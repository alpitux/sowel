#!/usr/bin/env node
// Backfill `sha256` and `owner` fields in plugins/registry.json (spec 089 C1).
// For each entry, fetch the latest GitHub release asset matching
// `sowel-*.tar.gz`, download it, compute SHA256, and update the JSON in place.
//
// Usage: node scripts/backfill-registry-sha256.mjs
//
// Idempotent: entries that already have a valid sha256 are skipped unless
// the env var FORCE=1 is set.

import { readFileSync, writeFileSync, createWriteStream, mkdtempSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REGISTRY_PATH = resolve(__dirname, "..", "plugins", "registry.json");
const SHA256_HEX = /^[a-f0-9]{64}$/i;

const force = process.env.FORCE === "1";

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
const tmpRoot = mkdtempSync(resolve(tmpdir(), "sowel-backfill-"));

let updated = 0;
let skipped = 0;
let failed = 0;

for (const entry of registry) {
  // Backfill owner if missing — derive from repo.
  if (!entry.owner && entry.repo) {
    entry.owner = entry.repo.split("/")[0];
    updated++;
    console.log(`  ${entry.id}: owner = ${entry.owner}`);
  }

  if (!force && entry.sha256 && SHA256_HEX.test(entry.sha256)) {
    skipped++;
    continue;
  }

  try {
    const apiUrl = `https://api.github.com/repos/${entry.repo}/releases/latest`;
    const releaseRes = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!releaseRes.ok) {
      console.warn(`  ${entry.id}: GitHub API ${releaseRes.status} for ${entry.repo}, skipping`);
      failed++;
      continue;
    }
    const release = await releaseRes.json();
    const asset = release.assets?.find(
      (a) => a.name.startsWith("sowel-") && a.name.endsWith(".tar.gz"),
    );
    if (!asset) {
      console.warn(`  ${entry.id}: no sowel-*.tar.gz asset in latest release of ${entry.repo}`);
      failed++;
      continue;
    }

    const tarballRes = await fetch(asset.browser_download_url);
    if (!tarballRes.ok || !tarballRes.body) {
      console.warn(`  ${entry.id}: download failed (${tarballRes.status})`);
      failed++;
      continue;
    }
    const tarballPath = resolve(tmpRoot, `${entry.id}.tar.gz`);
    await pipeline(tarballRes.body, createWriteStream(tarballPath));
    const sha256 = createHash("sha256")
      .update(readFileSync(tarballPath))
      .digest("hex");
    entry.sha256 = sha256;
    updated++;
    console.log(`  ${entry.id}: sha256 = ${sha256.slice(0, 16)}…`);
  } catch (err) {
    console.warn(`  ${entry.id}: ${err.message}`);
    failed++;
  }
}

writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
rmSync(tmpRoot, { recursive: true, force: true });

console.log("");
console.log(`Done: ${updated} updated, ${skipped} skipped, ${failed} failed.`);
if (failed > 0) {
  console.log("Some entries could not be hashed — they will be rejected at install time.");
  process.exit(1);
}
