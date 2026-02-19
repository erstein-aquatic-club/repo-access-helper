# Design : Calendrier Coach — Vue des assignations

**Date** : 2026-02-19
**Chantier** : §22 — Calendrier coach vue assignations

## Contexte

Les coachs n'ont pas de vue d'ensemble de leurs assignations. Ils doivent naviguer nageur par nageur pour voir ce qui est planifié. Besoin d'une vue calendrier mensuelle (similaire au Dashboard nageur) pour voir rapidement les séances assignées par créneau/jour, filtrées par groupe ou nageur.

## Décisions

- **Placement** : Nouvel onglet "Calendrier" dans Coach.tsx (`activeSection = "calendar"`)
- **Filtrage** : Toggle Groupe / Nageur avec Select ou Combobox
- **Indicateurs pills** : Présence d'assignation (oui/non) — colorée si ≥1 assignation sur le créneau
- **Détail jour** : Liste des assignations + bouton "Assigner une séance" (date pré-remplie)

## Architecture

```
CoachCalendar
  ├─ Filtre : Toggle groupe/nageur + Select/Combobox
  ├─ useCoachCalendarState(targetGroupId | targetUserId)
  │    ← api.getCoachAssignments(filters)
  │    → completionByISO (même format que Dashboard)
  ├─ CalendarHeader + CalendarGrid + DayCell (réutilisés)
  └─ Drawer jour sélectionné
       ├─ Liste des assignations (titre, créneau, type, groupe/nageur)
       └─ Bouton "Assigner une séance" (date pré-remplie)
```

## Flux de données

### Filtre en haut

- **Toggle** : "Groupe" / "Nageur" (même style que CoachAssignScreen)
- **Mode groupe** : Select dropdown (`getGroups()`)
- **Mode nageur** : Combobox avec recherche (`getAthletes()`)
- Le calendrier se met à jour à chaque changement de filtre

### Cellules du calendrier (DayCell)

Réutilisation directe du composant existant. Les pills AM/PM :
- **Colorée** (primary) = au moins 1 assignation sur ce créneau pour le filtre actif
- **Grise** = pas d'assignation
- **Pas de pill** = jour de repos (aucune assignation ni AM ni PM)

### Drawer du jour sélectionné

- **Header** : date formatée + nombre d'assignations
- **Liste** : carte par assignation avec :
  - Badge type (Nage / Muscu)
  - Titre de la séance
  - Créneau (Matin / Soir)
  - Cible (nom du groupe ou du nageur)
  - Statut (assigné / en cours / terminé)
- **Bouton CTA** : "Assigner une séance" → formulaire d'assignation avec date pré-remplie

### Nouvelle fonction API

`getCoachAssignments({ groupId?, userId?, from, to })` dans `src/lib/api/assignments.ts` :
- Requête Supabase sur `session_assignments`
- Filtre par `target_group_id` ou `target_user_id`
- Filtre par plage de dates (mois visible ± overflow)
- Jointure sur `swim_sessions_catalog` et `strength_sessions` pour le titre
- Retourne : `{ id, title, type, scheduledDate, scheduledSlot, targetLabel, status }`

## Composants réutilisés

| Composant | Source | Adaptation |
|-----------|--------|------------|
| CalendarHeader | `src/components/dashboard/CalendarHeader.tsx` | Aucune — navigation mois identique |
| CalendarGrid | `src/components/dashboard/CalendarGrid.tsx` | Aucune — même grid 7 colonnes |
| DayCell | `src/components/dashboard/DayCell.tsx` | Aucune — pills AM/PM déjà supportées |
| Select/Combobox | Shadcn UI | Déjà utilisés dans CoachAssignScreen |

## Composants nouveaux

| Composant | Rôle |
|-----------|------|
| `CoachCalendar.tsx` | Composant principal avec filtre + calendrier + drawer |
| `useCoachCalendarState.ts` | Hook état : fetch assignments, calcul completionByISO, navigation mois |
