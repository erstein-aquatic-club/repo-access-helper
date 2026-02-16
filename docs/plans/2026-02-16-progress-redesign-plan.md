# Progress Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Progression page from a dense dashboard into an Apple Health-style minimal layout with hero KPIs, gradient charts, horizontal progress bars, and collapsible detail sections.

**Architecture:** Pure UI refactor of `src/pages/Progress.tsx` — same data/queries, new render. Replace `Select` period picker with `ToggleGroup`, replace KPI card grids with hero numbers + inline pills, replace bar charts with gradient line charts, replace 4 metric charts with horizontal progress bars, wrap detail sections in `Collapsible`. Add framer-motion stagger animations.

**Tech Stack:** React, Recharts (LineChart, ComposedChart, BarChart, PieChart with `<defs>` gradients), framer-motion, Radix Collapsible, Radix ToggleGroup, Tailwind CSS 4.

**Design doc:** `docs/plans/2026-02-16-progress-redesign-design.md`

---

## Task 1: Update imports and remove unused components

**Files:**
- Modify: `src/pages/Progress.tsx:1-35` (imports + kpiBadgeClass)

**Step 1: Update the import block**

Replace the current imports with:

```tsx
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Cell,
  PieChart,
  Pie,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { useAuth } from "@/lib/auth";
import { scoreToColor } from "@/lib/score";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getContrastTextColor } from "@/lib/design-tokens";
import type { LocalStrengthRun, SetLogEntry } from "@/lib/types";
import { motion } from "framer-motion";
import { slideUp, fadeIn } from "@/lib/animations";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
```

Notes:
- Removed: `CartesianGrid`, `Input`, `Select/SelectContent/SelectItem/SelectTrigger/SelectValue`
- Added: `ToggleGroup`, `ToggleGroupItem`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, `Area`, `AreaChart`, `motion`, `slideUp`, `fadeIn`, `ChevronDown`, `TrendingUp`, `TrendingDown`

**Step 2: Remove `kpiBadgeClass` and `SwimKpiCompactGrid`**

Delete the `kpiBadgeClass` constant (line 34) and the entire `SwimKpiCompactGrid` component (lines 36-82) and `ChartSkeleton` (lines 84-96). Replace `ChartSkeleton` with a simpler inline skeleton.

**Step 3: Update the test file**

Modify `src/pages/__tests__/Progress.test.tsx` — replace the `SwimKpiCompactGrid` test with a test for the new `ProgressBar` helper:

```tsx
import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressBar } from "@/pages/Progress";

test("ProgressBar renders with correct width and label", () => {
  const markup = renderToStaticMarkup(
    <ProgressBar label="Difficulte" value={3.2} max={5} />,
  );

  assert.ok(markup.includes("Difficulte"));
  assert.ok(markup.includes("3.2"));
});

test("ProgressBar handles null value", () => {
  const markup = renderToStaticMarkup(
    <ProgressBar label="Performance" value={null} max={5} />,
  );

  assert.ok(markup.includes("Performance"));
  assert.ok(markup.includes("-"));
});
```

**Step 4: Run tests**

Run: `npm test -- --reporter=verbose 2>&1 | head -30`
Expected: Tests may fail since implementation is not done yet — that's fine.

**Step 5: Commit**

```bash
git add src/pages/Progress.tsx src/pages/__tests__/Progress.test.tsx
git commit -m "refactor(progress): update imports and remove SwimKpiCompactGrid for redesign"
```

---

## Task 2: Add helper components (ProgressBar, HeroKpi, TrendBadge, MetricPill)

**Files:**
- Modify: `src/pages/Progress.tsx` — add helper components before the `Progress` default export

**Step 1: Add the `ProgressBar` component**

Insert after imports, before the `Progress` function:

