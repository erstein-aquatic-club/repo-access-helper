# Design — Swim Session Timeline Visualization

**Date** : 2026-02-19
**Statut** : Validé
**Contexte** : Refonte de l'affichage des séances natation (nageur + coach consultation)

## Problème

L'affichage actuel (SwimSessionConsultation) souffre de :
- Surcharge de badges/pilules (intensité, nage, repos, matériel)
- Absence de hiérarchie visuelle — tout se ressemble
- Mauvaise adaptation mobile — scroll interminable, texte trop petit
- Difficulté de mémorisation — pas de "signature visuelle" de la séance

## Contraintes

- **Double contexte** : mémorisation avant entraînement + consultation au bord du bassin
- **Public mixte** : ados visuels (13-17 ans) + adultes techniques
- **Matériel** : icônes prominentes (les nageurs doivent savoir quoi sortir du sac)
- **Métriques** : distance totale en haut suffit, pas de graphique de répartition d'intensité

## Design retenu : Timeline verticale colorée

### 1. Header de séance

Résumé compact en haut (sticky au scroll) :
- Distance totale en gros (chiffre principal)
- Durée estimée + nombre de blocs en secondaire
- Pas de barre d'intensité, pas de titre (déjà dans le contexte de navigation)

### 2. Rail vertical coloré

- Ligne de 4px à gauche de chaque bloc
- Couleur = intensité dominante du bloc :
  - V0 → bleu ciel (intensity-1)
  - V1 → vert (intensity-2)
  - V2 → ambre (intensity-3)
  - V3 → orange (intensity-4)
  - Max → rouge (intensity-5)
  - Prog → dégradé
- Point `●` marque le début de chaque bloc
- Crée un "profil thermique" visible au scroll rapide

### 3. En-tête de bloc

Une seule ligne :
- Titre en majuscules semi-bold (ÉCHAUFFEMENT, TECHNIQUE...)
- Badge ×2 si répétitions
- Distance du bloc alignée à droite, gras

### 4. Exercices — 1 ligne par exercice

Format : `[reps×]distance  nage  [type]  [intensité]  [repos]`
- Distance en semi-bold (priorité visuelle)
- Nage en badge compact coloré (Cr, Do, Br, Pa, 4N, Spé)
- Type (Éduc/Jambes) en badge arrondi si applicable
- Intensité en couleur de texte (pas de badge)
- Repos/départ en texte gris aligné à droite : `d:1'30` ou `r:30"`

### 5. Matériel — icônes SVG

Ligne dédiée sous chaque exercice (si matériel) :
- Icônes SVG dans cercles gris (bg-muted, 28×28px, icône 16px)
- Labels 3 lettres sous l'icône : PAL, PUL, PLQ, TUB, ELA
- Matériel au niveau bloc → affiché dans l'en-tête

### 6. Expand/collapse

- Par défaut tous les blocs ouverts (mode mémorisation)
- Tap sur l'en-tête → collapse le bloc
- Collapsed = juste `● TITRE  800m` sur une ligne
- Animation slide smooth

### 7. Interactions

- Tap exercice → affiche modalities/description en slide-down
- Header de séance sticky en haut au scroll
- Mode "Bord du bassin" : toggle ultra-compact (gros texte, blocs collapsés sauf courant)

### 8. Palette nages

| Nage | Label | Fond/Texte |
|------|-------|------------|
| Crawl | Cr | sky-100/sky-800 |
| Dos | Do | violet-100/violet-800 |
| Brasse | Br | emerald-100/emerald-800 |
| Papillon | Pa | amber-100/amber-800 |
| 4 Nages | 4N | multi/gradient |
| Spécialité | Spé | slate-100/slate-800 |

### 9. Scope

Composant `SwimSessionTimeline` remplaçant `SwimSessionConsultation` dans :
- Dashboard nageur (preview de séance)
- SwimCatalog coach (preview de séance)
- Partout où une séance est affichée en consultation

## Décisions

- Pas de barre de répartition d'intensité dans le header (le rail vertical donne déjà l'info)
- SVG custom pour le matériel (pas d'emojis — rendu cross-platform)
- Les modalities sont masquées par défaut, visibles au tap sur l'exercice
- Le mode "bord du bassin" est un toggle optionnel, pas le défaut
