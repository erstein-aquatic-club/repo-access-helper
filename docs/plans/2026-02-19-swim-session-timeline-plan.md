# Swim Session Timeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remplacer `SwimSessionConsultation` (cartes + badges denses) par `SwimSessionTimeline` — une timeline verticale colorée avec rail d'intensité, exercices compacts, icônes matériel, et toggle 3 niveaux (Détail/Compact/Bassin).

**Architecture:** Nouveau composant `SwimSessionTimeline` avec même interface que `SwimSessionConsultation`. Réutilise les helpers existants (groupItemsByBlock, normalizeIntensity, etc.) extraits dans un module partagé. Remplace les 3 usages (SwimSessionView, SwimCatalog, SwimSessionBuilder).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide icons, SVG equipment existants

**Prototype visuel :** `docs/prototypes/swim-timeline-prototype.html` (ouvrir dans un navigateur pour référence)

---

## Task 1: Extraire les helpers partagés

**Files:**
- Create: `src/lib/swimConsultationUtils.ts`
- Modify: `src/components/swim/SwimSessionConsultation.tsx` (re-import)

**Step 1:** Créer `src/lib/swimConsultationUtils.ts` avec les fonctions et types extraits de `SwimSessionConsultation.tsx` :

```ts
// src/lib/swimConsultationUtils.ts
import { intensityScale } from "@/components/swim/IntensityDots";
import type { SwimSessionItem } from "@/lib/api";
import type { SwimPayloadFields } from "@/lib/types";

// ─── Types ───
export interface BlockGroup {
  key: string;
  title: string;
  description?: string | null;
  modalities?: string | null;
  equipment?: string[] | null;
  order: number;
  repetitions?: number | null;
  items: SwimSessionItem[];
}

export type SwimExerciseDetail = {
  label: string;
  distance?: number | null;
  repetitions?: number | null;
  rest?: number | null;
  stroke?: string | null;
  strokeType?: string | null;
  intensity?: string | null;
  modalities?: string | null;
  restType?: "departure" | "rest" | null;
  equipment?: string[];
  blockTitle?: string;
  blockIndex?: number;
};

// ─── Maps ───
export const strokeLabelMap: Record<string, string> = {
  pap: "Pap", papillon: "Pap", crawl: "Crawl", dos: "Dos",
  brasse: "Brasse", "4n": "4 nages", "4 nages": "4 nages",
  spe: "Spé", "spé": "Spé",
};

export const strokeTypeLabels: Record<string, string> = {
  nc: "NC", educ: "Éducatif", jambes: "Jambes",
};

const legacyIntensityMap: Record<string, (typeof intensityScale)[number]> = {
  souple: "V0", facile: "V0", relache: "V0", "relâché": "V0",
};

// ─── Helpers ───
export const getStrokeLabel = (stroke?: string | null) =>
  stroke ? (strokeLabelMap[stroke] ?? stroke) : null;

export const normalizeIntensity = (intensity?: string | null) => {
  if (!intensity) return null;
  const trimmed = intensity.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === "prog" || lower === "progressif") return "Prog";
  if (legacyIntensityMap[lower]) return legacyIntensityMap[lower];
  const upper = trimmed.toUpperCase();
  if (upper === "MAX") return "Max";
  if (upper.startsWith("V")) {
    const level = Number.parseInt(upper.slice(1), 10);
    if (Number.isFinite(level) && level >= 4) return "Max";
    if (intensityScale.includes(upper as (typeof intensityScale)[number])) return upper;
  }
  return trimmed;
};

export const formatRecoveryDisplay = (seconds?: number | null) => {
  if (!seconds) return "";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min > 0 && sec > 0) return `${min}'${sec.toString().padStart(2, "0")}`;
  if (min > 0) return `${min}'00`;
  return `${sec}s`;
};

