# Design : Dossiers pour séances et exercices musculation

**Date** : 2026-02-15
**Scope** : Organisation des séances et exercices coach en dossiers
**Approche** : Table unique `strength_folders` avec type discriminant

## Contexte

Le coach dispose d'une liste plate de séances et d'exercices de musculation. Avec un catalogue grandissant, il a besoin de pouvoir les organiser en dossiers (ex: "Programme Hiver", "Pectoraux").

## Décisions

- **1 niveau** de profondeur (pas de sous-dossiers)
- **Dossiers séparés** pour séances (`type='session'`) et exercices (`type='exercise'`)
- **Table unique** `strength_folders` avec colonne `type` discriminante
- Items sans dossier affichés **en haut, hors dossier**
- Supprimer un dossier **ne supprime pas** son contenu (items retournent hors dossier)

## 1. Base de données

### Nouvelle table `strength_folders`

```sql
CREATE TABLE strength_folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('session', 'exercise')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Colonnes ajoutées

- `strength_sessions.folder_id INTEGER REFERENCES strength_folders(id) ON DELETE SET NULL`
- `dim_exercices.folder_id INTEGER REFERENCES strength_folders(id) ON DELETE SET NULL`

RLS : même politique que les tables existantes (accès coach/admin).

## 2. API

### Folders CRUD (`src/lib/api/strength.ts`)

- `getStrengthFolders(type: 'session' | 'exercise'): Promise<Folder[]>`
- `createStrengthFolder(name: string, type: 'session' | 'exercise'): Promise<Folder>`
- `renameStrengthFolder(id: number, name: string): Promise<void>`
- `deleteStrengthFolder(id: number): Promise<void>` — ON DELETE SET NULL
- `moveToFolder(itemId: number, folderId: number | null, table: 'strength_sessions' | 'dim_exercices'): Promise<void>`

### Types (`src/lib/api/types.ts`)

```typescript
export interface StrengthFolder {
  id: number;
  name: string;
  type: 'session' | 'exercise';
  sort_order: number;
}
```

Ajouter `folder_id?: number | null` sur `StrengthSessionTemplate` et `Exercise`.

## 3. UI — Liste avec dossiers repliables

Les dossiers apparaissent comme des sections repliables dans la liste existante.

```
┌─────────────────────────────────┐
│ [Recherche...]                  │
├─────────────────────────────────┤
│ Full Body A                     │  ← items sans dossier
│ Push Pull Legs B                │
├─────────────────────────────────┤
│ ▼ Programme Hiver  (3)    [···] │  ← dossier ouvert
│   │ Session Force 1             │
│   │ Session Force 2             │
│   │ Session Force 3             │
├─────────────────────────────────┤
│ ▶ Été Compet  (2)         [···] │  ← dossier fermé
└─────────────────────────────────┘
```

- Tap header = replier/déplier
- Menu `···` = Renommer, Supprimer
- Bouton "Nouveau dossier" dans le header de section

### Assignation aux dossiers

- **Dans le formulaire** : sélecteur "Dossier" optionnel (séances dans le builder, exercices dans le dialog)
- **Depuis la liste** : action "Déplacer vers..." dans le menu contextuel de chaque item

## 4. Fichiers impactés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/00021_strength_folders.sql` | Créer table + colonnes |
| `src/lib/api/types.ts` | Ajouter `StrengthFolder`, `folder_id` sur types existants |
| `src/lib/api/strength.ts` | CRUD folders + `moveToFolder` |
| `src/pages/coach/StrengthCatalog.tsx` | Intégrer dossiers dans les deux sections |
| `src/components/coach/strength/StrengthSessionBuilder.tsx` | Sélecteur dossier dans metadata |
| `src/components/coach/shared/SessionListView.tsx` | Support grouping par dossier |

## 5. Ce qui ne change PAS

- Le builder de séances (hormis ajout du sélecteur dossier)
- Les cartes d'exercices (StrengthExerciseCard)
- Le dialog de création/édition d'exercice (hormis ajout du sélecteur dossier)
- Les API calls existantes (sessions, exercices)
- Le module nageur (Strength.tsx)
