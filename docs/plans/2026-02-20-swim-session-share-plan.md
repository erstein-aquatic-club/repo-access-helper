# Swim Session Share — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettre aux coachs et nageurs de partager une séance natation via un lien public (token UUID), accessible sans compte, avec un CTA d'inscription en bandeau fixe.

**Architecture:** Ajout d'un `share_token UUID` à `swim_sessions_catalog`, nouvelles policies RLS anon pour autoriser le SELECT public par token, route publique `/#/s/:token` rendant `SwimSessionTimeline` sans authentification, boutons de partage dans SwimCatalog et SwimSessionView.

**Tech Stack:** React 19, TypeScript, Supabase (migration SQL, RLS), Tailwind CSS v4, Wouter hash routing

**Design doc :** `docs/plans/2026-02-20-swim-session-share-design.md`

---

## Task 1 : Migration Supabase — share_token + RLS anon

**Files:**
- Create: `supabase/migrations/00025_swim_share_token.sql`

**Step 1: Écrire la migration**

```sql
-- Add share_token to swim_sessions_catalog
ALTER TABLE swim_sessions_catalog
  ADD COLUMN share_token UUID DEFAULT NULL;

-- Unique partial index (only non-null tokens)
CREATE UNIQUE INDEX idx_swim_catalog_share_token
  ON swim_sessions_catalog (share_token) WHERE share_token IS NOT NULL;

-- Anon can SELECT shared sessions (by token)
CREATE POLICY swim_catalog_anon_shared ON swim_sessions_catalog
  FOR SELECT TO anon
  USING (share_token IS NOT NULL);

-- Anon can SELECT items of shared sessions
CREATE POLICY swim_items_anon_shared ON swim_session_items
  FOR SELECT TO anon
  USING (catalog_id IN (
    SELECT id FROM swim_sessions_catalog WHERE share_token IS NOT NULL
  ));
```

**Step 2: Appliquer la migration via Supabase MCP**

Utiliser `apply_migration` avec le SQL ci-dessus sur le projet Supabase.

**Step 3: Vérifier**

Run: `npx tsc --noEmit`
Expected: 0 erreur (pas de changement TS)

**Step 4: Commit**

```bash
git add supabase/migrations/00025_swim_share_token.sql
git commit -m "feat(db): add share_token column and anon RLS for swim sessions"
```

---

## Task 2 : API — generateShareToken + getSharedSession

