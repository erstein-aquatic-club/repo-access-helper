import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EquipmentPill } from "@/components/swim/EquipmentPill";
import {
  formatIntensityLabel,
  intensityTone,
} from "@/components/swim/IntensityDots";
import { SwimBadgeRow } from "@/components/swim/SwimBadgeRow";
import { Repeat, Ruler, Timer, Waves } from "lucide-react";
import type { SwimSessionItem } from "@/lib/api";
import type { SwimPayloadFields } from "@/lib/types";
import { splitModalitiesLines } from "@/lib/swimSessionUtils";
import {
  type BlockGroup,
  formatRecoveryDisplay,
  getStrokeLabel,
  groupItemsByBlock,
  normalizeIntensity,
  strokeTypeLabels,
  strokeTypeTone,
} from "@/lib/swimConsultationUtils";

// Re-export for backward compatibility
export type { SwimExerciseDetail } from "@/lib/swimConsultationUtils";
import type { SwimExerciseDetail } from "@/lib/swimConsultationUtils";

interface SwimSessionConsultationProps {
  title: string;
  description?: string;
  items?: SwimSessionItem[];
  showHeader?: boolean;
  compactMode?: boolean;
  onExerciseSelect?: (detail: SwimExerciseDetail) => void;
}

const intensityTextTone: Record<string, string> = {
  V0: "text-intensity-1",
  V1: "text-intensity-2",
  V2: "text-intensity-3",
  V3: "text-intensity-4",
  Max: "text-intensity-5",
  Prog: "text-intensity-prog",
};

const intensityRingTone: Record<string, string> = {
  V0: "ring-intensity-1/30",
  V1: "ring-intensity-2/30",
  V2: "ring-intensity-3/30",
  V3: "ring-intensity-4/30",
  Max: "ring-intensity-5/30",
  Prog: "ring-intensity-prog/30",
};

const intensityBadgeClass = (value: string) =>
  `inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-card ${
    intensityTextTone[value] ?? "text-foreground"
  } ${intensityRingTone[value] ?? "ring-border"}`;

