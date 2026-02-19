# Design : Calendrier Coach — Slots éditables inline

**Date** : 2026-02-19
**Chantier** : §22b — Refonte drawer calendrier coach avec assignation inline

## Contexte

Le drawer du calendrier coach affiche actuellement une liste passive d'assignations avec un bouton qui redirige vers CoachAssignScreen. Le coach doit pouvoir assigner/modifier/supprimer des séances directement depuis le drawer, sans changer de page. Le contexte groupe/nageur est hérité du filtre calendrier.

## Modèle de slots

Chaque jour a **3 slots fixes** :

| Slot | Type | Créneau |
|------|------|---------|
| Nage Matin | swim | morning |
| Nage Soir | swim | evening |
| Musculation | strength | aucun (libre) |

## Décisions

- **Assignation inline** : Select du catalogue directement dans le drawer (pas de navigation)
- **Contexte hérité** : le `groupId` ou `userId` actif dans le filtre calendrier est utilisé pour `assignments_create`
- **Remplacement** : supprimer l'ancien (`assignments_delete`) + créer le nouveau (`assignments_create`)
- **Pills DayCell** : AM = nage matin, PM = nage soir, + dot supplémentaire pour muscu

## Day Drawer

```
┌──────────────────────────────────┐
│  Mercredi 19 février             │
│                                  │
│  🏊 Nage — Matin                 │
│  ┌─ [Endurance 3km] ──────────┐ │
│  │  ✕ supprimer   ↻ changer   │ │
│  └─────────────────────────────┘ │
│                                  │
│  🏊 Nage — Soir                  │
│  ┌─ Aucune séance ─────────────┐ │
│  │  [+ Choisir une séance]     │ │
│  └─────────────────────────────┘ │
│                                  │
│  🏋️ Musculation                  │
│  ┌─ [Full body force] ─────────┐ │
│  │  ✕ supprimer   ↻ changer   │ │
│  └─────────────────────────────┘ │
└──────────────────────────────────┘
```

### Slot vide
- Bouton "Choisir une séance" → ouvre un Select inline avec le catalogue filtré (swim pour nage, strength pour muscu)

### Slot rempli
- Titre de la séance
- Bouton "supprimer" → `assignments_delete()` + invalidate query
- Bouton "changer" → supprime l'ancien, ouvre le Select pour choisir le nouveau

## Flux de données

1. Coach clique un jour → drawer s'ouvre avec les 3 slots pré-remplis selon les assignations existantes
2. Le hook `useCoachCalendarState` fournit les assignations indexées par date
3. Le composant mappe les assignations aux 3 slots selon `assignment_type` + `scheduled_slot`
4. Actions (assigner/supprimer/changer) appellent `assignments_create`/`assignments_delete` avec le `groupId`/`userId` du filtre actif
5. `invalidateQueries(["coach-calendar-assignments"])` rafraîchit le calendrier

## Pills DayCell

Le `completionByISO` garde le format AM/PM existant pour les pills nage. Pour la muscu :
- Le `CoachAssignment` retourné par l'API inclut le type (`swim`/`strength`)
- On ajoute un 3e indicateur (petit dot ou icône) dans le DayCell pour signaler une assignation muscu
