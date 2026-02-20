# Calendrier Coach — Vue des assignations — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a monthly calendar view in the Coach dashboard showing session assignments filtered by group or swimmer, with day detail drawer and quick-assign CTA.

**Architecture:** New `CoachCalendar` component with filter bar (group/swimmer toggle + Select), reusing existing `CalendarHeader`/`CalendarGrid`/`DayCell` from the swimmer dashboard. New `useCoachCalendarState` hook handles data fetching, month navigation, and `completionByISO` map computation. New `getCoachAssignments()` API function queries `session_assignments` with date range + target filters and enriches with session titles.

**Tech Stack:** React 19, TypeScript, Tanstack React Query, Supabase (PostgreSQL), Shadcn UI (Select, Badge, Sheet), Tailwind CSS 4

---

## Task 1: API function `getCoachAssignments`

**Files:**
- Modify: `src/lib/api/assignments.ts` (add new export)
- Modify: `src/lib/api/index.ts` (re-export)
- Modify: `src/lib/api.ts` (add to `api` object)
- Test: `src/lib/api/__tests__/getCoachAssignments.test.ts`

### Step 1: Define the return type

Add to `src/lib/api/types.ts`:

```typescript
export interface CoachAssignment {
  id: number;
  title: string;
  type: "swim" | "strength";
  scheduledDate: string;        // ISO date "YYYY-MM-DD"
  scheduledSlot: "morning" | "evening" | null;
  targetLabel: string;           // Group name or swimmer name
  targetType: "group" | "user";
  status: string;
}
```

### Step 2: Write the API function

Add to `src/lib/api/assignments.ts`:

```typescript
export async function getCoachAssignments(filters: {
  groupId?: number | null;
  userId?: number | null;
  from: string;   // ISO date
  to: string;     // ISO date
}): Promise<CoachAssignment[]> {
  if (!canUseSupabase()) return [];

  let query = supabase
    .from("session_assignments")
    .select("*")
    .gte("scheduled_date", filters.from)
    .lte("scheduled_date", filters.to);

  if (filters.groupId) {
    query = query.eq("target_group_id", filters.groupId);
  } else if (filters.userId) {
    query = query.eq("target_user_id", filters.userId);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const [swimCatalogs, strengthCatalogs] = await Promise.all([
    getSwimCatalog(),
    getStrengthSessions(),
  ]);
  const swimById = new Map(swimCatalogs.map((c) => [c.id, c]));
  const strengthById = new Map(strengthCatalogs.map((s) => [s.id, s]));

  return data.map((row: any) => {
    const type = row.assignment_type === "strength" ? "strength" : "swim";
    const sessionId = safeOptionalInt(
      type === "swim" ? row.swim_catalog_id : row.strength_session_id
    ) ?? 0;
    const swim = type === "swim" ? swimById.get(sessionId) : undefined;
    const strength = type === "strength" ? strengthById.get(sessionId) : undefined;

    return {
      id: safeInt(row.id, 0),
      title: type === "swim"
        ? (swim?.name ?? "Séance natation")
        : (strength?.title ?? "Séance musculation"),
      type,
      scheduledDate: row.scheduled_date ?? "",
      scheduledSlot: row.scheduled_slot ?? null,
      targetLabel: "",  // Will be enriched by the caller if needed
      targetType: row.target_group_id ? "group" : "user",
      status: row.status ?? "assigned",
    } satisfies CoachAssignment;
  });
}
```

### Step 3: Register in exports

In `src/lib/api/index.ts`, add `getCoachAssignments` to the assignments export block:

```typescript
export {
  getAssignmentsForCoach,
  getAssignments,
  getCoachAssignments,   // ← NEW
  assignments_create,
  assignments_delete,
} from './assignments';
```

In `src/lib/api.ts`, add to the `api` object:

```typescript
import { getCoachAssignments as _getCoachAssignments } from './api/assignments';
// ...
async getCoachAssignments(filters: Parameters<typeof _getCoachAssignments>[0]) {
  return _getCoachAssignments(filters);
},
```

### Step 4: Commit

```bash
git add src/lib/api/types.ts src/lib/api/assignments.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat(coach-calendar): add getCoachAssignments API function"
```

---

## Task 2: Hook `useCoachCalendarState`

**Files:**
- Create: `src/hooks/useCoachCalendarState.ts`

### Step 1: Write the hook

This hook mirrors the calendar logic from `useDashboardState.ts` but simplified for the coach view (no presence defaults, no session logs, no km tracking — just assignment presence).

