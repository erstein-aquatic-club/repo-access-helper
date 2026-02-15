# Strength Catalog Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refonte mobile-first du catalogue musculation coach avec compact cards, composants partagés, et cohérence visuelle avec SwimCatalog.

**Architecture:** Généraliser `SessionListView` pour accepter swim ou strength via render props. Remplacer `StrengthExerciseForm` par un `StrengthExerciseCard` compact avec expand/collapse. Intégrer `DragDropList` pour le réordonnement touch-friendly. Utiliser `SessionMetadataForm` via son slot `additionalFields`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Radix UI/Shadcn, Lucide icons

**Design doc:** `docs/plans/2026-02-15-strength-catalog-redesign-design.md`

---

### Task 1: Create `StrengthExerciseCard` — compact/expanded component

**Files:**
- Create: `src/components/coach/strength/StrengthExerciseCard.tsx`
- Reference: `src/components/coach/strength/StrengthExerciseForm.tsx` (will be replaced later)

**Step 1: Create the StrengthExerciseCard component**

Create `src/components/coach/strength/StrengthExerciseCard.tsx` with:

```tsx
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Exercise, StrengthSessionItem } from "@/lib/api";

interface StrengthExerciseCardProps {
  exercise: StrengthSessionItem;
  exercises: Exercise[];
  exerciseFilter: "all" | "strength" | "warmup";
  index: number;
  onChange: (field: string, value: string | number | null) => void;
  onDelete: () => void;
}

export function StrengthExerciseCard({
  exercise,
  exercises,
  exerciseFilter,
  index,
  onChange,
  onDelete,
}: StrengthExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);

  const filteredExercises = exercises.filter((ex) => {
    if (exerciseFilter === "all") return true;
    return ex.exercise_type === exerciseFilter;
  });

  const currentExercise = exercises.find((ex) => ex.id === exercise.exercise_id);
  const exerciseName = currentExercise?.nom_exercice ?? "Exercice";
  const isWarmup = currentExercise?.exercise_type === "warmup";

  return (
    <Card
      className={cn(
        "rounded-2xl border-border transition-all",
        expanded && "ring-1 ring-primary/20"
      )}
    >
      {/* Collapsed header — always visible */}
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{exerciseName}</span>
            {isWarmup && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Échauf.
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {exercise.sets}&times;{exercise.reps}
            {exercise.percent_1rm ? ` @ ${exercise.percent_1rm}% 1RM` : ""}
            {exercise.rest_seconds ? ` \u00b7 ${exercise.rest_seconds}s repos` : ""}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Séries</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={exercise.sets === 0 ? "" : exercise.sets}
                onChange={(e) => onChange("sets", e.target.value === "" ? 0 : Number(e.target.value))}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reps</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={exercise.reps === 0 ? "" : exercise.reps}
                onChange={(e) => onChange("reps", e.target.value === "" ? 0 : Number(e.target.value))}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">% 1RM</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={exercise.percent_1rm === 0 ? "" : exercise.percent_1rm}
                onChange={(e) => onChange("percent_1rm", e.target.value === "" ? 0 : Number(e.target.value))}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Repos (s)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={exercise.rest_seconds === 0 ? "" : exercise.rest_seconds}
                onChange={(e) => onChange("rest_seconds", e.target.value === "" ? 0 : Number(e.target.value))}
                className="rounded-xl h-10"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Exercice</Label>
            <Select
              value={exercise.exercise_id.toString()}
              onValueChange={(v) => onChange("exercise_id", parseInt(v))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filteredExercises.length ? (
                  filteredExercises.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id.toString()}>
                      {ex.nom_exercice}
                      {ex.exercise_type === "warmup" ? " \u00b7 \u00c9chauffement" : ""}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-exercise" disabled>
                    Aucun exercice disponible
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={exercise.notes ?? ""}
              onChange={(e) => onChange("notes", e.target.value || null)}
              placeholder="Notes optionnelles..."
              className="rounded-xl min-h-[60px]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors related to `StrengthExerciseCard`

**Step 3: Commit**

```bash
git add src/components/coach/strength/StrengthExerciseCard.tsx
git commit -m "feat: add StrengthExerciseCard compact/expanded component"
```

---

### Task 2: Refactor `StrengthSessionBuilder` — use shared components + compact cards

**Files:**
- Modify: `src/components/coach/strength/StrengthSessionBuilder.tsx`
- Reference: `src/components/coach/shared/SessionMetadataForm.tsx` (use `additionalFields` slot)
- Reference: `src/components/coach/shared/DragDropList.tsx` (replace HTML5 drag)
- Reference: `src/components/coach/strength/StrengthExerciseCard.tsx` (from Task 1)

**Step 1: Rewrite StrengthSessionBuilder**

Replace the entire content of `src/components/coach/strength/StrengthSessionBuilder.tsx` with:

```tsx
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Filter, Plus } from "lucide-react";
import { SessionMetadataForm } from "../shared/SessionMetadataForm";
import { DragDropList } from "../shared/DragDropList";
import { FormActions } from "../shared/FormActions";
import { StrengthExerciseCard } from "./StrengthExerciseCard";
import type { Exercise, StrengthCycleType, StrengthSessionItem, StrengthSessionTemplate } from "@/lib/api";

