# Notes de version

Sowel est versionné et déployé via CI/CD depuis `v1.0.0` (avril 2026, spec 055). Chaque version est publiée sous forme de :

- Release GitHub avec un changelog généré — [github.com/mchacher/sowel/releases](https://github.com/mchacher/sowel/releases)
- Image Docker multi-arch taggée `ghcr.io/mchacher/sowel:<version>` et `:latest`

Cette page résume toutes les versions publiées, de la plus récente à la plus ancienne. Pour le diff complet entre deux versions : `https://github.com/mchacher/sowel/compare/v<a>...v<b>`.

**Mettre à jour une instance en cours.** Sowel interroge GitHub toutes les heures et fait apparaître la mise à jour disponible dans la barre supérieure. Un clic sur la pastille ouvre la feuille des mises à jour et applique la nouvelle version en un clic (ajouté en v1.9.0). En ligne de commande : `cd /opt/sowel && docker compose pull && docker compose up -d`.

---

## 1.10.x — Le changelog à portée de clic

### v1.10.3 — 2026-05-17 { #v1-10-3 }

- Refactor : toutes les résolutions de bindings côté UI et moteur de recettes passent désormais par un résolveur partagé catégorie-d'abord. Les équipements re-bindés manuellement (avec l'alias = clé device) fonctionnent partout : vue zone, détail équipement, feuille mobile, toggle mobile direct, fermer-toutes-vannes, et dispatch piloté par recette (motion-light, switch-light, presence-heater, state-trigger-light). Ferme la classe de bug latent qui avait causé l'incident pool-cover de v1.10.2. Spec 110.

### v1.10.2 — 2026-05-17 { #v1-10-2 }