```typescript
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CoachAssignment } from "@/lib/api/types";

type SlotStatus = {
  slotKey: "AM" | "PM";
  expected: boolean;
  completed: boolean;
  absent: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function weekdayMondayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

function slotToSlotKey(slot: string | null): "AM" | "PM" {
  if (!slot) return "AM";
  const norm = slot.toLowerCase();
  if (norm === "evening" || norm.includes("soir") || norm === "pm") return "PM";
  return "AM";
}

interface UseCoachCalendarStateProps {
  groupId?: number | null;
  userId?: number | null;
  enabled: boolean;
}

export function useCoachCalendarState({ groupId, userId, enabled }: UseCoachCalendarStateProps) {
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedISO, setSelectedISO] = useState(() => toISODate(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);

  // Grid: 6 weeks × 7 days = 42 cells
  const gridDates = useMemo(() => {
    const startIndex = weekdayMondayIndex(monthStart);
    const gridStart = addDays(monthStart, -startIndex);
    const dates: Date[] = [];
    for (let i = 0; i < 42; i++) dates.push(addDays(gridStart, i));
    return dates;
  }, [monthStart]);

  // Date range for the query (grid start → grid end)
  const dateRange = useMemo(() => {
    const from = toISODate(gridDates[0]);
    const to = toISODate(gridDates[gridDates.length - 1]);
    return { from, to };
  }, [gridDates]);

  const hasFilter = Boolean(groupId || userId);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["coach-calendar-assignments", groupId, userId, dateRange.from, dateRange.to],
    queryFn: () =>
      api.getCoachAssignments({
        groupId: groupId ?? null,
        userId: userId ?? null,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: enabled && hasFilter,
  });

  // Index assignments by ISO date
  const assignmentsByISO = useMemo(() => {
    const map = new Map<string, CoachAssignment[]>();
    for (const a of assignments) {
      const iso = a.scheduledDate?.slice(0, 10);
      if (!iso) continue;
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push(a);
    }
    return map;
  }, [assignments]);

  // Build completionByISO — same shape as Dashboard for CalendarGrid compatibility
  const completionByISO = useMemo(() => {
    const map: Record<string, {
      completed: number;
      total: number;
      slots: SlotStatus[];
    }> = {};

    for (const d of gridDates) {
      const iso = toISODate(d);
      const dayAssignments = assignmentsByISO.get(iso) ?? [];

      const hasAM = dayAssignments.some((a) => slotToSlotKey(a.scheduledSlot) === "AM");
      const hasPM = dayAssignments.some((a) => slotToSlotKey(a.scheduledSlot) === "PM");
      const total = (hasAM ? 1 : 0) + (hasPM ? 1 : 0);

      // For the coach view: "completed" = pill is colored (has assignment)
      // We use completed === total so pills appear green/colored
      const slots: SlotStatus[] = [
        { slotKey: "AM", expected: hasAM, completed: hasAM, absent: false },
        { slotKey: "PM", expected: hasPM, completed: hasPM, absent: false },
      ];

      map[iso] = { completed: total, total, slots };
    }

    return map;
  }, [gridDates, assignmentsByISO]);

  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedISO.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selectedISO]);

  const assignmentsForSelectedDay = useMemo(
    () => assignmentsByISO.get(selectedISO) ?? [],
    [assignmentsByISO, selectedISO]
  );

  const selectedDayStatus = completionByISO[selectedISO] ?? {
    completed: 0,
    total: 0,
    slots: [
      { slotKey: "AM" as const, expected: false, completed: false, absent: false },
      { slotKey: "PM" as const, expected: false, completed: false, absent: false },
    ],
  };

  const prevMonth = useCallback(() => {
    setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, []);

  const jumpToday = useCallback(() => {
    setMonthCursor(startOfMonth(new Date()));
    setSelectedISO(toISODate(new Date()));
  }, []);

  const openDay = useCallback((iso: string) => {
    setSelectedISO(iso);
    setDrawerOpen(true);
  }, []);

  return {
    today,
    monthCursor,
    selectedISO,
    selectedDayIndex,
    drawerOpen,
    gridDates,
    completionByISO,
    selectedDate,
    selectedDayStatus,
    assignmentsForSelectedDay,
    isLoading,
    hasFilter,
    setSelectedISO,
    setSelectedDayIndex,
    setDrawerOpen,
    prevMonth,
    nextMonth,
    jumpToday,
    openDay,
  };
}
```

### Step 2: Commit

```bash
git add src/hooks/useCoachCalendarState.ts
git commit -m "feat(coach-calendar): add useCoachCalendarState hook"
```