interface StrengthSessionBuilderProps {
  session: {
    title: string;
    description: string;
    cycle: StrengthCycleType;
    items: StrengthSessionItem[];
  };
  exercises: Exercise[];
  editingSessionId: number | null;
  onSessionChange: (session: {
    title: string;
    description: string;
    cycle: StrengthCycleType;
    items: StrengthSessionItem[];
  }) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddItem: () => void;
  onUpdateItem: (index: number, field: string, value: string | number | null) => void;
  onRemoveItem: (index: number) => void;
  onReorderItems: (fromIndex: number, toIndex: number) => void;
  onExerciseDialogOpen: () => void;
  isSaving?: boolean;
}

const normalizeStrengthCycle = (value?: string | null): StrengthCycleType => {
  if (value === "endurance" || value === "hypertrophie" || value === "force") {
    return value;
  }
  return "endurance";
};

export function StrengthSessionBuilder({
  session,
  exercises,
  editingSessionId,
  onSessionChange,
  onSave,
  onCancel,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onExerciseDialogOpen,
  isSaving,
}: StrengthSessionBuilderProps) {
  const [exerciseFilter, setExerciseFilter] = useState<"all" | "strength" | "warmup">("all");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]));
  const totalSets = session.items.reduce((sum, item) => sum + (item.sets || 0), 0);

  const handleMoveUp = (index: number) => {
    if (index > 0) onReorderItems(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index < session.items.length - 1) onReorderItems(index, index + 1);
  };

  const handlePreview = () => {
    setDetailDialogOpen(true);
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-4">
      <FormActions
        isEditing={Boolean(editingSessionId)}
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
        onPreview={handlePreview}
      />

      <div className="p-4 space-y-4">
        {/* Metadata — reuse shared SessionMetadataForm */}
        <SessionMetadataForm
          name={session.title}
          onNameChange={(value) => onSessionChange({ ...session, title: value })}
          showDuration={false}
          showTotalDistance={false}
          additionalFields={
            <>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Cycle</div>
                <div className="mt-1">
                  <Select
                    value={session.cycle}
                    onValueChange={(value) =>
                      onSessionChange({ ...session, cycle: normalizeStrengthCycle(value) })
                    }
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="endurance">Endurance</SelectItem>
                      <SelectItem value="hypertrophie">Hypertrophie</SelectItem>
                      <SelectItem value="force">Force</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Séries totales</div>
                <div className="mt-1 rounded-2xl border border-border bg-muted px-3 py-2 text-sm font-semibold">
                  {totalSets}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-xs font-semibold text-muted-foreground">Description</div>
                <div className="mt-1">
                  <Textarea
                    value={session.description}
                    onChange={(e) => onSessionChange({ ...session, description: e.target.value })}
                    placeholder="Description optionnelle..."
                    className="rounded-2xl min-h-[60px]"
                  />
                </div>
              </div>
            </>
          }
        />

        {/* Exercise list header */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">
            Exercices ({session.items.length})
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={exerciseFilter}
              onValueChange={(value: "all" | "strength" | "warmup") => setExerciseFilter(value)}
            >
              <SelectTrigger className="h-8 w-auto gap-1 rounded-full border-dashed text-xs">
                <Filter className="h-3 w-3" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="strength">Travail</SelectItem>
                <SelectItem value="warmup">Échauf.</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Exercise list — DragDropList with compact cards */}
        <DragDropList
          items={session.items}
          className="space-y-2"
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onDelete={onRemoveItem}
          renderItem={(item, index) => (
            <StrengthExerciseCard
              exercise={item}
              exercises={exercises}
              exerciseFilter={exerciseFilter}
              index={index}
              onChange={(field, value) => onUpdateItem(index, field, value)}
              onDelete={() => onRemoveItem(index)}
            />
          )}
        />

        {/* Add exercise buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddItem}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Ajouter un exercice
          </button>
          <button
            type="button"
            onClick={onExerciseDialogOpen}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Nouvel exercice
          </button>
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Aperçu de la séance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold">{session.title || "Sans titre"}</p>
              <p className="text-sm text-muted-foreground">{session.description || "—"}</p>
              <p className="text-sm text-muted-foreground">Cycle : {session.cycle}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Exercices</p>
              <div className="space-y-2">
                {session.items
                  .slice()
                  .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                  .map((item, index) => {
                    const exercise = exerciseById.get(item.exercise_id);
                    return (
                      <div
                        key={`${item.exercise_id}-${index}`}
                        className="rounded-xl border px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {index + 1}. {exercise?.nom_exercice ?? "Exercice"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {exercise?.exercise_type === "warmup" ? "Échauffement" : "Travail"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.sets} séries &bull; {item.reps} reps &bull; {item.percent_1rm}% 1RM &bull;{" "}
                          {item.rest_seconds}s
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors. The props interface is unchanged so `StrengthCatalog.tsx` still works.

**Step 3: Commit**

```bash
git add src/components/coach/strength/StrengthSessionBuilder.tsx
git commit -m "refactor: StrengthSessionBuilder uses shared components + compact cards"
```

---

### Task 3: Generalize `SessionListView` — accept strength sessions via render props

**Files:**
- Modify: `src/components/coach/shared/SessionListView.tsx`
- Modify: `src/pages/coach/SwimCatalog.tsx` (update usage to pass new required props)

**Step 1: Refactor SessionListView to generic type**

Replace the entire `SessionListView.tsx` with a generic version. The key changes:
- Add generic type `T extends { id: number }`
- Replace hardcoded metrics with `renderTitle(session)` and `renderMetrics(session)` props
- Remove swim-specific imports (`calculateSwimTotalDistance`)
- Make `onArchive` optional (strength doesn't use archive)

```tsx
import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Archive, Pencil, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionListViewProps<T extends { id: number }> {
  sessions: T[];
  isLoading?: boolean;
  error?: Error | null;
  renderTitle: (session: T) => string;
  renderMetrics: (session: T) => React.ReactNode;
  onPreview: (session: T) => void;
  onEdit: (session: T) => void;
  onArchive?: (session: T) => void;
  onDelete: (session: T) => void;
  canDelete: (sessionId: number) => boolean;
  isDeleting?: boolean;
}

export function SessionListView<T extends { id: number }>({
  sessions,
  isLoading,
  error,
  renderTitle,
  renderMetrics,
  onPreview,
  onEdit,
  onArchive,
  onDelete,
  canDelete,
  isDeleting,
}: SessionListViewProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`skeleton-${i}`} className="rounded-2xl border-border">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-semibold">Impossible de charger les données</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {error instanceof Error ? error.message : "Une erreur s'est produite"}
        </p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
        Aucune séance trouvée. Crée une nouvelle séance pour commencer.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const canDeleteSession = canDelete(session.id);
        const deleteDisabled = !canDeleteSession || isDeleting;

        return (
          <Card key={session.id} className="rounded-2xl border-border">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold tracking-tight truncate">
                    {renderTitle(session)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {renderMetrics(session)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onPreview(session)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                    aria-label="Aperçu"
                    title="Aperçu"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(session)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                    aria-label="Modifier"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {onArchive && (
                    <button
                      type="button"
                      onClick={() => onArchive(session)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                      aria-label="Archiver"
                      title="Archiver"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (deleteDisabled) return;
                      onDelete(session);
                    }}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted",
                      deleteDisabled && "cursor-not-allowed text-muted-foreground"
                    )}
                    aria-label="Supprimer"
                    title={canDeleteSession ? "Supprimer" : "Suppression indisponible"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
```

**Step 2: Update SwimCatalog to use new generic SessionListView**

In `src/pages/coach/SwimCatalog.tsx`, the `SessionListView` usage needs `renderTitle` and `renderMetrics` props. Add the swim-specific metrics logic that was removed from `SessionListView` into SwimCatalog.

Add these imports at the top of SwimCatalog:
```tsx
import { Route, Timer, Layers } from "lucide-react";
import { calculateSwimTotalDistance } from "@/lib/swimSessionUtils";
```

Add these helpers inside the component (or above it):
```tsx
const countBlocks = (items: SwimSessionItem[] = []) => {
  const keys = new Set(
    items.map((item) => {
      const raw = item.raw_payload as Record<string, unknown> | null;
      return raw?.block_title || raw?.section || "Bloc";
    }),
  );
  return keys.size;
};
```

Update each `<SessionListView` usage to pass the new required props:
```tsx
<SessionListView
  sessions={visibleSessions}
  isLoading={sessionsLoading}
  error={sessionsError}
  renderTitle={(session) => session.name}
  renderMetrics={(session) => {
    const totalDistance = calculateSwimTotalDistance(session.items ?? []);
    const hasDuration = session.items?.some((item) => item.duration != null) ?? false;
    const totalDuration = hasDuration
      ? session.items?.reduce((sum, item) => sum + (item.duration ?? 0), 0) ?? 0
      : null;
    const blockCount = countBlocks(session.items ?? []);
    return (
      <>
        <span className="inline-flex items-center gap-1">
          <Route className="h-3.5 w-3.5" />
          {totalDistance}m
        </span>
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3.5 w-3.5" />
          ~{totalDuration ?? "—"} min
        </span>
        <span className="inline-flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          {blockCount}
        </span>
      </>
    );
  }}
  onPreview={setSelectedSession}
  onEdit={handleEdit}
  onArchive={handleArchive}
  onDelete={handleDelete}
  canDelete={(sessionId) => canDeleteSwimCatalog(sessionId, assignments ?? null)}
  isDeleting={deleteSession.isPending}
/>
```

Do the same for the loading skeleton `<SessionListView` call (the one at line ~374 with `isLoading={true}`). Since it's loading, the render props won't be called, but TypeScript requires them:
```tsx
<SessionListView
  sessions={[]}
  isLoading={true}
  renderTitle={() => ""}
  renderMetrics={() => null}
  onPreview={() => {}}
  onEdit={() => {}}
  onArchive={() => {}}
  onDelete={() => {}}
  canDelete={() => false}
/>
```

Remove the `assignments` prop from SwimCatalog's SessionListView calls (it's no longer part of the generic interface — the delete tooltip logic was simplified).

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors. SwimCatalog compiles with the new generic API.

**Step 4: Commit**

```bash
git add src/components/coach/shared/SessionListView.tsx src/pages/coach/SwimCatalog.tsx
git commit -m "refactor: generalize SessionListView with render props for swim/strength"
```

---

### Task 4: Refactor `StrengthCatalog` list view — use `SessionListView`

**Files:**
- Modify: `src/pages/coach/StrengthCatalog.tsx`

**Step 1: Refactor the list view section**

In `StrengthCatalog.tsx`, make these changes:

1. **Add imports** for `SessionListView`, `Search`, `Dumbbell`:
```tsx
import { SessionListView } from "@/components/coach/shared/SessionListView";
import { Search, Dumbbell } from "lucide-react";
```

2. **Add search state** near other state declarations:
```tsx
const [searchQuery, setSearchQuery] = useState("");
```

3. **Add filtered sessions** memo:
```tsx
const filteredSessions = useMemo(() => {
  if (!sessions) return [];
  if (!searchQuery.trim()) return sessions;
  const q = searchQuery.toLowerCase();
  return sessions.filter((s) => s.title?.toLowerCase().includes(q));
}, [sessions, searchQuery]);
```

4. **Replace the list view section** (the `return` block when `!isCreating`, lines ~917-1022). Replace the session grid and exercise catalog with the new layout using `SessionListView`:

The main return (when `!isCreating`) becomes:
```tsx
return (
  <div>
    {exerciseCreateDialog}
    {exerciseEditDialog}
    {deleteSessionDialog}
    {deleteExerciseDialog}

    {/* Header */}
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div>
        <div className="text-base font-semibold">Musculation</div>
        <div className="text-xs text-muted-foreground">Catalogue</div>
      </div>
      <button
        type="button"
        onClick={() => {
          setEditingSessionId(null);
          setNewSession({ title: "", description: "", cycle: "endurance", items: [] });
          setIsCreating(true);
        }}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
      >
        <Plus className="h-4 w-4" /> Nouvelle
      </button>
    </div>

    <div className="p-4 space-y-6">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Rechercher une séance"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Sessions list */}
      <SessionListView
        sessions={filteredSessions}
        renderTitle={(session) => session.title ?? "Sans titre"}
        renderMetrics={(session) => {
          const count = session.items?.length ?? 0;
          const cycleBadgeClass =
            session.cycle === "force"
              ? "bg-red-100 text-red-800"
              : session.cycle === "hypertrophie"
                ? "bg-violet-100 text-violet-800"
                : "bg-blue-100 text-blue-800";
          return (
            <>
              <span className="inline-flex items-center gap-1">
                <Dumbbell className="h-3.5 w-3.5" />
                {count} exo{count > 1 ? "s" : ""}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cycleBadgeClass)}>
                {session.cycle}
              </span>
            </>
          );
        }}
        onPreview={(session) => startEditSession(session)}
        onEdit={(session) => startEditSession(session)}
        onDelete={(session) => setPendingDeleteSession(session)}
        canDelete={() => true}
        isDeleting={deleteSession.isPending}
      />

      {/* Exercise catalog — compact list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Exercices ({exercises?.length ?? 0})</div>
          <button
            type="button"
            onClick={() => setExerciseDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>

        <div className="space-y-1">
          {exercises?.map((exercise) => (
            <div
              key={exercise.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted/50"
            >
              {exercise.illustration_gif ? (
                <img
                  src={exercise.illustration_gif}
                  alt={exercise.nom_exercice}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Dumbbell className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{exercise.nom_exercice}</div>
                <div className="text-xs text-muted-foreground">
                  {exercise.exercise_type === "warmup" ? "Échauffement" : "Séries de travail"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEditExercise(exercise)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                  aria-label="Modifier"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteExercise(exercise)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
```

5. **Add missing imports** if not already present: `useMemo`, `cn`, `Search`, `Dumbbell`, `SessionListView`. Remove `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`, `Eye` if no longer used.

6. **Remove the loading skeleton** — `SessionListView` handles its own loading state. Remove the `isLoading` return block and instead pass `isLoading` to `SessionListView`. Wrap the full page in a loading check for exercises only.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/pages/coach/StrengthCatalog.tsx
git commit -m "refactor: StrengthCatalog uses SessionListView, search, compact exercise list"
```

---

### Task 5: Clean up — remove old StrengthExerciseForm, verify no regressions

**Files:**
- Delete: `src/components/coach/strength/StrengthExerciseForm.tsx` (replaced by StrengthExerciseCard)
- Verify: No other file imports `StrengthExerciseForm`

**Step 1: Check for remaining imports of StrengthExerciseForm**

Run: `grep -r "StrengthExerciseForm" src/`
Expected: Only the old `StrengthSessionBuilder.tsx` import, which was already replaced in Task 2.

**Step 2: Delete the old file**

```bash
rm src/components/coach/strength/StrengthExerciseForm.tsx
```

**Step 3: Run full type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: Both pass with no errors.

**Step 4: Run tests**

Run: `npm test`
Expected: All 27 test files pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated StrengthExerciseForm, replaced by StrengthExerciseCard"
```

---

### Task 6: Update documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/FEATURES_STATUS.md`

**Step 1: Add implementation-log entry**

Append a new section to `docs/implementation-log.md` documenting:
- Context: Refonte mobile-first du catalogue musculation coach
- Changes: SessionListView generalized, StrengthExerciseCard created, StrengthSessionBuilder refactored, StrengthCatalog simplified
- Files modified/created/deleted
- Decisions: Approach A (shared components), compact cards with expand/collapse, DragDropList for touch reordering
- Limits: No session duplication (deferred)

**Step 2: Update FEATURES_STATUS.md**

Update the Strength Coach section to reflect the improved state of the feature.

**Step 3: Commit**

```bash
git add docs/implementation-log.md docs/FEATURES_STATUS.md
git commit -m "docs: log strength catalog redesign implementation"
```
