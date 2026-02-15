# Calendar Dynamic Pills — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Calendar cells show dynamic pills (1 or 2) matching the athlete's expected sessions, with individual green/grey coloring per slot.

**Architecture:** Enrich `completionByISO` in `useDashboardState` to include per-slot status (AM/PM expected + completed). Update `DayCell`, `CalendarGrid`, and `CalendarHeader` to consume the new structure and render pills dynamically.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide icons

**Design doc:** `docs/plans/2026-02-15-calendar-pills-design.md`

---

### Task 1: Enrich `completionByISO` with per-slot data

**Files:**
- Modify: `src/hooks/useDashboardState.ts:435-459`

**Step 1: Update the `completionByISO` type and computation**

Replace the current `completionByISO` useMemo (lines 435-459) with a version that includes per-slot detail:

```typescript
const completionByISO = useMemo(() => {
  const map: Record<string, { completed: number; total: number; slots: Array<{ slotKey: "AM" | "PM"; expected: boolean; completed: boolean }> }> = {};

  for (const d of gridDates) {
    const iso = toISODate(d);
    const planned = getSessionsForISO(iso);

    let total = 0;
    let completed = 0;
    const slots: Array<{ slotKey: "AM" | "PM"; expected: boolean; completed: boolean }> = [];

    for (const s of planned) {
      const st = getSessionStatus(s, d);
      const isExpected = st.expected;
      if (!isExpected) {
        slots.push({ slotKey: s.slotKey, expected: false, completed: false });
        continue;
      }
      total += 1;

      const hasLog = Boolean(logsBySessionId[s.id]);
      const isAbsent = st.status === "absent";
      const isDone = hasLog || isAbsent;
      if (isDone) completed += 1;

      slots.push({ slotKey: s.slotKey, expected: true, completed: isDone });
    }

    map[iso] = { completed, total, slots };
  }

  return map;
}, [gridDates, getSessionsForISO, getSessionStatus, logsBySessionId]);
```

**Step 2: Update `selectedDayStatus` default fallback**

Line 468 — update the fallback to include `slots`:

```typescript
const selectedDayStatus = completionByISO[selectedISO] || { completed: 0, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: false }, { slotKey: "PM" as const, expected: true, completed: false }] };
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep -v stories`
Expected: No new errors (existing story errors are OK)

**Step 4: Commit**

```
git add src/hooks/useDashboardState.ts
git commit -m "feat(calendar): enrich completionByISO with per-slot status"
```

---

### Task 2: Refonte `DayCell` — pills dynamiques et fond neutre

**Files:**
- Modify: `src/components/dashboard/DayCell.tsx` (full rewrite of component body)

**Step 1: Update DayCellProps type**

Replace the `status` prop type (line 25):

```typescript
// Old:
status: { completed: number; total: number };

// New:
status: { completed: number; total: number; slots: Array<{ slotKey: "AM" | "PM"; expected: boolean; completed: boolean }> };
```

**Step 2: Rewrite the component body**

Replace `toneForDay` function and the entire component render. The new logic:

- Import `Minus` from lucide-react
- Remove the old `toneForDay` function
- Background: `bg-card border-border` for active days, `bg-muted/30 border-border` for rest days
- Today/selected rings stay the same (simplified to always use primary)
- Pills section: render only expected slots, positioned AM=left PM=right
- Rest days: small `Minus` icon instead of pills

Full replacement for `DayCell.tsx`:

```tsx
import React, { memo } from "react";
import { Minus } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toISODate(d: Date) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type SlotStatus = { slotKey: "AM" | "PM"; expected: boolean; completed: boolean };

interface DayCellProps {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFocused: boolean;
  status: { completed: number; total: number; slots: SlotStatus[] };
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export const DayCell = memo(function DayCell({
  date,
  inMonth,
  isToday,
  isSelected,
  isFocused,
  status,
  onClick,
  onKeyDown,
}: DayCellProps) {
  const { total, slots } = status;
  const isRest = total === 0;

  const bg = isRest ? "bg-muted/30" : "bg-card";
  const border = "border-border";
  const text = "text-foreground";

  const ring = isSelected ? "ring-2 ring-primary/30" : "";
  const todayRing = isToday && !isSelected ? "ring-2 ring-primary/50" : "";
  const focusRing = isFocused ? "ring-2 ring-primary" : "";

  // AM slot = index 0 (left), PM slot = index 1 (right)
  const amSlot = slots.find((s) => s.slotKey === "AM");
  const pmSlot = slots.find((s) => s.slotKey === "PM");

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={isFocused ? 0 : -1}
      data-calendar-cell="true"
      className={cn(
        "aspect-square min-w-0 rounded-2xl border p-1 transition",
        bg,
        border,
        !inMonth && "opacity-40",
        "hover:shadow-sm focus:outline-none",
        ring,
        todayRing,
        focusRing
      )}
      aria-label={`${toISODate(date)} — ${isRest ? "Repos" : `${status.completed}/${total}`}`}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className={cn("text-[12px] font-semibold", text)}>{date.getDate()}</div>
          <div className="h-[14px] w-[14px]" />
        </div>

        <div className="flex items-center justify-end">
          {isRest ? (
            <Minus className="h-3 w-3 text-muted-foreground/40" />
          ) : (
            <div className="w-6">
              <div className="flex gap-1">
                {/* AM pill (left position) */}
                {amSlot?.expected ? (
                  <span className={cn("h-1.5 flex-1 rounded-full", amSlot.completed ? "bg-status-success" : "bg-muted-foreground/30")} />
                ) : (
                  <span className="flex-1" />
                )}
                {/* PM pill (right position) */}
                {pmSlot?.expected ? (
                  <span className={cn("h-1.5 flex-1 rounded-full", pmSlot.completed ? "bg-status-success" : "bg-muted-foreground/30")} />
                ) : (
                  <span className="flex-1" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
});
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep -v stories`
Expected: No new errors

