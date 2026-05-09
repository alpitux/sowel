# Premiers pas

Cette page vous guide à travers l'installation de Sowel, la première connexion, et la configuration de votre maison.

## Prérequis

- **Docker** (recommandé) ou **Node.js 20+** pour une installation manuelle
- Au moins une intégration prise en charge :
  - **Zigbee2MQTT** avec un broker MQTT (Mosquitto ou équivalent)
  - Compte **Panasonic Comfort Cloud** (pour les climatiseurs)
  - Compte **MCZ Maestro** (pour les poêles à granulés)
  - **Netatmo Weather** (pour les stations météo)
  - **Legrand Energy / Control** (pour le suivi énergétique, les lumières, les volets)
  - **LoRa2MQTT** (pour les devices LoRa via un pont lora2mqtt)

## Installation

### Option 1 : Docker (recommandé)

Docker est la manière la plus simple d'exécuter Sowel. Il regroupe le moteur et InfluxDB.

```bash
git clone <repo>
cd sowel
docker-compose up -d
```

Cela lance :

- Le **moteur Sowel** sur le port `3000`
- **InfluxDB** sur le port `8086` (utilisé en interne pour les données d'énergie et d'historique)

Ouvrez votre navigateur sur **http://localhost:3000**.

### Option 2 : Installation manuelle

```bash
git clone <repo>
cd sowel
npm install
```

Démarrez le backend :

```bash
npm run dev
```

Dans un terminal séparé, démarrez le frontend :

```bash
cd ui
npm install
npm run dev
```

Ouvrez votre navigateur sur **http://localhost:5173**.

!!! info "Développement vs production"
En exécution manuelle avec `npm run dev`, l'UI tourne sur le port 5173 (serveur de dev Vite avec hot reload). En mode Docker ou production, le backend sert directement l'UI sur le port 3000.

## Première connexion

À la première ouverture de Sowel, une **page de configuration** apparaît. Créez votre compte administrateur :

1. Choisissez un nom d'utilisateur
2. Définissez un mot de passe
3. Saisissez un nom d'affichage

Une fois le premier compte créé, l'écran de connexion vous accueille :

![Écran de connexion](../screenshots/getting-started-login.png)

Cela crée le premier compte administrateur. Vous pourrez ajouter d'autres utilisateurs plus tard depuis les Réglages.

!!! warning
Il n'existe aucun mécanisme de récupération de mot de passe. Assurez-vous de bien retenir vos identifiants admin.

## Configuration initiale

Après la connexion, suivez ces étapes pour configurer votre maison.

### Étape 1 : Configurer les intégrations

Allez dans **Administration > Intégrations** dans la barre latérale.

![Page intégrations](../screenshots/getting-started-integrations.png)

Chaque intégration possède son propre panneau de réglages. Cliquez sur une intégration pour la déplier et configurer la connexion. Réglages courants :

| Intégration                 | À configurer                                                        |
| --------------------------- | ------------------------------------------------------------------- |
| **Zigbee2MQTT**             | URL du broker MQTT (par ex. `mqtt://localhost:1883`), topic de base |
| **Panasonic Comfort Cloud** | Email et mot de passe de votre compte Panasonic                     |
| **MCZ Maestro**             | Email et mot de passe de votre compte MCZ                           |
| **Netatmo Weather**         | Identifiants OAuth (client ID, client secret, tokens)               |
| **Legrand Energy/Control**  | Identifiants OAuth (client ID, client secret, tokens)               |
| **LoRa2MQTT**               | URL du broker MQTT, topic de base                                   |

Chaque intégration affiche un **indicateur de statut de connexion** (vert = connecté). Vous pouvez démarrer/arrêter les intégrations et déclencher un rafraîchissement manuel sans redémarrer le moteur.

!!! tip
Les réglages d'intégration sont stockés dans la base de données, pas dans des fichiers d'environnement. Vous configurez tout depuis l'UI.

### Étape 2 : Vérifier la découverte des devices

Allez dans **Administration > Devices**.

![Page devices](../screenshots/getting-started-devices.png)

Une fois qu'une intégration est connectée, les devices apparaissent automatiquement. Le tableau affiche :

- Le nom du device et l'intégration source (Z2M, LORA2MQTT, MCZ, etc.)
- Le fabricant et le modèle
- Le statut de connexion (point vert = en ligne)
- Le lien à l'équipement (s'il est déjà affecté)