- Correctif : le bouton ON/OFF de la pompe piscine ne passe plus à la ligne sous l'icône dans la vue compacte de zone.
- Correctif : les boutons OUVRIR/STOP/FERMER du volet piscine (et de tout volet) réapparaissent dans la vue compacte de zone, dans la feuille mobile du tableau de bord, et dans la page de détail équipement quand le binding a été créé avec la clé du device comme alias (ex : après un re-binding manuel via l'UI). Les contrôles résolvent désormais les bindings move/position par catégorie, comme le widget du tableau de bord le faisait déjà.

### v1.10.1 — 2026-05-17 { #v1-10-1 }

- Correctif : une annonce de découverte partielle envoyée par un plugin d'intégration ne détruit plus silencieusement les bindings d'équipement. Avant ce correctif, si un device Tasmota / Zigbee2MQTT / etc. omettait temporairement une de ses clés lors d'une reconnexion, la ligne `device_data` / `device_orders` était supprimée et le CASCADE FK effaçait le binding d'équipement correspondant. C'est ce qui avait fait disparaître la commande du volet piscine après le restart de v1.10.0. Les lignes bound sont désormais préservées à travers les re-découvertes partielles ; seules les vraies lignes orphelines continuent d'être nettoyées (spec 109).

### v1.10.0 — 2026-05-17 { #v1-10-0 }

- Chaque ligne de la feuille des mises à jour expose désormais une icône changelog discrète à côté du bouton Mettre à jour. Cliquez pour ouvrir les notes de version correspondantes (cette page pour le cœur Sowel, la page GitHub release pour les plugins) dans un nouvel onglet. Fini les mises à jour à l'aveugle (spec 107).
- Les notes de version sont désormais dans la table des matières du Guide utilisateur.
- La CI refuse maintenant de publier une release sans entrée correspondante sur cette page, en EN et FR (spec 108). Conséquence : chaque lien « Voir les changements » de l'application tombe sur une section remplie.

---

## 1.9.x — Pastille de mise à jour actionnable

### v1.9.0 — 2026-05-17 { #v1-9-0 }

- La pastille de mise à jour de la barre supérieure ouvre désormais une feuille `UpdatesSheet` listant le cœur Sowel et les plugins obsolètes, avec un bouton `Mettre à jour` par ligne (spec 106). Remplace l'ancienne redirection aveugle vers `/plugins`, qui laissait les mises à jour du cœur invisibles.

---

## 1.8.x — Graphiques et flux d'activité

### v1.8.1 — 2026-05-17 { #v1-8-1 }

- Les graphiques temporels utilisent désormais une échelle de temps linéaire sur l'axe X. Les données détection / contact / météo éparse ne sont plus comprimées visuellement quand les événements sont groupés dans le temps.

### v1.8.0 — 2026-05-16 { #v1-8-0 }

- Nouveau flux d'activité dans la vue zone (spec 101). Affiche les événements des dernières 24 h avec un plafond adaptatif (10 sur mobile, 100 sur desktop), filtré par catégorie de liaison et limité à la zone courante.

---

## 1.7.x — Durcissement WAN

### v1.7.0 — 2026-05-15 { #v1-7-0 }

- Durcissement WAN (spec 105) : CSP et vérification d'origine WebSocket renforcés pour une exposition publique sûre via tunnel Cloudflare. Google Fonts autorisé pour la police Nunito. Socket Docker accessible à l'utilisateur non-root `sowel`.
- CI : runner GitHub ARM64 natif avec builds parallèles — le temps de release multi-arch passe d'environ 15 min à 3 min.

---

## 1.6.x — Design system et chaîne d'approvisionnement plugins

### v1.6.6 — 2026-05-15 { #v1-6-6 }

- L'assistant de configuration déclenche automatiquement le redémarrage après validation ; séparateur décimal unifié pour les champs latitude/longitude.
- CI : politique de rétention GHCR — les anciennes versions de conteneurs sont automatiquement purgées à chaque release.

### v1.6.5 — 2026-05-15 { #v1-6-5 }

- Assistant de configuration Maison au premier login. Le helper de redémarrage passe désormais `--force-recreate` pour réellement redémarrer.

### v1.6.4 — 2026-05-15 { #v1-6-4 }

- L'installation de plugin ne refuse plus que les liens symboliques _qui sortent du paquet_ ; les liens internes sont autorisés (spec 089 C1).

### v1.6.3 — 2026-05-14 { #v1-6-3 }

- L'auto-mise à jour normalise le fichier compose vers `:latest`, force la recréation du conteneur et vérifie la nouvelle version (spec 104).
- CI : création de la release GitHub conditionnée à la réussite du build ARM64.

### v1.6.2 — 2026-05-14 { #v1-6-2 }

- Durcissement de la chaîne d'approvisionnement plugins (spec 089 C1+C2) : hashes SHA256 figés dans le registre, confirmation d'installation pour le namespace communautaire, confinement du chemin de restauration, liste blanche d'extensions, refus des liens symboliques, plafond de taille.

### v1.6.1 — 2026-05-14 { #v1-6-1 }

- Correction du build Docker — le répertoire `design-system/` est désormais copié dans l'étape de build UI.

### v1.6.0 — 2026-05-14 { #v1-6-0 }

- Refonte UI majeure pour parité avec le design system (specs 094–100) :
  - Nouvelle palette et nouveaux tokens du design system
  - Sidebar refactorisée en composants réutilisables
  - Vue zone en 2 colonnes sur desktop avec bande d'agrégation et pills variantes
  - Toolbar de commandes zone icon-only
  - Chrome unifié pour les widgets du tableau de bord
  - Typographie polie (letter-spacing, standardisation H1, tabular nums par défaut)
  - Refactor du chrome des lignes d'équipement avec halo lumineux
  - Alignement strict avec la maquette sur les panneaux de zone, parité mobile
- Installateur en une commande (`install.sh`) ajouté.

---

## 1.5.x — Extension énergie et recettes

### v1.5.10 — 2026-05-10 { #v1-5-10 }

- Revert interne sur la documentation.

### v1.5.9 — 2026-05-09 { #v1-5-9 }

- Sélecteur de recettes réécrit en popover compacte (latéral sur desktop, bottom-sheet sur mobile). Palette pastel et coins arrondis sur le graphique énergie par usage.

### v1.5.8 — 2026-05-08 { #v1-5-8 }

- Nouvelle recette `state-trigger-light` (spec 092). Les slots de recette gagnent les contraintes `crossZone` et `includeDescendants`, ainsi qu'un sélecteur "zone d'abord" pour les slots équipement unique.

### v1.5.7 — 2026-05-08 { #v1-5-7 }

- Sous-compteurs en puissance uniquement et graphique de répartition énergie par usage (spec 091). Cumul Wh des sous-compteurs exposé comme donnée calculée sur l'équipement.

### v1.5.6 — 2026-05-03 { #v1-5-6 }

- Toggle activer/désactiver par mapping sur les publications MQTT (spec 090).

### v1.5.5 — 2026-05-03 { #v1-5-5 }

- Hot-load plugin : invalidation du cache pour les imports transitifs.

### v1.5.4 — 2026-05-03 { #v1-5-4 }

- API plugin : getter `getDeviceDataLastUpdated` exposé ; bump du registre `shelly_mqtt`.

### v1.5.3 — 2026-05-03 { #v1-5-3 }

- La requête de production énergie retombe sur le bucket horaire quand le bucket raw manque. Le tooltip de consommation sépare HP/HC entre réseau pur et autoconsommation.

### v1.5.2 — 2026-05-03 { #v1-5-2 }

- Pastilles compactes en barre supérieure remplacent la bannière d'alarme et le warning d'intégration. Le statut énergie live se sépare selon la source dominante. Le dechargement plugin appelle toujours `stop()`.

### v1.5.1 — 2026-05-03 { #v1-5-1 }

- Writer d'autoconsommation (spec 086 étapes E+F), plus corrections de bugs sur l'agrégateur et l'historique. Nouveau getter `getDeviceDataValue` pour l'hydratation des plugins.

### v1.5.0 — 2026-05-02 { #v1-5-0 }

- Page de flux de puissance en direct (`/energy/live`) avec auto-détection des sources. Plugin Shelly MQTT ajouté au registre. Outil de migration de l'historique pour les équipements orphelins.

---

## 1.4.x — Pompe à chaleur piscine

### v1.4.2 — 2026-05-01 { #v1-4-2 }

- Le tableau de bord mobile affiche la pompe à chaleur piscine comme un thermostat. Les intégrations désactivées restent visibles sur la page Intégrations. Toggle activer/désactiver directement sur la ligne.

### v1.4.1 — 2026-05-01 { #v1-4-1 }

- Toggle persistant Activer/Désactiver sur le drawer d'intégration. Les anciennes images `ghcr.io/mchacher/sowel` sont purgées automatiquement après auto-mise à jour.

### v1.4.0 — 2026-05-01 { #v1-4-0 }

- Nouveau type d'équipement `pool_heat_pump` et scaffolding du plugin Modbus associé.

---

## 1.3.x — Équipements piscine

### v1.3.2 — 2026-04-19 { #v1-3-2 }

- La logique de rappel d'alarme passe dans le publisher de notification Telegram (spec 083). Remplissages adaptatifs au thème pour l'icône de pompe piscine (dark mode). Pill Ouvert/Fermé sur les cartes compactes de volets et de couverture piscine.

### v1.3.1 — 2026-04-19 { #v1-3-1 }

- Mise en page des slots de recette : colonnes de largeur égale pour les paires homogènes.

### v1.3.0 — 2026-04-19 { #v1-3-0 }

- Nouveaux types d'équipement `pool_pump` et `pool_cover` (spec 081), avec contrôles inline dans la vue zone compacte et un sélecteur de canal dédié côté device. Les appareils multi-canaux peuvent désormais alimenter plusieurs équipements. Le registre plugins peut être rechargé à la demande depuis l'UI.

---

## 1.2.x — Dispatch équipement v2 et catégories de domaine

### v1.2.15 — 2026-04-19 { #v1-2-15 }

- Plugin Tasmota enregistré en v1.0.0 (spec 080). Le `install()` plugin redirige vers `update()` en cas de réinstallation.

### v1.2.14 — 2026-04-18 { #v1-2-14 }

- Les devices stockent les valeurs enum ; l'UI surface les valeurs d'action dynamiquement (spec 079). Nouveau type d'effet bouton `zone_order` avec sélection équipement "zone d'abord" (spec 078).

### v1.2.13 — 2026-04-18 { #v1-2-13 }

- Refactor : `dispatchConfig`, `apiVersion`, fallback brute-force supprimés (spec 074). Le dispatch v2 est désormais l'unique chemin.

### v1.2.12 — 2026-04-18 { #v1-2-12 }

- Catégories de commande pour la résolution des ordres de zone (spec 077). Nouvelles catégories température/humidité extérieures et mise à jour du plugin `netatmo-weather` (spec 076).

### v1.2.11 — 2026-04-18 { #v1-2-11 }

- Nouvelles catégories de domaine pour `media_player`, `appliance` et `thermostat` (spec 073).

### v1.2.10 — 2026-04-18 { #v1-2-10 }

- L'ordre de zone sur thermostat passe par la catégorie de consigne (spec 070).

### v1.2.9 — 2026-04-18 { #v1-2-9 }

- Les ordres de zone résolvent les alias par catégorie au lieu de noms en dur (spec 069).

### v1.2.8 — 2026-04-18 { #v1-2-8 }

- Dispatch d'ordres v2 — les plugins reçoivent directement `orderKey` au lieu d'un blob `dispatchConfig` (spec 067).

### v1.2.7 — 2026-04-15 { #v1-2-7 }

- Les ordres de zone volet utilisent l'état OPEN/CLOSE au lieu d'une position.

### v1.2.6 — 2026-04-12 { #v1-2-6 }

- Nouvelle option `onChangeOnly` sur les publications MQTT.

### v1.2.5 — 2026-04-12 { #v1-2-5 }

- Restauration du snapshot à chaque reconnexion — revert du changement de v1.2.4 après effets de bord.

### v1.2.4 — 2026-04-12 { #v1-2-4 }

- Les publications MQTT ne bouclent plus sur snapshot à la reconnexion du broker ; republication au changement de mapping.

### v1.2.3 — 2026-04-12 { #v1-2-3 }

- Suppression du verrou par fichier PID — il causait une boucle de crash Docker au redémarrage du conteneur.

### v1.2.2 — 2026-04-12 { #v1-2-2 }

- Nettoyage interne.

### v1.2.1 — 2026-04-12 { #v1-2-1 }

- Le helper d'auto-mise à jour préserve le `working_dir` compose de l'hôte.

### v1.2.0 — 2026-04-12 { #v1-2-0 }

- Registre plugins découplé de la cadence de release de Sowel + champ de compatibilité `sowelVersion` (spec 066).

---

## 1.1.x — Eau et freecooling

### v1.1.7 — 2026-04-12 { #v1-1-7 }

- Les badges et boutons de mise à jour utilisent désormais le rouge au lieu de l'ambre.

### v1.1.6 — 2026-04-12 { #v1-1-6 }

- Nettoyage interne.

### v1.1.5 — 2026-04-12 { #v1-1-5 }

- Le helper d'auto-mise à jour conserve `AutoRemove` désactivé temporairement pour le debug.

### v1.1.4 — 2026-04-12 { #v1-1-4 }

- Nettoyage interne.

### v1.1.3 — 2026-04-12 { #v1-1-3 }

- L'auto-mise à jour pull par tag de version au lieu de `:latest` (évite la course avec des releases concurrentes).

### v1.1.2 — 2026-04-12 { #v1-1-2 }

- Nouvelle recette freecooling — ferme les volets avant le lever du soleil (spec 065).

### v1.1.1 — 2026-04-12 { #v1-1-1 }

- Les paquets recette peuvent s'installer et se mettre à jour à chaud sans redémarrage du moteur.

### v1.1.0 — 2026-04-12 { #v1-1-0 }

- Nouveau type d'équipement `water_valve` (spec 062) et recette d'arrosage automatique (spec 063).
- Données météo calculées : pluie-1h / pluie-24h plus graphiques à barres cumulatifs (spec 064).
- Le fuseau horaire est désormais auto-dérivé de la localisation du domicile (spec 061), avec un fallback sûr quand la table settings manque sur une installation fraîche.
- Polish UX recettes, secondes sur l'horloge, auto-démarrage des plugins après install/update.

---

## 1.0.x — Premières versions

### v1.0.8 — 2026-04-11 { #v1-0-8 }

- Nettoyage interne.

### v1.0.7 — 2026-04-11 { #v1-0-7 }

- Pattern de conteneur helper pour l'auto-mise à jour + améliorations de détection (spec 060).

### v1.0.6 — 2026-04-11 { #v1-0-6 }

- Nettoyage interne.

### v1.0.5 — 2026-04-06 { #v1-0-5 }

- Registre plugins distant, récupéré au runtime avec fallback local (spec 059).
- Image Docker passée à Debian Trixie pour Python 3.13+ (compatibilité bridge Panasonic Comfort Cloud).
- CI : build `amd64` uniquement à ce stade (~5 min vs ~15 min) ; l'ARM64 reviendra plus tard.
- Comparaison semver-aware pour les mises à jour de plugins.

### v1.0.4 — 2026-04-06 { #v1-0-4 }

- Nettoyage interne.

### v1.0.3 — 2026-04-06 { #v1-0-3 }

- L'export line-protocol du backup gère les valeurs non-string d'InfluxDB. La restauration vide `recipe_log` pour éviter les FK orphelines. L'image Docker runtime conserve `python3` pour le bridge Panasonic Comfort Cloud.

### v1.0.2 — 2026-04-06 { #v1-0-2 }

- Le backup inclut désormais `refresh_tokens` pour qu'une instance restaurée garde les utilisateurs connectés.

### v1.0.1 — 2026-04-06 { #v1-0-1 }

- Le `PRAGMA foreign_keys` du backup est déplacé hors de la transaction SQLite (il n'avait aucun effet à l'intérieur).

### v1.0.0 — 2026-04-06 { #v1-0-0 }

- Première version versionnée. Ajoute le versioning `package.json`, le Dockerfile, le pipeline GitHub Actions de release et le `docker-compose.yml` de référence (spec 055). Tout ce qui précède ne vit que dans l'historique git pré-release.
