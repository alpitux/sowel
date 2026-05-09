# Suivi énergétique

Sowel intègre un suivi énergétique qui mesure la consommation électrique de votre maison dans le temps. Il prend en charge la classification tarifaire HP/HC (heures pleines/heures creuses) et le suivi de l'autoconsommation pour la production solaire.

## Vue d'ensemble

Le suivi énergétique fonctionne via un pipeline :

1. Un **équipement compteur d'énergie** (par ex. module Netatmo Energy sur votre disjoncteur principal) remonte les données de consommation
2. Sowel écrit ces données dans **InfluxDB**, une base de données de séries temporelles
3. InfluxDB agrège automatiquement les données en résumés horaires et journaliers
4. La **page Énergie** dans l'UI affiche les graphiques et les totaux

## Prérequis

- Un device de compteur d'énergie connecté à l'une de vos intégrations (par ex. Netatmo Home Control)
- Un équipement de type **main_energy_meter** configuré dans Sowel
- InfluxDB en service (inclus dans la configuration Docker)

!!! info "InfluxDB est automatique"
InfluxDB est obligatoire et démarre avec Sowel. Au premier lancement, Sowel crée automatiquement les buckets requis, les tâches de downsampling et les tâches d'agrégation énergétique. Aucune configuration manuelle d'InfluxDB n'est nécessaire.

## Configurer le suivi énergétique

### Étape 1 : connecter votre intégration énergie

Assurez-vous que votre source de données énergie est configurée dans **Administration > Intégrations**. Pour Netatmo, cela signifie configurer l'intégration Netatmo Home Control avec vos identifiants OAuth.

### Étape 2 : créer l'équipement énergie

Allez dans **Administration > Équipements** et créez un équipement :

- **Type** : Compteur d'énergie principal
- **Zone** : affectez-le à une zone pertinente (par ex. Maison ou Local technique)
- **Liez** à votre device compteur d'énergie

Une fois lié, Sowel commence à enregistrer les données d'énergie dans InfluxDB.

### Étape 3 : (facultatif) configurer les tarifs HP/HC

Si votre contrat d'électricité utilise des heures pleines (HP) et creuses (HC), configurez la grille tarifaire afin que Sowel puisse répartir votre consommation en conséquence.

Allez dans **Réglages > Configuration tarifaire** :

1. Définissez votre grille tarifaire : quelles heures sont HP et lesquelles sont HC
2. Vous pouvez définir des grilles différentes selon les jours de la semaine
3. Optionnellement, saisissez vos prix HP et HC par kWh

**Exemple : tarif HP/HC français standard**

| Heures        | Tarif        |
| ------------- | ------------ |
| 06:00 à 22:00 | HP (pleines) |
| 22:00 à 06:00 | HC (creuses) |

!!! tip
Si aucun tarif n'est configuré, toute la consommation est classée HP par défaut. La page Énergie fonctionne quand même, vous ne verrez juste pas la ventilation HP/HC.

### Étape 4 : (facultatif) configurer des sous-compteurs pour une ventilation par usage

Vous pouvez ajouter des **équipements sous-compteurs** de type `energy_meter` sur des circuits dédiés (pompe à chaleur, piscine, borne VE, etc.) pour répartir ce que mesure votre compteur principal en usages nommés.

Pour configurer un sous-compteur :

1. Liez un compteur d'énergie ou une prise mesurée Zigbee/Wi-Fi au circuit pertinent.
2. Allez dans **Administration > Équipements** et créez un équipement de type **Compteur d'énergie**.
3. Liez-le à la donnée `energy` (Wh) du device.

Une fois qu'au moins un sous-compteur est configuré, la page Énergie affiche un bouton **Total / Par usage**. La vue "Par usage" rend un graphique en barres empilées avec une pile par sous-compteur, plus une pile **Autre** pour le résidu non capturé par un sous-compteur (c'est-à-dire `compteur principal - somme des sous-compteurs`).

### Étape 5 : (facultatif) configurer le suivi de production

