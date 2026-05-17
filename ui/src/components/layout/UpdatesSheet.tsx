import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { BottomSheet } from "../dashboard/BottomSheet";
import { getPlugins, triggerSystemUpdate, updatePlugin } from "../../api";
import { useWebSocket } from "../../store/useWebSocket";
import { refreshPluginUpdateCount } from "./usePluginUpdates";
import type { PluginInfo, PluginManifest, PackageType } from "../../types";

interface UpdatesSheetProps {
  open: boolean;
  onClose: () => void;
}

const CORE_ROW_ID = "__core__";

function getManifestType(manifest: PluginManifest): PackageType {
  return manifest.type ?? "integration";
}

function getLocalizedName(manifest: PluginManifest, lang: string): string {
  return manifest.i18n?.[lang]?.name ?? manifest.name;
}

export function UpdatesSheet({ open, onClose }: UpdatesSheetProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] ?? "en";
  const coreUpdate = useWebSocket((s) => s.updateAvailable);
  const setUpdateInProgress = useWebSocket((s) => s.setUpdateInProgress);
  const [plugins, setPlugins] = useState<PluginInfo[] | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUpdatingId(null);
    setPlugins(null);
    getPlugins()
      .then((all) => setPlugins(all.filter((p) => p.latestVersion)))
      .catch(() => setPlugins([]));
  }, [open]);

  const outdated = plugins ?? [];
  const showCore = !!coreUpdate;
  const totalCount = outdated.length + (showCore ? 1 : 0);

  async function handleCoreUpdate() {
    if (!coreUpdate) return;
    setError(null);
    setUpdatingId(CORE_ROW_ID);
    try {
      await triggerSystemUpdate();
      // UpdateOverlay takes over from here.
      setUpdateInProgress(true);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("updates.error.generic"));
      setUpdatingId(null);
    }
  }

  async function handlePluginUpdate(id: string) {
    setError(null);
    setUpdatingId(id);
    try {
      await updatePlugin(id);
      // Plugin restart takes a moment — let the backend settle before refreshing the badge.
      await new Promise((r) => setTimeout(r, 1500));
      setPlugins((prev) => (prev ?? []).filter((p) => p.manifest.id !== id));
      refreshPluginUpdateCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("updates.error.generic"));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("updates.sheet.title")}
      icon={<RefreshCw size={18} strokeWidth={1.5} className="text-error" />}
    >
      {plugins === null ? (
        <div className="text-center text-text-tertiary text-[13px] py-6">
          {t("common.loading")}
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center text-text-tertiary text-[13px] py-6">
          {t("updates.sheet.empty")}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {showCore && coreUpdate && (
            <UpdateRow
              title="Sowel"
              kind="core"
              from={coreUpdate.current}
              to={coreUpdate.latest}
              loading={updatingId === CORE_ROW_ID}
              onUpdate={handleCoreUpdate}
            />
          )}
          {outdated.map((p) => (
            <UpdateRow
              key={p.manifest.id}
              title={getLocalizedName(p.manifest, lang)}
              kind={getManifestType(p.manifest)}
              from={p.manifest.version}
              to={p.latestVersion ?? ""}
              loading={updatingId === p.manifest.id}
              onUpdate={() => handlePluginUpdate(p.manifest.id)}
            />
          ))}
        </ul>
      )}
      {error && <div className="mt-3 text-[12px] text-error text-center">{error}</div>}
    </BottomSheet>
  );
}

interface UpdateRowProps {
  title: string;
  kind: "core" | PackageType;
  from: string;
  to: string;
  loading: boolean;
  onUpdate: () => void;
}

function UpdateRow({ title, kind, from, to, loading, onUpdate }: UpdateRowProps) {
  const { t } = useTranslation();
  const badge =
    kind === "core"
      ? null
      : kind === "recipe"
        ? t("updates.badge.recipe")
        : t("updates.badge.integration");

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] bg-border-light/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
          <span className="truncate">{title}</span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase bg-primary/10 text-primary">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-0.5">
          {t("updates.sheet.versions", { from, to })}
        </div>
      </div>
      <button
        onClick={onUpdate}
        disabled={loading}
        className="px-3 py-1.5 rounded-[6px] bg-primary text-white text-[12px] font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0"
      >
        {loading && <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />}
        {t("updates.action.update")}
      </button>
    </li>
  );
}