```tsx
// ─── Helper Components ──────────────────────────────────────────────────────

type ProgressBarProps = {
  label: string;
  value: number | null;
  max: number;
  invert?: boolean;
};

export function ProgressBar({ label, value, max, invert = false }: ProgressBarProps) {
  const pct = value !== null ? Math.min(100, (value / max) * 100) : 0;
  const color = scoreToColor(value ?? null, { invert }) ?? "hsl(var(--muted-foreground))";

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-muted-foreground truncate">{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="w-10 text-right text-sm font-mono font-semibold tabular-nums">
        {value !== null ? value.toFixed(1) : "-"}
      </span>
    </div>
  );
}

type HeroKpiProps = {
  value: string;
  unit?: string;
  label: string;
  trend?: number | null;
  trendLabel?: string;
};

function HeroKpi({ value, unit, label, trend, trendLabel }: HeroKpiProps) {
  return (
    <motion.div
      className="flex flex-col items-center gap-1 py-4"
      variants={slideUp}
      initial="hidden"
      animate="visible"
    >
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-mono font-bold tracking-tight">{value}</span>
        {unit && <span className="text-lg font-mono text-muted-foreground">{unit}</span>}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
      {trend !== null && trend !== undefined && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            trend >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
          }`}
        >
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend >= 0 ? "+" : ""}{trend.toFixed(0)}%{trendLabel ? ` ${trendLabel}` : ""}
        </span>
      )}
    </motion.div>
  );
}

type MetricPillProps = {
  value: string;
  label?: string;
  colored?: boolean;
  colorValue?: number | null;
  invert?: boolean;
};

function MetricPill({ value, label, colored, colorValue, invert }: MetricPillProps) {
  const base = "rounded-full px-3 py-1 text-sm font-mono";
  if (colored && colorValue !== null && colorValue !== undefined) {
    const bg = scoreToColor(colorValue, { invert }) ?? "hsl(var(--muted-foreground))";
    return (
      <span className={base} style={{ backgroundColor: bg, color: getContrastTextColor(bg) }}>
        {value}
      </span>
    );
  }
  return <span className={`${base} bg-muted text-muted-foreground`}>{value}{label ? ` ${label}` : ""}</span>;
}