export const groupItemsByBlock = (items: SwimSessionItem[] = []): BlockGroup[] => {
  // (exact code from SwimSessionConsultation.tsx lines 132-204)
  // copier tel quel
};
```

**Step 2:** Modifier `SwimSessionConsultation.tsx` pour importer depuis le nouveau module :

```ts
import {
  type BlockGroup,
  type SwimExerciseDetail,
  normalizeIntensity,
  getStrokeLabel,
  formatRecoveryDisplay,
  groupItemsByBlock,
  strokeTypeLabels,
} from "@/lib/swimConsultationUtils";
```

Supprimer les définitions locales correspondantes. Garder le `export type { SwimExerciseDetail }` pour ne pas casser les imports existants.

**Step 3:** Vérifier que le build passe : `npm run build`

**Step 4:** Commit

```bash
git add src/lib/swimConsultationUtils.ts src/components/swim/SwimSessionConsultation.tsx
git commit -m "refactor: extract swim consultation helpers to shared module"
```

---

## Task 2: Ajouter les animations CSS timeline

**Files:**
- Modify: `src/index.css`

**Step 1:** Ajouter les keyframes dans `src/index.css` (après le bloc `@theme inline`) :

```css
/* Timeline block reveal animation */
@keyframes timeline-block-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Step 2:** Commit

```bash
git add src/index.css
git commit -m "feat: add timeline block reveal animation keyframes"
```

---

## Task 3: Créer le composant `EquipmentIconCompact`

**Files:**
- Create: `src/components/swim/EquipmentIconCompact.tsx`

**Step 1:** Créer le composant :

```tsx
// src/components/swim/EquipmentIconCompact.tsx
import { cn } from "@/lib/utils";
import { getEquipmentIconUrl } from "@/components/swim/EquipmentPill";

const shortLabels: Record<string, string> = {
  palmes: "Pal",
  tuba: "Tub",
  plaquettes: "Plq",
  pull: "Pul",
  elastique: "Éla",
};

type EquipmentIconCompactProps = {
  equipment: string;
  className?: string;
  size?: "sm" | "md";
};

export function EquipmentIconCompact({
  equipment,
  className,
  size = "md",
}: EquipmentIconCompactProps) {
  const key = equipment.trim().toLowerCase();
  const iconUrl = getEquipmentIconUrl(equipment);
  const label = shortLabels[key] ?? equipment.slice(0, 3);
  const boxSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const imgSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={cn("flex flex-col items-center gap-0.5", className)}>
      <div
        className={cn(
          boxSize,
          "flex items-center justify-center rounded-lg bg-muted",
        )}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={equipment}
            className={cn(imgSize, "opacity-70")}
            aria-hidden="true"
          />
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {label}
          </span>
        )}
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
```

**Step 2:** Vérifier : `npx tsc --noEmit`

**Step 3:** Commit

```bash
git add src/components/swim/EquipmentIconCompact.tsx
git commit -m "feat: add compact equipment icon component for timeline"
```

---

## Task 4: Créer le composant `SwimSessionTimeline`

**Files:**
- Create: `src/components/swim/SwimSessionTimeline.tsx`

C'est le composant principal. Référence visuelle : `docs/prototypes/swim-timeline-prototype.html`

**Step 1:** Créer le fichier avec la structure complète.

### Props interface

```tsx
import { useState, useMemo } from "react";
import type { SwimSessionItem } from "@/lib/api";
import type { SwimPayloadFields } from "@/lib/types";
import {
  type BlockGroup,
  type SwimExerciseDetail,
  normalizeIntensity,
  getStrokeLabel,
  formatRecoveryDisplay,
  groupItemsByBlock,
  strokeTypeLabels,
} from "@/lib/swimConsultationUtils";
import { intensityTone, formatIntensityLabel } from "@/components/swim/IntensityDots";
import { EquipmentIconCompact } from "@/components/swim/EquipmentIconCompact";
import { splitModalitiesLines } from "@/lib/swimSessionUtils";
import { calculateSwimTotalDistance } from "@/lib/swimSessionUtils";
import { ChevronDown, Clock, Layers, Eye, List, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwimSessionTimelineProps {
  title: string;
  description?: string;
  items?: SwimSessionItem[];
  showHeader?: boolean;
  onExerciseSelect?: (detail: SwimExerciseDetail) => void;
}
```

### Maps internes

