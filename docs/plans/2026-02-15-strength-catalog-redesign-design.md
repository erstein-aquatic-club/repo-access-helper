# Design : Refonte mobile-first du catalogue musculation coach

**Date** : 2026-02-15
**Scope** : List view + Builder + Catalogue exercices
**Approche** : Réutilisation des composants partagés (`coach/shared/`)

## Contexte

Le catalogue musculation coach (`StrengthCatalog.tsx`) est fonctionnel mais présente des problèmes UX sur mobile :
- Exercices empilés verticalement dans le builder (scroll excessif)
- Drag & drop HTML5 inutilisable sur iOS/Android
- Incohérence de style avec SwimCatalog (qui utilise les composants partagés)
- Pas de recherche/filtrage des séances
- Pas de métriques visuelles sur les cards séances

## Décisions

### Approche retenue : Refonte progressive avec composants partagés

Réutiliser `SessionListView`, `SessionMetadataForm`, `FormActions`, `DragDropList` en les adaptant pour la muscu. Refondre `StrengthExerciseForm` en compact card avec expand/collapse.

**Raisons** : Cohérence swim/strength, moins de duplication, maintenance simplifiée.

### Duplication de séance : Hors scope (sera ajoutée ultérieurement).

## 1. List View — Catalogue des séances

### Généraliser `SessionListView`

Actuellement typé pour `SwimSessionTemplate`. Introduire un pattern polymorphe via un slot `renderMetrics` et un type générique.

**Card séance muscu** :
```
┌──────────────────────────────────┐
│ Full Body A                      │
│ 🏋️ 6 exos • Endurance    [👁][✎][🗑]│
└──────────────────────────────────┘
```

Métriques affichées :
- Nombre d'exercices
- Cycle (badge coloré : bleu=endurance, violet=hypertrophie, rouge=force)
- Actions : preview, edit, delete

Style : `rounded-2xl border-border` (identique swim).

### Recherche (optionnel, si le temps le permet)

Barre de recherche textuelle en haut de la liste, filtrant par titre. Même pattern que SwimCatalog si celui-ci en a une.

## 2. Session Builder — Création/édition

### Header

`FormActions` existant — aucun changement.

### Métadonnées

Adapter `SessionMetadataForm` :
- Champ **Titre** (texte)
- Sélecteur **Cycle** (Endurance / Hypertrophie / Force) via `additionalFields` slot
- Champ **Description** (textarea) via `additionalFields` slot
- Badge auto-calculé : nombre total de séries (somme des sets)

### Exercices — Compact Cards expand/collapse

Nouveau composant `StrengthExerciseCard` remplaçant `StrengthExerciseForm`.

**État collapsed** (défaut) — 1 card compacte :
```
┌──────────────────────────────────────┐
│ [↕] 1. Développé couché              │
│      3×8 @ 75% 1RM • 200s repos     │
└──────────────────────────────────────┘
```

- Tap sur la card = expand
- Numéro d'ordre affiché
- Résumé inline : `{sets}×{reps} @ {percent_1rm}% 1RM • {rest}s repos`

**État expanded** (après tap) :
```
┌──────────────────────────────────────┐
│ [↕] 1. Développé couché         [🗑] │
│ ┌─────────┬─────────┐               │
│ │ Séries  │ Reps    │               │
│ │   [3]   │   [8]   │               │
│ ├─────────┼─────────┤               │
│ │ % 1RM   │ Repos   │               │
│ │  [75]   │ [200s]  │               │
│ └─────────┴─────────┘               │
│ Exercice: [Select ▼]                │
│ Notes: [....................]        │
└──────────────────────────────────────┘
```

- Layout 2×2 pour les champs numériques (compact sur mobile)
- Sélecteur d'exercice en dessous
- Champ notes optionnel
- Bouton supprimer visible uniquement en mode expanded

### Réordonnement

Utiliser `DragDropList` existant avec boutons `↑`/`↓` (touch-friendly). Remplace le HTML5 drag actuel qui ne fonctionne pas sur mobile.

### Bouton ajouter

Bouton "Ajouter un exercice" sticky ou en fin de liste. Même style que SwimCatalog.

## 3. Catalogue exercices (section sous les séances)

- Passer de grid (`md:grid-cols-2`) à liste compacte verticale
- Chaque exercice = 1 ligne : thumbnail GIF (si dispo) + nom + badge type
- Actions inline (edit, delete) — boutons icônes
- Bouton "Ajouter un exercice" en haut de la section
- Dialog de création/édition inchangé (fonctionne bien)

## 4. Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/components/coach/shared/SessionListView.tsx` | Généraliser (type générique + slot metrics) |
| `src/components/coach/shared/SessionMetadataForm.tsx` | Ajouter slot description |
| `src/components/coach/strength/StrengthExerciseForm.tsx` | Remplacer par `StrengthExerciseCard.tsx` |
| `src/components/coach/strength/StrengthSessionBuilder.tsx` | Refondre (SessionMetadataForm + DragDropList + StrengthExerciseCard) |
| `src/pages/coach/StrengthCatalog.tsx` | Simplifier (utiliser SessionListView, nettoyer state) |

## 5. Ce qui ne change PAS

- Dialogues de création/édition d'exercice (fonctionnent bien)
- `FormActions` (déjà partagé et utilisé)
- API calls et mutations (inchangés)
- Logic métier (`createStrengthItemFromExercise`, cycle tabs, etc.)
