# Design — Redesign page Progression

**Date** : 2026-02-16
**Auteur** : Claude + Francois
**Fichier cible** : `src/pages/Progress.tsx`

## Contexte

La page Progression actuelle (780 lignes) affiche trop de graphiques empiles, sans hierarchie visuelle ni storytelling. Le nageur (audience principale) ne comprend pas rapidement s'il progresse ou stagne.

## Direction

Style **Apple Health / Fitness** — minimaliste, un chiffre hero par section, espaces genereux, graphiques epures sans grille, sections secondaires repliables.

## Architecture

### Layout global

- Titre "Progression" (`font-display uppercase italic`) + `ToggleGroup` compact pour la periode (7j / 30j / 365j) a droite
- 2 onglets (Natation / Musculation) avec underline style
- `gap-8` entre sections
- Animations `framer-motion` : `fadeIn` + `slideUp` stagger au mount

### Onglet Natation

| # | Section | Composant | Description |
|---|---------|-----------|-------------|
| 1 | Hero KPI | Chiffre `text-4xl font-mono` | Volume total periode + tendance % vs periode precedente (badge colore) |
| 2 | Mini-metrics | 3 pills inline `bg-muted rounded-full` | Nb seances, distance moy, duree moy |
| 3 | Courbe volume | `LineChart` + gradient fill | Pas de grille, axes discrets, dernier dot mis en valeur |
| 4 | Ressentis | 4 barres de progression horizontales | RPE, Performance, Engagement, Fatigue — barre coloree (`scoreToColor`) + valeur `font-mono` |
| 5 | Repartition nages | `Collapsible` ferme | Pie chart + barres empilees par jour |

### Onglet Musculation

| # | Section | Composant | Description |
|---|---------|-----------|-------------|
| 1 | Hero KPI | Chiffre `text-4xl font-mono` | Tonnage total periode + tendance % |
| 2 | Mini-metrics | 3 pills inline | Nb seances, total reps, RPE moyen (pill coloree) |
| 3 | Tonnage & Volume | `ComposedChart` epure | Barres tonnage (primary) + ligne volume (accent) |
| 4 | Ressenti seances | `LineChart` + gradient | Dots colores selon valeur RPE |
| 5 | Top exercices | `Collapsible` ferme | Bar chart horizontal top 8 + tableau 4 colonnes (nom, volume, charge max, derniere seance) |
| 6 | Historique | `Collapsible` ferme | Liste date + RPE + bouton "Charger plus" |

## Style visuel

- **Graphiques** : Pas de `CartesianGrid`, axes legers (`fontSize: 10, tickLine: false, axisLine: false`), gradient fill `<defs><linearGradient>` sous les courbes
- **Barres de progression** : `height: 8px`, `rounded-full`, couleur via `scoreToColor`, fond `bg-muted`
- **Pills** : `bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm font-mono`
- **Tendance** : Badge `rounded-full px-2 py-0.5 text-xs` — vert si positif, rouge si negatif
- **Collapsibles** : Chevron anime, contenu avec `animate-in fade-in`
- **Animations** : `motion.div` avec `variants={slideUp}` stagger 0.05s

## Donnees

- La logique de calcul (processData, aggregation, etc.) reste identique — seul le rendu change
- Ajout : calcul de tendance (% variation vs periode precedente)
- Le `SwimKpiCompactGrid` exportable est remplace par les barres de progression inline

## Hors perimetre

- Pas de nouvelles API / requetes Supabase
- Pas de refactoring de la logique metier
- Pas de nouveaux composants partages (tout reste dans Progress.tsx)
