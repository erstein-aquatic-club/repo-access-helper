# Profile + Hall of Fame Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign Profile and Hall of Fame views with a bold, sporty mobile-first aesthetic — hero banner for Profile, visual podium for HoF.

**Architecture:** Both pages are standalone React components. Profile gets a hero banner + Sheet for editing + Collapsible for password. HoF gets a new `<Podium>` component replacing the flat list for top 3. No API changes needed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Shadcn (Sheet, Collapsible, Avatar, Card, Badge), Framer Motion, Lucide icons.

**Design doc:** `docs/plans/2026-02-16-profile-halloffame-redesign-design.md`

---

## Task 1: Create Podium component with tests

**Files:**
- Create: `src/pages/hallOfFame/Podium.tsx`
- Create: `src/pages/__tests__/Podium.test.tsx`

**Step 1: Write the test file**

```tsx
// src/pages/__tests__/Podium.test.tsx
import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Podium, type PodiumEntry } from "@/pages/hallOfFame/Podium";

test("Podium renders 3 entries in correct order (2-1-3)", () => {
  const entries: PodiumEntry[] = [
    { name: "ALICE", value: "12.4 km", toneScore: 5 },
    { name: "BOB", value: "9.8 km", toneScore: 3 },
    { name: "CHARLIE", value: "7.2 km", toneScore: 1 },
  ];
  const markup = renderToStaticMarkup(<Podium entries={entries} />);
  // #2 (BOB) appears before #1 (ALICE) in DOM (left column first)
  const bobIdx = markup.indexOf("BOB");
  const aliceIdx = markup.indexOf("ALICE");
  const charlieIdx = markup.indexOf("CHARLIE");
  assert.ok(bobIdx < aliceIdx, "BOB (#2) should be before ALICE (#1) in DOM");
  assert.ok(aliceIdx < charlieIdx, "ALICE (#1) should be before CHARLIE (#3) in DOM");
});

test("Podium renders 2 entries without crashing", () => {
  const entries: PodiumEntry[] = [
    { name: "ALICE", value: "12.4 km", toneScore: 5 },
    { name: "BOB", value: "9.8 km", toneScore: 3 },
  ];
  const markup = renderToStaticMarkup(<Podium entries={entries} />);
  assert.ok(markup.includes("ALICE"));
  assert.ok(markup.includes("BOB"));
});

test("Podium renders 1 entry as solo champion", () => {
  const entries: PodiumEntry[] = [
    { name: "ALICE", value: "12.4 km", toneScore: 5 },
  ];
  const markup = renderToStaticMarkup(<Podium entries={entries} />);
  assert.ok(markup.includes("ALICE"));
});

test("Podium renders empty state", () => {
  const markup = renderToStaticMarkup(<Podium entries={[]} />);
  assert.ok(markup.includes("Aucune donn"));
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/Podium.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the Podium component**

```tsx
// src/pages/hallOfFame/Podium.tsx
import { Crown, Medal } from "lucide-react";
import { HallOfFameValue } from "./HallOfFameValue";

export type PodiumEntry = {
  name: string;
  value: string;
  toneScore: number | null;
};

type PodiumProps = {
  entries: PodiumEntry[];
};

const PODIUM_CONFIG = [
  { rank: 1, height: "h-28", avatarSize: "h-12 w-12 text-lg", colOrder: "order-2" },
  { rank: 2, height: "h-20", avatarSize: "h-10 w-10 text-base", colOrder: "order-1" },
  { rank: 3, height: "h-14", avatarSize: "h-10 w-10 text-base", colOrder: "order-3" },
] as const;

const RANK_STYLES = {
  1: { icon: Crown, color: "text-rank-gold", bg: "bg-rank-gold/10", border: "border-rank-gold", pedestal: "from-rank-gold/30" },
  2: { icon: Medal, color: "text-rank-silver", bg: "bg-rank-silver/10", border: "border-rank-silver", pedestal: "from-rank-silver/30" },
  3: { icon: Medal, color: "text-rank-bronze", bg: "bg-rank-bronze/10", border: "border-rank-bronze", pedestal: "from-rank-bronze/30" },
} as const;

function PodiumColumn({ entry, config }: { entry: PodiumEntry; config: typeof PODIUM_CONFIG[number] }) {
  const style = RANK_STYLES[config.rank as 1 | 2 | 3];
  const IconComponent = style.icon;
  const initials = entry.name.slice(0, 2).toUpperCase();

  return (
    <div className={`flex flex-col items-center gap-1 ${config.colOrder} flex-1`}>
      {/* Icon + Avatar */}
      <IconComponent className={`h-5 w-5 ${style.color} ${config.rank === 1 ? "fill-rank-gold" : config.rank === 2 ? "fill-rank-silver" : "fill-rank-bronze"}`} />
      <div className={`${config.avatarSize} rounded-full ${style.bg} border-2 ${style.border} flex items-center justify-center font-bold font-display`}>
        {initials}
      </div>
      <div className="font-bold uppercase tracking-tight text-xs text-center truncate max-w-full px-1">{entry.name}</div>
      <HallOfFameValue value={entry.value} toneScore={entry.toneScore} />
      {/* Pedestal */}
      <div className={`${config.height} w-full rounded-t-xl bg-gradient-to-b ${style.pedestal} to-muted/50 border-t-2 ${style.border}`} />
    </div>
  );
}

