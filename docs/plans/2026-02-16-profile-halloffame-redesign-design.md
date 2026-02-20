# Design — Redesign Profil + Hall of Fame (Mobile First)

**Date** : 2026-02-16
**Scope** : `src/pages/Profile.tsx`, `src/pages/HallOfFame.tsx`, `src/pages/hallOfFame/`
**Direction** : Sportif bold, cohérent avec le dashboard coach redesigné

---

## 1. Vue Profil

### 1.1 Hero Banner

- Fond `bg-accent` (noir) avec texte `accent-foreground` (blanc)
- Avatar 80px avec `ring-2 ring-primary` (EAC Red)
- Nom : `font-display text-2xl uppercase italic`
- Sous-titre : rôle (badge pill) + groupe
- IUF FFN affiché si présent (nageur uniquement)
- Bouton edit (icône crayon) en top-right, ouvre un **Sheet** Shadcn (side="bottom" mobile, side="right" desktop)

### 1.2 Section Infos (lecture seule)

- Card standard, grid 2 colonnes
- Labels : `text-xs uppercase text-muted-foreground tracking-wider`
- Valeurs : `font-medium`
- Champs : Groupe, Date de naissance, Objectifs (col-span-2), Bio (col-span-2)

### 1.3 Section FFN Sync (nageurs uniquement)

- Card compacte avec IUF affiché, bouton sync, lien vers records
- Fusionner la card FFN et le lien records actuels en une seule card

### 1.4 Section Sécurité (Collapsible)

- Utilise `Collapsible` de Shadcn, fermé par défaut
- Label "Sécurité" avec chevron
- Contenu : formulaire changement mot de passe (identique à l'actuel)

### 1.5 Déconnexion

- Bouton `variant="ghost"` discret en bas de page, après le Collapsible

### 1.6 Sheet d'édition

- `Sheet` Shadcn, responsive (bottom mobile, right desktop)
- Formulaire identique à l'actuel (groupe, IUF, objectifs, bio, avatar URL, date naissance)
- Boutons Save/Cancel en footer du Sheet

---

## 2. Vue Hall of Fame

### 2.1 Header + Tabs

- Inchangés : titre Oswald uppercase, bouton "Records du club", tabs Bassin/Muscu
- Animations slide-in conservées

### 2.2 Composant Podium

Nouveau composant `<Podium>` réutilisable pour chaque catégorie :

**Props :**
```ts
type PodiumEntry = {
  name: string;
  value: string;       // formatted display value
  toneScore: number | null;
};

type PodiumProps = {
  entries: PodiumEntry[];  // top 3 (or less)
};
```

**Layout (flexbox) :**
- 3 colonnes en `flex items-end justify-center gap-2`
- Colonne 1 (gauche) = #2 : hauteur socle ~80px
- Colonne 2 (centre) = #1 : hauteur socle ~110px, légèrement plus large
- Colonne 3 (droite) = #3 : hauteur socle ~60px

**Visuels :**
- #1 : Crown icon, `bg-rank-gold/10`, `border-rank-gold`, avatar 48px
- #2 : Medal icon, `bg-rank-silver/10`, `border-rank-silver`, avatar 40px
- #3 : Medal icon, `bg-rank-bronze/10`, `border-rank-bronze`, avatar 40px
- Socle (base du podium) : `rounded-t-xl` avec gradient rank-color → muted
- Nom : `font-bold uppercase tracking-tight text-sm`
- Valeur : composant `HallOfFameValue` existant

**Animation :**
- Staggered entrance : colonne #2 → #1 → #3
- Utilise `staggerChildren` + `listItem` existants ou variants custom avec spring bounce

**Cas limites :**
- 2 entrées : podium 2 colonnes (#1 centre, #2 côté)
- 1 entrée : champion solo centré
- 0 entrées : message "Aucune donnée"

### 2.3 Rangs 4-5

- Sous le podium, lignes compactes `bg-muted/30 rounded-lg p-3`
- Format identique à l'actuel : rang + nom + badge valeur

### 2.4 Layout responsive

- Mobile (< md) : 1 colonne, catégories empilées
- Tablette+ (>= md) : grid 2 colonnes (comme actuel)
- Chaque catégorie = Card avec `border-t-4 border-t-{color} shadow-md`

---

## 3. Composants existants réutilisés

- `HallOfFameValue` : badge KPI coloré (inchangé)
- `Avatar` / `AvatarFallback` : pour le profil hero
- `Sheet` : Shadcn, pour l'édition profil
- `Collapsible` : Shadcn, pour la section sécurité
- `Tabs` / `TabsContent` : inchangés pour HoF
- Animations `fadeIn`, `staggerChildren`, `listItem` : réutilisées

## 4. Nouveaux composants

- `<Podium>` : composant réutilisable dans `src/pages/hallOfFame/Podium.tsx`
- `<ProfileHero>` : section hero extraite dans `src/pages/profile/ProfileHero.tsx` (optionnel, peut rester inline)

## 5. Pas dans le scope

- RecordsClub : reste inchangé
- Logique métier / API : aucun changement
- Dark mode : les tokens existants gèrent déjà le dark mode via CSS variables
