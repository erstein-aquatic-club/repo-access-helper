import { useMemo, useState, useCallback } from "react";
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
import { api, Assignment, SwimSessionItem } from "@/lib/api";
import type { SwimExerciseLog, SwimExerciseLogInput } from "@/lib/api";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function inferSlot(assignedDate?: string | null): string {
  if (!assignedDate) return "Matin";
  const d = new Date(assignedDate);
  return d.getHours() >= 14 ? "Soir" : "Matin";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SwimSessionView() {
  const { user, userId } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Edit mode state
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

  const sessionCatalogId = assignment?.session_id;

  // Load existing exercise logs
  const { data: existingLogs } = useQuery({
    queryKey: ["swim-exercise-logs-by-catalog", sessionCatalogId, userId],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getSession();
      const authUid = authData.session?.user?.id;
      if (!authUid) return [];
      const sessions = await api.getSessions(user!, userId);
      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length === 0) return [];
      const allLogs: SwimExerciseLog[] = [];
      for (const sid of sessionIds.slice(0, 10)) {
        const logs = await api.getSwimExerciseLogs(sid);
        allLogs.push(...logs.filter((l) => l.user_id === authUid));
      }
      const itemIds = new Set(
        (assignment?.items ?? []).map((i) => i.id).filter(Boolean) as number[],
      );
      return allLogs.filter(
        (l) => l.source_item_id != null && itemIds.has(l.source_item_id),
      );
    },
    enabled: !!sessionCatalogId && !!userId && !!user,
  });

  // Merged logs map: local edits override DB data
  const logsMap = useMemo(() => {
    if (localLogs) return localLogs;
    if (!existingLogs) return new Map<number, SwimExerciseLogInput>();
    return buildLogsMap(existingLogs);
  }, [localLogs, existingLogs]);

  const handleToggleExpand = useCallback((itemId: number) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  }, []);

  const handleLogChange = useCallback(
    (itemId: number, log: SwimExerciseLogInput) => {
      setLocalLogs((prev) => {
        const next = new Map(prev ?? logsMap);
        next.set(itemId, log);
        return next;
      });
      setDirty(true);
    },
    [logsMap],
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: authData } = await supabase.auth.getSession();
      const authUid = authData.session?.user?.id;
      if (!authUid || !user) throw new Error("Non authentifié");

      const date = assignment?.assigned_date
        ? new Date(assignment.assigned_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const slot = inferSlot(assignment?.assigned_date);

      const sessionId = await api.ensureSwimSession({
        athleteName: user,
        athleteId: userId,
        date,
        slot,
      });

      // Filter to only logs with actual data
      const allLogs: SwimExerciseLogInput[] = [];
      for (const [, log] of logsMap) {
        const hasSplits = (log.split_times ?? []).some((s) => s.time_seconds > 0);
        const hasStrokes = (log.stroke_count ?? []).some((s) => s.count > 0);
        const hasData = hasSplits || hasStrokes || log.tempo != null || (log.notes?.trim());
        if (hasData) allLogs.push(log);
      }

      if (allLogs.length === 0) throw new Error("Aucune donnée à sauvegarder");

      await api.saveSwimExerciseLogs(sessionId, authUid, allLogs);
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["swim-exercise-logs-by-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["swim-exercise-logs-history"] });
      toast({ title: "Notes techniques sauvegardées" });
    },
    onError: (err) => {
      toast({
        title: "Erreur",
        description: (err as Error).message,
        variant: "destructive",
      });
    },
  });

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
        <Button onClick={() => refetch()} className="mt-4">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            aria-label="Retour à l'accueil"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Séance natation</div>
            <h1 className="text-2xl font-display font-bold uppercase">Détails</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {assignment ? (
            <Button variant="ghost" size="icon" onClick={handleShare} aria-label="Partager la séance">
              <Share2 className="h-5 w-5" />
            </Button>
          ) : null}
          {assignment ? (
            <Badge variant="secondary" className="text-xs">
              {statusLabels[assignment.status] ?? "Assignée"}
            </Badge>
          ) : null}
        </div>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <div className="text-lg font-semibold tracking-tight">
              {assignment?.title ?? "Séance natation"}
            </div>
            {assignment?.description ? (
              <p className="text-sm text-muted-foreground">{assignment.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="outline" className="text-xs">
              {formatAssignedDate(assignment?.assigned_date)}
            </Badge>
            {assignment ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const confirmed = window.confirm("Retirer cette séance de votre feed ?");
                  if (!confirmed) return;
                  deleteAssignmentMutation.mutate(assignment.id);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Retirer de mon feed
              </Button>
            ) : null}
          </div>
          <Separator />

          {/* Instruction text */}
          {assignment && !isLoading ? (
            <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
              Tapez sur un exercice pour ajouter vos temps et détails techniques.
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-4" aria-live="polite" aria-busy="true">
              <div className="sr-only">Chargement de la séance...</div>
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
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2 shadow-lg"
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