```tsx
// Couleur du rail par intensité dominante (classes Tailwind existantes)
const railColorMap: Record<string, string> = {
  V0: "bg-intensity-1",
  V1: "bg-intensity-2",
  V2: "bg-intensity-3",
  V3: "bg-intensity-4",
  Max: "bg-intensity-5",
  Prog: "bg-intensity-prog",
};

// Couleur du dot (shadow glow via ring)
const dotRingMap: Record<string, string> = {
  V0: "ring-intensity-1/40 shadow-[0_0_10px_-2px_var(--color-intensity-1)]",
  V1: "ring-intensity-2/40 shadow-[0_0_10px_-2px_var(--color-intensity-2)]",
  V2: "ring-intensity-3/40 shadow-[0_0_10px_-2px_var(--color-intensity-3)]",
  V3: "ring-intensity-4/40 shadow-[0_0_10px_-2px_var(--color-intensity-4)]",
  Max: "ring-intensity-5/40 shadow-[0_0_10px_-2px_var(--color-intensity-5)]",
  Prog: "ring-intensity-prog/40 shadow-[0_0_10px_-2px_var(--color-intensity-prog)]",
};

// Couleur texte intensité par exercice
const intensityTextMap: Record<string, string> = {
  V0: "text-intensity-1",
  V1: "text-intensity-2",
  V2: "text-intensity-3",
  V3: "text-intensity-4",
  Max: "text-intensity-5",
  Prog: "bg-gradient-to-r from-intensity-2 to-intensity-4 bg-clip-text text-transparent",
};

// Badges nages
const strokeBadgeMap: Record<string, { label: string; className: string }> = {
  Crawl:    { label: "Crawl",    className: "bg-sky-100 text-sky-800" },
  Dos:      { label: "Dos",      className: "bg-violet-100 text-violet-800" },
  Brasse:   { label: "Brasse",   className: "bg-emerald-100 text-emerald-800" },
  Pap:      { label: "Pap",      className: "bg-amber-100 text-amber-800" },
  "4 nages":{ label: "4N",       className: "bg-slate-100 text-slate-700" },
  "Spé":    { label: "Spé",      className: "bg-pink-100 text-pink-800" },
};

// Badges types d'exercice
const typeBadgeMap: Record<string, { label: string; className: string }> = {
  "Éducatif": { label: "Éduc",   className: "bg-violet-100 text-violet-800 italic" },
  "Jambes":   { label: "Jambes", className: "bg-teal-100 text-teal-800" },
};
```

### Helpers internes

```tsx
// Intensité dominante d'un bloc = la plus élevée trouvée
const getDominantIntensity = (items: SwimSessionItem[]): string => {
  const priority = ["Max", "V3", "V2", "V1", "V0", "Prog"];
  const intensities = items
    .map((item) => {
      const p = (item.raw_payload as SwimPayloadFields) ?? {};
      return normalizeIntensity(p.exercise_intensity ?? item.intensity);
    })
    .filter(Boolean) as string[];
  for (const level of priority) {
    if (intensities.includes(level)) return level;
  }
  return "V1";
};

// Distance d'un bloc (en tenant compte des répétitions exercice, pas des reps bloc car le total est déjà multiplié)
const computeBlockDistance = (block: BlockGroup): number => {
  const itemsDistance = block.items.reduce((total, item) => {
    const p = (item.raw_payload as SwimPayloadFields) ?? {};
    const reps = Number(p.exercise_repetitions) || 1;
    const dist = Number(item.distance) || 0;
    return total + reps * dist;
  }, 0);
  return itemsDistance * (block.repetitions || 1);
};

// Label d'exercice formaté : "4×100m"
const formatExerciseLabel = (item: SwimSessionItem): string => {
  const p = (item.raw_payload as SwimPayloadFields) ?? {};
  const reps = Number(p.exercise_repetitions);
  const dist = Number(item.distance);
  if (reps > 1 && dist > 0) return `${reps}×${dist}m`;
  if (dist > 0) return `${dist}m`;
  return item.label || "—";
};
```

### Structure du composant

