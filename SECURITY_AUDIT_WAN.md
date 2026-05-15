# Analyse de risques cybersécurité WAN — Sowel

**Date** : 2026-05-15
**Périmètre** : exposition publique d'une instance Sowel sur Internet (deux topologies : Cloudflare Tunnel et port-forwarding direct sur box Internet).
**Branche analysée** : `main` @ v1.6.5
**Document précédent** : [SECURITY_AUDIT.md](SECURITY_AUDIT.md) (audit applicatif daté 2026-05-03, v1.5.2)
**Méthode** : revue statique différentielle depuis v1.5.2, modélisation de menace par scénario d'exposition, vérification ciblée du code en main.

---

## 1. Pourquoi un audit WAN distinct

L'audit du 2026-05-03 a évalué Sowel sous l'hypothèse **"LAN de confiance"**. Cette analyse complète cet audit en répondant à une question opérationnelle distincte :

> Que se passe-t-il quand une instance Sowel devient atteignable depuis Internet ?

Les vulnérabilités classées "Moyenne" en LAN remontent souvent à "Critique" dès qu'un attaquant peut frapper l'instance depuis n'importe quelle IP du monde, 24/7, sans contrainte de proximité physique.

Deux topologies sont aujourd'hui utilisées par les utilisateurs Sowel :

| Topologie                | Qui                              | Caractéristiques                                                                                                                             |
| ------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Cloudflare Tunnel** | Mainteneur, utilisateurs avancés | TLS terminé chez Cloudflare. Pas de port ouvert sur la box. Origine Sowel uniquement joignable via le tunnel. Possibilité Cloudflare Access. |
| **B. Port-forward**      | Auto-hébergeurs grand public     | Règle NAT sur la box Internet vers `192.168.x.x:3000`. TLS souvent absent (HTTP brut), IP source = monde entier, pas de WAF.                 |

Les deux topologies n'ont **pas le même profil de risque** — beaucoup de findings cessent d'être exploitables sous Cloudflare Access, mais redeviennent critiques en port-forward nu. Ce document traite les deux.

---

## 2. Synthèse exécutive

### En une phrase

Depuis l'audit v1.5.2, **les deux vulnérabilités d'extraction (C1 plugin SHA256, C2 path traversal restore) ont été corrigées**, ce qui élimine deux RCE directes. **Aucun autre finding "Haute" ou "Moyenne" n'a été traité**. En topologie B (port-forward), Sowel **ne devrait pas être exposé WAN en l'état**.

### Score par topologie

| Sévérité résiduelle | Cloudflare Tunnel (A)     | Port-forward (B) |
| ------------------- | ------------------------- | ---------------- |
| Critique            | 1 (C3 backup non chiffré) | 4                |
| Haute               | 3                         | 7                |
| Moyenne             | ~7                        | ~10              |

### Top 5 actions à mener avant d'élargir l'exposition WAN

| #   | Action                                                                                         | Effort | Couvre                               |
| --- | ---------------------------------------------------------------------------------------------- | ------ | ------------------------------------ |
| 1   | `USER 1000` dans Dockerfile + `docker.sock` optionnel                                          | S      | H1 — empêche escalade host           |
| 2   | `@fastify/helmet` + CORS défaut `localhost`                                                    | S      | H3 + finding CORS — couches XSS/CSRF |
| 3   | WS auth obligatoire + validation `Origin`                                                      | M      | H4 — CSRF via WebSocket              |
| 4   | Auth `preHandler` sur routes oubliées (`/devices/suggest`, etc.) + audit complet de couverture | M      | H5                                   |
| 5   | Chiffrement backup (passphrase AES-256-GCM)                                                    | M      | C3 — fuite credentials               |

Le détail est en §6.

---

## 3. Delta v1.5.2 → v1.6.5 (état des findings de l'audit précédent)

Vérification ciblée du code en main pour chaque finding listé dans `SECURITY_AUDIT.md`. Statut : **CORRIGÉ**, **PARTIEL**, **OUVERT**.

### Critiques

