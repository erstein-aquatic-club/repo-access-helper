# Swim Inline Technical Logs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow swimmers to enter technical details (times, tempo, stroke count) per exercise directly from the session timeline view, with inline expansion and per-rep data entry.

**Architecture:** Enrich the existing `SwimSessionView` page to support inline exercise expansion with a log form. The `SwimSessionTimeline` component gets new optional props for edit mode. A new `ExerciseLogInline` component handles per-exercise form rendering. An `ensureSwimSession` API helper auto-creates a `dim_sessions` entry if the swimmer hasn't submitted feedback yet.

**Tech Stack:** React 19, TypeScript, React Query 5, Supabase, Tailwind CSS 4, Zustand

---

## Context

### Key Files

| File | Role |
|------|------|
| `src/pages/SwimSessionView.tsx` | Page `/swim-session` — currently read-only timeline |
| `src/components/swim/SwimSessionTimeline.tsx` | Timeline component (~555 lines) |
| `src/lib/api/swim-logs.ts` | CRUD for `swim_exercise_logs` table |
| `src/lib/api/types.ts` | `SwimExerciseLog`, `SwimExerciseLogInput`, `SplitTimeEntry`, `StrokeCountEntry` |
| `src/lib/swimConsultationUtils.ts` | `groupItemsByBlock`, `BlockGroup` |
| `src/components/dashboard/FeedbackDrawer.tsx` | Current location of technical notes form |
| `src/components/dashboard/TechnicalNotesSection.tsx` | Current per-exercise form |
| `src/lib/api.ts` | `syncSession` — creates `dim_sessions` entries |
| `src/lib/api/helpers.ts` | `mapToDbSession` — maps session data to DB format |

### DB Schema (unchanged)

```sql
-- swim_exercise_logs (migration 00017)
id UUID PK, session_id INTEGER NOT NULL REFERENCES dim_sessions(id),
user_id UUID NOT NULL, exercise_label TEXT NOT NULL,
source_item_id INTEGER REFERENCES swim_session_items(id),
split_times JSONB DEFAULT '[]', tempo NUMERIC(5,2),
stroke_count JSONB DEFAULT '[]', notes TEXT
```

### Critical Constraint

`swim_exercise_logs.session_id` references `dim_sessions(id)` NOT NULL. A `dim_sessions` entry is created only when the swimmer submits feedback via the Dashboard FeedbackDrawer. The swimmer may open SwimSessionView **before** submitting feedback → we need an `ensureSwimSession` helper.

---

## Task 1: Add `ensureSwimSession` API helper

**Files:**
- Modify: `src/lib/api.ts` (add new method to the `api` object, around line 225)

**Step 1: Add the `ensureSwimSession` method**

Add after `syncSession` in `src/lib/api.ts`:

```typescript
async ensureSwimSession(params: {
  athleteName: string;
  athleteId?: number | string | null;
  date: string;       // ISO date "2026-02-21"
  slot: string;       // "Matin" or "Soir"
}): Promise<number> {
  if (!canUseSupabase()) throw new Error("Supabase required");

  // Check for existing session
  let query = supabase
    .from("dim_sessions")
    .select("id")
    .eq("session_date", params.date)
    .eq("time_slot", params.slot);

  if (params.athleteId) {
    query = query.eq("athlete_id", Number(params.athleteId));
  } else {
    query = query.eq("athlete_name", params.athleteName);
  }

  const { data: existing } = await query.maybeSingle();
  if (existing?.id) return existing.id as number;

  // Create minimal session
  const payload: Record<string, unknown> = {
    athlete_name: params.athleteName,
    session_date: params.date,
    time_slot: params.slot,
    distance: 0,
    duration: 0,
    rpe: 5,
    performance: 5,
    engagement: 5,
    fatigue: 5,
  };
  if (params.athleteId) payload.athlete_id = Number(params.athleteId);

  const { data, error } = await supabase
    .from("dim_sessions")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
},
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors from `api.ts`

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): add ensureSwimSession helper for technical logs"
```

---

## Task 2: Create `ExerciseLogInline` component

**Files:**
- Create: `src/components/swim/ExerciseLogInline.tsx`

**Step 1: Create the component**

Create `src/components/swim/ExerciseLogInline.tsx`:

```tsx
import { useState } from "react";
import { Timer, Activity, Hash, ChevronUp, FileText } from "lucide-react";
import type { SwimExerciseLogInput, SplitTimeEntry, StrokeCountEntry, SwimSessionItem } from "@/lib/api";
import type { SwimPayloadFields } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ExerciseLogInlineProps {
  item: SwimSessionItem;
  log: SwimExerciseLogInput;
  onChange: (log: SwimExerciseLogInput) => void;
  onCollapse: () => void;
}

/** Parse the number of repetitions from item payload or label */
export function detectRepetitions(item: SwimSessionItem): number {
  const payload = (item.raw_payload as SwimPayloadFields) ?? {};
  const fromPayload = Number(payload.exercise_repetitions);
  if (Number.isFinite(fromPayload) && fromPayload > 0) return fromPayload;

  // Parse from label: "6x50m" → 6
  const label = item.label ?? "";
  const match = label.match(/^(\d+)\s*[x×]/i);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 1;
}

export function ExerciseLogInline({ item, log, onChange, onCollapse }: ExerciseLogInlineProps) {
  const repCount = detectRepetitions(item);
  const splits = log.split_times ?? [];
  const strokes = log.stroke_count ?? [];

  // Ensure splits/strokes arrays match repCount
  const ensuredSplits: SplitTimeEntry[] = Array.from({ length: repCount }, (_, i) => (
    splits[i] ?? { rep: i + 1, time_seconds: 0 }
  ));
  const ensuredStrokes: StrokeCountEntry[] = Array.from({ length: repCount }, (_, i) => (
    strokes[i] ?? { rep: i + 1, count: 0 }
  ));

  const [showStrokes, setShowStrokes] = useState(strokes.some((s) => s.count > 0));

  const updateSplit = (index: number, time_seconds: number) => {
    const updated = ensuredSplits.map((s, i) =>
      i === index ? { ...s, time_seconds } : s
    );
    onChange({ ...log, split_times: updated });
  };

  const updateStroke = (index: number, count: number) => {
    const updated = ensuredStrokes.map((s, i) =>
      i === index ? { ...s, count } : s
    );
    onChange({ ...log, stroke_count: updated });
  };

  return (
    <div className="border-t border-border/40 bg-muted/30 px-3 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
      {/* Collapse button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Détails techniques
        </span>
        <button
          type="button"
          onClick={onCollapse}
          className="p-1 rounded-lg text-muted-foreground hover:bg-muted transition"
          aria-label="Replier"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      {/* Tempo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground min-w-[72px]">
          <Activity className="h-3.5 w-3.5" />
          Tempo
        </div>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={0}
          value={log.tempo ?? ""}
          onChange={(e) => onChange({ ...log, tempo: e.target.value ? Number(e.target.value) : null })}
          placeholder="c/min"
          className="w-20 rounded-xl border border-border bg-background px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-foreground/10"
        />
      </div>

      {/* Per-rep times */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Timer className="h-3.5 w-3.5" />
          Temps par rep
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {ensuredSplits.map((split, i) => (
            <div key={`split-${i}`} className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-4 text-right font-medium">{i + 1}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                value={split.time_seconds || ""}
                onChange={(e) => updateSplit(i, Number(e.target.value) || 0)}
                placeholder="sec"
                className="w-full rounded-lg border border-border bg-background px-1.5 py-1.5 text-xs text-center outline-none focus:ring-2 focus:ring-foreground/10"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Per-rep stroke count (toggle) */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setShowStrokes((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          <Hash className="h-3.5 w-3.5" />
          Coups de bras
          <span className="text-[10px]">{showStrokes ? "▲" : "▼"}</span>
        </button>
        {showStrokes && (
          <div className="grid grid-cols-3 gap-1.5">
            {ensuredStrokes.map((stroke, i) => (
              <div key={`stroke-${i}`} className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground w-4 text-right font-medium">{i + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={stroke.count || ""}
                  onChange={(e) => updateStroke(i, Number(e.target.value) || 0)}
                  placeholder="nb"
                  className="w-full rounded-lg border border-border bg-background px-1.5 py-1.5 text-xs text-center outline-none focus:ring-2 focus:ring-foreground/10"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Notes
        </div>
        <textarea
          value={log.notes ?? ""}
          onChange={(e) => onChange({ ...log, notes: e.target.value || null })}
          placeholder="Notes libres..."
          rows={2}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep ExerciseLogInline`
Expected: No errors from this file

**Step 3: Commit**

```bash
git add src/components/swim/ExerciseLogInline.tsx
git commit -m "feat(swim): add ExerciseLogInline component for per-rep data entry"
```

---

## Task 3: Add edit mode props to `SwimSessionTimeline`

**Files:**
- Modify: `src/components/swim/SwimSessionTimeline.tsx`

