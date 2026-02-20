# Coach Calendar — Slots éditables inline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the passive coach calendar drawer with 3 editable slots (Nage Matin, Nage Soir, Muscu) where the coach can assign/replace/delete sessions inline using the active group/swimmer filter.

**Architecture:** Update `useCoachCalendarState` to expose a 3-slot model per day. Update `DayCell` with an optional strength indicator. Rewrite the `CoachCalendar` drawer to show 3 slot cards with inline Select pickers. Pass swim/strength catalogs from `Coach.tsx`. Mutations (`assignments_create`/`assignments_delete`) happen directly in the drawer.

**Tech Stack:** React 19, TypeScript, Tanstack React Query (useMutation + invalidateQueries), Shadcn UI (Select, Sheet, Badge), Tailwind CSS 4

---

## Task 1: Update hook — 3-slot model + strength tracking

**Files:**
- Modify: `src/hooks/useCoachCalendarState.ts`

### Step 1: Add DaySlot type and slotsForSelectedDay

Add a `DaySlot` type and a computed `slotsForSelectedDay` that maps assignments to the 3-slot model. Also add `hasStrengthByISO` for the DayCell indicator.

At the top of the file, add the type:

```typescript
export type DaySlot = {
  key: "swim-morning" | "swim-evening" | "strength";
  label: string;
  type: "swim" | "strength";
  scheduledSlot: "morning" | "evening" | null;
  assignment: CoachAssignment | null;
};

const DAY_SLOTS: Omit<DaySlot, "assignment">[] = [
  { key: "swim-morning", label: "Nage — Matin", type: "swim", scheduledSlot: "morning" },
  { key: "swim-evening", label: "Nage — Soir", type: "swim", scheduledSlot: "evening" },
  { key: "strength", label: "Musculation", type: "strength", scheduledSlot: null },
];
```

Add a new useMemo after `assignmentsForSelectedDay`:

```typescript
const slotsForSelectedDay = useMemo((): DaySlot[] => {
  const dayAssignments = assignmentsForSelectedDay;
  return DAY_SLOTS.map((slot) => {
    const match = dayAssignments.find((a) => {
      if (slot.type !== a.type) return false;
      if (slot.type === "swim") return slotToSlotKey(a.scheduledSlot) === (slot.scheduledSlot === "morning" ? "AM" : "PM");
      return true; // strength: any strength assignment matches
    });
    return { ...slot, assignment: match ?? null };
  });
}, [assignmentsForSelectedDay]);
```

Add `hasStrengthByISO` for DayCell indicators:

```typescript
const hasStrengthByISO = useMemo(() => {
  const map: Record<string, boolean> = {};
  for (const d of gridDates) {
    const iso = toISODate(d);
    const dayAssignments = assignmentsByISO.get(iso) ?? [];
    map[iso] = dayAssignments.some((a) => a.type === "strength");
  }
  return map;
}, [gridDates, assignmentsByISO]);
```

Add both to the return object:

```typescript
return {
  // ...existing...
  slotsForSelectedDay,
  hasStrengthByISO,
};
```

### Step 2: Verify types compile

Run: `npx tsc --noEmit`
Expected: No errors.

### Step 3: Commit

```bash
git add src/hooks/useCoachCalendarState.ts
git commit -m "feat(coach-calendar): add 3-slot model and strength tracking to hook"
```

---

## Task 2: Update DayCell — optional strength indicator

**Files:**
- Modify: `src/components/dashboard/DayCell.tsx`

### Step 1: Add optional prop

Add `strengthAssigned?: boolean` to `DayCellProps` interface (line 15-24):

```typescript
interface DayCellProps {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFocused: boolean;
  status: { completed: number; total: number; slots: SlotStatus[] };
  strengthAssigned?: boolean;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}
```

Add it to the destructured props (line 26-35):

```typescript
export const DayCell = memo(function DayCell({
  date,
  inMonth,
  isToday,
  isSelected,
  isFocused,
  status,
  strengthAssigned,
  onClick,
  onKeyDown,
}: DayCellProps) {
```

### Step 2: Render strength dot

After the AM/PM pills div (inside the `<div className="w-6">` block, line 80-95), add a strength dot when the prop is true. Replace the current pill section with:

```tsx
<div className="flex items-center justify-end gap-1">
  {isRest && !strengthAssigned ? (
    <Moon className="h-3 w-3 text-muted-foreground/40" />
  ) : (
    <>
      <div className="w-6">
        <div className="flex gap-1">
          {amSlot?.expected ? (
            <span className={cn("h-1.5 flex-1 rounded-full", amSlot.completed ? "bg-status-success" : amSlot.absent ? "bg-muted-foreground/15" : "bg-muted-foreground/30")} />
          ) : (
            <span className="flex-1" />
          )}
          {pmSlot?.expected ? (
            <span className={cn("h-1.5 flex-1 rounded-full", pmSlot.completed ? "bg-status-success" : pmSlot.absent ? "bg-muted-foreground/15" : "bg-muted-foreground/30")} />
          ) : (
            <span className="flex-1" />
          )}
        </div>
      </div>
      {strengthAssigned ? (
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
      ) : null}
    </>
  )}
</div>
```

