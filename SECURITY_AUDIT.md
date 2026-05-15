# Audit de cybersécurité — Sowel

**Date** : 2026-05-03
**Périmètre** : authentification, API REST + WebSocket, système de plugins, gestion des secrets, stockage, packaging Docker
**Méthode** : revue statique de code (3 agents parallèles + relecture manuelle des findings critiques)
**Branche auditée** : `main` @ `7eeeea1` (release v1.5.2)

---

## 1. Synthèse exécutive

Sowel présente une **base saine** sur les fondamentaux de sécurité applicative (bcrypt cost 12, prepared statements, JWT + refresh token rotation, WAL SQLite, redaction des champs sensibles dans les logs).

Les **risques majeurs** se concentrent sur trois zones :

1. **La chaîne d'approvisionnement des plugins** — pas de vérification d'intégrité au téléchargement, le code tiers est exécuté avec les droits du process.
2. **Le système de backup** — path traversal possible au restore, secrets exportés en clair dans le ZIP.
3. **Le packaging runtime** — container en `root`, socket Docker monté en RW, CORS `*` par défaut, pas de headers de sécurité.

L'engine est conçu pour un LAN de confiance ; **l'exposition WAN actuelle** (`app.sowel.org` via Cloudflare tunnel) **amplifie matériellement plusieurs risques** qui seraient mineurs en réseau privé.

### Score

| Sévérité | Nombre |
| -------- | ------ |
| Critique | **3**  |
| Haute    | 6      |
| Moyenne  | ~10    |
| Basse    | ~6     |

> Note : 3 findings remontés initialement par les agents ont été reclassés après vérification manuelle (cf. § 6 Faux positifs).

---

## 2. Priorités d'action — TL;DR

Ordre **strict** d'exécution recommandé. Ne pas paralléliser P1 avec le reste : ce sont les seules failles avec impact RCE direct.

### 🔴 P1 — À traiter immédiatement (RCE / fuite de credentials)

| Ordre | Action                                                       | Finding | Effort |
| ----- | ------------------------------------------------------------ | ------- | ------ |
| **1** | Vérification SHA256 obligatoire des plugins avant `import()` | C1      | M      |
| **2** | Confiner `restoreBackup` (`startsWith(dataDir+sep)`)         | C2      | S      |
| **3** | Chiffrer le backup (passphrase utilisateur, AES-256-GCM)     | C3      | M      |

### 🟠 P2 — À traiter dans la foulée (durcissement runtime, blocage exposition WAN)

| Ordre | Action                                                                     | Finding | Effort |
| ----- | -------------------------------------------------------------------------- | ------- | ------ |
| **4** | `USER 1000` dans le Dockerfile + retirer docker.sock par défaut            | H1      | S      |
| **5** | Pinning d'image Docker par digest pour self-update                         | H2      | S      |
| **6** | `npm audit fix` + ajout en CI (Fastify ≥5.9, `@fastify/static`, `esbuild`) | H6      | S      |
| **7** | `@fastify/helmet` + CORS défaut `localhost` (whitelist explicite)          | H3      | S      |
| **8** | WS auth via header `Authorization` + validation `Origin`                   | H4      | M      |
| **9** | Authentification sur routes oubliées (`/devices/suggest`, etc.)            | H5      | S      |

### 🟡 P3 — Hardening de fond (semaines suivantes)

| Ordre  | Action                                                                    | Effort |
| ------ | ------------------------------------------------------------------------- | ------ |
| **10** | Validation Zod centralisée sur toutes les routes mutables                 | M      |
| **11** | Chiffrement secrets en SQLite (clé hors backup)                           | L      |
| **12** | `algorithm: 'HS256'` explicite sur `jwt.sign/verify`                      | XS     |
| **13** | Refresh token TTL 30j → 7-14j                                             | XS     |
| **14** | Filtrage WS par rôle, rate-limit `/auth/setup` et WS                      | M      |
| **15** | Tar extraction avec flags durs (`--no-absolute-names`, `--no-same-owner`) | XS     |
| **16** | Mot de passe min 6 → 8 (idéalement 12)                                    | XS     |

### 🟢 P4 — Dette de sécurité (à planifier)

| Ordre  | Action                                                                        |
| ------ | ----------------------------------------------------------------------------- |
| **17** | Plan de dépréciation préfixes tokens legacy (`wch_`, `cbl_`)                  |
| **18** | Helper webhook sécurisé (blockliste IP privées) avant ajout webhooks/ntfy/FCM |
| **19** | Sanitisation `err.message` dans les réponses 500                              |
| **20** | Signature GPG/cosign optionnelle des plugins (en complément du SHA256)        |

