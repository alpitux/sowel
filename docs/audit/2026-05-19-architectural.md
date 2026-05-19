# Audit architectural et documentaire de Sowel

Date : 2026-05-19. Périmètre : architecture backend, frontend, plugins, tests, sécurité, data model, documentation, specs. Méthode : exploration multi-agents, lecture directe des sources et des migrations, vérification croisée des affirmations.

---

## 1. Synthèse exécutive

### 1.1 Findings prioritaires (Top 20)

| #   | Finding                                                                                                                                                              | Sévérité     | Effort | Catégorie ISO 25010 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ | ------------------- |
| F01 | Secrets de plugins (MQTT, API clouds, tokens) stockés en clair dans `settings` _(accepté, voir 1.4)_                                                                 | **Critical** | M      | Security            |
| F02 | Isolation plugin inexistante : un plugin lit les settings des autres et émet tout event _(soft isolation livrée par spec 111, active sans condition depuis v1.11.0)_ | **High**     | L      | Security            |
| F03 | Aucun handler `uncaughtException` / `unhandledRejection` (process peut mourir sans trace)                                                                            | **High**     | S      | Reliability         |
| F04 | Backup ZIP non chiffré, contient secrets et tokens hachés                                                                                                            | **High**     | S      | Security            |
| F05 | Drift `docs/specs-index.md` : 76 specs sur 111 absentes de l'index (FR uniquement parfois)                                                                           | **High**     | M      | Maintainability     |
| F06 | Pages doc clés non alignées avec spec 089 (sécurité supply chain) et spec 110 (category)                                                                             | **High**     | S      | Maintainability     |
| F07 | Asymétrie `EquipmentType` vs `DataCategory` : recettes contraintes sur le type technique                                                                             | **High**     | L      | Maintainability     |
| F08 | God components UI : 4 fichiers > 1000 LOC dont `ZoneRecipesSection.tsx` à 2013 LOC                                                                                   | **High**     | L      | Maintainability     |
| F09 | Couverture de tests UI quasi-nulle (1 test sur 156 fichiers TSX)                                                                                                     | **High**     | L      | Reliability         |
| F10 | `Energy API routes` non migrés vers category-first (8 endroits hardcodent les alias)                                                                                 | Medium       | M      | Maintainability     |
| F11 | EventBus : handlers synchrones et bloquants, pas de timeout ni de monitoring slow handler                                                                            | Medium       | M      | Performance         |
| F12 | Pas de chiffrement at-rest sur SQLite ni rotation des secrets JWT                                                                                                    | Medium       | M      | Security            |
| F13 | Aucun audit trail (login, création tokens, changement settings, changement mode)                                                                                     | Medium       | S      | Security            |
| F14 | 31 specs incomplètes (manque architecture.md ou plan.md) sur 111 au total                                                                                            | Medium       | M      | Maintainability     |
| F15 | InfluxDB write failures silencieusement avalées dans plusieurs catch                                                                                                 | Medium       | S      | Reliability         |
| F16 | Pas de schémas JSON validés pour les blobs JSON en DB (`raw_expose`, `params`, etc.)                                                                                 | Medium       | M      | Reliability         |
| F17 | `Settings.set()` non transactionnel, race condition possible sur écritures concurrentes                                                                              | Medium       | S      | Reliability         |
| F18 | Pas de glossaire ni d'ADR : décisions et terminologie dispersées dans 80+ specs                                                                                      | Medium       | M      | Maintainability     |
| F19 | Aucun lazy-loading React, bundle UI monolithique, pas de code splitting                                                                                              | Medium       | M      | Performance         |
| F20 | Plugins ne déclarent pas leurs catégories (extensibilité bloquée par hard-mapping core)                                                                              | Medium       | L      | Scalability         |

Légende : **Critical** = défaut bloquant ou risque de fuite/incident immédiat. **High** = dégrade fortement la maintenabilité ou expose à un risque structurel. **Medium** = à corriger sur la roadmap, pas urgent en soi. Effort : S < 1 jour, M = quelques jours, L = chantier (semaine+).

### 1.2 Score par caractéristique ISO 25010