This task adds new optional props to `SwimSessionTimeline` and renders the `ExerciseLogInline` form under expanded exercises. The component remains backward-compatible — existing usages (coach catalog, shared view) are unaffected since all new props are optional.

**Step 1: Add new props to the interface**

In `src/components/swim/SwimSessionTimeline.tsx`, modify the `SwimSessionTimelineProps` interface (line ~22):

```typescript
interface SwimSessionTimelineProps {
  title: string;
  description?: string;
  items?: SwimSessionItem[];
  showHeader?: boolean;
  onExerciseSelect?: (detail: SwimExerciseDetail) => void;
  // Edit mode props (all optional — backward compatible)
  exerciseLogs?: Map<number, SwimExerciseLogInput>;
  expandedItemId?: number | null;
  onToggleExpand?: (itemId: number) => void;
  onLogChange?: (itemId: number, log: SwimExerciseLogInput) => void;
}
```

Add import at top of file:
```typescript
import type { SwimExerciseLogInput } from "@/lib/api";
import { ExerciseLogInline } from "./ExerciseLogInline";
```

**Step 2: Destructure new props**

In the function signature (line ~117), add:

```typescript
export function SwimSessionTimeline({
  title: _title,
  description: _description,
  items = [],
  showHeader = true,
  onExerciseSelect,
  exerciseLogs,
  expandedItemId,
  onToggleExpand,
  onLogChange,
}: SwimSessionTimelineProps) {
```

**Step 3: Modify the exercise row click handler**

In the exercise row rendering (line ~366), replace the existing click handler logic. The row currently calls `onExerciseSelect` when clicked. When `onToggleExpand` is provided, use that instead:

Replace the `onClick` logic on the exercise `<div>` (around line 366-407):

```typescript
const isExpandable = Boolean(onToggleExpand && item.id != null);
const isExpanded = isExpandable && expandedItemId === item.id;
const hasLogData = item.id != null && exerciseLogs?.has(item.id);

const handleClick = isExpandable
  ? () => onToggleExpand!(item.id!)
  : onExerciseSelect
    ? () => onExerciseSelect(buildDetail(item, itemIndex, block, blockIndex))
    : undefined;

const exerciseRow = (
  <div
    key={`${block.key}-${itemIndex}`}
    className={cn(
      "py-2",
      itemIndex > 0 && "border-t border-border/40",
      (isExpandable || onExerciseSelect) && "cursor-pointer active:bg-muted/50 rounded",
    )}
  >
    <div
      onClick={handleClick}
      role={handleClick ? "button" : undefined}
      tabIndex={handleClick ? 0 : undefined}
      onKeyDown={handleClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      } : undefined}
    >
      {/* Existing exercise row content (label, badges, intensity, etc.) */}
      <div className="flex items-center gap-1.5">
        {/* ... keep all existing content unchanged ... */}

        {/* Add log indicator badge before spacer */}
        {hasLogData && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            ✓
          </span>
        )}

        {/* ... rest of existing row ... */}
      </div>

      {/* ... equipment row, modalities, etc. unchanged ... */}
    </div>

    {/* Inline log form (expanded) */}
    {isExpanded && item.id != null && onLogChange && (
      <ExerciseLogInline
        item={item}
        log={exerciseLogs?.get(item.id) ?? {
          exercise_label: item.label || `Exercice ${itemIndex + 1}`,
          source_item_id: item.id,
          split_times: [],
          tempo: null,
          stroke_count: [],
          notes: null,
        }}
        onChange={(log) => onLogChange(item.id!, log)}
        onCollapse={() => onToggleExpand!(item.id!)}
      />
    )}
  </div>
);
```

**Important:** The existing exercise row content (distance label, stroke badge, type badge, intensity text, equipment, modalities) stays exactly as-is. The only changes are:
1. Wrapping the clickable area in an inner `<div>` so the inline form is outside the click zone
2. Adding the `hasLogData` badge
3. Appending the `ExerciseLogInline` after the exercise content when expanded

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/components/swim/SwimSessionTimeline.tsx
git commit -m "feat(swim): add edit mode props to SwimSessionTimeline"
```

---

## Task 4: Rewrite `SwimSessionView` for inline editing

**Files:**
- Modify: `src/pages/SwimSessionView.tsx`

This is the main integration task. The page currently shows the timeline in read-only mode with a Sheet for exercise details. We replace that with inline expansion + save functionality.

**Step 1: Rewrite SwimSessionView**

Replace the content of `src/pages/SwimSessionView.tsx` with:

```tsx
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, AlertCircle, Share2, Save, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SwimSessionTimeline } from "@/components/swim/SwimSessionTimeline";
import { api, Assignment, SwimSessionItem, SwimExerciseLog, SwimExerciseLogInput } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { generateShareToken } from "@/lib/api/swim";
import { supabase } from "@/lib/supabase";

