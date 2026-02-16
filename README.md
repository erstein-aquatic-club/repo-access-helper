# Suivi Natation V2

Application web de suivi des séances de natation et de musculation pour l'Erstein Aquatic Club.

## Stack technique

| Catégorie | Technologies |
|-----------|-------------|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS 4 |
| **UI** | Radix UI + Shadcn (55 composants) |
| **State** | Zustand 5, React Query 5 |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions) |
| **Déploiement** | GitHub Pages (frontend), Supabase Cloud (backend) |

## Fonctionnalités

### 🔐 Authentification & Rôles
- Multi-rôles : nageur, coach, comité, admin
- Connexion sécurisée avec Supabase Auth
- Navigation dynamique selon le rôle

### 🏊 Natation

| Côté | Fonctionnalités |
|------|-----------------|
| **Coach** | Création/édition de séances, catalogue, assignation aux nageurs |
| **Nageur** | Consultation, exécution, saisie ressenti, historique, progression |

### 🏋️ Musculation

| Côté | Fonctionnalités |
|------|-----------------|
| **Coach** | Builder séances, catalogue exercices par cycle, assignation |
| **Nageur** | Lancement séance, mode focus mobile, saisie charge/reps, historique, 1RM |

### 💬 Messagerie
- Fils de discussion (threads)
- Indicateurs lu/non-lu
- Envoi coach → nageur/groupe

### 🕒 Pointage des heures (Comité)
- Shifts avec heures d'arrivée/sortie
- Lieu de travail, temps de trajet
- Dashboards totaux semaine/mois

### 📱 PWA
- Application installable
- Safe-areas mobile
- Réactivité sans refresh

## État des fonctionnalités

| Module | Statut | Notes |
|--------|--------|-------|
| Auth Supabase | ✅ OK | Login, rôles, refresh JWT |
| Inscription | ⚠️ Partiel | Formulaire OK, UX post-inscription à refaire |
| Natation nageur | ✅ OK | Dashboard, ressenti, progression |
| Natation coach | ✅ OK | Catalogue, assignation |
| Musculation nageur | ✅ OK | WorkoutRunner, historique, 1RM |
| Musculation coach | ✅ OK | Builder activé (`coachStrength: true`) |
| Messagerie | ✅ OK | Threads, individuel/groupe |
| Pointage heures | ✅ OK | Shifts, dashboard, vue comité |
| Records perso FFN | ✅ OK | Sync via Edge Function |
| Records club | ✅ OK | Table + classements, nécessite déploiement Edge Functions |
| Hall of Fame | ✅ OK | Top 5 nage + muscu |
| Admin | ✅ OK | Gestion utilisateurs, rôles |

Détail complet : [`docs/FEATURES_STATUS.md`](docs/FEATURES_STATUS.md)

## Structure du projet

```
competition/
├── src/
│   ├── pages/           # Pages React (19 pages)
│   ├── components/      # Composants UI et métier
│   ├── lib/
│   │   ├── api.ts       # Client API Supabase (~2200 lignes)
│   │   ├── api/         # Modules API extraits
│   │   │   ├── types.ts        # Interfaces TypeScript
│   │   │   ├── client.ts       # Supabase client, utilitaires
│   │   │   ├── transformers.ts # Transformations données strength
│   │   │   ├── helpers.ts      # Fonctions de mapping
│   │   │   ├── localStorage.ts # Stockage local fallback
│   │   │   └── index.ts        # Re-exports centralisés
│   │   ├── auth.ts      # Gestion authentification
│   │   ├── supabase.ts  # Client Supabase
│   │   └── features.ts  # Feature flags
│   └── hooks/           # Hooks React personnalisés
├── supabase/
│   ├── migrations/      # Migrations PostgreSQL
│   └── functions/       # Edge Functions (ffn-sync, admin-user, ffn-performances, import-club-records)
├── docs/                # Documentation
└── public/              # Assets statiques
```

## Démarrage local

### Prérequis
- Node.js 18+
- npm
- Compte Supabase (optionnel pour dev local)

### Installation

```bash
npm install
```

### Configuration

Créer un fichier `.env` à la racine :

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Développement

```bash
npm run dev
```

L'application est servie sur `http://localhost:8080`.

### Build production

```bash
npm run build
```

## Déploiement

### GitHub Pages

> **IMPORTANT : Ne JAMAIS déployer localement avec `npx gh-pages -d dist`.**
> Le build local n'a pas les credentials Supabase → l'app affiche "Supabase not configured".

Le déploiement se fait exclusivement via **GitHub Actions** :

1. Configurer les secrets dans GitHub :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

2. Le workflow `.github/workflows/pages.yml` déploie automatiquement sur push vers `main`

3. Déploiement manuel : `gh workflow run "Deploy to GitHub Pages"`

### Edge Functions Supabase

```bash
# Installation CLI
npm install -g supabase

# Connexion
supabase login

# Lier le projet
supabase link --project-ref <project-id>

# Déployer TOUTES les fonctions
supabase functions deploy ffn-sync
supabase functions deploy admin-user
supabase functions deploy ffn-performances
supabase functions deploy import-club-records

# Configurer les secrets
supabase secrets set SERVICE_ROLE_KEY=<service-role-key>
```

> **Important** : Les Edge Functions ne sont PAS déployées automatiquement par GitHub Actions.
> Après chaque modification dans `supabase/functions/`, redéployer manuellement la fonction modifiée.

## Documentation additionnelle

| Document | Description |
|----------|-------------|
| `docs/FEATURES_STATUS.md` | Matrice détaillée des fonctionnalités |
| `docs/ROADMAP.md` | Plan de développement futur (chantiers à implémenter) |
| `docs/audit-projet-complet.md` | Audit qualité code (score B+) |
| `docs/implementation-log.md` | Journal des implémentations |
| `docs/patch-report.md` | Rapport d'audit UI/UX (items restants) |
| `docs/roadmap-data-contract.md` | Contrats de données (legacy, réf. Cloudflare) |

## Roadmap

### Fait
- [x] Refonte du parcours d'inscription (approbation admin)
- [x] Import de toutes les performances FFN d'un nageur (historique complet)
- [x] Edge Function `import-club-records` + recalcul automatique
- [x] Gestion coach des imports de performances (+ rate limiting)
- [x] Records club avec classements par épreuve/âge
- [x] Dette UI/UX (API refactoring, tokens CSS, skeletons, reset mot de passe)

### En cours
- [ ] Déployer les Edge Functions `ffn-performances` et `import-club-records` sur Supabase Cloud

Détail complet : [`docs/ROADMAP.md`](docs/ROADMAP.md)

## Contribuer

1. Créer une branche depuis `main`
2. Implémenter les changements
3. Vérifier : `npm run build`
4. Créer une PR vers `main`

---

*Dernière mise à jour : 2026-02-07*