**Files:**
- Modify: `src/lib/api/swim.ts` (ajouter 2 fonctions)
- Modify: `src/lib/api/index.ts` (re-export)
- Modify: `src/lib/api.ts` (ajouter à l'objet `api`)

**Step 1: Ajouter les fonctions dans `src/lib/api/swim.ts`**

À la fin du fichier, ajouter :

```typescript
/**
 * Generate (or retrieve existing) share token for a swim session.
 * Returns the UUID token string.
 */
export async function generateShareToken(catalogId: number): Promise<string> {
  if (!canUseSupabase()) throw new Error("Supabase required for sharing");

  // Check if token already exists
  const { data: existing, error: fetchError } = await supabase
    .from("swim_sessions_catalog")
    .select("share_token")
    .eq("id", catalogId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (existing?.share_token) return existing.share_token as string;

  // Generate new token via SQL gen_random_uuid()
  const { data, error } = await supabase.rpc("generate_swim_share_token", {
    p_catalog_id: catalogId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Fetch a shared swim session by its public token.
 * Works without authentication (uses anon key).
 */
export async function getSharedSession(
  token: string,
): Promise<{ name: string; description: string | null; items: SwimSessionItem[] } | null> {
  // Use supabase directly (anon key, no auth needed)
  const { data, error } = await supabase
    .from("swim_sessions_catalog")
    .select("name, description, swim_session_items(*)")
    .eq("share_token", token)
    .single();
  if (error || !data) return null;

  const items: SwimSessionItem[] = Array.isArray((data as any).swim_session_items)
    ? (data as any).swim_session_items
        .sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0))
        .map((item: any, index: number) => ({
          id: safeOptionalInt(item.id) ?? undefined,
          catalog_id: safeOptionalInt(item.catalog_id) ?? undefined,
          ordre: safeOptionalInt(item.ordre) ?? index,
          label: item.label ?? null,
          distance: safeOptionalInt(item.distance) ?? null,
          duration: safeOptionalInt(item.duration) ?? null,
          intensity: item.intensity ?? null,
          notes: item.notes ?? null,
          raw_payload: parseRawPayload(item.raw_payload),
        }))
    : [];

  return {
    name: String(data.name || ""),
    description: (data as any).description ?? null,
    items,
  };
}
```

**Step 2: Ajouter la RPC Supabase `generate_swim_share_token`**

Ajouter dans la migration (Task 1) ou créer une migration supplémentaire :

```sql
CREATE OR REPLACE FUNCTION generate_swim_share_token(p_catalog_id INTEGER)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token UUID;
BEGIN
  v_token := gen_random_uuid();
  UPDATE swim_sessions_catalog
    SET share_token = v_token
    WHERE id = p_catalog_id AND share_token IS NULL;
  -- If already had a token (race condition), return existing
  SELECT share_token INTO v_token
    FROM swim_sessions_catalog
    WHERE id = p_catalog_id;
  RETURN v_token;
END;
$$;
```

**Step 3: Re-exporter dans `src/lib/api/index.ts`**

Ajouter `generateShareToken` et `getSharedSession` au bloc d'export swim :

```typescript
export {
  getSwimCatalog,
  createSwimSession,
  deleteSwimSession,
  archiveSwimSession,
  moveSwimSession,
  migrateLocalStorageArchive,
  generateShareToken,
  getSharedSession,
} from './swim';
```

**Step 4: Ajouter à l'objet `api` dans `src/lib/api.ts`**

Chercher la section swim dans l'objet `api` et ajouter :

```typescript
generateShareToken: swim.generateShareToken,
getSharedSession: swim.getSharedSession,
```

**Step 5: Vérifier**

Run: `npx tsc --noEmit`
Expected: 0 erreur

**Step 6: Commit**

```bash
git add src/lib/api/swim.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat(api): add generateShareToken and getSharedSession functions"
```

---

## Task 3 : Composant SharedSwimSession

**Files:**
- Create: `src/pages/SharedSwimSession.tsx`

**Step 1: Créer le composant**

```tsx
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { SwimSessionTimeline } from "@/components/swim/SwimSessionTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Waves } from "lucide-react";
import { getSharedSession } from "@/lib/api/swim";
import type { SwimSessionItem } from "@/lib/api";

interface SharedSessionData {
  name: string;
  description: string | null;
  items: SwimSessionItem[];
}

export default function SharedSwimSession() {
  const [location] = useLocation();
  const [data, setData] = useState<SharedSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Extract token from route: /s/:token
  const token = location.split("/s/")[1]?.split("?")[0] ?? "";

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getSharedSession(token).then((result) => {
      if (cancelled) return;
      if (result) {
        setData(result);
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 pt-8">
        <div className="mx-auto max-w-lg space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h1 className="font-display text-xl font-bold uppercase">Séance introuvable</h1>
        <p className="text-sm text-muted-foreground">
          Ce lien de partage n'existe pas ou a été désactivé.
        </p>
        <Button onClick={() => window.location.hash = "#/"}>
          Accueil
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Waves className="h-4 w-4" />
            Séance partagée
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-tight">
            {data.name}
          </h1>
          {data.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
          ) : null}
        </div>
      </div>

      {/* Timeline */}
      <div className="mx-auto max-w-lg px-4 pt-4">
        <SwimSessionTimeline
          title={data.name}
          description={data.description ?? undefined}
          items={data.items}
          showHeader={true}
        />
      </div>

      {/* Fixed CTA banner */}
      <div className="fixed inset-x-0 bottom-0 z-[var(--z-index-bar)] border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Rejoins l'EAC</p>
            <p className="truncate text-xs text-muted-foreground">
              Crée ton compte pour accéder à toutes tes séances
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => window.location.hash = "#/"}
            className="shrink-0"
          >
            S'inscrire
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Vérifier**

Run: `npx tsc --noEmit`
Expected: 0 erreur

**Step 3: Commit**

```bash
git add src/pages/SharedSwimSession.tsx
git commit -m "feat: add SharedSwimSession public page with CTA banner"
```

---

## Task 4 : Route publique dans App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Ajouter le lazy import**

Après la ligne `const SwimSessionView = lazyWithRetry(...)` (ligne ~59), ajouter :

```typescript
const SharedSwimSession = lazyWithRetry(() => import("@/pages/SharedSwimSession"));
```

**Step 2: Ajouter la route dans le bloc non-authentifié**

Dans `AppRouter`, dans le bloc `if (!user)`, ajouter la route AVANT le catch-all :

```tsx
<Route path="/s/:token" component={SharedSwimSession} />
```

Le bloc devient :
```tsx
if (!user) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Switch>
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/login-debug" component={LoginDebug} />
          <Route path="/s/:token" component={SharedSwimSession} />
          <Route path="/" component={Login} />
          <Route path="/:rest*" component={() => <Redirect to="/" />} />
        </Switch>
      </Suspense>
    </ErrorBoundary>
  );
}
```

**Step 3: Ajouter la route dans le bloc authentifié**

Dans le `<Switch>` principal (bloc authentifié), ajouter aussi :

```tsx
<Route path="/s/:token" component={SharedSwimSession} />
```

Juste après la route `/swim-session` (ligne ~246).

**Step 4: Vérifier**

Run: `npx tsc --noEmit`
Expected: 0 erreur

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add public route /#/s/:token for shared swim sessions"
```