export function Podium({ entries }: PodiumProps) {
  if (entries.length === 0) {
    return <div className="text-center text-muted-foreground py-4">Aucune donnée</div>;
  }

  // Map entries to podium positions: index 0 = #1, index 1 = #2, index 2 = #3
  const podiumEntries = entries.slice(0, 3);

  if (podiumEntries.length === 1) {
    return (
      <div className="flex justify-center py-2">
        <div className="w-1/3">
          <PodiumColumn entry={podiumEntries[0]} config={PODIUM_CONFIG[0]} />
        </div>
      </div>
    );
  }

  // For 2 entries: show #1 (center) and #2 (left)
  // For 3 entries: show #2 (left), #1 (center), #3 (right)
  return (
    <div className="flex items-end justify-center gap-2 py-2">
      {/* #2 — left */}
      <PodiumColumn entry={podiumEntries[1]} config={PODIUM_CONFIG[1]} />
      {/* #1 — center */}
      <PodiumColumn entry={podiumEntries[0]} config={PODIUM_CONFIG[0]} />
      {/* #3 — right (if exists) */}
      {podiumEntries[2] && (
        <PodiumColumn entry={podiumEntries[2]} config={PODIUM_CONFIG[2]} />
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/__tests__/Podium.test.tsx`
Expected: All 4 tests PASS

**Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/pages/hallOfFame/Podium.tsx src/pages/__tests__/Podium.test.tsx
git commit -m "feat: add Podium component for Hall of Fame top 3"
```

---

## Task 2: Integrate Podium into HallOfFame page

**Files:**
- Modify: `src/pages/HallOfFame.tsx`

**Context:** Replace the flat leaderboard list with the Podium for top 3, keeping rangs 4-5 as compact rows below.

**Step 1: Refactor HallOfFame.tsx**

Key changes:
- Import `Podium` and `PodiumEntry` from `./hallOfFame/Podium`
- For each category, split entries into `top3` (first 3) and `rest` (4-5)
- Replace the `motion.div` loop for entries with `<Podium entries={top3} />` followed by compact rows for `rest`
- Remove the `RankIcon` component (no longer needed inline — podium handles ranks)
- Keep the RankIcon for rangs 4-5 as a simple number span

The implementation should:
1. Add a helper `toPodiumEntries(items, formatFn, rangeOrScore)` that maps data arrays to `PodiumEntry[]`
2. For each Card (Top Distance, Top Intensité, etc.), render `<Podium entries={top3} />` then the remaining rows
3. Keep the same Card structure (border-t-4, shadow-md) and tabs

**Step 2: Run existing tests**

Run: `npm test -- src/pages/__tests__/HallOfFameValue.test.tsx`
Expected: PASS (no existing HoF page tests break)

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Visual check**

Run: `npm run dev` — open `/#/hall-of-fame` on mobile viewport (375px)
Verify:
- Podium shows 3 columns with center (#1) taller
- Medals/crown icons visible
- Values (km, reps, kg) display correctly
- Tabs switch between Bassin and Muscu
- Empty categories show "Aucune donnée"

**Step 5: Commit**

```bash
git add src/pages/HallOfFame.tsx
git commit -m "feat: integrate visual podium into Hall of Fame leaderboards"
```

---

## Task 3: Redesign Profile — Hero banner

**Files:**
- Modify: `src/pages/Profile.tsx`

**Context:** Replace the plain `<h1>` + Card header with a bold hero banner using `bg-accent` background.

**Step 1: Refactor the Profile header section**

Replace lines ~295-328 (the `<h1>` and `<Card><CardHeader>`) with a hero banner:

```tsx
{/* Hero Banner */}
<div className="rounded-xl bg-accent text-accent-foreground p-5">
  <div className="flex items-center gap-4">
    <Avatar className="h-20 w-20 ring-2 ring-primary ring-offset-2 ring-offset-accent">
      <AvatarImage src={avatarSrc} alt={user || "Profil"} />
      <AvatarFallback className="text-lg">{(user || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1">
      <h1 className="text-2xl font-display font-bold uppercase italic text-accent-foreground truncate">{user}</h1>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <Badge variant="secondary" className="text-xs">{roleLabel}</Badge>
        <span className="text-sm opacity-80">{groupLabel}</span>
      </div>
      {showRecords && String(profile?.ffn_iuf ?? "").trim() && (
        <p className="text-xs opacity-60 mt-1">IUF {profile?.ffn_iuf}</p>
      )}
    </div>
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0 text-accent-foreground hover:bg-accent-foreground/10"
      onClick={startEdit}
      aria-label="Modifier le profil"
    >
      <Edit2 className="h-4 w-4" />
    </Button>
  </div>
</div>
```

Remove the old `<h1>Profil</h1>` and the Card header section with its avatar.

**Step 2: Run existing profile tests**

Run: `npm test -- src/pages/__tests__/ProfileLogic.test.ts`
Expected: PASS (tests only test exported functions, not JSX)

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: add hero banner to Profile page"
```

---

## Task 4: Profile — Move edit form to Sheet

**Files:**
- Modify: `src/pages/Profile.tsx`

**Context:** Replace the inline edit toggle with a bottom Sheet on mobile.

**Step 1: Refactor edit mode**

Key changes:
- Import `Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription` from `@/components/ui/sheet`
- Replace the `isEditing` state toggle with `isEditSheetOpen` state
- Move the entire edit form into a `<Sheet>` component
- Sheet uses `side="bottom"` with `max-h-[85vh] overflow-y-auto` for mobile scrollability
- The hero banner edit button now sets `isEditSheetOpen(true)` instead of `startEdit()`
- `startEdit` still resets form values, then opens sheet
- On save success, close the sheet
- Remove the inline `{isEditing ? <form> : <div>}` toggle — the info grid is always shown, the form lives in the Sheet

**Step 2: Run existing tests**

Run: `npm test -- src/pages/__tests__/ProfileLogic.test.ts`
Expected: PASS

**Step 3: Type-check**

Run: `npx tsc --noEmit`

**Step 4: Visual check**

Run: `npm run dev` — open `/#/profile`
Verify:
- Click edit icon opens bottom sheet
- Form fields pre-populated
- Save closes sheet + shows toast
- Cancel closes sheet
- Sheet scrollable on small screens

**Step 5: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: move profile edit form to bottom Sheet"
```

---

## Task 5: Profile — Collapsible password section + cleanup

**Files:**
- Modify: `src/pages/Profile.tsx`

**Context:** Wrap the password section in a Collapsible (closed by default). Merge FFN + Records into one card. Move logout to bottom.

**Step 1: Refactor password section**

Key changes:
- Import `Collapsible, CollapsibleTrigger, CollapsibleContent` from `@/components/ui/collapsible`
- Import `ChevronRight` from `lucide-react`
- Wrap the password Card in `<Collapsible>`:
  ```tsx
  <Collapsible>
    <CollapsibleTrigger asChild>
      <button className="flex items-center gap-2 w-full text-left py-3 px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
        Sécurité
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      {/* existing password form content (without the Card wrapper) */}
    </CollapsibleContent>
  </Collapsible>
  ```
- Merge the FFN card and Records link card into a single card with both the sync button and the records link
- Move the logout button to the very bottom of the page as `variant="ghost"` full-width

**Step 2: Run existing tests**

Run: `npm test -- src/pages/__tests__/ProfileLogic.test.ts`
Expected: PASS

**Step 3: Type-check**

Run: `npx tsc --noEmit`

**Step 4: Visual check**

Run: `npm run dev` — open `/#/profile`
Verify:
- Password section collapsed by default
- Clicking "Sécurité" expands it
- FFN sync + Records link in one card
- Logout button at bottom

**Step 5: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: collapsible password, merged FFN card, profile cleanup"
```

---

## Task 6: Final polish + responsive check + docs

**Files:**
- Modify: `docs/implementation-log.md` (add entry)
- Modify: `docs/ROADMAP.md` (update chantier status)
- Modify: `docs/FEATURES_STATUS.md` (update feature status)

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Build check**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Visual QA on mobile viewport**

Check both pages on 375px viewport:
- Profile: hero banner doesn't overflow, avatar scales well, sheet opens from bottom
- HoF: podium columns fit on narrow screen, text truncates properly, tabs work

**Step 5: Update documentation**

Add entry to `docs/implementation-log.md`:
- Section: `§37 — Redesign Profil + Hall of Fame (mobile first)`
- Context, changes, files modified, tests, decisions

Update `docs/ROADMAP.md`:
- Add new chantier entry if not present, mark as Fait

Update `docs/FEATURES_STATUS.md`:
- Update Profil and Hall of Fame status

**Step 6: Commit**

```bash
git add docs/implementation-log.md docs/ROADMAP.md docs/FEATURES_STATUS.md
git commit -m "docs: add implementation log entry for profile + HoF redesign (§37)"
```