| Caractéristique     | Score   | Justification courte                                                                                                       |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Reliability**     | 3.5 / 5 | Pipeline réactif robuste, EventBus bien typé, mais pas de filets de sécurité process et catches silencieux sur InfluxDB    |
| **Security**        | 2.5 / 5 | Bonnes pratiques sur auth (bcrypt, JWT, SHA256 plugins, rate-limit auth), mais secrets en clair et plugin isolation absent |
| **Maintainability** | 3.5 / 5 | Modules clairs, types disciplinés, CLAUDE.md exemplaire, mais god components, drift specs-index et asymétries category     |
| **Performance**     | 3.5 / 5 | better-sqlite3 + WAL + InfluxDB downsampling efficaces, mais handlers bloquants et pas de code splitting UI                |
| **Scalability**     | 3 / 5   | Architecture plugin externe est saine, mais contrat plugin non extensible côté catégories et pas de sandbox                |

**Score global pondéré : 3.2 / 5** : projet mature, solide sur le coeur métier, fragile sur les bords (sécurité runtime, UI géants, documentation décalée).

### 1.3 En une phrase

> Sowel est une architecture domaine bien pensée et largement aboutie sur le pipeline réactif et la modélisation Device/Equipment/Zone/Recipe, qui paye sa maturité par une dette périphérique : la couche plugin reste non isolée, les secrets vivent en clair, l'UI a accumulé des composants monolithiques, et la documentation technique a divergé de la réalité sur les deux refactors les plus récents (catégorie-first spec 110, supply chain spec 089).

### 1.4 Risques acceptés

**F01 (secrets en clair dans `settings`)** : risque connu et accepté en l'état au 2026-05-19. Justification : Sowel est au même niveau que Home Assistant sur ce point (HA stocke aussi les credentials d'intégrations en clair dans `.storage/core.config_entries`, seul le backup propose une encryption optionnelle depuis 2024). La menace dominante reste l'accès filesystem à la VM Sowelox ou le partage non protégé d'un backup ZIP, deux vecteurs hors du modèle de menace courant pour de l'auto-hébergement passif. À réévaluer si : (a) une exposition réseau directe est ajoutée, (b) un incident terrain remonte, (c) une feature "cloud sync" ou "backup distant" est introduite. Une spec future pourra adresser le sujet (chiffrement AES-GCM côté `SettingsManager` + backup avec passphrase), mais ce n'est pas une priorité immédiate.

### 1.5 Mitigations livrées depuis l'audit

**F02 (isolation plugin)** : adressée partiellement par la **spec 111 (plugin soft isolation)**, livrée en v1.11.0 (2026-05-19). Les Proxies enforcent quatre invariants au niveau JavaScript : scoping settings sur `integration.<own-id>.`, whitelist des `system.*` events, ownership devices forcée par `integrationId`, et confinement des erreurs via `wrapPluginMethods`. L'isolation est unconditionnelle (pas de flag opt-out) après validation locale sur les 13 plugins de la registry. Six vecteurs résiduels restent (lecture directe DB via `better-sqlite3`, `process.env`, boucles infinies, prototype pollution, `fetch` arbitraire, `process.exit`) : ils relèveraient d'une vraie hard isolation (worker_threads) qui imposerait une v2 du contrat plugin et reste hors scope tant que la registry n'accueille que des owners de confiance.

---

## 2. Audit du concept "Catégorie" (sujet phare)

### 2.1 État

Le concept est **architecturé proprement au coeur** mais **non normalisé sur l'ensemble du projet**. Il existe trois enums sémantiques dans [src/shared/types.ts](src/shared/types.ts) :

- `DataCategory` (49 valeurs : motion, temperature, light_state, shutter_position, energy, etc.), lignes 7 à 49
- `OrderCategory` (16 valeurs : light_toggle, set_brightness, shutter_move, etc.), lignes 51 à 67
- `EquipmentType` (light_onoff, light_dimmable, shutter, sensor, thermostat, etc.), lignes 183 à 204

Notable : il n'existe **pas** de `DeviceCategory`, `EquipmentCategory` ni `RecipeCategory`. La catégorie est portée par `DeviceData.category` et `DeviceOrder.category`, donc par les bindings, jamais directement par l'équipement.

