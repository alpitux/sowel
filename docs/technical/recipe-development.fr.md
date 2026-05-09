# Guide de développement de recettes

Comment créer une nouvelle recette pour Sowel.

## Architecture

Une recette est un modèle d'automatisation réutilisable. Les utilisateurs instancient les recettes avec des paramètres (slots) pour créer des instances d'automatisation en cours d'exécution. Les recettes sont enregistrées au démarrage du moteur et exposées via l'API REST.

```
Recipe class (definition)
  -> RecipeManager.register()
    -> GET /api/v1/recipes -> UI shows available recipes
      -> User creates instance with params
        -> RecipeManager.createInstance() -> validate() -> start()
          -> Recipe subscribes to EventBus events and reacts
```

## Créer une recette

### 1. Créer le fichier

Créez `src/recipes/<recipe-name>.ts` qui étend la classe de base `Recipe` :

```typescript
import type { RecipeSlotDef, RecipeLangPack } from "../shared/types.js";
import { Recipe, type RecipeContext } from "./engine/recipe.js";

export class MyRecipe extends Recipe {
  readonly id = "my-recipe";
  readonly name = "My Recipe"; // English (fallback)
  readonly description = "What it does"; // English (fallback)
  readonly slots: RecipeSlotDef[] = [
    // ...see Slots section below
  ];
  override readonly i18n: Record<string, RecipeLangPack> = {
    // ...see Translations section below
  };

  validate(params: Record<string, unknown>, ctx: RecipeContext): void {
    // Throw if params are invalid
  }

  start(params: Record<string, unknown>, ctx: RecipeContext): void {
    // Subscribe to events, start timers
  }

  stop(): void {
    // Unsubscribe events, clear timers (must be idempotent)
  }
}
```

### 2. Enregistrer dans index.ts

```typescript
import { MyRecipe } from "./recipes/my-recipe.js";
// ...
recipeManager.register(MyRecipe);
```

### 3. Écrire des tests

Créez `src/recipes/<recipe-name>.test.ts`. Suivez le pattern de `motion-light.test.ts` :

- SQLite en mémoire avec migrations
- Faux timers (`vi.useFakeTimers()`)
- Mock du registry d'intégrations capturant les publications MQTT
- Test de la validation, du traitement des événements, du comportement des timers, du nettoyage

## Slots

Les slots définissent les paramètres que les utilisateurs configurent à la création d'une instance.

```typescript
interface RecipeSlotDef {
  id: string; // Unique within recipe (e.g. "lights", "timeout")
  name: string; // English label (fallback)
  description: string; // English description (fallback)
  type: "zone" | "equipment" | "number" | "duration" | "time" | "boolean";
  required: boolean;
  list?: boolean; // Allow multiple values (equipment lists)
  defaultValue?: unknown;
  constraints?: {
    equipmentType?: EquipmentType | EquipmentType[]; // Filter equipment selector
    min?: number;
    max?: number;
    crossZone?: boolean; // Allow picking equipments from any zone
    includeDescendants?: boolean; // Widen candidates to descendant zones
  };
}
```

### Portée d'un slot equipment : `crossZone` et `includeDescendants`

Par défaut, le picker d'un slot `equipment` est filtré sur les équipements qui vivent dans la `zone` de la recette. Deux contraintes élargissent cet ensemble :

| Contrainte           | Effet                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crossZone`          | Permet à l'utilisateur de choisir un équipement depuis **n'importe quelle** zone du système. Utile pour des triggers comme "le portail" qui appartient sémantiquement à une zone différente de l'action.      |
| `includeDescendants` | Élargit l'ensemble candidat à la zone de la recette **plus toutes les zones descendantes**. Utile quand les actionneurs (par ex. les lumières) vivent dans des sous-zones plutôt que directement dans `zone`. |

Les deux flags sont indépendants : `crossZone` ignore complètement la portée de zone, alors que `includeDescendants` conserve la portée enracinée à la zone mais inclut récursivement les enfants. Un picker avec les deux activés se comporte comme `crossZone` seul.

```typescript
slots: RecipeSlotDef[] = [
  { id: "zone", name: "Zone", description: "...", type: "zone", required: true },
  {
    id: "trigger",
    name: "Trigger equipment",
    description: "Equipment whose state change fires the recipe",
    type: "equipment",
    required: true,
    constraints: { crossZone: true }, // can be in another zone
  },
  {
    id: "lights",
    name: "Lights",
    description: "Lights to turn on",
    type: "equipment",
    required: true,
    list: true,
    constraints: {
      equipmentType: ["light_onoff", "light_dimmable"],
      includeDescendants: true, // lights may live in subzones of `zone`
    },
  },
];
```

**Patterns courants de slot :**

| Slot type   | Contrôle UI       | Format de valeur                      |
| ----------- | ----------------- | ------------------------------------- |
| `zone`      | Auto-rempli       | UUID de zone                          |
| `equipment` | Liste/cases       | UUID d'équipement (ou UUID[] si list) |
| `duration`  | Numérique + min   | `"10m"`, `"30s"`, `"1h"`              |
| `number`    | Saisie numérique  | Valeur numérique                      |
| `time`      | Sélecteur d'heure | Chaîne `"HH:MM"` (24 h)               |
| `boolean`   | Bascule           | `true` / `false`                      |

## Traductions (i18n)

Les traductions voyagent avec la recette, pas dans les fichiers de locale de la plateforme. Cela permet de hot-loader des recettes sans modifier `fr.json`/`en.json`.

### Comment ça marche

Chaque recette définit un record `i18n` qui mappe les codes de langue à des noms, descriptions et libellés de slot traduits :

```typescript
override readonly i18n: Record<string, RecipeLangPack> = {
  fr: {
    name: "Ma recette",
    description: "Ce qu'elle fait",
    slots: {
      lights: { name: "Lumieres", description: "Lumieres a controler" },
      timeout: { name: "Delai", description: "Delai avant extinction" },
    },
  },
  // Add more languages as needed
};
```

### Définitions de types

```typescript
interface RecipeLangPack {
  name: string;
  description: string;
  slots?: Record<string, RecipeSlotI18n>; // Keyed by slot id
}