This replaces the existing `<div className="flex items-center justify-end">` block (lines 76-97). The outer wrapper now includes `gap-1` and the orange dot sits to the right of the AM/PM pills.

### Step 3: Update CalendarGrid to forward the prop

Modify `src/components/dashboard/CalendarGrid.tsx` — add optional `strengthByISO` prop:

In `CalendarGridProps` interface, add:
```typescript
strengthByISO?: Record<string, boolean>;
```

In the destructured props:
```typescript
export function CalendarGrid({
  monthCursor,
  gridDates,
  completionByISO,
  strengthByISO,
  selectedISO,
  selectedDayIndex,
  today,
  onDayClick,
  onKeyDown,
}: CalendarGridProps) {
```

In the DayCell render (line 55-66), pass the prop:
```tsx
<DayCell
  key={iso}
  date={d}
  inMonth={inMonth}
  isToday={isToday}
  isSelected={isSel}
  isFocused={isFocused}
  status={status}
  strengthAssigned={strengthByISO?.[iso]}
  onClick={() => onDayClick(iso)}
  onKeyDown={(e) => onKeyDown(e, index)}
/>
```

### Step 4: Verify no regressions

Run: `npx tsc --noEmit`
Expected: No errors. Dashboard doesn't pass `strengthByISO` — it's optional, defaults to undefined, DayCell renders nothing for it.

Run: `npm test`
Expected: All tests pass.

### Step 5: Commit

```bash
git add src/components/dashboard/DayCell.tsx src/components/dashboard/CalendarGrid.tsx
git commit -m "feat(coach-calendar): add optional strength indicator to DayCell"
```

---

## Task 3: Rewrite CoachCalendar drawer — inline slot editing

**Files:**
- Modify: `src/pages/coach/CoachCalendar.tsx`

### Step 1: Update props and imports

Change `CoachCalendarProps` — remove `onAssign`, add catalogs:

```typescript
interface CoachCalendarProps {
  onBack: () => void;
  athletes: Array<{ id: number | null; display_name: string; group_label?: string | null }>;
  groups: Array<{ id: number | string; name: string }>;
  swimSessions?: Array<{ id: number; name: string }>;
  strengthSessions?: Array<{ id: number; title: string }>;
}
```

Add imports:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Trash2, RefreshCw } from "lucide-react";
import type { DaySlot } from "@/hooks/useCoachCalendarState";
```

### Step 2: Add mutations in the component body

Inside the `CoachCalendar` function, after the hook call:

```typescript
const queryClient = useQueryClient();

const assignMutation = useMutation({
  mutationFn: (params: {
    assignment_type: "swim" | "strength";
    session_id: number;
    scheduled_date: string;
    scheduled_slot?: "morning" | "evening";
    target_group_id?: number | null;
    target_user_id?: number | null;
  }) => api.assignments_create(params),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["coach-calendar-assignments"] });
  },
});

const deleteMutation = useMutation({
  mutationFn: (assignmentId: number) => api.assignments_delete(assignmentId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["coach-calendar-assignments"] });
  },
});
```

### Step 3: Extract `slotsForSelectedDay` and `hasStrengthByISO` from hook

Update the destructured hook values:

```typescript
const {
  today,
  monthCursor,
  selectedISO,
  selectedDayIndex,
  drawerOpen,
  gridDates,
  completionByISO,
  selectedDayStatus,
  slotsForSelectedDay,
  hasStrengthByISO,
  hasFilter,
  setSelectedISO,
  setSelectedDayIndex,
  setDrawerOpen,
  prevMonth,
  nextMonth,
  jumpToday,
  openDay,
} = useCoachCalendarState({ groupId, userId, enabled: true });
```

### Step 4: Pass `strengthByISO` to CalendarGrid

```tsx
<CalendarGrid
  monthCursor={monthCursor}
  gridDates={gridDates}
  completionByISO={completionByISO}
  strengthByISO={hasStrengthByISO}
  selectedISO={selectedISO}
  selectedDayIndex={selectedDayIndex}
  today={today}
  onDayClick={openDay}
  onKeyDown={handleKeyDown}
/>
```

### Step 5: Replace drawer content with SlotRow components

Replace the entire Sheet content (lines 194-233) with:

```tsx
<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
  <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
    <SheetHeader className="pb-3">
      <SheetTitle className="capitalize text-left">
        {formatDateFR(selectedISO)}
      </SheetTitle>
      <SheetDescription className="sr-only">
        Gérer les assignations pour cette journée
      </SheetDescription>
    </SheetHeader>

    <div className="space-y-3">
      {slotsForSelectedDay.map((slot) => (
        <SlotRow
          key={slot.key}
          slot={slot}
          swimSessions={swimSessions}
          strengthSessions={strengthSessions}
          onAssign={(sessionId) => {
            assignMutation.mutate({
              assignment_type: slot.type,
              session_id: sessionId,
              scheduled_date: selectedISO,
              scheduled_slot: slot.scheduledSlot ?? undefined,
              target_group_id: groupId,
              target_user_id: userId,
            });
          }}
          onDelete={(assignmentId) => {
            deleteMutation.mutate(assignmentId);
          }}
          onReplace={(oldAssignmentId, newSessionId) => {
            deleteMutation.mutate(oldAssignmentId, {
              onSuccess: () => {
                assignMutation.mutate({
                  assignment_type: slot.type,
                  session_id: newSessionId,
                  scheduled_date: selectedISO,
                  scheduled_slot: slot.scheduledSlot ?? undefined,
                  target_group_id: groupId,
                  target_user_id: userId,
                });
              },
            });
          }}
          isPending={assignMutation.isPending || deleteMutation.isPending}
        />
      ))}
    </div>
  </SheetContent>