### 2.2 Ce qui est migré (Spec 110)

La PR #202 (commits 6ac996c, e15740b, da6914a) a livré les resolvers category-first :

- [src/equipments/binding-resolver.ts](src/equipments/binding-resolver.ts) : `findOrderByCategory`, `findDataByCategory` avec fallback alias/regex et tests dédiés
- [src/recipes/engine/light-helpers.ts](src/recipes/engine/light-helpers.ts) : `isAnyLightOn`, `resolveToggleOrder`, `turnOnLights`, `setLightsBrightness` migrées sur catégorie
- [ui/src/components/equipments/bindingUtils.ts](ui/src/components/equipments/bindingUtils.ts) : twin UI identique côté React
- [src/history/history-writer.ts](src/history/history-writer.ts) : `CATEGORY_DEFAULTS_ON` Set qui pilote l'historisation par catégorie
- [src/zones/zone-aggregator.ts](src/zones/zone-aggregator.ts) (lignes 489 à 570) : agrégations par catégorie
- [src/activity/activity-buffer.ts](src/activity/activity-buffer.ts) (lignes 152 à 173) : filtres et event types par catégorie

### 2.3 Ce qui ne l'est pas

**Energy** ([src/api/routes/energy.ts](src/api/routes/energy.ts), 759 LOC) : 8 endroits filtrent sur des alias hardcodés ("energy", "energy_hp", "energy_hc", "autoconso", "injection") aux lignes 436, 464, 507, 549, 577, 622, 665, 694, sans fallback catégorie. Même chose dans [src/energy/energy-aggregator.ts](src/energy/energy-aggregator.ts) ligne 94 qui fait `binding.alias === "energy" && binding.category === "energy"` (double vérification non-idéale).

**Recettes** : les `RecipeSlotDef` ([src/shared/types.ts](src/shared/types.ts) lignes 321 à 341) contraignent sur `equipmentType: EquipmentType | EquipmentType[]`. Conséquence : `motion-light` doit énumérer `light_onoff | light_dimmable | light_color` au lieu de dire "n'importe quelle lumière". Cela force aussi des recettes jumelles (`motion-light` et `motion-light-dimmable`) qui pourraient n'être qu'une seule.

**Plugins** : aucun mécanisme pour qu'un plugin déclare ses catégories dans son manifest. Toute nouvelle propriété Zigbee2MQTT doit être ajoutée manuellement à [src/shared/constants.ts](src/shared/constants.ts) (`PROPERTY_TO_CATEGORY`). Ce point cap le caractère "plug and play" promis par la spec 053.

**Equipment** : pas de `category` au niveau Equipment, asymétrie avec les bindings qui en portent une. La logique `category_override` dans [src/equipments/equipment-manager.ts](src/equipments/equipment-manager.ts) (lignes 200 à 204, 412 à 424, 559 à 591) compense pour les cas piscine mais ajoute de la complexité.

### 2.4 Score concept catégorie

| Critère                  | Score |
| ------------------------ | ----- |
| Source unique de vérité  | 5/5   |
| Inférence automatique    | 5/5   |
| Core resolvers           | 5/5   |
| Adoption backend         | 4/5   |
| Adoption frontend        | 4/5   |
| Recettes (constraints)   | 3/5   |
| Extensibilité plugin     | 2/5   |
| Type safety bout en bout | 3/5   |
| Documentation            | 2/5   |
| Cohérence Equipment/Type | 2/5   |

**Maturité globale du concept : 3.5 / 5**. Le travail spec 110 a fait le plus dur, mais il reste deux chantiers structurants : (1) introduire `EquipmentCategory` ou faire contraindre les recettes sur `OrderCategory`/`DataCategory`, (2) ouvrir aux plugins la possibilité de déclarer de nouvelles catégories.

---

## 3. Architecture et système de plugins

### 3.1 Forces

**EventBus** ([src/core/event-bus.ts](src/core/event-bus.ts)) : entièrement typé en discriminated union `EngineEvent` ([src/shared/types.ts](src/shared/types.ts) ligne 582+), handlers wrappés en try/catch, `maxListeners` à 50. Tests présents et significatifs ([src/core/event-bus.test.ts](src/core/event-bus.test.ts)).