interface RecipeSlotI18n {
  name: string;
  description: string;
}
```

### Résolution dans l'UI

Le frontend utilise des helpers depuis `ui/src/lib/recipe-i18n.ts` :

```typescript
recipeName(recipe, lang); // Recipe name with fallback
recipeDescription(recipe, lang); // Recipe description with fallback
recipeSlotName(recipe, slot, lang); // Slot name with fallback
recipeSlotDescription(recipe, slot, lang); // Slot description with fallback
```

Chaîne de fallback : `i18n[lang].name -> recipe.name` (anglais embarqué dans la classe).

### Ajouter une nouvelle langue

Ajoutez une nouvelle clé au record `i18n` dans la classe de votre recette. Aucun fichier de plateforme à modifier.

## RecipeContext

L'objet `ctx` injecté dans `validate()` et `start()` fournit :

| Propriété          | Type               | Usage                                                                                 |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------- |
| `eventBus`         | `EventBus`         | S'abonner aux événements typés                                                        |
| `equipmentManager` | `EquipmentManager` | Interroger l'état d'un équipement, exécuter des ordres                                |
| `zoneManager`      | `ZoneManager`      | Interroger les définitions de zones                                                   |
| `zoneAggregator`   | `ZoneAggregator`   | Interroger les données agrégées de zone                                               |
| `state`            | `RecipeStateStore` | Persister un état clé-valeur (survit au redémarrage, auto-notifie l'UI sur mutations) |
| `log(msg, level?)` | fonction           | Écrire dans le journal d'exécution de la recette                                      |

## Helpers partagés

Utilitaires réutilisables dans `src/recipes/engine/` :

| Module             | Exporte                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `duration.ts`      | `parseDuration(value)`, `formatDuration(ms)`                                   |
| `light-helpers.ts` | `isAnyLightOn()`, `turnOnLights()`, `turnOffLights()`, `setLightsBrightness()` |

## Événements de l'Event Bus

Événements clés auxquels les recettes s'abonnent typiquement :

| Event                    | Payload                                                   |
| ------------------------ | --------------------------------------------------------- |
| `zone.data.changed`      | `{ zoneId, aggregatedData: { motion, luminosity, ... } }` |
| `equipment.data.changed` | `{ equipmentId, alias, value, category }`                 |

## Cycle de vie

1. **Enregistrement** : `recipeManager.register(MyRecipe)`, crée une instance d'exemple pour extraire les métadonnées
2. **Instanciation** : l'utilisateur crée via l'API → `validate()` → persisté en SQLite → `start()`
3. **Restauration** : au redémarrage moteur, les instances activées sont chargées depuis la DB et `start()` est appelé
4. **Mise à jour** : `stop()` → mise à jour des params en DB → `validate()` → `start()` avec les nouveaux params
5. **Suppression** : `stop()` → retiré de la DB (cascade sur state + logs)

## Recettes existantes

| ID             | Description                                                            |
| -------------- | ---------------------------------------------------------------------- |
| `motion-light` | Allume les lumières au mouvement, les éteint après un délai            |
| `switch-light` | Bascule les lumières à l'appui sur bouton, timer de sécurité optionnel |

## Checklist

- [ ] La classe Recipe étend `Recipe` avec id, name, description, slots, i18n
- [ ] `validate()` vérifie tous les params, lève une erreur si invalide
- [ ] `start()` s'abonne aux événements, stocke les unsubs
- [ ] `stop()` annule tous les timers et désabonne (idempotent)
- [ ] Enregistré dans `src/index.ts`
- [ ] Tests écrits et passants
- [ ] `npx tsc --noEmit` passe
- [ ] Traductions françaises dans le record `i18n`