```tsx
export function SwimSessionTimeline({
  title,
  description,
  items = [],
  showHeader = true,
  onExerciseSelect,
}: SwimSessionTimelineProps) {
  const [viewLevel, setViewLevel] = useState<0 | 1 | 2>(0);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());

  const blocks = useMemo(() => groupItemsByBlock(items), [items]);
  const totalDistance = useMemo(() => calculateSwimTotalDistance(items), [items]);

  // Cumul distance pour milestones
  const cumulativeDistances = useMemo(() => {
    let cumul = 0;
    return blocks.map((block) => {
      cumul += computeBlockDistance(block);
      return cumul;
    });
  }, [blocks]);

  const toggleBlock = (key: string) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const cycleViewLevel = () => {
    const next = ((viewLevel + 1) % 3) as 0 | 1 | 2;
    setViewLevel(next);
    if (next === 2) {
      // Bassin: collapse all
      setCollapsedBlocks(new Set(blocks.map((b) => b.key)));
    } else if (next === 0) {
      // Détail: expand all
      setCollapsedBlocks(new Set());
    }
  };

  const isBassin = viewLevel === 2;
  const isCompact = viewLevel >= 1; // compact hides details, bassin too

  return (
    <div className="space-y-0">
      {/* ─── HEADER ─── */}
      {showHeader && (
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="flex items-baseline gap-4">
            <span className="text-3xl font-display font-extrabold tracking-tight tabular-nums">
              {totalDistance.toLocaleString("fr-FR")}m
            </span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              {blocks.length} blocs
            </span>
          </div>
          <button
            type="button"
            onClick={cycleViewLevel}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              viewLevel === 0 && "border-border bg-card text-muted-foreground",
              viewLevel === 1 && "border-muted-foreground/30 bg-muted text-foreground",
              viewLevel === 2 && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {viewLevel === 0 && <><Eye className="h-3.5 w-3.5" /> Détail</>}
            {viewLevel === 1 && <><List className="h-3.5 w-3.5" /> Compact</>}
            {viewLevel === 2 && <><Waves className="h-3.5 w-3.5" /> Bassin</>}
          </button>
        </div>
      )}

      {/* ─── BLOCKS TIMELINE ─── */}
      {blocks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-muted/70 bg-muted/30 p-6 text-sm text-muted-foreground">
          Aucun contenu détaillé pour cette séance.
        </div>
      ) : (
        blocks.map((block, blockIndex) => {
          const dominant = getDominantIntensity(block.items);
          const blockDist = computeBlockDistance(block);
          const isCollapsed = collapsedBlocks.has(block.key);
          const cumulDist = cumulativeDistances[blockIndex];

          return (
            <div key={block.key}>
              {/* ─── BLOCK ─── */}
              <div
                className="flex"
                style={{
                  animationName: "timeline-block-reveal",
                  animationDuration: "0.5s",
                  animationTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
                  animationFillMode: "both",
                  animationDelay: `${blockIndex * 0.07}s`,
                }}
              >
                {/* Rail */}
                <div className="flex w-8 shrink-0 flex-col items-center pt-0.5">
                  <div
                    className={cn(
                      "h-4 w-4 shrink-0 rounded-full border-[3px] border-background ring-2",
                      railColorMap[dominant],
                      dotRingMap[dominant],
                    )}
                  />
                  <div
                    className={cn(
                      "-mt-0.5 w-[5px] grow rounded-full opacity-35",
                      railColorMap[dominant],
                    )}
                  />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pb-2 pl-3">
                  {/* Block header */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 py-1.5"
                    onClick={() => toggleBlock(block.key)}
                    aria-expanded={!isCollapsed}
                  >
                    <span
                      className={cn(
                        "text-xs font-bold uppercase tracking-[0.08em]",
                        `${intensityTextMap[dominant] ?? "text-foreground"}`,
                      )}
                    >
                      {block.title}
                    </span>
                    {block.repetitions && block.repetitions > 1 ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold text-white",
                          railColorMap[dominant],
                        )}
                      >
                        ×{block.repetitions}
                      </span>
                    ) : null}
                    <span className="flex-1" />
                    <span className="text-sm font-bold tabular-nums tracking-tight">
                      {blockDist.toLocaleString("fr-FR")}m
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                  </button>

                  {/* Block description */}
                  {!isCollapsed && !isCompact && block.description ? (
                    <p className="pb-1.5 text-xs italic text-muted-foreground">
                      {block.description}
                    </p>
                  ) : null}

                  {/* Exercises */}
                  {!isCollapsed && (
                    <div className="space-y-0 divide-y divide-border/50">
                      {block.items.map((item, itemIndex) => {
                        // Render exercise row
                        // (voir code détaillé ci-dessous)
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── MILESTONE ─── */}
              {blockIndex < blocks.length - 1 && (
                <div className="flex items-center gap-0 py-1" style={{ marginLeft: "15px" }}>
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="px-2 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {cumulDist.toLocaleString("fr-FR")}m
                  </span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ─── SESSION END ─── */}
      {blocks.length > 0 && (
        <div className="flex items-center gap-2 pl-2.5 pt-2">
          <div className="h-2.5 w-2.5 rounded-full bg-muted" />
          <span className="text-xs font-semibold text-muted-foreground">
            Fin de séance — {totalDistance.toLocaleString("fr-FR")}m
          </span>
        </div>
      )}
    </div>
  );
}
```