---

## Task 5 : Bouton partage dans SwimCatalog (coach)

**Files:**
- Modify: `src/pages/coach/SwimCatalog.tsx`

**Step 1: Ajouter l'import**

Ajouter `Share2` à l'import lucide-react existant.
Ajouter l'import API : `import { generateShareToken } from "@/lib/api/swim";`

**Step 2: Ajouter la fonction de partage**

Dans le composant, ajouter une fonction helper :

```typescript
const handleShare = async (session: SwimSessionTemplate) => {
  try {
    const token = await generateShareToken(session.id);
    const url = `${window.location.origin}${window.location.pathname}#/s/${token}`;
    if (navigator.share) {
      await navigator.share({ title: session.name, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Lien copié !", description: "Le lien de partage a été copié dans le presse-papier." });
    }
  } catch (err) {
    toast({ title: "Erreur", description: "Impossible de générer le lien de partage.", variant: "destructive" });
  }
};
```

**Step 3: Ajouter le bouton dans le dialog preview**

Dans le `<DialogContent className="max-w-4xl">` (vers la ligne 673), ajouter un bouton partage au-dessus du `SwimSessionTimeline` :

```tsx
<DialogContent className="max-w-4xl">
  <div className="flex items-center justify-between pb-2">
    <DialogTitle className="text-lg font-display font-bold uppercase">
      {selectedSession?.name}
    </DialogTitle>
    <Button
      variant="outline"
      size="sm"
      onClick={() => selectedSession && handleShare(selectedSession)}
      className="gap-1.5"
    >
      <Share2 className="h-4 w-4" />
      Partager
    </Button>
  </div>
  <SwimSessionTimeline
    title={selectedSession?.name ?? ""}
    description={selectedSession?.description ?? undefined}
    items={selectedSession?.items}
  />
</DialogContent>
```

**Step 4: Vérifier**

Run: `npx tsc --noEmit`
Expected: 0 erreur

**Step 5: Commit**

```bash
git add src/pages/coach/SwimCatalog.tsx
git commit -m "feat(swim-catalog): add share button in session preview dialog"
```

---

## Task 6 : Bouton partage dans SwimSessionView (nageur)

**Files:**
- Modify: `src/pages/SwimSessionView.tsx`

**Step 1: Ajouter les imports**

Ajouter `Share2` à l'import lucide-react.
Ajouter : `import { generateShareToken } from "@/lib/api/swim";`

**Step 2: Ajouter la fonction de partage**

Le nageur voit une assignment qui a un `session_id` correspondant au `swim_catalog_id`. Ajouter :

```typescript
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
```

**Step 3: Ajouter le bouton dans le header**

Dans le `<div className="flex flex-wrap items-center justify-between gap-3">` (ligne ~93), à côté du badge statut, ajouter :

```tsx
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
```

**Step 4: Vérifier**

Run: `npx tsc --noEmit`
Expected: 0 erreur

**Step 5: Commit**

```bash
git add src/pages/SwimSessionView.tsx
git commit -m "feat(swim-session-view): add share button for swimmers"
```

---

## Task 7 : Documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `CLAUDE.md`

**Step 1: Ajouter l'entrée §57 dans `docs/implementation-log.md`**

Ajouter une nouvelle entrée suivant le format standard (contexte, changements, fichiers, tests, décisions, limites).

**Step 2: Mettre à jour `docs/ROADMAP.md`**

- Incrémenter la date de dernière mise à jour
- Ajouter la ligne `| 25 | Partage public séances natation (token UUID) | Moyenne | Moyenne | Fait (§57) |` au tableau

**Step 3: Mettre à jour `docs/FEATURES_STATUS.md`**

- Incrémenter la date de dernière mise à jour
- Ajouter une ligne dans la section Natation — Nageur :
  `| Partage séance (lien public) | ✅ | SharedSwimSession.tsx, swim.ts | Token UUID, route /#/s/:token, CTA inscription (§57) |`

**Step 4: Mettre à jour `CLAUDE.md`**

- Ajouter `| 25 | Partage public séances natation | Moyenne | Fait (§57) |` au tableau des chantiers

**Step 5: Commit**

```bash
git add docs/implementation-log.md docs/ROADMAP.md docs/FEATURES_STATUS.md CLAUDE.md
git commit -m "docs: add §57 swim session share to all tracking files"
```