**Modules** : pas de dépendance circulaire détectée. Hiérarchie respectée : `core` ne dépend de rien de métier, `devices` -> `equipments` -> `recipes` est bien orienté, `api` consomme les managers (correct pour une couche présentation).

**Migrations** : 9 migrations séquentielles (001 à 009), tracking via table `_migrations`, WAL activé.

**Sécurité supply chain (spec 089)** : SHA256 vérifié à l'install ([src/packages/package-manager.ts](src/packages/package-manager.ts) lignes 210 à 212, 280 à 281, 338 à 339), `OFFICIAL_OWNERS` confirmé dans [src/packages/registry-types.ts](src/packages/registry-types.ts) ligne 12, modal explicite pour plugins communautaires.

**Authentification** : bcrypt cost 12, JWT HS256, refresh token rotation, API tokens stockés hachés (SHA256). Rate-limit appliqué sur `/auth` via `@fastify/rate-limit` ([src/api/routes/auth.ts](src/api/routes/auth.ts) ligne 55) : 10 requêtes / minute.

### 3.2 Faiblesses

**Isolation plugin nulle** : [src/shared/plugin-api.ts](src/shared/plugin-api.ts) lignes 7 à 15 expose `eventBus`, `settingsManager`, `deviceManager` et `pluginDir` directement. Un plugin malveillant ou buggé peut :

- Lire les settings de tous les autres plugins via `settingsManager.getByPrefix("integration.")`
- Émettre des events système arbitraires (`eventBus.emit("equipment.data.changed", ...)`)
- Faire planter le process via `throw` non rattrapé dans un handler async
- Accéder au filesystem hors de son `pluginDir`
- Faire des appels réseau quelconques

Pour un système qui distribue désormais tout en plugins (spec 053), c'est l'écart le plus structurel.

**Pas de filet process** : aucun `process.on("uncaughtException")` ni `process.on("unhandledRejection")` détecté dans `src/`. En production, un throw non rattrapé tue le process sans trace utile, et docker redémarre en aveugle.

**EventBus bloquant** : handlers synchrones, pas de timeout. Un zone aggregator lent sur 100 zones bloque la propagation. Pas de métrique latence par handler.

**Catch silencieux sur InfluxDB** : [src/core/influx-client.ts](src/core/influx-client.ts) (lignes 131, 397, 423, 522 selon l'audit) avale des erreurs d'écriture. Les données énergie peuvent disparaître sans alerte.

**Concurrence** :

- `SettingsManager.set()` ([src/core/settings-manager.ts](src/core/settings-manager.ts) lignes 51 à 59) n'est pas en transaction (seul `setMany` l'est).
- `pendingToggles` Set dans equipment-manager n'a pas de verrou (race possible sur gate, mais finalement résolue par device update).

**Custom errors partiels** : `EquipmentError`, `ChecksumMismatchError`, `CommunityPluginConfirmationRequiredError` existent mais 80% des throw sont des `Error("string")` génériques, qui rendent le filtrage côté API plus pénible.

### 3.3 Top 5 risques architecture

1. **Plugin isolation absente** ([src/shared/plugin-api.ts](src/shared/plugin-api.ts)) : Critical / Effort L
2. **Pas de filet uncaughtException** ([src/index.ts](src/index.ts)) : High / Effort S
3. **InfluxDB silent catches** ([src/core/influx-client.ts](src/core/influx-client.ts)) : Medium / Effort S
4. **Settings.set() race condition** ([src/core/settings-manager.ts](src/core/settings-manager.ts) ligne 51) : Medium / Effort S
5. **EventBus pas de timeout/observabilité** ([src/core/event-bus.ts](src/core/event-bus.ts)) : Medium / Effort M

---

## 4. Sécurité et secrets

### 4.1 Forces

