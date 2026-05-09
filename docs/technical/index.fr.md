# Guide technique

Cette section couvre l'architecture, les APIs, le développement et l'exploitation de Sowel.

## Vue d'ensemble

Sowel suit un **pipeline réactif piloté par les événements** :

```
Integration message (MQTT, cloud API poll, plugin)
  → Integration Plugin (receives + parses)
    → Device Manager (updates DeviceData)
      → Event Bus: "device.data.updated"
        → Equipment Manager (re-evaluates bindings + computed Data)
          → Event Bus: "equipment.data.changed"
            → Zone Manager (re-evaluates aggregations)
              → Event Bus: "zone.data.changed"
                → Recipe Engine (triggers → conditions → actions)
                  → Actions may emit Orders → Integration Plugin → device
            → WebSocket pushes to UI clients
```

Depuis la spec 053, **tout est plugin** : les intégrations et les recettes sont distribuées depuis GitHub via le service `PackageManager`. Il n'y a plus aucune intégration intégrée dans `src/`.

## Sections

| Section                                            | Description                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| [Architecture](architecture.md)                    | Conception système, plugin V2, auto-update, backup, CI/CD, logs    |
| [Déploiement](deployment.md)                       | Déploiement en production, mises à jour, backup/restore, dépannage |
| [Référence API](api-reference.md)                  | Endpoints REST et événements WebSocket                             |
| [Développement de plugins](plugin-development.md)  | Comment créer des intégrations plugin tierces                      |
| [Développement de recettes](recipe-development.md) | Comment créer des paquets de recettes d'automatisation             |
| [Modèle de données](data-model.md)                 | Schéma SQLite, types TypeScript, événements du bus                 |
| [Contribuer](contributing.md)                      | Mise en place de l'environnement, conventions et workflow          |

## Index des specs

Pour une liste chronologique de chaque spec avec un résumé d'une ligne et son statut, voir [../specs-index.md](../specs-index.md).