const statusLabels: Record<string, string> = {
  assigned: "Assignée",
  pending: "Assignée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const formatAssignedDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : format(parsed, "dd MMM", { locale: fr });
};

/** Build a logsMap from existing DB logs, keyed by source_item_id */
function buildLogsMap(logs: SwimExerciseLog[]): Map<number, SwimExerciseLogInput> {
  const map = new Map<number, SwimExerciseLogInput>();
  for (const log of logs) {
    if (log.source_item_id == null) continue;
    map.set(log.source_item_id, {
      exercise_label: log.exercise_label,
      source_item_id: log.source_item_id,
      split_times: log.split_times,
      tempo: log.tempo,
      stroke_count: log.stroke_count,
      notes: log.notes,
    });
  }
  return map;
}

/** Determine the time slot from assignment date */
function inferSlot(assignedDate?: string | null): string {
  if (!assignedDate) return "Matin";
  try {
    const hour = new Date(assignedDate).getHours();
    return hour >= 14 ? "Soir" : "Matin";
  } catch {
    return "Matin";
  }
}

export default function SwimSessionView() {
  const { user, userId } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [localLogs, setLocalLogs] = useState<Map<number, SwimExerciseLogInput> | null>(null);
  const [dirty, setDirty] = useState(false);

  const assignmentId = useMemo(() => {
    const [, queryString] = location.split("?");
    if (!queryString) return null;
    const params = new URLSearchParams(queryString);
    const id = params.get("assignmentId");
    const parsed = id ? Number(id) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [location]);

  // Load assignments
  const { data: assignments, isLoading, error, refetch } = useQuery({
    queryKey: ["assignments", user],
    queryFn: () => api.getAssignments(user!, userId),
    enabled: !!user,
  });

  type SwimAssignment = Assignment & { session_type: "swim"; items?: SwimSessionItem[] };
  const swimAssignments = assignments?.filter(
    (assignment): assignment is SwimAssignment => assignment.session_type === "swim",
  ) || [];
  const assignment = assignmentId
    ? swimAssignments.find((item) => item.id === assignmentId)
    : swimAssignments[0];

  // Load existing exercise logs
  const sessionCatalogId = assignment?.session_id;
  const { data: existingLogs } = useQuery({
    queryKey: ["swim-exercise-logs-by-catalog", sessionCatalogId, userId],
    queryFn: async () => {
      if (!sessionCatalogId || !userId) return [];
      // We need to find the dim_sessions entry that matches
      // For now, load logs via the catalog items' source_item_ids
      const { data: authData } = await supabase.auth.getSession();
      const authUid = authData.session?.user?.id;
      if (!authUid) return [];

      // Get all sessions for this user, then find logs
      const sessions = await api.getSessions(user!, userId);
      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length === 0) return [];

      // Load logs for all recent sessions, filter by source_item_ids from this assignment
      const allLogs: SwimExerciseLog[] = [];
      for (const sid of sessionIds.slice(0, 10)) {
        const logs = await api.getSwimExerciseLogs(sid);
        allLogs.push(...logs.filter((l) => l.user_id === authUid));
      }

      // Filter to logs that match items in this assignment
      const itemIds = new Set((assignment?.items ?? []).map((i) => i.id).filter(Boolean));
      return allLogs.filter((l) => l.source_item_id != null && itemIds.has(l.source_item_id));
    },
    enabled: !!sessionCatalogId && !!userId && !!user,
  });

  // Initialize localLogs from DB data
  const logsMap = useMemo(() => {
    if (localLogs) return localLogs;
    if (!existingLogs) return new Map<number, SwimExerciseLogInput>();
    return buildLogsMap(existingLogs);
  }, [localLogs, existingLogs]);

  const handleLogChange = useCallback((itemId: number, log: SwimExerciseLogInput) => {
    setLocalLogs((prev) => {
      const next = new Map(prev ?? logsMap);
      next.set(itemId, log);
      return next;
    });
    setDirty(true);
  }, [logsMap]);

  const handleToggleExpand = useCallback((itemId: number) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!assignment || !user) throw new Error("No assignment");
      const { data: authData } = await supabase.auth.getSession();
      const authUid = authData.session?.user?.id;
      if (!authUid) throw new Error("Not authenticated");

      // Ensure dim_sessions exists
      const dateStr = assignment.assigned_date
        ? new Date(assignment.assigned_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const slot = inferSlot(assignment.assigned_date);

      const sessionId = await api.ensureSwimSession({
        athleteName: user,
        athleteId: userId,
        date: dateStr,
        slot,
      });

      // Collect all logs
      const allLogs: SwimExerciseLogInput[] = [];
      for (const [itemId, log] of logsMap.entries()) {
        // Only save logs that have actual data
        const hasSplits = (log.split_times ?? []).some((s) => s.time_seconds > 0);
        const hasStrokes = (log.stroke_count ?? []).some((s) => s.count > 0);
        const hasData = hasSplits || hasStrokes || log.tempo != null || (log.notes?.trim());
        if (hasData) {
          allLogs.push({ ...log, source_item_id: itemId });
        }
      }

      await api.saveSwimExerciseLogs(sessionId, authUid, allLogs);
    },
    onSuccess: () => {
      setDirty(false);
      toast({ title: "Enregistré", description: "Notes techniques sauvegardées." });
      queryClient.invalidateQueries({ queryKey: ["swim-exercise-logs-by-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["swim-exercise-logs-history"] });
    },
    onError: (err) => {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    },
  });

  // Delete assignment
  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: number) => api.assignments_delete(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({ title: "Séance retirée", description: "La séance a été retirée de votre feed." });
      setLocation("/");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de retirer la séance.", variant: "destructive" });
    },
  });

  const handleShare = async () => {
    if (!assignment) return;
    try {
      const token = await generateShareToken(assignment.session_id);
      const url = `${window.location.origin}${window.location.pathname}#/s/${token}`;
      if (navigator.share) {
        await navigator.share({ title: assignment.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Lien copié !", description: "Le lien de partage a été copié dans le presse-papier." });
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de générer le lien de partage.", variant: "destructive" });
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-semibold">Impossible de charger les données</h3>
        <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="mt-4">Réessayer</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} aria-label="Retour">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Séance natation</div>
            <h1 className="text-2xl font-display font-bold uppercase">Détails</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {assignment && (
            <Button variant="ghost" size="icon" onClick={handleShare} aria-label="Partager">
              <Share2 className="h-5 w-5" />
            </Button>
          )}
          {assignment && (
            <Badge variant="secondary" className="text-xs">
              {statusLabels[assignment.status] ?? "Assignée"}
            </Badge>
          )}
        </div>
      </div>

      {/* Session card */}
      <Card className="border border-border shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <div className="text-lg font-semibold tracking-tight">
              {assignment?.title ?? "Séance natation"}
            </div>
            {assignment?.description && (
              <p className="text-sm text-muted-foreground">{assignment.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="outline" className="text-xs">
              {formatAssignedDate(assignment?.assigned_date)}
            </Badge>
            {assignment && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm("Retirer cette séance de votre feed ?")) {
                    deleteAssignmentMutation.mutate(assignment.id);
                  }
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Retirer de mon feed
              </Button>
            )}
          </div>
          <Separator />

          {/* Instruction */}
          <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Tapez sur un exercice pour ajouter vos temps et détails techniques.
          </div>

          {/* Timeline */}
          {isLoading ? (
            <div className="space-y-4" aria-live="polite" aria-busy="true">
              <Skeleton className="h-6 w-48" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          ) : assignment ? (
            <SwimSessionTimeline
              title={assignment.title}
              description={assignment.description}
              items={assignment.items}
              showHeader={true}
              exerciseLogs={logsMap}
              expandedItemId={expandedItemId}
              onToggleExpand={handleToggleExpand}
              onLogChange={handleLogChange}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-muted/70 bg-muted/30 p-6 text-sm text-muted-foreground">
              Aucune séance de natation assignée pour le moment.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky save button */}
      {dirty && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 px-4">
          <Button
            size="lg"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="shadow-lg rounded-2xl gap-2 min-w-[200px]"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Note:** The log loading strategy above is a first pass — it searches recent sessions to find matching logs. This can be optimized later if needed, but works correctly for the common case.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors from `SwimSessionView.tsx`

**Step 3: Manual test**

Run: `npm run dev`
1. Log in as a swimmer
2. Navigate to a swim session via Dashboard → "Voir la séance"
3. Verify the timeline renders with the instruction text
4. Tap on an exercise → inline form should appear
5. Fill in some times, tap another exercise → first collapses, second opens
6. "Enregistrer" button should appear at bottom
7. Click save → toast confirmation

**Step 4: Commit**

```bash
git add src/pages/SwimSessionView.tsx
git commit -m "feat(swim): rewrite SwimSessionView with inline technical log editing"
```

---

## Task 5: Simplify FeedbackDrawer's TechnicalNotesSection

**Files:**
- Modify: `src/components/dashboard/TechnicalNotesSection.tsx`
- Modify: `src/components/dashboard/FeedbackDrawer.tsx`

**Step 1: Simplify TechnicalNotesSection**

Replace the content of `src/components/dashboard/TechnicalNotesSection.tsx` to show a read-only summary + link:

```tsx
import { ChevronRight, Timer, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import type { SwimExerciseLogInput } from "@/lib/api";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

interface TechnicalNotesSectionProps {
  exerciseLogs: SwimExerciseLogInput[];
  assignmentId?: number;
  disabled?: boolean;
  onLogsChange: (logs: SwimExerciseLogInput[]) => void;
}

export function TechnicalNotesSection({
  exerciseLogs,
  assignmentId,
  disabled = false,
}: TechnicalNotesSectionProps) {
  const [, setLocation] = useLocation();
  const filledCount = exerciseLogs.filter((l) => {
    const hasSplits = (l.split_times ?? []).some((s) => s.time_seconds > 0);
    const hasStrokes = (l.stroke_count ?? []).some((s) => s.count > 0);
    return hasSplits || hasStrokes || l.tempo != null || l.notes?.trim();
  }).length;

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled || !assignmentId}
        onClick={() => {
          if (assignmentId) {
            setLocation(`/swim-session?assignmentId=${assignmentId}`);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm font-semibold transition",
          disabled || !assignmentId
            ? "text-muted-foreground border-border cursor-not-allowed"
            : "text-foreground border-border hover:bg-muted",
        )}
      >
        <span className="flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Notes techniques
          {filledCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
              <CheckCircle2 className="h-3 w-3" />
              {filledCount}
            </span>
          )}
        </span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
```

**Step 2: Update FeedbackDrawer usage**

In `src/components/dashboard/FeedbackDrawer.tsx`, find the `TechnicalNotesSection` usage (around line 720) and add the `assignmentId` prop:

```tsx
<TechnicalNotesSection
  exerciseLogs={draftState.exerciseLogs}
  assignmentId={activeSession?.assignmentId}
  disabled={!canRate}
  onLogsChange={(exerciseLogs) => onDraftStateChange({ ...draftState, exerciseLogs })}
/>
```

Also update the import to remove `SwimSessionItem` if it's no longer needed by TechnicalNotesSection, and remove `assignmentItems` prop since the simplified version doesn't need it.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/components/dashboard/TechnicalNotesSection.tsx src/components/dashboard/FeedbackDrawer.tsx
git commit -m "refactor(swim): simplify TechnicalNotesSection to link to timeline view"
```

---

## Task 6: Final verification and documentation

**Files:**
- Modify: `docs/implementation-log.md` (new entry)
- Modify: `docs/ROADMAP.md` (update chantier status)
- Modify: `docs/FEATURES_STATUS.md` (update feature status)
- Modify: `CLAUDE.md` (update chantier table)

**Step 1: Build check**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 2: Type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (pre-existing story/test errors are OK)

**Step 3: Run tests**

Run: `npm test 2>&1 | tail -20`
Expected: Pre-existing failures only

**Step 4: Manual end-to-end test**

Run: `npm run dev`
Full flow:
1. Login as swimmer → Dashboard
2. See assigned swim session → tap "Voir la séance"
3. Timeline renders with exercises
4. Tap "6x50m Crawl" → inline form expands with 6 rep lines
5. Enter times: 35.2, 34.8, 35.0, 34.5, 35.1, 34.7
6. Enter tempo: 42
7. Toggle stroke count, enter values
8. Add a note
9. Tap another exercise → first collapses
10. Click "Enregistrer" → toast "Notes techniques sauvegardées"
11. Refresh page → data persists
12. Go back to Dashboard → open FeedbackDrawer → TechnicalNotesSection shows count + link

**Step 5: Update documentation files**

Add entry to `docs/implementation-log.md`, update `docs/ROADMAP.md` chantier 26 status to Fait (§58), update `docs/FEATURES_STATUS.md`, update `CLAUDE.md` chantier table.

**Step 6: Final commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: add §58 implementation log and update roadmap"
```
