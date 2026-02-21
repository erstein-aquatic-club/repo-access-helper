import { useState, useCallback } from "react";
import { ChevronUp, Activity, Timer, Hash, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SwimSessionItem, SwimExerciseLogInput, SplitTimeEntry, StrokeCountEntry } from "@/lib/api/types";
import type { SwimPayloadFields } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect number of repetitions from a SwimSessionItem */
export function detectRepetitions(item: SwimSessionItem): number {
  const payload = (item.raw_payload ?? {}) as SwimPayloadFields;

  // 1. Explicit numeric field
  const explicit = Number(payload.exercise_repetitions);
  if (Number.isFinite(explicit) && explicit >= 1) return explicit;

  // 2. Parse from label: "6x50m", "6×50m", "6 x 50"
  const label = item.label ?? "";
  const match = label.match(/^(\d+)\s*[x×]/i);
  if (match) return parseInt(match[1], 10);

  return 1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ExerciseLogInlineProps {
  item: SwimSessionItem;
  log: SwimExerciseLogInput;
  onChange: (log: SwimExerciseLogInput) => void;
  onCollapse: () => void;
}

export function ExerciseLogInline({ item, log, onChange, onCollapse }: ExerciseLogInlineProps) {
  const reps = detectRepetitions(item);

  // Pre-populate arrays to N entries
  const initSplits = (): SplitTimeEntry[] =>
    Array.from({ length: reps }, (_, i) => {
      const existing = log.split_times?.find((s) => s.rep === i + 1);
      return { rep: i + 1, time_seconds: existing?.time_seconds ?? 0 };
    });

  const initStrokes = (): StrokeCountEntry[] =>
    Array.from({ length: reps }, (_, i) => {
      const existing = log.stroke_count?.find((s) => s.rep === i + 1);
      return { rep: i + 1, count: existing?.count ?? 0 };
    });

  const [splits, setSplits] = useState<SplitTimeEntry[]>(initSplits);
  const [strokes, setStrokes] = useState<StrokeCountEntry[]>(initStrokes);
  const [showStrokes, setShowStrokes] = useState(
    () => !!log.stroke_count?.some((s) => s.count > 0),
  );

  const emit = useCallback(
    (patch: Partial<SwimExerciseLogInput>) => {
      onChange({ ...log, ...patch });
    },
    [log, onChange],
  );

  // -- Field handlers --------------------------------------------------------

  const handleTempoChange = (value: string) => {
    const n = parseFloat(value);
    emit({ tempo: Number.isFinite(n) ? n : null });
  };

  const handleSplitChange = (index: number, value: string) => {
    const n = parseFloat(value);
    const next = splits.map((s, i) =>
      i === index ? { ...s, time_seconds: Number.isFinite(n) ? n : 0 } : s,
    );
    setSplits(next);
    emit({ split_times: next });
  };

  const handleStrokeChange = (index: number, value: string) => {
    const n = parseInt(value, 10);
    const next = strokes.map((s, i) =>
      i === index ? { ...s, count: Number.isFinite(n) ? n : 0 } : s,
    );
    setStrokes(next);
    emit({ stroke_count: next });
  };

  const handleNotesChange = (value: string) => {
    emit({ notes: value || null });
  };

  // -- Render ----------------------------------------------------------------

  return (
    <div className="border-t border-border/40 bg-muted/30 px-3 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Détails techniques</span>
        <button
          type="button"
          onClick={onCollapse}
          className="p-1 rounded-md hover:bg-muted"
          aria-label="Replier"
        >
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Tempo */}
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground w-14">Tempo</span>
        <input
          type="number"
          step={0.1}
          inputMode="decimal"
          placeholder="c/min"
          value={log.tempo ?? ""}
          onChange={(e) => handleTempoChange(e.target.value)}
          className={cn(
            "h-8 w-24 rounded-md border border-input bg-background px-2 text-sm",
            "focus:outline-none focus:ring-1 focus:ring-ring",
          )}
        />
      </div>

      {/* Split times */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Temps par rep</span>
        </div>
        <div className="grid grid-cols-3 gap-2 pl-6">
          {splits.map((s, i) => (
            <div key={s.rep} className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">Rep {s.rep}</span>
              <input
                type="number"
                step={0.1}
                inputMode="decimal"
                placeholder="sec"
                value={s.time_seconds || ""}
                onChange={(e) => handleSplitChange(i, e.target.value)}
                className={cn(
                  "h-8 w-full rounded-md border border-input bg-background px-2 text-sm",
                  "focus:outline-none focus:ring-1 focus:ring-ring",
                )}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Stroke counts (toggleable) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setShowStrokes((v) => !v)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Coups de bras {showStrokes ? "▾" : "▸"}
          </button>
        </div>
        {showStrokes && (
          <div className="grid grid-cols-3 gap-2 pl-6">
            {strokes.map((s, i) => (
              <div key={s.rep} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">Rep {s.rep}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="coups"
                  value={s.count || ""}
                  onChange={(e) => handleStrokeChange(i, e.target.value)}
                  className={cn(
                    "h-8 w-full rounded-md border border-input bg-background px-2 text-sm",
                    "focus:outline-none focus:ring-1 focus:ring-ring",
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Notes</span>
        </div>
        <textarea
          rows={2}
          placeholder="Notes libres..."
          value={log.notes ?? ""}
          onChange={(e) => handleNotesChange(e.target.value)}
          className={cn(
            "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm resize-none ml-6",
            "focus:outline-none focus:ring-1 focus:ring-ring",
          )}
        />
      </div>
    </div>
  );
}