</Sheet>
```

### Step 6: Write the SlotRow sub-component

Add at the bottom of the file:

```tsx
function SlotRow({
  slot,
  swimSessions,
  strengthSessions,
  onAssign,
  onDelete,
  onReplace,
  isPending,
}: {
  slot: DaySlot;
  swimSessions?: Array<{ id: number; name: string }>;
  strengthSessions?: Array<{ id: number; title: string }>;
  onAssign: (sessionId: number) => void;
  onDelete: (assignmentId: number) => void;
  onReplace: (oldAssignmentId: number, newSessionId: number) => void;
  isPending: boolean;
}) {
  const [isChanging, setIsChanging] = useState(false);
  const isSwim = slot.type === "swim";
  const catalog = isSwim
    ? (swimSessions ?? []).map((s) => ({ id: s.id, label: s.name }))
    : (strengthSessions ?? []).map((s) => ({ id: s.id, label: s.title }));
  const hasAssignment = slot.assignment !== null;

  const handleSelect = (value: string) => {
    const sessionId = Number(value);
    if (!sessionId) return;

    if (hasAssignment && isChanging) {
      onReplace(slot.assignment!.id, sessionId);
      setIsChanging(false);
    } else {
      onAssign(sessionId);
    }
  };

  return (
    <div className="rounded-xl border p-3 space-y-2">
      <div className="flex items-center gap-2">
        {isSwim ? (
          <Waves className="h-4 w-4 text-blue-500 shrink-0" />
        ) : (
          <Dumbbell className="h-4 w-4 text-orange-500 shrink-0" />
        )}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {slot.label}
        </span>
      </div>

      {hasAssignment && !isChanging ? (
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate flex-1">{slot.assignment!.title}</p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            disabled={isPending}
            onClick={() => setIsChanging(true)}
            title="Changer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            disabled={isPending}
            onClick={() => onDelete(slot.assignment!.id)}
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Select
          value=""
          onValueChange={handleSelect}
          disabled={isPending || catalog.length === 0}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={isChanging ? "Choisir le remplacement" : "Choisir une séance"} />
          </SelectTrigger>
          <SelectContent>
            {catalog.map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isChanging ? (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setIsChanging(false)}
        >
          Annuler
        </button>
      ) : null}
    </div>
  );
}
```

### Step 7: Remove unused code

Remove the old `AssignmentCard` component and the unused imports (`CalendarPlus`, `statusLabel`, `statusVariant`, `slotLabel`). Remove the `onAssign` destructured prop.

### Step 8: Verify build

Run: `npx tsc --noEmit`
Expected: No errors.

### Step 9: Commit

```bash
git add src/pages/coach/CoachCalendar.tsx
git commit -m "feat(coach-calendar): rewrite drawer with inline 3-slot editing"
```

---

## Task 4: Update Coach.tsx wiring

**Files:**
- Modify: `src/pages/Coach.tsx`

### Step 1: Update shouldLoadCatalogs

Around line 291, add `"calendar"`:

```typescript
const shouldLoadCatalogs = activeSection === "home" || activeSection === "assignments" || activeSection === "calendar";
```

### Step 2: Update CoachCalendar rendering

Replace the calendar block (around line 600-609) with:

```tsx
{activeSection === "calendar" ? (
  <CoachCalendar
    onBack={() => setActiveSection("home")}
    athletes={athletes}
    groups={groups}
    swimSessions={swimSessions}
    strengthSessions={strengthSessions}
  />
) : null}
```

Remove the `onAssign` prop — it no longer exists.

### Step 3: Verify build

Run: `npx tsc --noEmit`
Expected: No errors.

### Step 4: Commit

```bash
git add src/pages/Coach.tsx
git commit -m "feat(coach-calendar): pass catalogs to CoachCalendar, remove onAssign"
```

---

## Task 5: Tests + documentation

### Step 1: Run full test suite

Run: `npm test`
Expected: All 122+ tests pass.

Run: `npx tsc --noEmit`
Expected: No errors.

### Step 2: Update documentation

Update `docs/implementation-log.md` with §54 entry for the slots redesign. Update `docs/FEATURES_STATUS.md` if needed. Update `docs/ROADMAP.md` — mark §22b as Fait.

### Step 3: Commit

```bash
git add docs/implementation-log.md docs/FEATURES_STATUS.md docs/ROADMAP.md
git commit -m "docs: add §54 coach calendar slots redesign to implementation log"
```