Si vous avez des panneaux solaires, créez un équipement de type **energy_production_meter** et liez-le au device de votre compteur de production. Sowel suivra alors :

- **Consommation réseau** : énergie tirée du réseau
- **Autoconsommation** : énergie produite et consommée localement
- **Consommation totale** : réseau + autoconsommation

## Utiliser la page Énergie

Naviguez vers **Énergie** dans la barre latérale. La page affiche :

### Sélecteur de période

Basculez entre différentes vues temporelles :

| Période   | Ce qui est affiché                                       |
| --------- | -------------------------------------------------------- |
| **Jour**  | Barres de consommation horaires pour un jour choisi      |
| **Mois**  | Barres de consommation journalières pour un mois choisi  |
| **Année** | Barres de consommation mensuelles pour une année choisie |

Utilisez les flèches de navigation pour vous déplacer entre les dates.

### Graphique de consommation

Un graphique en barres qui montre la consommation d'énergie sur la période sélectionnée. Chaque barre est codée par couleur :

- **Bleu** : consommation réseau
- **Bleu clair** : portion en heures creuses (HC), si HP/HC est configuré
- **Vert** : autoconsommation, si le suivi de production est configuré

#### Bouton Total / Par usage

Si vous avez configuré au moins un sous-compteur (voir [Étape 4](#etape-4-facultatif-configurer-des-sous-compteurs-pour-une-ventilation-par-usage)), un bouton **Total / Par usage** apparaît au-dessus du graphique :

- **Total** : la vue HP/HC/production standard décrite plus haut
- **Par usage** : un graphique en barres empilées avec une couleur par sous-compteur (par ex. PAC, Piscine) plus un résidu **Autre** qui représente ce que le compteur principal a vu mais qu'aucun sous-compteur n'a comptabilisé

Le bouton est masqué quand aucun sous-compteur n'est configuré. Les widgets de totaux (HP/HC, autoconsommation) conservent leurs valeurs entre les deux vues.

### Totaux

Sous le graphique, vous voyez les totaux récapitulatifs :

- **Consommation réseau** en kWh
- **Répartition HP / HC** en kWh (si le tarif est configuré)
- **Autoconsommation** en kWh (si la production est suivie)
- **Consommation totale** en kWh

### Page Production

Si vous avez configuré la production solaire, un onglet **Production** apparaît, qui affiche :

- Graphique en barres de production (même sélecteur de période que la consommation)
- Totaux de production
- Ratio d'autoconsommation

## Pipeline de données

Comprendre le flux des données aide au dépannage :

```
Energy meter device
  --> 30-minute energy readings
    --> InfluxDB "sowel" bucket (7-day retention, raw data)
      --> Hourly aggregation task
        --> InfluxDB "sowel-energy-hourly" bucket (2-year retention)
          --> Daily aggregation task
            --> InfluxDB "sowel-energy-daily" bucket (10-year retention)
```

- **Vue Jour** : pour les jours récents (moins d'une semaine), le graphique interroge les données brutes pour une précision en temps réel. Pour les jours plus anciens, il utilise le bucket horaire.
- **Vue Mois/Année** : utilise le bucket journalier pour des requêtes efficaces sur de longues périodes.

## Dépannage

### Aucune donnée n'apparaît sur la page Énergie

1. Vérifiez que votre intégration énergie est connectée (indicateur vert dans Intégrations)
2. Vérifiez que l'équipement énergie existe et est lié à un device
3. Patientez le temps d'au moins un cycle de polling (typiquement 30 minutes pour Netatmo)
4. Consultez les logs pour des messages d'erreur liés à l'énergie ou à InfluxDB

### La répartition HP/HC affiche tout en HP

Cela signifie qu'aucune grille tarifaire n'est configurée. Allez dans **Réglages > Configuration tarifaire** et définissez vos heures HP/HC.

### Des données anciennes manquent

Les données de plus de 7 jours ne sont disponibles que si la tâche d'agrégation horaire s'est exécutée correctement. Vérifiez qu'InfluxDB tourne et que Sowel a créé les tâches d'agrégation (cela se fait automatiquement au démarrage).