**Step 4: Commit**

```
git add src/components/dashboard/DayCell.tsx
git commit -m "feat(calendar): dynamic pills per slot with neutral background"
```

---

### Task 3: Update `CalendarGrid` default fallback

**Files:**
- Modify: `src/components/dashboard/CalendarGrid.tsx:51`

**Step 1: Update the default status fallback**

Line 51 — the fallback `{ completed: 0, total: 2 }` needs the `slots` field:

```typescript
// Old:
const status = completionByISO[iso] || { completed: 0, total: 2 };

// New:
const status = completionByISO[iso] || { completed: 0, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: false }, { slotKey: "PM" as const, expected: true, completed: false }] };
```

**Step 2: Update CalendarGridProps type**

Line 19 — update the type of `completionByISO`:

```typescript
// Old:
completionByISO: Record<string, { completed: number; total: number }>;

// New:
completionByISO: Record<string, { completed: number; total: number; slots: Array<{ slotKey: "AM" | "PM"; expected: boolean; completed: boolean }> }>;
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep -v stories`

**Step 4: Commit**

```
git add src/components/dashboard/CalendarGrid.tsx
git commit -m "feat(calendar): update CalendarGrid props for slot status"
```

---

### Task 4: Update `CalendarHeader` — pills dynamiques

**Files:**
- Modify: `src/components/dashboard/CalendarHeader.tsx:46-81`

**Step 1: Update CalendarHeaderProps**

Replace the `selectedDayStatus` type:

```typescript
// Old:
selectedDayStatus: { completed: number; total: number };

// New:
selectedDayStatus: { completed: number; total: number; slots: Array<{ slotKey: "AM" | "PM"; expected: boolean; completed: boolean }> };
```

**Step 2: Update the pills rendering**

Replace the hardcoded 2-pill block (lines 68-80) with dynamic pills:

```tsx
<div className="mt-1 flex items-center justify-center gap-1">
  {selectedDayStatus.total > 0 ? (
    selectedDayStatus.slots
      .filter((s) => s.expected)
      .map((s) => (
        <span
          key={s.slotKey}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            s.completed ? "bg-status-success" : "bg-muted-foreground/30"
          )}
        />
      ))
  ) : (
    <span className="text-[10px] text-muted-foreground">repos</span>
  )}
</div>
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep -v stories`

**Step 4: Commit**

```
git add src/components/dashboard/CalendarHeader.tsx
git commit -m "feat(calendar): dynamic pills in CalendarHeader"
```

---

### Task 5: Update `Dashboard.tsx` default fallback

**Files:**
- Modify: `src/pages/Dashboard.tsx:317`

**Step 1: Update the fallback in `openDay`**

Line 317 — add `slots` to the fallback:

```typescript
// Old:
const st = completionByISO[iso] || { completed: 0, total: 2 };

// New:
const st = completionByISO[iso] || { completed: 0, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: false }, { slotKey: "PM" as const, expected: true, completed: false }] };
```

Note: This fallback is only used for the `autoCloseArmed` logic (`st.total > 0 && st.completed < st.total`) so adding `slots` is for type consistency.

**Step 2: Verify build**

Run: `npm run build`
Expected: Build success

**Step 3: Commit**

```
git add src/pages/Dashboard.tsx
git commit -m "feat(calendar): update Dashboard fallback for slot status"
```

---

### Task 6: Final verification + documentation

**Step 1: Full build**

Run: `npm run build`
Expected: Success

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No new errors (pre-existing story errors only)

**Step 3: Update documentation**

Add entry to `docs/implementation-log.md` (section 27) and update `docs/FEATURES_STATUS.md`.

**Step 4: Commit docs**

```
git add docs/
git commit -m "docs: calendar dynamic pills implementation log"
```