| #   | Finding                             | Statut      | Preuve / Note                                                                                                            |
| --- | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| C1  | Plugin RCE sans vérif. d'intégrité  | **CORRIGÉ** | SHA256 obligatoire dans `plugins/registry.json` + validation au download (spec 089). `OFFICIAL_OWNERS` whitelist active. |
| C2  | Path traversal `restoreBackup`      | **CORRIGÉ** | Confinement `startsWith(dataDirAbs + sep)` + whitelist d'extensions sous `data/` (vérifié dans backup-manager actuel).   |
| C3  | Secrets en clair dans le backup ZIP | **OUVERT**  | Aucun chiffrement passphrase. Le ZIP local pré-update contient toujours hashes bcrypt, tokens API, settings sensibles.   |

### Hautes

| #   | Finding                                                                               | Statut      | Preuve                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| H1  | Container Docker en `root` + `docker.sock` monté en RW par défaut                     | **OUVERT**  | [Dockerfile](Dockerfile) : pas de directive `USER`. [docker-compose.yml:25](docker-compose.yml#L25) : `/var/run/docker.sock` monté.        |
| H2  | Auto-update sans pinning de digest                                                    | **OUVERT**  | `UpdateManager` pull toujours par tag `:targetVersion`, pas de `@sha256:...`.                                                              |
| H3  | Aucun header de sécurité (pas de helmet, pas de CSP/HSTS/X-Frame-Options)             | **OUVERT**  | [src/api/server.ts:139-160](src/api/server.ts#L139-L160) : seuls `cors`, `rateLimit`, `multipart`, `websocket` enregistrés.                |
| H4  | WS auth via query param + `Origin` non validé + **token optionnel** (anonyme accepté) | **OUVERT**  | [src/api/websocket.ts:173](src/api/websocket.ts#L173) : `if (token) { ... }` — pas de token = subscription par défaut "system" en anonyme. |
| H5  | Routes non authentifiées (ex. `/api/v1/devices/suggest`)                              | **OUVERT**  | À auditer exhaustivement (au moins une route confirmée sans `preHandler` dans l'audit précédent).                                          |
| H6  | Dépendances vulnérables (Fastify < 5.9, `@fastify/static`, `esbuild`)                 | **PARTIEL** | Fastify est en 5.x mais le pinning précis demandait un `npm audit` qui n'est pas en CI. À refaire systématiquement.                        |

### Moyennes (extraits significatifs pour WAN)

| Finding                                                                                           | Statut     | Note                                                                                                            |
| ------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| CORS défaut `*` ([src/config.ts:92](src/config.ts#L92))                                           | **OUVERT** | Toute origin peut frapper l'API depuis le navigateur d'un utilisateur authentifié.                              |
| Pas de validation Zod sur routes mutables                                                         | **OUVERT** | Type injection silencieuse possible (booléen passé comme string, etc.).                                         |
| `err.message` brut renvoyé en 500 (plugins/integrations routes)                                   | **OUVERT** | Stack traces / paths internes / nom de dépendances exfiltrés.                                                   |
| Refresh token TTL 30 jours ([src/config.ts:86](src/config.ts#L86))                                | **OUVERT** | Fenêtre de rejeu longue en cas de vol de token.                                                                 |
| WS broadcast non filtré par rôle ([src/api/websocket.ts:135-139](src/api/websocket.ts#L135-L139)) | **OUVERT** | Un viewer connecté reçoit les events admin (settings changes, etc.).                                            |
| Rate-limit dédié sur `/auth/login` (10/min)                                                       | **OK**     | À noter : `/auth/login` est protégé. Mais `/auth/setup` ne l'est pas explicitement (au-delà du global 300/min). |
| Mot de passe minimum 6 caractères ([src/api/routes/auth.ts:33](src/api/routes/auth.ts#L33))       | **OUVERT** | Faible pour un service exposé WAN.                                                                              |
| Algorithme JWT non explicite                                                                      | **OUVERT** | `jwt.sign(payload, secret)` sans `algorithm: 'HS256'`.                                                          |

### Lecture

- **Surface "supply chain / restore" considérablement réduite** depuis v1.5.2 (C1 + C2). L'effort spec 089 a payé.
- **Aucun progrès sur la surface réseau / runtime**. Le profil reste celui d'un service LAN.
- **Le rate-limit dédié `/auth/login` à 10/min est une bonne surprise** — il rend le brute-force pratique infaisable même en WAN. C'est le point fort principal pour l'exposition.

---

## 4. Modèle de menace WAN

### 4.1 Topologie A — Cloudflare Tunnel

```
Internet  ──TLS──>  Cloudflare edge  ──cloudflared (mTLS)──>  Sowel container
                          │
                          ├─ (optionnel) Cloudflare Access (Zero Trust)
                          ├─ (optionnel) WAF règles managées
                          └─ Logs / rate-limit Cloudflare
```

**Ce qui est neutralisé par cette topologie** :

- Scans de ports IP publics → invisible (pas de port ouvert sur la box).
- MITM TLS → Cloudflare termine le TLS, certificat valide automatique.
- Attaques bruteforce massives → rate-limit Cloudflare en amont.
- Origin spoofing → si Cloudflare Access est activé, l'utilisateur doit s'authentifier au tunnel avant même de joindre Sowel.

**Ce qui reste exploitable** :

- Toute attaque côté application (CSRF, XSS, vol de session, fuite par WS, restore backup malveillant authentifié) passe à travers le tunnel comme du trafic légitime.
- **Si Cloudflare Access n'est pas activé**, l'attaquant peut atteindre `/api/v1/auth/login` et tenter du credential stuffing (mitigé par le rate-limit local 10/min).
- Compromission Cloudflare elle-même (TLS terminé chez CF, ils voient tout en clair). Modèle d'attaquant à très faible probabilité mais à conscientiser.

**Recommandation A** : exposition acceptable **si Cloudflare Access est activé** (Zero Trust login Google/email magic link en amont). Sans Cloudflare Access, l'exposition équivaut à port-forward sur le plan applicatif (mais avec TLS et anti-DDoS gratuits).

### 4.2 Topologie B — Port-forward direct

```
Internet  ──TCP:80/443/3000──>  Box Internet  ──NAT──>  192.168.x.x:3000 (HTTP brut Sowel)
```

**Profil par défaut** :

- TLS absent (Sowel n'écoute qu'en HTTP sur 3000). Si l'utilisateur n'a pas mis un reverse proxy avec Let's Encrypt devant, **tous les credentials transitent en clair**.
- Aucune authentification réseau préalable (pas de VPN, pas de SSO).
- Adresse IP du Sowel = adresse IP publique de la box, indexable par Shodan/Censys via un scan de bannière HTTP "Sowel".
- Pas de WAF, pas de rate-limit réseau global au-dessus du rate-limit applicatif.

**Modèle d'attaquant** : bot internet opportuniste + attaquant ciblé.

**Verdict** : **cette topologie ne devrait pas être recommandée tant que les findings P1/P2 de §6 ne sont pas adressés**. Trop de chemins exploitables passent par des défauts d'un service exposé non durci :

- HTTP brut → vol de mot de passe au login (réseau Wi-Fi public, captive portal).
- Pas de CSP / pas de SameSite défaut → CSRF (cookies non concernés mais bearer + CORS `*` = `fetch` cross-origin volant la session).
- WS sans Origin + token optionnel → connexion WebSocket anonyme depuis n'importe quelle page web malveillante, écoute des events `system.*` en clair.
- `err.message` brut → un attaquant identifie la stack via une requête malformée.
- Container root + docker.sock → si l'attaquant trouve une RCE (même par exploit de dépendance vulnérable), il prend l'host.

### 4.3 Modèle d'attaquant retenu

| Profil                              | Capacité                                                                    | Probabilité                              | Priorité défense                                |
| ----------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| **Bot opportuniste**                | Scanner CVE, fuzz endpoints, default creds, exploits de dépendances connues | Très haute (24/7)                        | Headers, deps à jour, rate-limit, pas de banner |
| **Attaquant ciblé non authentifié** | Phishing utilisateur, CSRF, XSS, social engineering                         | Moyenne (mainteneur exposé publiquement) | CSP, Origin WS, CORS strict, SameSite           |
| **Utilisateur authentifié hostile** | Compte viewer/standard tente escalade, exfiltration via WS, abus restore    | Faible (ménages)                         | Filtrage WS par rôle, validation backups        |
| **Plugin compromis**                | Code tiers RCE in-process                                                   | Faible depuis spec 089                   | C1 corrigé. Surveiller cosign futur.            |
| **Compromission Cloudflare**        | Inspection trafic, TLS termination abuse                                    | Très faible                              | Hors scope. Mention pour conscientisation.      |

---

## 5. Vulnérabilités WAN spécifiques (au-delà de l'audit applicatif)

Ces points ne sont pas dans l'audit précédent parce qu'ils n'émergent qu'en exposition publique.

### W1 — Absence de TLS natif et de redirection HTTPS

**Constat** : Sowel n'écoute qu'en HTTP. Aucune option de configuration TLS native (pas de chemin `TLS_CERT_PATH`, pas de Let's Encrypt embarqué).
**Impact en topologie B** : si l'utilisateur port-forward sans reverse proxy TLS, tout le trafic (login inclus) est en clair. Le mot de passe peut être capturé sur n'importe quel réseau intermédiaire.
**Impact en topologie A** : nul (TLS terminé par Cloudflare).
**Reco** : documenter clairement qu'**aucune exposition WAN sans reverse proxy TLS** n'est supportée. Idéalement, refuser de démarrer en mode "WAN_EXPOSURE=true" si pas de TLS détecté. Au minimum : page docs/user/security-wan.md explicite.

### W2 — Absence d'option "lockdown WAN"

**Constat** : Sowel ne distingue pas un déploiement LAN d'un déploiement WAN. Pas de variable d'env `EXPOSURE_MODE=lan|wan` qui activerait par défaut un profil durci (helmet strict, CORS localhost, refresh TTL court, WS auth obligatoire, etc.).
**Impact** : l'utilisateur grand public ne sait pas qu'il faut ajuster une dizaine de réglages par défaut sécurité pour pouvoir exposer.
**Reco** : introduire un mode `wan` qui force un profil sécurité strict et qui se manifeste en bannière UI.

### W3 — WebSocket accepte les connexions anonymes

**Constat** : [src/api/websocket.ts:168-188](src/api/websocket.ts#L168-L188) — `if (token) { ... }`. Si aucun token n'est fourni, l'auth est sautée et la subscription par défaut `system` est attribuée.
**Impact** : un attaquant Internet peut ouvrir une WS, recevoir les events `system.*` (intégrations connectées/déconnectées, settings changed, restart events) sans auth.
**Reco** : refuser la connexion si pas de token (`socket.close(4001, "Auth required")` dans le else). Et valider `Origin` ou exiger un header `Authorization`.

### W4 — Fingerprinting de version Sowel

**Constat** : la version est exposée publique via `GET /api/v1/system/version` (auth requise) **et** via le service worker / manifest PWA servis publiquement. Le binaire JS bundlé révèle des chunks identifiables. La bannière HTML inclut probablement le nom "Sowel" et le titre.
**Impact** : un scanner Shodan/Censys peut identifier une instance Sowel + sa version, et corréler avec les CVE applicables.
**Reco** : pas urgent, mais éviter d'exposer la version sur tout endpoint non authentifié. Ajouter une route `GET /` qui renvoie une page neutre (option) ou une 401 quand pas de session.

### W5 — Surface d'attaque DNS / Cloudflare account

**Constat** : la topologie A repose entièrement sur l'intégrité du compte Cloudflare du mainteneur. Une compromission du compte Cloudflare (phishing, vol de session, MFA bypass) permet de pivoter directement sur le tunnel et d'intercepter tout le trafic.
**Impact** : équivalent à une compromission de l'origine Sowel.
**Reco hors-code** : MFA matériel (YubiKey) sur le compte Cloudflare. Cloudflare Access en couche supplémentaire (un attaquant qui prend le compte CF doit aussi prendre le compte SSO).

### W6 — `/auth/setup` exploitable pendant la fenêtre de premier démarrage

**Constat** : [src/api/routes/auth.ts:24-48](src/api/routes/auth.ts#L24-L48) — `/auth/setup` est ouvert tant que `userManager.hasUsers()` est faux. Sur une instance fraîche, un attaquant qui scanne l'IP publique entre `docker compose up` et la création du premier admin (quelques secondes à plusieurs minutes selon l'utilisateur) peut créer un admin avec ses propres credentials.
**Impact** : prise de contrôle complète d'une instance fraîche.
**Reco** :

1. Documenter "ne jamais exposer une instance WAN avant d'avoir terminé le setup en local".
2. À terme : rendre `/auth/setup` joignable **uniquement depuis l'interface LAN** (binding 127.0.0.1 ou vérification IP source = privée).

### W7 — Self-update sans confirmation forte

**Constat** : l'utilisateur authentifié admin peut déclencher un self-update depuis l'UI. Le helper container exécute `docker compose pull` puis `up -d`. Combiné à H1 (root + docker.sock), un admin compromis = host compromis instantanément (en plus de C1 corrigé qui ne change rien ici parce que c'est le main image qui est pullée, pas un plugin).
**Impact en WAN** : si la session admin est volée (XSS, CSRF, vol de bearer), l'attaquant déclenche un update.
**Reco** :

1. Confirmation par mot de passe avant tout self-update (re-prompt password modal).
2. H2 (digest pinning) en complément.

### W8 — Pas de journalisation des événements de sécurité

**Constat** : pas de log distinct "security event" (login fail, token utilisé, restore backup, settings sensibles modifiés). Tout est dans le log standard à niveau `info` ou `warn`.
**Impact en WAN** : pas de signal exploitable pour détecter une compromission en cours.
**Reco** : log dédié "audit" pour `auth.login`, `auth.login_failed`, `auth.setup`, `backup.restore`, `plugin.install`, `system.update`, `user.created`, `user.role_changed`. Endpoint UI Admin → Sécurité qui affiche ces événements.

---

## 6. Priorisation des actions (input pour la spec à venir)

Cette section a alimenté la spec [`105-wan-hardening`](specs/105-wan-hardening/spec.md). Les éléments shippés en v1.7.0 sont marqués `[x]`.

### 🔴 P1 — Bloquant pour toute exposition WAN

| État | Ordre | Action                                                                                                         | Couvre           | Effort |
| ---- | ----- | -------------------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| [x]  | 1     | WS : refuser anonyme + valider `Origin` + déplacer token en header `Sec-WebSocket-Protocol` ou `Authorization` | W3, H4           | M      |
| [x]  | 2     | `@fastify/helmet` avec CSP stricte, HSTS, X-Frame-Options DENY, Referrer-Policy                                | H3               | S      |
| [x]  | 3     | CORS défaut `localhost:3000` + whitelist explicite documentée                                                  | finding CORS `*` | S      |
| [x]  | 4     | `USER 1000` dans Dockerfile + retirer `docker.sock` du compose par défaut (opt-in self-update via override)    | H1               | S      |
| [ ]  | 5     | Chiffrement backup AES-256-GCM avec passphrase utilisateur (argon2id KDF) — déclassé (cohérent avec HA)        | C3               | M      |

### 🟠 P2 — Avant ouverture aux utilisateurs non-techniques

| État | Ordre | Action                                                                                       | Couvre       | Effort |
| ---- | ----- | -------------------------------------------------------------------------------------------- | ------------ | ------ |
| [ ]  | 6     | Mode `EXPOSURE_MODE=wan` : profil sécurité strict par défaut + bannière UI                   | W2           | M      |
| [x]  | 7     | Auth `preHandler` audit complet de toutes les routes — ajouter check explicite par défaut    | H5           | M      |
| [ ]  | 8     | Digest pinning self-update (`@sha256:...`)                                                   | H2, W7       | S      |
| [ ]  | 9     | Confirmation par mot de passe pour self-update, restore, install plugin community (spec 106) | W7           | S      |
| [ ]  | 10    | `npm audit` en CI + dépendances à jour                                                       | H6           | S      |
| [ ]  | 11    | Sanitisation `err.message` dans les réponses 500 (renvoyer code + messageId, pas la stack)   | finding leak | XS     |
| [ ]  | 12    | Bind `/auth/setup` uniquement depuis IPs privées (RFC1918 + 127.0.0.0/8)                     | W6           | S      |

### 🟡 P3 — Durcissement de fond

| Ordre | Action                                                                             | Effort |
| ----- | ---------------------------------------------------------------------------------- | ------ |
| 13    | Validation Zod centralisée sur toutes les routes mutables                          | M      |
| 14    | WS broadcast filtré par rôle (viewer ≠ admin events)                               | M      |
| 15    | Refresh token TTL 30j → 7j en mode WAN (avec sliding renew)                        | XS     |
| 16    | Mot de passe min 6 → 12 (et règle de complexité ?) en mode WAN                     | XS     |
| 17    | `algorithm: 'HS256'` explicite sur `jwt.sign/verify`                               | XS     |
| 18    | Log de sécurité distinct + page Admin → Sécurité                                   | M      |
| 19    | Banner version uniquement après auth (pas dans manifest PWA, pas dans HTML neutre) | S      |

### 🟢 P4 — Roadmap à plus long terme

| #   | Action                                                                              |
| --- | ----------------------------------------------------------------------------------- |
| 20  | TLS natif optionnel (option certificat utilisateur) — alternative au reverse proxy. |
| 21  | Plan de dépréciation préfixes tokens legacy (`wch_`, `cbl_`).                       |
| 22  | Signature cosign optionnelle des plugins en complément du SHA256.                   |
| 23  | Support natif Cloudflare Access (header `Cf-Access-Authenticated-User-Email`).      |

---

## 7. Recommandations utilisateur (à formaliser plus tard)

Le mainteneur a demandé qu'une page utilisateur soit rédigée **après** que les corrections soient implémentées. Squelette envisagé pour `docs/user/security-wan.md` :

1. **Toujours préférer Cloudflare Tunnel + Cloudflare Access** à un port-forward direct.
2. **Si port-forward, alors reverse proxy TLS obligatoire** (Caddy ou Nginx Proxy Manager — exemples fournis).
3. **Mot de passe fort exigé** (12 caractères minimum, gestionnaire de mots de passe recommandé).
4. **Premier démarrage en LAN uniquement**, exposer après création du premier admin.
5. **MAJ régulières activées** (badge update + check manuel disponible depuis v1.6.x).
6. **Backups chiffrés stockés ailleurs que sur la VM** (cloud personnel, NAS).
7. **Pas d'install plugin community sans vérification** (l'UI le signale déjà via `OFFICIAL_OWNERS`).

À écrire en clair, pour un utilisateur grand public, dès que les actions P1 sont mergées.

---

## 8. Posture d'ensemble

Sowel a fait un **vrai pas en avant** sur la chaîne supply (spec 089) depuis l'audit de mai. Le projet reste néanmoins conçu et configuré par défaut pour un usage **LAN de confiance**, et l'exposition WAN actuelle (que ce soit via Cloudflare Tunnel ou port-forward) repose entièrement sur des hypothèses externes (Cloudflare Access activé, reverse proxy TLS configuré côté utilisateur, network discipline) qui ne sont **pas encore vérifiées ni guidées par le produit lui-même**.

**Posture recommandée** :

- **Pour le mainteneur** (topologie A + Cloudflare Access) : exposition acceptable, mais l'implémentation des P1 ferait passer la posture de "acceptable par hypothèses" à "acceptable par défaut".
- **Pour les utilisateurs grand public** (topologie B) : **déconseiller l'exposition WAN** dans les docs jusqu'à implémentation au minimum des P1 + W1 (documentation TLS). Mention claire en page Settings → Sécurité.

---

**Suite immédiate** : créer la spec `specs/105-wan-hardening/` avec spec.md + architecture.md + plan.md couvrant les actions P1 (et au moins le mode `EXPOSURE_MODE=wan` du P2-6 comme parapluie organisationnel).
