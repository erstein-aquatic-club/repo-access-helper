import { useMemo, useState } from "react";
import { Mail, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CoachSectionHeader from "./CoachSectionHeader";

type CoachMessagesScreenProps = {
  onBack: () => void;
  athletes: Array<{ id: number | null; display_name: string; email?: string | null; group_id?: number | null; group_label?: string | null }>;
  groups: Array<{ id: number; name: string }>;
  athletesLoading: boolean;
};

const CoachMessagesScreen = ({ onBack, athletes, groups, athletesLoading }: CoachMessagesScreenProps) => {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [targetValue, setTargetValue] = useState("");

  const athleteOptions = useMemo(
    () =>
      athletes
        .filter((a) => a.id && a.email)
        .map((a) => ({
          value: `user:${a.id}`,
          label: a.group_label ? `${a.display_name} · ${a.group_label}` : a.display_name,
          email: a.email!,
        })),
    [athletes],
  );

  const groupOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: `group:${g.id}`,
        label: g.name,
        id: g.id,
      })),
    [groups],
  );

  const resolveEmails = (): string[] => {
    if (!targetValue) return [];
    if (targetValue.startsWith("user:")) {
      const opt = athleteOptions.find((a) => a.value === targetValue);
      return opt ? [opt.email] : [];
    }
    if (targetValue.startsWith("group:")) {
      const groupId = Number(targetValue.split(":")[1]);
      return athletes
        .filter((a) => a.group_id === groupId && a.email)
        .map((a) => a.email!);
    }
    return [];
  };

  const handleOpenMailto = () => {
    const emails = resolveEmails();
    if (!emails.length) {
      toast({ title: "Aucune adresse email", description: "Aucun nageur avec une adresse email dans cette sélection." });
      return;
    }
    const params = new URLSearchParams();
    params.set("bcc", emails.join(","));
    if (subject.trim()) {
      params.set("subject", subject.trim());
    }
    window.location.href = `mailto:?${params.toString()}`;
  };

  const selectedEmails = resolveEmails();

  return (
    <div className="space-y-6 pb-24">
      <CoachSectionHeader
        title="Contacter par email"
        description="Ouvre votre application mail avec les destinataires en CCI."
        onBack={onBack}
      />

      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle>Destinataire</CardTitle>
          <CardDescription>Sélectionnez un nageur ou un groupe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Destinataire</Label>
            <Select value={targetValue} onValueChange={setTargetValue}>
              <SelectTrigger>
                <SelectValue placeholder={athletesLoading ? "Chargement..." : "Choisir un nageur ou un groupe"} />
              </SelectTrigger>
              <SelectContent>
                {groupOptions.length ? (
                  <>
                    <SelectItem value="section-group" disabled>
                      Groupes
                    </SelectItem>
                    {groupOptions.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </>
                ) : null}
                {athleteOptions.length ? (
                  <>
                    <SelectItem value="section-athlete" disabled>
                      Nageurs
                    </SelectItem>
                    {athleteOptions.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          {targetValue && selectedEmails.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {selectedEmails.length} adresse{selectedEmails.length > 1 ? "s" : ""} email
              {selectedEmails.length > 1 ? " (envoi en CCI)" : ""}
            </p>
          ) : null}
          {targetValue && selectedEmails.length === 0 ? (
            <p className="text-xs text-destructive">
              Aucune adresse email disponible pour cette sélection.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objet</CardTitle>
          <CardDescription>Optionnel — pré-rempli dans votre application mail.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Objet du mail…"
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:p-0">
        <Button
          className="w-full sm:w-auto"
          onClick={handleOpenMailto}
          disabled={!targetValue || selectedEmails.length === 0}
        >
          <Mail className="mr-2 h-4 w-4" />
          Ouvrir dans l'app mail
          <ExternalLink className="ml-2 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export default CoachMessagesScreen;