export function SwimSessionConsultation({
  title,
  description,
  items = [],
  showHeader = true,
  compactMode = false,
  onExerciseSelect,
}: SwimSessionConsultationProps) {
  const blocks = groupItemsByBlock(items);
  const isClickable = Boolean(onExerciseSelect);

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-2xl font-display font-semibold uppercase tracking-wide">{title}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <Separator />
        </div>
      ) : null}
      {blocks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-muted/70 bg-muted/30 p-6 text-sm text-muted-foreground">
          Aucun contenu détaillé pour cette séance.
        </div>
      ) : (
        blocks.map((block, blockIndex) => (
          <Card key={block.key} className="overflow-hidden border border-border shadow-sm">
            <CardHeader className="space-y-3 bg-muted/80 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Bloc {blockIndex + 1}
                  </div>
                  <div className="text-lg font-semibold tracking-tight text-foreground">{block.title}</div>
                  {block.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{block.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {block.repetitions ? (
                    <Badge variant="secondary" className="text-xs">
                      <Repeat className="mr-1 h-3 w-3" /> {block.repetitions}x
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="text-xs">
                    {block.items.length} exercices
                  </Badge>
                </div>
              </div>
              <SwimBadgeRow className="text-muted-foreground">
                {block.modalities ? (
                  <span
                    className="inline-flex max-w-[280px] items-center rounded-full bg-card px-2.5 py-1 ring-1 ring-border"
                    title={block.modalities}
                  >
                    <span className="truncate">Modalités : {block.modalities}</span>
                  </span>
                ) : null}
                {block.equipment?.length ? (
                  <SwimBadgeRow>
                    {block.equipment.map((equipment) => {
                      return (
                        <EquipmentPill key={equipment} equipment={equipment} />
                      );
                    })}
                  </SwimBadgeRow>
                ) : null}
              </SwimBadgeRow>
            </CardHeader>
            <CardContent className="space-y-4 bg-card px-5 py-4">
              {block.items.map((item, itemIndex) => {
                const payload = (item.raw_payload as SwimPayloadFields) ?? {};
                const normalizedIntensity = normalizeIntensity(payload.exercise_intensity ?? item.intensity ?? null);
                const strokeLabel = getStrokeLabel(payload.exercise_stroke);
                const strokeTypeLabel = payload.exercise_stroke_type
                  ? strokeTypeLabels[payload.exercise_stroke_type] ?? payload.exercise_stroke_type
                  : null;
                const equipmentList = Array.isArray(payload.exercise_equipment) ? payload.exercise_equipment : [];
                const exerciseLabel = item.label || `Exercice ${itemIndex + 1}`;
                const exerciseDetail: SwimExerciseDetail = {
                  label: exerciseLabel,
                  distance: item.distance ?? null,
                  repetitions: payload.exercise_repetitions ?? null,
                  rest: payload.exercise_rest ?? null,
                  restType: (payload.exercise_rest_type as "departure" | "rest") ?? "rest",
                  stroke: strokeLabel,
                  strokeType: strokeTypeLabel,
                  intensity: normalizedIntensity,
                  modalities: item.notes ?? null,
                  equipment: equipmentList,
                  blockTitle: block.title,
                  blockIndex,
                };
                const modalitiesLines = splitModalitiesLines(item.notes);
                const content = (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-sm font-semibold tracking-tight text-foreground">
                          {exerciseLabel}
                        </div>
                        {!compactMode ? (
                          <SwimBadgeRow className="text-muted-foreground">
                            {payload.exercise_repetitions ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                {payload.exercise_repetitions}x
                              </span>
                            ) : null}
                            {item.distance ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Ruler className="h-3 w-3" /> {item.distance}m
                              </span>
                            ) : null}
                            {payload.exercise_rest ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Timer className="h-3 w-3" />
                                {payload.exercise_rest_type === "departure" ? "Dép." : "Repos"}{" "}
                                {formatRecoveryDisplay(payload.exercise_rest as number)}
                              </span>
                            ) : null}
                            {payload.exercise_stroke ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Waves className="h-3 w-3" /> {strokeLabel}
                              </span>
                            ) : null}
                          </SwimBadgeRow>
                        ) : (
                          <SwimBadgeRow className="text-muted-foreground">
                            {payload.exercise_repetitions ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                {payload.exercise_repetitions}x
                              </span>
                            ) : null}
                            {item.distance ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Ruler className="h-3 w-3" /> {item.distance}m
                              </span>
                            ) : null}
                            {payload.exercise_rest ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Timer className="h-3 w-3" />
                                {payload.exercise_rest_type === "departure" ? "Dép." : "Repos"}{" "}
                                {formatRecoveryDisplay(payload.exercise_rest as number)}
                              </span>
                            ) : null}
                            {strokeLabel ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Waves className="h-3 w-3" /> {strokeLabel}
                              </span>
                            ) : null}
                            {normalizedIntensity ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    intensityTone[normalizedIntensity] ?? "bg-primary"
                                  }`}
                                />
                                {formatIntensityLabel(normalizedIntensity)}
                              </span>
                            ) : null}
                          </SwimBadgeRow>
                        )}
                      </div>
                      {!compactMode ? (
                        <div className="flex items-center gap-2 self-center">
                          {normalizedIntensity ? (
                            <span className={intensityBadgeClass(normalizedIntensity)}>
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  intensityTone[normalizedIntensity] ?? "bg-primary"
                                }`}
                              />
                              {formatIntensityLabel(normalizedIntensity)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {!compactMode && (strokeLabel || strokeTypeLabel) ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                        {strokeLabel ? (
                          <Badge className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-900 ring-1 ring-blue-200">
                            Nage : {strokeLabel}
                          </Badge>
                        ) : null}
                        {strokeTypeLabel ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 ring-1 ${
                              strokeTypeTone[payload.exercise_stroke_type ?? ""] ??
                              "bg-muted text-foreground ring-border"
                            }`}
                          >
                            Type : {strokeTypeLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {!compactMode && modalitiesLines.length ? (
                      <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                        <ul className="list-disc space-y-1 pl-4">
                          {modalitiesLines.map((line, lineIndex) => (
                            <li key={`${block.key}-${itemIndex}-line-${lineIndex}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {compactMode && modalitiesLines.length ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <ul className="list-disc space-y-1 pl-4">
                          {modalitiesLines.map((line, lineIndex) => (
                            <li key={`${block.key}-${itemIndex}-compact-${lineIndex}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {equipmentList.length ? (
                      <SwimBadgeRow className="mt-3">
                        {equipmentList.map((equipment: string) => (
                          <EquipmentPill key={equipment} equipment={equipment} />
                        ))}
                      </SwimBadgeRow>
                    ) : null}
                  </>
                );

                return isClickable ? (
                  <button
                    key={`${block.key}-${itemIndex}`}
                    type="button"
                    onClick={() => onExerciseSelect?.(exerciseDetail)}
                    className="w-full rounded-2xl border border-border bg-muted p-4 text-left transition hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Voir les détails de ${exerciseLabel}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={`${block.key}-${itemIndex}`}
                    className="w-full rounded-2xl border border-border bg-muted p-4 text-left"
                  >
                    {content}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