### Rendu d'un exercice (à intégrer dans la boucle items.map)

```tsx
const payload = (item.raw_payload as SwimPayloadFields) ?? {};
const normalized = normalizeIntensity(payload.exercise_intensity ?? item.intensity);
const strokeLabel = getStrokeLabel(payload.exercise_stroke);
const strokeTypeLabel = payload.exercise_stroke_type
  ? strokeTypeLabels[payload.exercise_stroke_type] ?? payload.exercise_stroke_type
  : null;
const equipmentList = Array.isArray(payload.exercise_equipment)
  ? payload.exercise_equipment
  : [];
const exerciseLabel = formatExerciseLabel(item);
const restSeconds = payload.exercise_rest as number | undefined;
const restType = payload.exercise_rest_type as "departure" | "rest" | undefined;
const modalitiesLines = splitModalitiesLines(item.notes);

const strokeBadge = strokeLabel ? strokeBadgeMap[strokeLabel] : null;
const typeBadge = strokeTypeLabel ? typeBadgeMap[strokeTypeLabel] : null;

return (
  <div key={`${block.key}-${itemIndex}`} className="py-2">
    {/* Main exercise row */}
    <div className="flex items-center gap-1.5">
      <span className={cn(
        "min-w-[72px] font-display font-bold tabular-nums tracking-tight",
        isBassin ? "text-xl" : "text-base",
      )}>
        {exerciseLabel}
      </span>

      {strokeBadge && (
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-bold",
          strokeBadge.className,
          isBassin && "px-2.5 py-1 text-xs",
        )}>
          {strokeBadge.label}
        </span>
      )}

      {!isBassin && typeBadge && (
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
          typeBadge.className,
        )}>
          {typeBadge.label}
        </span>
      )}

      {!isBassin && normalized && (
        <span className={cn(
          "text-xs font-bold",
          intensityTextMap[normalized] ?? "text-foreground",
        )}>
          {formatIntensityLabel(normalized)}
        </span>
      )}

      <span className="flex-1" />

      {!isBassin && restSeconds ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {restType === "departure" ? "d:" : "r:"}
          {formatRecoveryDisplay(restSeconds)}
        </span>
      ) : null}
    </div>

    {/* Equipment row */}
    {equipmentList.length > 0 && (
      <div className="mt-1.5 flex gap-2">
        {equipmentList.map((eq: string) => (
          <EquipmentIconCompact
            key={eq}
            equipment={eq}
            size={isBassin ? "md" : "sm"}
          />
        ))}
      </div>
    )}

    {/* Modalities (visible only in Détail mode = viewLevel 0) */}
    {!isCompact && modalitiesLines.length > 0 && (
      <div className="mt-2 rounded-lg border-l-[3px] border-l-muted-foreground/20 bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
        {modalitiesLines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    )}
  </div>
);
```

**Step 2:** Vérifier : `npx tsc --noEmit`

**Step 3:** Vérifier visuellement en remplaçant temporairement dans SwimSessionView

**Step 4:** Commit

```bash
git add src/components/swim/SwimSessionTimeline.tsx
git commit -m "feat: add SwimSessionTimeline component with colored rail and 3-level toggle"
```

---

## Task 5: Remplacer dans SwimSessionView

**Files:**
- Modify: `src/pages/SwimSessionView.tsx`

**Step 1:** Remplacer l'import et le composant :

```tsx
// Avant:
import { SwimExerciseDetail, SwimSessionConsultation } from "@/components/swim/SwimSessionConsultation";

// Après:
import { SwimSessionTimeline } from "@/components/swim/SwimSessionTimeline";
import type { SwimExerciseDetail } from "@/lib/swimConsultationUtils";
```

**Step 2:** Supprimer le state `compactMode` et le toggle Condensé/Détail (lignes ~39, ~165-186).

**Step 3:** Remplacer `<SwimSessionConsultation>` par `<SwimSessionTimeline>` (sans prop `compactMode`).

```tsx
<SwimSessionTimeline
  title={assignment.title}
  description={assignment.description}
  items={assignment.items}
  showHeader={false}
  onExerciseSelect={(detail) => setSelectedExercise(detail)}
/>
```