- Supply chain (spec 089) : SHA256 + owner whitelist + community modal, tests présents dans [src/packages/package-manager.test.ts](src/packages/package-manager.test.ts) (cas `OFFICIAL_OWNERS` à la ligne 338)
- Auth : bcrypt 12, JWT HS256, refresh rotation, redaction pino auto sur `password`, `token`, `secret`, `apiKey`
- Rate-limit : `@fastify/rate-limit` enregistré globalement dans [src/api/server.ts](src/api/server.ts) ligne 198 et durci à 10/min sur `/auth/login`
- HTTPS détectable via `req.socket.encrypted` dans [src/api/server.ts](src/api/server.ts) ligne 190 (utile en cas de cloudflared)

### 4.2 Faiblesses

**Aucun chiffrement at-rest dans le code** : `grep encrypt|decrypt|cipher|AES` dans `src/` ne retourne que la ligne de détection HTTPS. Toutes les valeurs `integration.<id>.<key>` (MQTT URL, password, API keys Panasonic, Netatmo, etc.) sont en clair dans la table `settings`.

**Impact** : un dump SQLite (backup volé, accès filesystem) ou un fork malveillant de Sowel donne accès direct à tous les comptes domotiques de l'utilisateur. Vu que le projet vise le grand public (Sowelox VM auto-hébergée), c'est le risque numéro un.

**Backups ZIP non chiffrés** : [src/backup/backup-manager.ts](src/backup/backup-manager.ts) (684 LOC) exporte la DB et les manifests sans chiffrement. Les `.zip` se baladent dans `data/backups/` puis sont parfois envoyés vers un drive personnel.

**Pas d'audit trail** : aucune table `audit_log`. Login, logout, création/suppression de tokens, changements de mode, changements de settings ne sont pas tracés. En cas d'incident, impossible de reconstruire le "qui a fait quoi quand".

**Pas de rotation JWT** : un secret JWT changé invalide tous les tokens d'un coup, pas de graceful rotation.

**HTTPS local optionnel** : pas de redirect HTTP -> HTTPS dans le code, repose sur cloudflared en prod.

### 4.3 Recommandations sécurité

1. (M, Security) Chiffrer les valeurs sensibles de la table `settings` avec une clé dérivée d'un secret env (`SOWEL_SECRET_KEY`). Migration de schema simple : nouvelle colonne `encrypted INTEGER DEFAULT 0`. Wrapper transparent dans `SettingsManager`.
2. (S, Security) Chiffrer les backups ZIP avec passphrase utilisateur, ajouter une checkbox dans l'UI.
3. (S, Security) Ajouter table `audit_log(timestamp, actor, action, target_type, target_id, meta JSON)` et logger auth + token + settings + mode.
4. (S, Reliability) Ajouter `process.on("uncaughtException")` et `process.on("unhandledRejection")` avec logger.fatal puis exit propre.

---

## 5. Frontend (ui/)

### 5.1 Forces

- Design system formalisé : tokens CSS dans `design-system/tokens.css` + Tailwind v4 + dark mode via classe `.dark`
- i18n complet en/fr via i18next, fichiers JSON pairés
- WebSocket résilient avec backoff exponentiel
- ErrorBoundary défini

### 5.2 Faiblesses

**God components confirmés** (top 10 mesuré) :

| Fichier                                                                                                | LOC  |
| ------------------------------------------------------------------------------------------------------ | ---- |
| [ui/src/components/recipes/ZoneRecipesSection.tsx](ui/src/components/recipes/ZoneRecipesSection.tsx)   | 2013 |
| [ui/src/pages/MqttPublishersPage.tsx](ui/src/pages/MqttPublishersPage.tsx)                             | 1303 |
| [ui/src/api.ts](ui/src/api.ts)                                                                         | 1296 |
| [ui/src/components/dashboard/EquipmentWidget.tsx](ui/src/components/dashboard/EquipmentWidget.tsx)     | 1140 |
| [ui/src/components/dashboard/WidgetDetailSheet.tsx](ui/src/components/dashboard/WidgetDetailSheet.tsx) | 1136 |
| [ui/src/pages/SettingsPage.tsx](ui/src/pages/SettingsPage.tsx)                                         | 1131 |
| [ui/src/pages/NotificationPublishersPage.tsx](ui/src/pages/NotificationPublishersPage.tsx)             | 1089 |
| [ui/src/components/dashboard/WidgetIcons.tsx](ui/src/components/dashboard/WidgetIcons.tsx)             | 1078 |
| [ui/src/types.ts](ui/src/types.ts)                                                                     | 915  |
| [ui/src/components/home/ZoneModesSection.tsx](ui/src/components/home/ZoneModesSection.tsx)             | 910  |

