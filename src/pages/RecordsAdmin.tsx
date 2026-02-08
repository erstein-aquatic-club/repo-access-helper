import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, summarizeApiError, type ClubRecordSwimmer } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SEX_OPTIONS = [
  { value: "M", label: "Gar\u00e7on" },
  { value: "F", label: "Fille" },
];

const formatSource = (source: ClubRecordSwimmer["source_type"]) =>
  source === "user" ? "Compte" : "Ancien";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR") + " " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "success":
      return "default" as const;
    case "running":
      return "secondary" as const;
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "success":
      return "OK";
    case "running":
      return "En cours";
    case "error":
      return "Erreur";
    case "pending":
      return "En attente";
    default:
      return status;
  }
};

export default function RecordsAdmin() {
  const role = useAuth((state) => state.role);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newSwimmer, setNewSwimmer] = useState({
    display_name: "",
    iuf: "",
    sex: "",
    birthdate: "",
  });
  const [swimmers, setSwimmers] = useState<ClubRecordSwimmer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAccess = role === "coach" || role === "admin";

  // Import logs query
  const { data: importLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["import-logs"],
    queryFn: () => api.getImportLogs({ limit: 20 }),
    enabled: canAccess,
  });

  const load = useCallback(async () => {
    if (!canAccess) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getClubRecordSwimmers();
      setSwimmers(data);
    } catch (err) {
      const summary = summarizeApiError(err, "Impossible de charger la liste.");
      setError(summary.message);
      setSwimmers([]);
    } finally {
      setIsLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    void load();
  }, [load]);

  const createSwimmer = useMutation({
    mutationFn: () =>
      api.createClubRecordSwimmer({
        display_name: newSwimmer.display_name.trim(),
        iuf: newSwimmer.iuf.trim() || null,
        sex: newSwimmer.sex ? (newSwimmer.sex as "M" | "F") : null,
        birthdate: newSwimmer.birthdate || null,
        is_active: true,
      }),
    onSuccess: () => {
      toast({ title: "Nageur ajout\u00e9" });
      setNewSwimmer({ display_name: "", iuf: "", sex: "", birthdate: "" });
      void load();
    },
    onError: () => {
      toast({ title: "Impossible d'ajouter le nageur", variant: "destructive" });
    },
  });

  const updateSwimmer = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      api.updateClubRecordSwimmer(id, payload),
    onSuccess: () => {
      void load();
      toast({ title: "Sauvegard\u00e9" });
    },
    onError: () => {
      toast({ title: "Mise \u00e0 jour impossible", variant: "destructive" });
    },
  });

  const updateUserSwimmer = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Record<string, unknown> }) =>
      api.updateClubRecordSwimmerForUser(userId, payload),
    onSuccess: () => {
      void load();
      toast({ title: "Sauvegard\u00e9" });
    },
    onError: () => {
      toast({ title: "Mise \u00e0 jour impossible", variant: "destructive" });
    },
  });

  const updateSwimmerEntry = (swimmer: ClubRecordSwimmer, payload: Record<string, unknown>) => {
    if (swimmer.source_type === "user" && swimmer.user_id) {
      updateUserSwimmer.mutate({ userId: swimmer.user_id, payload });
      return;
    }
    if (swimmer.id) {
      updateSwimmer.mutate({ id: swimmer.id, payload });
    }
  };

  const importRecords = useMutation({
    mutationFn: () => api.importClubRecords(),
    onSuccess: (summary) => {
      toast({
        title: "Import termin\u00e9",
        description: summary
          ? `Performances import\u00e9es: ${summary.imported ?? 0}. Erreurs: ${summary.errors ?? 0}.`
          : "",
      });
      void load();
      void refetchLogs();
      void queryClient.invalidateQueries({ queryKey: ["club-records"] });
    },
    onError: () => {
      toast({ title: "Import impossible", variant: "destructive" });
      void refetchLogs();
    },
  });

  // Per-swimmer import mutation
  const importSingle = useMutation({
    mutationFn: ({ iuf, name }: { iuf: string; name?: string }) =>
      api.importSingleSwimmer(iuf, name),
    onSuccess: (result, variables) => {
      toast({
        title: `Import de ${variables.name ?? variables.iuf}`,
        description: `${result.total_found} performances trouv\u00e9es, ${result.new_imported} nouvelles import\u00e9es.`,
      });
      void refetchLogs();
    },
    onError: (_err, variables) => {
      toast({
        title: `Erreur import ${variables.name ?? variables.iuf}`,
        variant: "destructive",
      });
      void refetchLogs();
    },
  });

  const sortedSwimmers = useMemo(() => {
    return [...swimmers].sort((a, b) => {
      if (a.source_type !== b.source_type) return a.source_type.localeCompare(b.source_type);
      return a.display_name.localeCompare(b.display_name);
    });
  }, [swimmers]);

  if (!canAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Administration des records</h1>
        <p className="text-sm text-muted-foreground">Acc\u00e8s r\u00e9serv\u00e9 aux coachs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Administration des records</h1>
          <p className="text-sm text-muted-foreground">
            G\u00e9rez les nageurs pris en compte pour les records et lancez l'import FFN.
          </p>
        </div>
        <Button onClick={() => importRecords.mutate()} disabled={importRecords.isPending}>
          {importRecords.isPending ? "Import en cours..." : "Mettre \u00e0 jour les records"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un ancien nageur</CardTitle>
          <CardDescription>Ajoutez un nageur sans compte pour l'import des performances FFN.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <Input
            placeholder="Nom du nageur"
            value={newSwimmer.display_name}
            onChange={(event) => setNewSwimmer((prev) => ({ ...prev, display_name: event.target.value }))}
          />
          <Input
            placeholder="IUF"
            value={newSwimmer.iuf}
            onChange={(event) => setNewSwimmer((prev) => ({ ...prev, iuf: event.target.value }))}
          />
          <Select
            value={newSwimmer.sex}
            onValueChange={(value) => setNewSwimmer((prev) => ({ ...prev, sex: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sexe" />
            </SelectTrigger>
            <SelectContent>
              {SEX_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={newSwimmer.birthdate}
            onChange={(event) => setNewSwimmer((prev) => ({ ...prev, birthdate: event.target.value }))}
          />
          <Button
            onClick={() => createSwimmer.mutate()}
            disabled={!newSwimmer.display_name.trim() || createSwimmer.isPending}
          >
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des nageurs suivis</CardTitle>
          <CardDescription>Mettre \u00e0 jour l'IUF, le sexe ou l'activation pour l'import FFN.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                  <div className="h-4 w-20 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                  <div className="h-4 w-24 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!isLoading && !error && swimmers.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun nageur disponible.</p>
          )}
          {!isLoading && !error && swimmers.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nageur</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>IUF</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Naissance</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSwimmers.map((swimmer) => {
                  const rowKey = swimmer.id ?? `user-${swimmer.user_id ?? "unknown"}`;
                  return (
                  <TableRow key={rowKey}>
                    <TableCell className="font-medium">{swimmer.display_name}</TableCell>
                    <TableCell>
                      <Badge variant={swimmer.source_type === "manual" ? "secondary" : "outline"}>
                        {formatSource(swimmer.source_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        key={`${rowKey}-${swimmer.iuf ?? ""}`}
                        defaultValue={swimmer.iuf ?? ""}
                        onBlur={(event) =>
                          updateSwimmerEntry(swimmer, { iuf: event.target.value.trim() || null })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={swimmer.sex ?? ""}
                        onValueChange={(value) =>
                          updateSwimmerEntry(swimmer, { sex: value || null })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sexe" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEX_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        key={`${rowKey}-${swimmer.birthdate ?? ""}`}
                        defaultValue={swimmer.birthdate ?? ""}
                        onBlur={(event) =>
                          updateSwimmerEntry(swimmer, { birthdate: event.target.value || null })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(swimmer.is_active)}
                        onCheckedChange={(checked) =>
                          updateSwimmerEntry(swimmer, { is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {swimmer.iuf ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={importSingle.isPending}
                          onClick={() =>
                            importSingle.mutate({
                              iuf: swimmer.iuf!,
                              name: swimmer.display_name,
                            })
                          }
                        >
                          Importer
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pas d'IUF</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des imports</CardTitle>
          <CardDescription>Les 20 derniers imports de performances FFN.</CardDescription>
        </CardHeader>
        <CardContent>
          {importLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun import effectu\u00e9.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nageur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Trouv\u00e9es</TableHead>
                  <TableHead>Import\u00e9es</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Erreur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {log.swimmer_name ?? log.swimmer_iuf}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(log.status)}>
                        {statusLabel(log.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.performances_found ?? "-"}</TableCell>
                    <TableCell>{log.performances_imported ?? "-"}</TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(log.started_at)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                      {log.error_message ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
