# Quick Implementation: Health drawer: clickable scan history + visible issue counts

**Feature Branch**: `AIB-758-health-drawer-clickable`
**Created**: 2026-04-29
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Contexte

Dans le drawer d'un module health (Compliance, Security, Tests, etc.), la section "Scan History" liste les scans précédents avec date, range de commits, score, et quelques métriques. Aujourd'hui:

1. Cliquer sur une ligne de l'historique ne fait rien — on ne peut consulter le rapport détaillé que du dernier scan.
2. Le nombre d'issues est affiché en gris neutre quel que soit la valeur, donc une régression (ex: 3 issues sur un scan) ne saute pas aux yeux.
3. Les colonnes "coût $" et "tokens" sont affichées partout à 0/$0.00 et n'apportent rien à l'utilisateur (la télémétrie sera traitée séparément).

## Comportement attendu

### 1. Historique cliquable

- Chaque ligne de l'historique des scans devient cliquable (curseur pointer, état hover/focus visible, accessible au clavier).
- Cliquer sur une ligne affiche le rapport détaillé de ce scan dans la même zone que le rapport courant ("Issues" / recommandations / fixes), à la place du scan actuel.
- Indication visuelle claire de la ligne sélectionnée dans la liste.
- Possibilité de revenir au scan courant (le plus récent), soit via un bouton "Latest" ou en re-cliquant sur la ligne du scan le plus récent.
- Le graphe "Score Trend" reste inchangé (toujours toute la période).
- Les rapports historiques sont déjà persistés en base — il s'agit juste de les rendre consultables dans l'UI.

### 2. Compteur d'issues coloré

Le nombre d'issues affiché à côté de l'icône triangle sur chaque ligne d'historique doit être colorisé selon le seuil:

- **0 issue** → couleur "low" (vert / no-friction) — rassurant
- **1–2 issues** → couleur "med" (jaune / warning)
- **3 issues ou plus** → couleur "high" (rouge / problème)

Réutiliser exactement les couleurs du système de badges unifié existant (variantes `attribute` / `attribute-tc` avec `kind="friction"`, niveaux `low` / `med` / `high`). Pas de nouvelle palette, pas de hex hardcodé.

Cette colorisation s'applique uniquement à la ligne de l'historique. Le rapport détaillé courant garde son rendu actuel.

### 3. Suppression de l'affichage coût / tokens

Retirer de chaque ligne d'historique:
- l'icône + valeur "$0.00" (coût)
- l'icône éclair + valeur "0" (tokens)

Garder: date, range de commits, nombre d'issues (colorisé), durée, score.

La donnée reste persistée en base (pour usage futur), seul l'affichage est retiré du drawer.

## Critères d'acceptation

- [ ] Cliquer sur une ligne historique remplace le rapport courant par celui du scan sélectionné, sans rechargement de page
- [ ] La ligne sélectionnée est visuellement distinguée
- [ ] L'utilisateur peut revenir au scan le plus récent
- [ ] Le compteur d'issues est en vert pour 0, jaune pour 1–2, rouge pour 3+
- [ ] Les couleurs proviennent du système de badges unifié (pas de hex hardcodé)
- [ ] Les colonnes coût et tokens ne sont plus visibles dans la liste
- [ ] Le comportement est identique pour tous les modules health (Compliance, Security, Tests, Spec Sync, Review Quality, etc.)
- [ ] Accessibilité clavier: focus visible, Enter/Space pour activer une ligne

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

Implementation will be done directly by Claude Code based on the description above.