---

## Task 3: Component `CoachCalendar`

**Files:**
- Create: `src/pages/coach/CoachCalendar.tsx`

### Step 1: Write the component

```tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CalendarHeader } from "@/components/dashboard/CalendarHeader";
import { CalendarGrid } from "@/components/dashboard/CalendarGrid";
import { useCoachCalendarState } from "@/hooks/useCoachCalendarState";
import CoachSectionHeader from "./CoachSectionHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CalendarPlus, Dumbbell, Waves } from "lucide-react";
import type { CoachAssignment } from "@/lib/api/types";

type FilterMode = "group" | "user";

interface CoachCalendarProps {
  onBack: () => void;
  onAssign: (prefillDate?: string) => void;
  athletes: Array<{ id: number | null; display_name: string; group_label?: string | null }>;
  groups: Array<{ id: number | string; name: string }>;
}

function slotLabel(slot: string | null): string {
  if (!slot) return "—";
  const norm = slot.toLowerCase();
  if (norm === "morning" || norm.includes("mat") || norm === "am") return "Matin";
  if (norm === "evening" || norm.includes("soir") || norm === "pm") return "Soir";
  return slot;
}

function statusLabel(status: string): string {
  switch (status) {
    case "assigned": return "Assigné";
    case "in_progress": return "En cours";
    case "completed": return "Terminé";
    default: return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed": return "default";
    case "in_progress": return "secondary";
    default: return "outline";
  }
}

function formatDateFR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function CoachCalendar({ onBack, onAssign, athletes, groups }: CoachCalendarProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>("group");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const groupId = filterMode === "group" && selectedGroupId ? Number(selectedGroupId) : null;
  const userId = filterMode === "user" && selectedUserId ? Number(selectedUserId) : null;

  const {
    today,
    monthCursor,
    selectedISO,
    selectedDayIndex,
    drawerOpen,
    gridDates,
    completionByISO,
    selectedDayStatus,
    assignmentsForSelectedDay,
    isLoading,
    hasFilter,
    setSelectedISO,
    setSelectedDayIndex,
    setDrawerOpen,
    prevMonth,
    nextMonth,
    jumpToday,
    openDay,
  } = useCoachCalendarState({
    groupId,
    userId,
    enabled: true,
  });

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === "ArrowLeft") nextIndex = Math.max(0, index - 1);
    if (e.key === "ArrowRight") nextIndex = Math.min(gridDates.length - 1, index + 1);
    if (e.key === "ArrowUp") nextIndex = Math.max(0, index - 7);
    if (e.key === "ArrowDown") nextIndex = Math.min(gridDates.length - 1, index + 7);
    if (nextIndex !== index) {
      e.preventDefault();
      setSelectedDayIndex(nextIndex);
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const d = gridDates[nextIndex];
      const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      setSelectedISO(iso);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const d = gridDates[index];
      const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      openDay(iso);
    }
  };

  return (
    <div className="space-y-4">
      <CoachSectionHeader
        title="Calendrier"
        description="Vue mensuelle des assignations"
        onBack={onBack}
      />

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ToggleGroup
          type="single"
          value={filterMode}
          onValueChange={(v) => {
            if (v === "group" || v === "user") setFilterMode(v);
          }}
          className="shrink-0"
        >
          <ToggleGroupItem value="group" className="text-xs px-3">Groupe</ToggleGroupItem>
          <ToggleGroupItem value="user" className="text-xs px-3">Nageur</ToggleGroupItem>
        </ToggleGroup>

        {filterMode === "group" ? (
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Choisir un groupe" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={String(g.id)} value={String(g.id)}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Choisir un nageur" />
            </SelectTrigger>
            <SelectContent>
              {athletes
                .filter((a) => a.id != null)
                .map((a) => (
                  <SelectItem key={String(a.id)} value={String(a.id)}>
                    {a.display_name}
                    {a.group_label ? ` · ${a.group_label}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Calendar */}
      {!hasFilter ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Sélectionnez un groupe ou un nageur pour afficher le calendrier.
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-sm">
          <CalendarHeader
            monthCursor={monthCursor}
            selectedDayStatus={selectedDayStatus}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onJumpToday={jumpToday}
          />
          <CalendarGrid
            monthCursor={monthCursor}
            gridDates={gridDates}
            completionByISO={completionByISO}
            selectedISO={selectedISO}
            selectedDayIndex={selectedDayIndex}
            today={today}
            onDayClick={openDay}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}

      {/* Day detail drawer (Sheet) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-3">
            <SheetTitle className="capitalize text-left">
              {formatDateFR(selectedISO)}
              {assignmentsForSelectedDay.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({assignmentsForSelectedDay.length} assignation{assignmentsForSelectedDay.length !== 1 ? "s" : ""})
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          {assignmentsForSelectedDay.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune assignation ce jour.
            </p>
          ) : (
            <div className="space-y-2">
              {assignmentsForSelectedDay.map((a) => (
                <AssignmentCard key={a.id} assignment={a} />
              ))}
            </div>
          )}

          <div className="pt-4">
            <Button
              className="w-full"
              onClick={() => onAssign(selectedISO)}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              Assigner une séance
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: CoachAssignment }) {
  const isSwim = assignment.type === "swim";
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <div className="mt-0.5">
        {isSwim ? (
          <Waves className="h-4 w-4 text-blue-500" />
        ) : (
          <Dumbbell className="h-4 w-4 text-orange-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{assignment.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {isSwim ? "Nage" : "Muscu"}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {slotLabel(assignment.scheduledSlot)}
          </span>
          <Badge variant={statusVariant(assignment.status)} className="text-[10px] px-1.5 py-0">
            {statusLabel(assignment.status)}
          </Badge>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Commit

```bash
git add src/pages/coach/CoachCalendar.tsx
git commit -m "feat(coach-calendar): add CoachCalendar component with filter, grid, and drawer"
```

---

## Task 4: Wire into Coach.tsx

**Files:**
- Modify: `src/pages/Coach.tsx`

### Step 1: Update `CoachSection` type

At line 24:

```typescript
type CoachSection = "home" | "swim" | "strength" | "swimmers" | "assignments" | "messaging" | "calendar";
```

### Step 2: Add import

```typescript
import CoachCalendar from "./coach/CoachCalendar";
```

### Step 3: Add "Calendrier" nav button in CoachHome

Add a new button in the quick actions row (around line 145, after the "Assigner" and "Message" buttons):

```tsx
<button
  type="button"
  onClick={() => onNavigate("calendar")}
  className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
>
  <CalendarDays className="h-3.5 w-3.5" />
  Calendrier
</button>
```

Import `CalendarDays` from `lucide-react` at the top.

### Step 4: Update `shouldLoadGroups` and `shouldLoadAthletes`

Around line 283-288, add `"calendar"` to both flags:

```typescript
const shouldLoadAthletes =
  activeSection === "home" ||
  activeSection === "assignments" ||
  activeSection === "messaging" ||
  activeSection === "swimmers" ||
  activeSection === "calendar";
const shouldLoadGroups =
  activeSection === "assignments" ||
  activeSection === "messaging" ||
  activeSection === "calendar";
```

### Step 5: Render the calendar section

After the `activeSection === "messaging"` block (around line 588), add:

```tsx
{activeSection === "calendar" ? (
  <CoachCalendar
    onBack={() => setActiveSection("home")}
    onAssign={(prefillDate) => {
      // Navigate to assignments screen — date prefill handled there
      setActiveSection("assignments");
    }}
    athletes={athletes}
    groups={groups}
  />
) : null}
```

### Step 6: Verify build

Run: `npx tsc --noEmit`
Expected: No new errors.

Run: `npm run dev` and check at `/#/coach` that the calendar tab appears.

### Step 7: Commit

```bash
git add src/pages/Coach.tsx
git commit -m "feat(coach-calendar): wire CoachCalendar into Coach dashboard"
```

---

## Task 5: Manual testing & polish

### Step 1: Test the full flow

1. Open `/#/coach` as a coach user
2. Click "Calendrier" button
3. Select a group → calendar shows pills for days with assignments
4. Switch to "Nageur" mode → select a swimmer → calendar updates
5. Click a day → drawer shows assignments
6. Click "Assigner une séance" → goes to assignment screen

### Step 2: Run tests

Run: `npm test`
Expected: All 122+ tests pass (no regressions).

Run: `npx tsc --noEmit`
Expected: No new TS errors.

### Step 3: Update documentation

Update `docs/implementation-log.md` with a §53 entry for this feature.
Update `docs/FEATURES_STATUS.md` if there's a coach calendar line.
Update `docs/ROADMAP.md` — mark chantier §22 as "Fait".
Update `CLAUDE.md` table if relevant files added.

### Step 4: Final commit

```bash
git add docs/implementation-log.md docs/FEATURES_STATUS.md docs/ROADMAP.md CLAUDE.md
git commit -m "docs: add §53 coach calendar to implementation log"
```