Note : `showHeader={false}` car la page a déjà son propre header avec distance et blocs. OU mettre `showHeader={true}` et supprimer le header dupliqué de la page. **Recommandé : `showHeader={true}`** et simplifier le Card wrapper pour ne garder que le titre + la timeline. Supprimer les badges distance/blocs redondants du Card.

**Step 4:** Vérifier visuellement dans le navigateur

**Step 5:** Commit

```bash
git add src/pages/SwimSessionView.tsx
git commit -m "feat: replace SwimSessionConsultation with SwimSessionTimeline in swimmer view"
```

---

## Task 6: Remplacer dans SwimCatalog (coach preview)

**Files:**
- Modify: `src/pages/coach/SwimCatalog.tsx`

**Step 1:** Remplacer l'import :

```tsx
// Avant:
import { SwimSessionConsultation } from "@/components/swim/SwimSessionConsultation";

// Après:
import { SwimSessionTimeline } from "@/components/swim/SwimSessionTimeline";
```

**Step 2:** Remplacer dans le DialogContent (vers ligne 674) :

```tsx
<SwimSessionTimeline
  title={selectedSession?.name ?? ""}
  description={selectedSession?.description ?? undefined}
  items={selectedSession?.items}
/>
```

**Step 3:** Commit

```bash
git add src/pages/coach/SwimCatalog.tsx
git commit -m "feat: use SwimSessionTimeline in coach catalog preview"
```

---

## Task 7: Remplacer dans SwimSessionBuilder

**Files:**
- Modify: `src/components/coach/swim/SwimSessionBuilder.tsx`

**Step 1:** Même pattern que Task 6 — remplacer import et usage.

**Step 2:** Commit

```bash
git add src/components/coach/swim/SwimSessionBuilder.tsx
git commit -m "feat: use SwimSessionTimeline in swim session builder preview"
```

---

## Task 8: Nettoyage — supprimer l'ancien composant

**Files:**
- Delete: `src/components/swim/SwimSessionConsultation.tsx` (si plus aucun import)
- Verify: `grep -r "SwimSessionConsultation" src/` retourne 0 résultat

**Step 1:** Vérifier qu'il n'y a plus d'imports :

```bash
grep -r "SwimSessionConsultation" src/
```

**Step 2:** Si clean, supprimer le fichier

**Step 3:** Commit

```bash
git rm src/components/swim/SwimSessionConsultation.tsx
git commit -m "cleanup: remove deprecated SwimSessionConsultation component"
```

---

## Task 9: Mettre à jour la documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `CLAUDE.md`

**Step 1:** Ajouter une entrée dans `implementation-log.md` :

```markdown
## §54 — Swim Session Timeline (refonte affichage séance natation)

**Contexte :** L'affichage des séances natation (SwimSessionConsultation) utilisait des cartes avec badges denses, peu lisible sur mobile et difficile à mémoriser.

**Changements :**
- Nouveau composant `SwimSessionTimeline` avec timeline verticale colorée
- Rail d'intensité coloré (vert V0/V1, ambre V2, orange V3, rouge Max)
- Exercices en lignes compactes (distance + badge nage + intensité + repos)
- Icônes matériel compactes (EquipmentIconCompact)
- Toggle 3 niveaux : Détail (tout visible) / Compact (modalités masquées) / Bassin (blocs repliés, gros texte)
- Milestones de distance cumulative entre les blocs
- Helpers extraits dans `swimConsultationUtils.ts`

**Fichiers modifiés :**
- `src/components/swim/SwimSessionTimeline.tsx` (nouveau)
- `src/components/swim/EquipmentIconCompact.tsx` (nouveau)
- `src/lib/swimConsultationUtils.ts` (nouveau)
- `src/pages/SwimSessionView.tsx` (remplacement)
- `src/pages/coach/SwimCatalog.tsx` (remplacement)
- `src/components/coach/swim/SwimSessionBuilder.tsx` (remplacement)
- `src/components/swim/SwimSessionConsultation.tsx` (supprimé)
- `src/index.css` (animation timeline)
```

**Step 2:** Mettre à jour ROADMAP, FEATURES_STATUS, CLAUDE.md avec le nouveau chantier §54

**Step 3:** Commit

```bash
git add docs/ CLAUDE.md
git commit -m "docs: add §54 swim session timeline to tracking files"
```