Utilisez les onglets d'intégration en haut pour filtrer par source. Si les devices n'apparaissent pas, vérifiez que votre intégration est connectée (indicateur vert) et que les devices sont appairés à votre coordinateur ou enregistrés sur votre compte cloud.

### Étape 3 : Créer la topologie de vos zones

Allez dans **Administration > Topologie**.

![Page zones](../screenshots/getting-started-zones.png)

Construisez la structure spatiale de votre maison sous forme d'arbre imbriquable. Une configuration typique :

```
Home
  Ground Floor
    Living Room
    Kitchen
    Hallway
  First Floor
    Master Bedroom
    Kids Room
    Bathroom
  Outdoor
    Garden
    Garage
```

Utilisez le bouton **+ Ajouter une zone** pour créer des zones, et les boutons fléchés pour les réordonner. Les zones peuvent être imbriquées sur n'importe quelle profondeur. L'arbre des zones apparaît dans la barre latérale Accueil pour la navigation quotidienne.

### Étape 4 : Créer les équipements

Allez dans **Administration > Équipements**.

Pour chaque unité fonctionnelle de votre maison :

1. Cliquez sur **Ajouter un équipement**
2. Choisissez un type (lumière, volet, capteur, thermostat, portail, vanne d'eau, etc.)
3. Donnez-lui un nom (par ex. "Spots Salon")
4. Affectez-le à une zone
5. Liez les données et les commandes des devices

!!! tip
Un seul équipement peut se lier à plusieurs devices. Par exemple, trois modules variateurs derrière le mur peuvent être regroupés en un seul équipement "Spots Salon". Un seul interrupteur les contrôle tous les trois.

### Étape 5 : Profiter de la vue Accueil

Allez sur **Accueil** dans la barre latérale.

![Vue accueil](../screenshots/getting-started-home.png)

L'arbre des zones apparaît à gauche. Cliquez sur n'importe quelle zone pour voir :

- **L'état agrégé** : température, humidité, luminosité, mouvement, nombre de lumières, position des volets
- **Les commandes de zone** : actions groupées (toutes lumières on/off, tous volets ouverts/fermés)
- **Les cartes d'équipement** : groupées par type (Thermostat, Énergie, Météo, etc.) avec contrôles intégrés
- **Les comportements** : recettes et modes configurés pour cette zone

### Étape 6 : Personnaliser le tableau de bord

Allez sur **Tableau de bord** et cliquez sur **Éditer**.

![Tableau de bord](../screenshots/getting-started-dashboard.png)

Ajoutez des widgets pour les équipements et zones que vous utilisez le plus. Les widgets se mettent à jour en temps réel via WebSocket. Vous pouvez les réordonner par glisser-déposer, les renommer, et personnaliser leurs icônes.

Votre maison est maintenant configurée. À partir de là, vous pouvez :

- [Personnaliser votre tableau de bord](dashboard.md) avec plus de widgets
- [Configurer des modes](modes.md) pour différents scénarios (Confort, Absence, Nuit)
- [Suivre la consommation d'énergie](energy.md)

## Variables d'environnement

Sowel fonctionne d'emblée avec des valeurs par défaut raisonnables. Pour une configuration avancée, vous pouvez définir des variables d'environnement dans un fichier `.env` à la racine du projet :

| Variable        | Défaut                  | Description                                      |
| --------------- | ----------------------- | ------------------------------------------------ |
| `SQLITE_PATH`   | `./data/sowel.db`       | Emplacement du fichier de base de données        |
| `API_PORT`      | `3000`                  | Port du serveur HTTP                             |
| `API_HOST`      | `0.0.0.0`               | Adresse de bind                                  |
| `LOG_LEVEL`     | `info`                  | Niveau de log (`debug`, `info`, `warn`, `error`) |
| `CORS_ORIGINS`  | `*`                     | Origines CORS autorisées                         |
| `INFLUX_URL`    | `http://localhost:8086` | URL InfluxDB                                     |
| `INFLUX_ORG`    | `sowel`                 | Organisation InfluxDB                            |
| `INFLUX_BUCKET` | `sowel`                 | Bucket principal InfluxDB                        |

!!! note
`JWT_SECRET` et `INFLUX_TOKEN` sont auto-générés au premier lancement et persistés dans le répertoire `data/`. Vous n'avez pas besoin de les définir manuellement.