7 fichiers dépassent 900 LOC, dont 4 dépassent 1000 LOC. Aucun n'a de test. Maintenir ces fichiers devient progressivement risqué : tout changement local nécessite de relire l'intégralité.

**ErrorBoundary défini mais non utilisé** : la classe existe mais n'est pas wrappée autour des pages clés. En cas de throw dans `ZoneRecipesSection` la page entière s'écroule.

**Accessibilité faible** : seulement 14 occurrences `aria-*` dans `ui/src/components/`. Pas de focus management documenté.

**Pas de code splitting** : aucun `React.lazy()` ni `import()` dynamique. Toute l'app est bundlée en un chunk, pénalisant le first paint mobile.

**CSS custom et couleurs hardcodées** : 320 lignes de CSS dans `index.css`, plus quelques `#D4963F` / `#1A4F6E` en dur dans `TimeSeriesChart.tsx` et `AnalyseView.tsx`, alors que les tokens existent dans le design system.

**Duplication front/back de types** : [ui/src/types.ts](ui/src/types.ts) (915 LOC) duplique [src/shared/types.ts](src/shared/types.ts) (1081 LOC). Pas de single source of truth ni de generation automatique. Chaque ajout de champ doit être propagé manuellement.

### 5.3 Top 5 risques UI

1. **God components** sur `ZoneRecipesSection`, `EquipmentWidget`, `WidgetDetailSheet` : High / Effort L
2. **ErrorBoundary non utilisé** : High / Effort S
3. **Duplication types front/back** (1996 LOC dupliquées) : Medium / Effort M
4. **Pas de tests UI** (1 / 156 fichiers) : High / Effort L
5. **Pas de code splitting** : Medium / Effort M

---

## 6. Tests

### 6.1 Chiffres mesurés

- **31** fichiers `.test.ts` côté backend pour 84 fichiers `src/*.ts` (37%)
- **1** fichier de test côté frontend pour 156 fichiers TSX/TS (0.6%)
- 844 cas de test au total (Vitest)
- Coverage non rapportée (pas de `--coverage` dans la CI)

### 6.2 Modules backend critiques sans test

- [src/history/](src/history/) : `HistoryWriter`, `HistoryQuery` (473 LOC), intégrité InfluxDB
- [src/notifications/](src/notifications/) : publishers Telegram, webhook, FCM, ntfy
- [src/recipes/recipe-loader.ts](src/recipes/recipe-loader.ts) : chargement des plugins recettes
- [src/charts/](src/charts/) : configurations sauvegardées
- [src/weather/](src/weather/) : agrégation météo
- [src/shared/types.ts](src/shared/types.ts) (1081 LOC) : aucun test de validation runtime

Les modules les plus volumineux ont une couverture limitée : [src/equipments/equipment-manager.ts](src/equipments/equipment-manager.ts) (1282 LOC) n'a que 5 cas de test, [src/devices/device-manager.ts](src/devices/device-manager.ts) (802 LOC) en a 2.

### 6.3 Risques tests

1. **Frontend non testé** : régression silencieuse possible à chaque PR. Effort de mise en place : moyen (vitest + @testing-library/react déjà compatibles).
2. **InfluxDB writes** : si les écritures échouent silencieusement (catch swallow constaté), l'absence de tests garantit qu'on ne s'en aperçoit qu'au moment de regarder un graphe vide.
3. **Recipe loader** : entrée principale du contrat plugin recette, non testée.

---

## 7. Data model

### 7.1 Forces

- 9 migrations propres, séquentielles, avec tracking
- UUID v4 + ISO 8601 partout
- InfluxDB 3 buckets avec downsampling auto (raw 7j, hourly 2 ans, daily 10 ans)
- API tokens hachés (SHA256), bcrypt cost 12 pour passwords
- Foreign keys et indexes pertinents