function ChartSkeleton() {
  return (
    <div className="space-y-3 animate-pulse motion-reduce:animate-none">
      <div className="h-[180px] w-full rounded-xl bg-muted" />
    </div>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm font-semibold hover:bg-muted transition-colors">
        {title}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4 animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

**Step 2: Run tests**

Run: `npm test -- --reporter=verbose 2>&1 | head -30`
Expected: The ProgressBar tests from Task 1 should now PASS.

**Step 3: Commit**

```bash
git add src/pages/Progress.tsx
git commit -m "feat(progress): add helper components (HeroKpi, ProgressBar, MetricPill, CollapsibleSection)"
```

---

## Task 3: Add trend calculation utility

**Files:**
- Modify: `src/pages/Progress.tsx` — add `computeTrend` function inside the `Progress` component, after the existing data processing

**Step 1: Add trend calculation**

Inside the `Progress()` function, after `const swimData = processData(swimPeriodDays);` (around line 297), add:

```tsx
  // Compute trend: compare current period vs previous equal period
  const computeTrend = (currentTotal: number, allSessions: Array<{ date: string; distance?: number }>, periodDays: number, metric: "distance" | "count") => {
    const now = new Date();
    const periodStart = subDays(now, periodDays);
    const prevStart = subDays(now, periodDays * 2);
    const prevEnd = subDays(now, periodDays);
    const prev = allSessions.filter((s) => {
      const d = new Date(s.date);
      return d >= prevStart && d < prevEnd;
    });
    const prevTotal = metric === "distance"
      ? prev.reduce((acc, s) => acc + (s.distance ?? 0), 0)
      : prev.length;
    if (prevTotal === 0) return null;
    return ((currentTotal - prevTotal) / prevTotal) * 100;
  };

  const swimVolumeTrend = sessions
    ? computeTrend(swimSessionsTotals.distance, sessions, swimPeriodDays, "distance")
    : null;
```

Also add strength trend after the strength data processing:

```tsx
  const strengthTonnageTrend = (() => {
    if (!strengthAggregatePeriods.length) return null;
    // We'd need previous period data — use a simple heuristic: compare first half vs second half
    const half = Math.floor(strengthAggregatePeriods.length / 2);
    if (half === 0) return null;
    const firstHalf = strengthAggregatePeriods.slice(0, half).reduce((acc, i) => acc + (i.tonnage ?? 0), 0);
    const secondHalf = strengthAggregatePeriods.slice(half).reduce((acc, i) => acc + (i.tonnage ?? 0), 0);
    if (firstHalf === 0) return null;
    return ((secondHalf - firstHalf) / firstHalf) * 100;
  })();
```

**Step 2: Commit**

```bash
git add src/pages/Progress.tsx
git commit -m "feat(progress): add trend calculation for hero KPIs"
```

---

## Task 4: Redesign the header and period selector

**Files:**
- Modify: `src/pages/Progress.tsx` — the return JSX, starting at `return (` (around line 409)

**Step 1: Replace the header and tabs**

Replace the current return block header (lines 409-418) with:

```tsx
  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Progression</h1>
      </div>

      <Tabs defaultValue="swim" className="w-full">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="grid w-full max-w-[240px] grid-cols-2">
            <TabsTrigger value="swim">Natation</TabsTrigger>
            <TabsTrigger value="strength">Musculation</TabsTrigger>
          </TabsList>
        </div>
```

Note: The period `ToggleGroup` will be placed inside each tab content (since swim and strength have independent period states).

**Step 2: Commit**

```bash
git add src/pages/Progress.tsx
git commit -m "refactor(progress): redesign header with tabs"
```

---

## Task 5: Redesign the Natation tab content

**Files:**
- Modify: `src/pages/Progress.tsx` — replace the entire `<TabsContent value="swim">` block

**Step 1: Replace natation tab content**

Replace the current swim `TabsContent` (everything between `<TabsContent value="swim"` and its closing `</TabsContent>`) with:

```tsx
        <TabsContent value="swim" className="space-y-8 mt-6">
          {/* Period selector */}
          <div className="flex justify-end">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={String(swimPeriodDays)}
              onValueChange={(v) => v && setSwimPeriodDays(Number(v))}
              className="gap-1"
            >
              <ToggleGroupItem value="7" className="h-8 px-3 text-xs">7j</ToggleGroupItem>
              <ToggleGroupItem value="30" className="h-8 px-3 text-xs">30j</ToggleGroupItem>
              <ToggleGroupItem value="365" className="h-8 px-3 text-xs">1 an</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Hero KPI — Volume */}
          <HeroKpi
            value={swimSessionsTotals.distance.toLocaleString()}
            unit="m"
            label={`volume sur ${swimPeriodDays} jours`}
            trend={swimVolumeTrend}
            trendLabel="vs periode prec."
          />

          {/* Mini metrics pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <MetricPill value={`${swimSessionsCount} seances`} />
            <MetricPill value={`${Math.round(swimSessionsAvgDistance).toLocaleString()}m moy`} />
            <MetricPill value={`${Math.round(swimSessionsAvgDuration)}min moy`} />
          </div>

          {/* Volume curve with gradient */}
          <motion.div variants={slideUp} initial="hidden" animate="visible">
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-0 h-[200px] w-full">
                {isSwimLoading ? (
                  <ChartSkeleton />
                ) : swimData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Aucune donnee disponible.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={swimData}>
                      <defs>
                        <linearGradient id="swimVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                        formatter={(value: number) => [`${value.toLocaleString()}m`, "Volume"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="distance"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#swimVolumeGradient)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Ressentis — horizontal progress bars */}
          <motion.div
            className="space-y-3"
            variants={slideUp}
            initial="hidden"
            animate="visible"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ressentis moyens</h3>
            <ProgressBar label="Difficulte" value={swimSessionsAvgRpe} max={5} invert />
            <ProgressBar label="Performance" value={swimSessionsAvgPerformance} max={5} />
            <ProgressBar label="Engagement" value={swimSessionsAvgEngagement} max={5} />
            <ProgressBar label="Fatigue" value={swimSessionsAvgFatigue} max={5} invert />
          </motion.div>

          {/* Stroke breakdown — collapsible */}
          {strokeBreakdown.hasData && (
            <CollapsibleSection title={`Repartition par nage (${swimPeriodDays}j)`}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={strokeBreakdown.pie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {strokeBreakdown.pie.map((entry, i) => (
                          <Cell key={`pie-${i}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value.toLocaleString()}m`, "Distance"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strokeBreakdown.daily}>
                      <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip />
                      {STROKE_KEYS.map((k) => (
                        <Bar key={k} dataKey={k} stackId="strokes" name={STROKE_LABELS[k]} fill={STROKE_COLORS[k]} radius={0} />
                      ))}
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CollapsibleSection>
          )}
        </TabsContent>
```

**Step 2: Verify the build**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors (pre-existing story errors OK).

**Step 3: Commit**

```bash
git add src/pages/Progress.tsx
git commit -m "feat(progress): redesign natation tab — hero KPI, gradient curve, progress bars"
```

---

## Task 6: Redesign the Musculation tab content

**Files:**
- Modify: `src/pages/Progress.tsx` — replace the entire `<TabsContent value="strength">` block

**Step 1: Replace musculation tab content**

Replace the current strength `TabsContent` with:

```tsx
        <TabsContent value="strength" className="space-y-8 mt-6">
          {/* Period selector */}
          <div className="flex justify-end">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={String(strengthPeriodDays)}
              onValueChange={(v) => v && setStrengthPeriodDays(Number(v))}
              className="gap-1"
            >
              <ToggleGroupItem value="7" className="h-8 px-3 text-xs">7j</ToggleGroupItem>
              <ToggleGroupItem value="30" className="h-8 px-3 text-xs">30j</ToggleGroupItem>
              <ToggleGroupItem value="365" className="h-8 px-3 text-xs">1 an</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Hero KPI — Tonnage */}
          <HeroKpi
            value={Math.round(strengthTonnagePeriod).toLocaleString()}
            unit="kg"
            label={`tonnage sur ${strengthPeriodDays} jours`}
            trend={strengthTonnageTrend}
            trendLabel="tendance"
          />

          {/* Mini metrics pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <MetricPill value={`${strengthSessionsCount} seances`} />
            <MetricPill value={`${Math.round(strengthVolumePeriod).toLocaleString()} reps`} />
            <MetricPill
              value={`RPE ${strengthAvgFeeling !== null ? strengthAvgFeeling.toFixed(1) : "-"}/10`}
              colored
              colorValue={strengthAvgFeeling !== null ? strengthAvgFeeling / 2 : null}
              invert
            />
          </div>

          {/* Tonnage & Volume chart */}
          <motion.div variants={slideUp} initial="hidden" animate="visible">
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-0 h-[200px] w-full">
                {isStrengthLoading ? (
                  <ChartSkeleton />
                ) : strengthAggregateData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Aucune donnee disponible.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={strengthAggregateData}>
                      <defs>
                        <linearGradient id="strengthTonnageGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Bar dataKey="tonnage" name="Tonnage (kg)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.7} />
                      <Line type="monotone" dataKey="volume" name="Volume (reps)" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Feeling chart */}
          <motion.div variants={slideUp} initial="hidden" animate="visible">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ressenti par seance</h3>
            <div className="h-[180px] w-full">
              {isStrengthLoading ? (
                <ChartSkeleton />
              ) : strengthData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Aucune donnee disponible.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={strengthData}>
                    <defs>
                      <linearGradient id="strengthFeelingGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} hide />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      formatter={(value: number) => [value !== null ? value.toFixed(1) : "-", "RPE"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="feeling"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2}
                      fill="url(#strengthFeelingGradient)"
                      dot={{ r: 4, fill: "hsl(var(--background))", stroke: "hsl(var(--foreground))", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Exercise detail — collapsible */}
          <CollapsibleSection title="Detail par exercice">
            <div className="space-y-4">
              {/* Top exercises bar chart */}
              <div className="h-[220px] w-full">
                {topExerciseVolume.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Aucun exercice enregistre.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topExerciseVolume} layout="vertical">
                      <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={100} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                        formatter={(value: number) => [`${value.toLocaleString()} kg`, "Volume"]}
                      />
                      <Bar dataKey="totalVolume" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Exercise stats table */}
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exercice</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Max</TableHead>
                      <TableHead className="text-right">Dernier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exerciseVolumeData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                          Aucun exercice enregistre.
                        </TableCell>
                      </TableRow>
                    ) : (
                      exerciseVolumeData.map((entry) => (
                        <TableRow key={entry.exerciseId}>
                          <TableCell className="font-medium text-sm">{entry.name}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {entry.totalVolume.toLocaleString()} kg
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {entry.maxWeight !== null ? `${entry.maxWeight} kg` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {formatExerciseDate(entry.lastPerformedAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CollapsibleSection>

          {/* Recent history — collapsible */}
          <CollapsibleSection title="Historique recent">
            <div className="space-y-3">
              {strengthRuns.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-6">
                  Aucun historique disponible.
                </div>
              )}
              {strengthRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                  <div>
                    <div className="text-sm font-semibold">
                      {format(new Date(run.started_at || run.date || run.created_at || new Date()), "dd/MM/yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {run.status || "Seance"}
                    </div>
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    {formatRunRpe(getRunRpeValue(run))}/10
                  </div>
                </div>
              ))}
              {strengthHistoryQuery.hasNextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => strengthHistoryQuery.fetchNextPage()}
                  disabled={strengthHistoryQuery.isFetchingNextPage}
                >
                  {strengthHistoryQuery.isFetchingNextPage ? "Chargement..." : "Charger plus"}
                </Button>
              )}
            </div>
          </CollapsibleSection>
        </TabsContent>
```

**Step 2: Close the JSX properly**

Ensure the closing tags are:
```tsx
      </Tabs>
    </div>
  );
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: No new errors.

**Step 4: Run tests**

Run: `npm test -- --reporter=verbose 2>&1 | head -30`
Expected: All Progress tests pass.

**Step 5: Commit**

```bash
git add src/pages/Progress.tsx
git commit -m "feat(progress): redesign musculation tab — hero tonnage, gradient charts, collapsible sections"
```

---

## Task 7: Clean up unused code and remove filter controls

**Files:**
- Modify: `src/pages/Progress.tsx`

**Step 1: Remove unused state and variables**

The old `historyStatus`, `historyFrom`, `historyTo` filter state variables and the `Input` import were used for strength history filtering controls that no longer appear in the UI. Check if they're still referenced (they are — in the query). Keep the query params but remove the state if no UI exposes them.

Actually — leave `historyStatus`, `historyFrom`, `historyTo` as they control the infinite query. Just verify no dead imports remain (`Select`, `SelectContent`, etc., `CartesianGrid`, `Input`).

**Step 2: Verify the final file compiles and tests pass**

Run: `npx tsc --noEmit 2>&1 | head -30 && npm test -- --reporter=verbose 2>&1 | head -30`

**Step 3: Commit**

```bash
git add src/pages/Progress.tsx
git commit -m "chore(progress): remove unused imports and dead code"
```

---

## Task 8: Visual QA and final polish

**Files:**
- Modify: `src/pages/Progress.tsx` (minor tweaks)

**Step 1: Run dev server and verify visually**

Run: `npm run dev`
Check at http://localhost:8080/#/progress

Verify:
- [ ] Title "Progression" displays correctly
- [ ] ToggleGroup period selector works (7j / 30j / 1 an)
- [ ] Natation tab: hero volume + pills + gradient curve + progress bars + collapsible nages
- [ ] Musculation tab: hero tonnage + pills + composed chart + feeling curve + collapsible exercices + collapsible historique
- [ ] Animations play on tab switch
- [ ] Mobile responsive (< 640px): single column, pills wrap, charts scale

**Step 2: Fix any visual issues found during QA**

Common adjustments:
- Chart heights may need tuning
- Pill wrapping on very small screens
- ToggleGroup might need `w-fit` for alignment

**Step 3: Final commit**

```bash
git add src/pages/Progress.tsx
git commit -m "feat(progress): visual polish after QA"
```

---

## Task 9: Update documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/FEATURES_STATUS.md`

**Step 1: Add entry to implementation-log.md**

Add a new section:

```markdown
## §41 — Redesign page Progression (2026-02-16)

### Contexte
La page Progression etait surchargee (6+ graphiques par onglet, grilles denses de cards KPI). Redesign en style Apple Health : minimaliste, hero KPIs, courbes gradient, barres de progression horizontales, sections repliables.

### Changements
- `src/pages/Progress.tsx` : Refonte complete du rendu (meme logique/queries)
  - Hero KPI avec tendance % et animation
  - Pills inline au lieu de cards KPI
  - AreaChart avec gradient au lieu de BarChart
  - ProgressBar horizontales pour ressentis (remplace SwimKpiCompactGrid)
  - Sections detail (nages, exercices, historique) dans des Collapsible
  - ToggleGroup au lieu de Select pour la periode
  - Animations framer-motion (slideUp stagger)
- `src/pages/__tests__/Progress.test.tsx` : Tests mis a jour (ProgressBar au lieu de SwimKpiCompactGrid)

### Fichiers modifies
- `src/pages/Progress.tsx`
- `src/pages/__tests__/Progress.test.tsx`

### Decisions
- Pas de nouveaux appels API — pur refactor UI
- SwimKpiCompactGrid supprime (n'etait utilise que dans Progress)
- Tendance calculee cote client (compare periode N vs N-1 pour natation, premiere moitie vs seconde pour muscu)

### Limites
- Tendance muscu approximative (premiere/seconde moitie de la periode selectionnee)
```

**Step 2: Update ROADMAP.md** — add chantier "Redesign Progression" as Fait.

**Step 3: Update FEATURES_STATUS.md** — mark Progression page as redesigned.

**Step 4: Commit documentation**

```bash
git add docs/implementation-log.md docs/ROADMAP.md docs/FEATURES_STATUS.md
git commit -m "docs: add Progression redesign to implementation log and roadmap"
```