> **Effort** : XS (<1h) · S (½ journée) · M (1-2 jours) · L (>2 jours)

---

## 3. Findings critiques

### C1 — Plugin RCE via package non vérifié

**Fichier** : [src/packages/package-manager.ts:460-512](src/packages/package-manager.ts#L460-L512)

Le téléchargement d'un plugin depuis GitHub (`browser_download_url`), l'extraction `tar.gz` puis l'`import()` dynamique du code se fait **sans checksum, sans signature, sans pinning de version**. Si un compte mainteneur de plugin est compromis — ou si le registry pointe vers un repo hostile — le code malveillant s'exécute avec les droits du process Sowel : accès MQTT, base SQLite, InfluxDB, secrets, et docker.sock (cf. H1).

**Impact** : RCE complète du host.
**Recommandation** : SHA256 obligatoire dans le manifest du plugin, vérifié avant extraction. Signature GPG/cosign optionnelle. TLS strict sur les fetches GitHub.

---

### C2 — Path traversal dans le restore backup

**Fichier** : [src/backup/backup-manager.ts:425-438](src/backup/backup-manager.ts#L425-L438)

```ts
if (!entry.entryName.startsWith("data/") || entry.isDirectory) continue;
const filename = entry.entryName.slice("data/".length);
// ...
const filePath = resolve(this.dataDir, filename);
writeFileSync(filePath, entry.getData());
```

`path.resolve()` **ne confine pas** : un ZIP malicieux avec `data/../../etc/cron.d/sowel-rce` produit un chemin hors `dataDir` et `writeFileSync` écrit avec les droits du process. Combiné à C2bis (container root), c'est une RCE par upload de backup.

**Impact** : RCE par utilisateur authentifié admin.
**Recommandation** :

```ts
const p = resolve(dataDir, filename);
if (!p.startsWith(dataDir + sep)) throw new Error("path traversal blocked");
```

Ajouter une whitelist d'extensions autorisées sous `data/`.

---

### C3 — Secrets exportés en clair dans le backup

**Fichier** : [src/backup/backup-manager.ts:131-152](src/backup/backup-manager.ts#L131-L152)

`SELECT * FROM ${table}` est exécuté sur toutes les tables, dont `settings` qui contient :

- mots de passe MQTT
- tokens d'API cloud (Panasonic Comfort Cloud, etc.)
- tokens Telegram, FCM, ntfy
- hashes utilisateurs (bcrypt — moins grave mais présent)

Le tout est sérialisé en JSON et embarqué dans un ZIP **non chiffré**. Quiconque récupère un backup (clé USB perdue, partage cloud, fuite de `data/backups/`) obtient toutes les credentials de l'installation.

**Impact** : compromission de toutes les intégrations en cas de fuite du backup.
**Recommandation** : chiffrer le backup avec une passphrase utilisateur (AES-256-GCM, dérivation argon2id). Alternative : exclure les champs marqués `sensitive` du settings-manager et les chiffrer séparément avec une clé hors backup.

---

## 4. Findings hautes

> **Mise à jour 2026-05-15** : les findings résolus par la spec 105 (v1.7.0) sont marqués `[x]`. Voir [SECURITY_AUDIT_WAN.md](SECURITY_AUDIT_WAN.md) pour la matrice WAN complète.

| État | #   | Vulnérabilité                                                | Fichier                                                                    | Recommandation                                                                            |
| ---- | --- | ------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [x]  | H1  | **Container Docker en root + docker.sock en RW**             | [Dockerfile](Dockerfile), [docker-compose.yml:25](docker-compose.yml#L25)  | `USER 1000`, retirer docker.sock par défaut (opt-in self-update)                          |
| [ ]  | H2  | **Auto-update sans pinning d'image digest**                  | [src/core/update-manager.ts:248-272](src/core/update-manager.ts#L248-L272) | Vérifier `image_digest` du manifest release, puller `@sha256:...`                         |
| [x]  | H3  | **Aucun header de sécurité** (pas de helmet)                 | [src/api/server.ts:139-160](src/api/server.ts#L139-L160)                   | `@fastify/helmet` avec CSP, HSTS, X-Frame-Options DENY                                    |
| [x]  | H4  | **WS auth via query param** `?token=…`                       | [src/api/websocket.ts:168-187](src/api/websocket.ts#L168-L187)             | Authorization header sur upgrade, valider `Origin`                                        |
| [x]  | H5  | **Routes non authentifiées** (ex. `/api/v1/devices/suggest`) | [src/api/routes/devices.ts:57](src/api/routes/devices.ts#L57)              | Ajouter check `request.auth`                                                              |
| [ ]  | H6  | **Dépendances vulnérables**                                  | [package.json](package.json)                                               | `npm audit fix` + ajout en CI ; Fastify `>=5.9`, mise à jour `@fastify/static`, `esbuild` |

---

## 5. Findings moyennes (extraits)

- **CORS `*` par défaut** ([src/config.ts:92](src/config.ts#L92)) — défaut à `localhost`, whitelist explicite (sévérité dépend de l'exposition WAN).
- **Pas de validation Zod / JSON Schema** sur les routes mutables → injection de types ; `repo` plugin non regex-validé.
- **`err.message` brut** renvoyé en réponse 500 dans [src/api/routes/plugins.ts](src/api/routes/plugins.ts) et [src/api/routes/integrations.ts](src/api/routes/integrations.ts) → fuite de paths/stack.
- **Refresh token TTL 30 jours** ([src/config.ts:86](src/config.ts#L86)) → fenêtre de rejeu longue. Cibler 7-14 jours.
- **WS broadcast non filtré par rôle** ([src/api/websocket.ts:129-140](src/api/websocket.ts#L129-L140)) — un viewer reçoit tout.
- **Tar extraction sans flags durs** (`--no-absolute-names`, `--no-same-owner`) sur [src/packages/package-manager.ts:504](src/packages/package-manager.ts#L504).
- **Préfixes tokens legacy** `wch_`/`cbl_` toujours acceptés sans roadmap de retrait ([src/auth/auth-middleware.ts:75-76](src/auth/auth-middleware.ts#L75-L76)).
- **Pas de rate-limit** sur WS et sur `/auth/setup`.
- **Tokens Telegram potentiellement loggués** sur erreur ([src/notifications/channels/telegram.ts](src/notifications/channels/telegram.ts)).
- **Mot de passe minimum 6 caractères** ([src/auth/auth-routes.ts:33-34](src/auth/auth-routes.ts#L33-L34)) — passer à 8 minimum, idéalement 12.

---

## 6. Faux positifs / findings reclassés après vérification

Trois points remontés par les agents ont été **invalidés ou nuancés** lors de la relecture manuelle :

| Reclassé                                                                                                        | Raison                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~Path traversal SPA fallback~~ ([src/api/server.ts:256](src/api/server.ts#L256))                               | `fastifyStatic` est enregistré juste au-dessus avec `root: uiDir` ; `reply.sendFile` confine via la lib `send` qui rejette les `..`. **Non exploitable** en l'état (à confirmer par un test `curl '/../../package.json'`). |
| ~~Token API : pas de timing-safe equal~~ ([src/auth/auth-service.ts:188](src/auth/auth-service.ts#L188))        | Le code calcule `sha256(token)` puis fait un lookup SQLite **indexé** par hash exact. Aucun comparateur byte-par-byte exploitable, le SHA256 est constant en temps. **Pas de canal timing**.                               |
| ~~Injection SQL dans restore~~ ([src/backup/backup-manager.ts:321-328](src/backup/backup-manager.ts#L321-L328)) | À revérifier ; les noms de tables proviennent de `BACKUP_TABLES` (constante interne), pas du backup utilisateur. Probablement non exploitable.                                                                             |

> Leçon : les rapports d'agents doivent toujours être relus, en particulier les findings de type "comparaison non timing-safe" et "path traversal sur framework" qui sont souvent surestimés.

---

## 7. Points positifs relevés

- Bcrypt cost 12 (conforme OWASP).
- Refresh token rotation implémentée.
- Prepared statements partout sur SQLite (better-sqlite3).
- WAL mode activé.
- Logger pino avec redaction automatique des champs sensibles (`password`, `token`, `secret`, `apiKey`).
- Prévention de la suppression du dernier admin.
- Validation JSON schema sur les payloads de backup.
- API tokens préfixés `swl_` avec entropie 256 bits (`randomBytes(32)`).

---

## 8. Posture de sécurité d'ensemble

Sowel est un projet **bien conçu pour un usage LAN privé**. Les vulnérabilités critiques relèvent toutes d'**hypothèses runtime trop permissives** (container root, plugin tiers de confiance, backup stocké en clair) plutôt que de défauts de codage classiques (pas d'injection SQL flagrante, pas d'XSS évident, pas de fuite de mémoire).

L'exposition WAN actuelle via Cloudflare tunnel transforme plusieurs findings de "moyens en LAN" à "critiques en WAN". **Recommandation forte** : adresser au minimum les priorités P1 et P2 avant tout élargissement de l'exposition publique.