### 7.2 Faiblesses

**Blobs JSON non validés** : `raw_expose` (devices), `dispatch_config` (device_orders), `params` (recipe_instances) sont stockés en JSON brut sans schéma. En cas de changement de format plugin, aucun garde-fou.

**Schema_version manquante** : seul `count(*)` des migrations sert de version. Impossible de détecter une migration manquée (par exemple si l'utilisateur restaure un backup pré-009).

**Backup partiel** : InfluxDB est exporté séparément via l'API InfluxDB, les plugins ne sont pas exportés avec leurs sources (re-download requis), les logs sont exclus du backup.

**Pas de chiffrement at-rest** : voir section 4.

**Duplication types front/back** : voir section 5.

### 7.3 Cohérence "Equipment vs Type vs Category"

Asymétrie déjà mentionnée. L'équipement porte un `type` technique (`light_onoff`), les bindings portent une `category` sémantique (`light_state`, `light_toggle`). Une recette doit se contraindre sur le type, alors qu'elle agit sur la catégorie. C'est exactement l'écart qui motive la spec 110 mais n'a pas encore été traité au niveau RecipeSlotDef.

---

## 8. Documentation

### 8.1 Cartographie

- `docs/technical/` : 8 pages clés, toutes pairées EN/FR
- `docs/user/` : 18 fichiers, pairés EN/FR
- `docs/release-notes.md` et `.fr.md` avec ancres `{ #vX-Y-Z }` obligatoires
- `docs/_legacy/` : 11 fichiers, dont `plugin-development.md` (1020 lignes) totalement obsolète
- `docs/sowel-spec.md` : **112 830 octets**, marqué obsolète dans CLAUDE.md mais toujours présent

### 8.2 Drift mesuré contre code

| Page                  | Drift                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| plugin-development.md | Ne mentionne **pas** spec 089 (SHA256 / OFFICIAL_OWNERS / workflow registry). Un plugin tiers publié aujourd'hui en suivant la doc échouera à l'install                              |
| recipe-development.md | Ne mentionne **pas** spec 110 (binding-resolver, light-helpers). Les patterns décrits sont les patterns alias-first d'avant mai 2026                                                 |
| data-model.md         | Ne couvre pas migrations 006 à 009 (pool_runtime, category_override, pool_water_temp_state, submeter_integrator_state)                                                               |
| architecture.md       | Parle encore de "built-in recipes" alors que spec 054 a tout externalisé                                                                                                             |
| docs/specs-index.md   | **76 specs manquantes sur 111** d'après le grep effectué (001 à 040 quasi toutes absentes, plus la majorité des récentes). L'index n'est pas un index, c'est une sélection partielle |
| docs/sowel-spec.md    | 112 ko de legacy non supprimé malgré l'avertissement CLAUDE.md                                                                                                                       |

### 8.3 Specs incomplètes

31 specs sur 111 ont moins des 3 fichiers attendus (spec.md + architecture.md + plan.md). Cas notables :

- 18 specs avec un seul fichier (souvent juste spec.md), dont 110-category-first-binding-resolution (le refactor qui motive cet audit)
- 13 specs à 2/3 (notamment toute la famille 048a/048b/048c plugins)

Pour un projet qui se veut "spec-driven", c'est une dette de processus visible.

### 8.4 Trous structurels

- Pas de glossaire formel (Device vs Equipment vs Binding vs Category vs Activity vs ComputedData)
- Pas d'ADR (les décisions vivent dans 80+ specs)
- Pas de runbook d'incident ("recette ne se déclenche pas", "device offline", "InfluxDB rempli")
- Pas de diagramme visuel (la pipeline réactive est en ASCII seulement)
- Pas de guide d'observabilité (quelles queries InfluxDB regarder, quel endpoint health)

### 8.5 Score documentation

| Critère                  | Score   |
| ------------------------ | ------- |
| Couverture des concepts  | 3 / 5   |
| Fraîcheur (drift)        | 3 / 5   |
| Cohérence terminologique | 4 / 5   |
| Onboarding développeur   | 3 / 5   |
| Opérabilité production   | 4 / 5   |
| Debug avancé             | 2.5 / 5 |
| Modernité                | 3 / 5   |
| Structure / navigation   | 3 / 5   |

**Doc globale : 3.2 / 5**.

---

## 9. Roadmap de remédiation recommandée

### Sprint 1 (urgent, effort < 1 semaine)

> Note : F01 (chiffrement des secrets) est exclu de cette priorisation, voir section 1.4 (risque accepté).

1. **F03 Filets process** : ajouter `uncaughtException` et `unhandledRejection` handlers dans [src/index.ts](src/index.ts).
2. **F06 Documentation spec 089 + spec 110** : compléter `plugin-development.md` (workflow SHA256 + OFFICIAL_OWNERS) et `recipe-development.md` (binding-resolver + light-helpers).
3. **F05 Specs-index** : exécuter un script qui régénère `docs/specs-index.md` à partir de `specs/*/` plutôt que de le tenir à la main.
4. **F13 Audit trail** : ajouter table `audit_log` + logger les events critiques.

### Sprint 2 (court terme, 1 à 2 semaines)

6. **F08 Refactor `ZoneRecipesSection.tsx`** : découper en sous-composants par section logique.
7. **F09 Bootstrap tests UI** : ajouter vitest UI sur 5 composants critiques (WidgetGrid, ZoneWidget, EquipmentWidget, AppLayout, ErrorBoundary).
8. **F07 + F20 EquipmentCategory** : introduire `EquipmentCategory` enum + permettre aux `RecipeSlotDef` de contraindre sur catégorie. Migration partielle (les recettes existantes restent compatibles via `equipmentType`).
9. **F11 EventBus observabilité** : compteurs latence par handler, log warn si > 200ms, métrique exposable sur `/health`.
10. **F04 Backup chiffré** : passphrase optionnelle au moment de l'export.

### Sprint 3+ (chantier, > 2 semaines)

11. **F02 Plugin isolation** : Proxy sur `PluginDeps`, whitelist d'API par plugin, plugin process worker_thread optionnel. Long terme, étudier worker_threads ou vm2.
12. **F10 Migrer `energy.ts`** vers les category-first resolvers.
13. **F14 Specs incomplètes** : décider d'une politique (clore les specs sans plan.md, ou les compléter au passage des futures features).
14. **F18 ADR + Glossaire** : extraire 10 décisions structurantes en ADR, créer `docs/technical/glossary.md`.
15. **F19 Code splitting UI** : `React.lazy()` sur les pages secondaires (Mqtt, Notifications, Settings).

---

## 10. Conclusion synthétique

Sowel est un projet **mature et techniquement abouti sur son coeur de métier**. Le pipeline réactif, la séparation Device/Equipment/Zone/Recipe, le système de plugin externalisé (spec 053) et la supply chain sécurisée (spec 089) sont des décisions architecturales fortes et bien tenues.

La dette se concentre sur **trois zones** :

1. **Le runtime des plugins**, qui partage trop largement le process Sowel : pas d'isolation, pas de sandbox, pas de filet process. Pour un produit qui se positionne comme "everything is a plugin", c'est la prochaine étape structurante.

2. **Les secrets** : tout est en clair dans la base. C'est probablement le risque le plus simple à corriger pour le plus gros gain de sécurité.

3. **La cohérence catégorie / type / equipment** : la spec 110 a fait l'essentiel mais n'a pas touché les contraintes recettes ni l'extensibilité plugin. Tant que `EquipmentType` reste l'axe principal de contrainte, le projet ne tirera pas tout le bénéfice de l'enum `DataCategory`.

À côté de ça, deux dettes "molles" qui ne bloquent pas mais usent : la documentation a divergé de manière mesurable sur les deux refactors récents (specs 089 et 110), et l'UI a accumulé des god components qui rendront de plus en plus coûteux chaque ajustement.

La note globale **3.2 / 5** reflète un projet sain qui a "le luxe des problèmes de maturité" : pas de bug architectural bloquant, mais une couche de durcissement à appliquer avant la prochaine vague de features.
