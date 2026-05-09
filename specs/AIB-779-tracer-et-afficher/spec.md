# Quick Implementation: Tracer et afficher la version du plugin et de l'agent sur chaque job 4.6

**Feature Branch**: `AIB-779-tracer-et-afficher`
**Created**: 2026-05-09
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Besoin

Aujourd'hui, chaque job enregistre le modèle utilisé (claude-opus-4-7, etc.) mais on ne sait pas :

- quelle version du plugin AI-Board (commandes, skills, prompts) était active au moment du run
- quelle version de l'agent CLI (claude-code, codex, gemini-cli, mistral-vibe) a tourné

Sans ces deux informations, on ne peut pas comparer deux runs entre eux ni établir le lien entre un comportement observé et la combinaison plugin/agent en place. Quand un ticket part en friction, on ne sait pas si c'est lié à une mise à jour récente du plugin, à un bump du CLI agent, ou à autre chose. Toutes les futures features qui comparent des runs (benchmark de régression, A/B, replay, counterfactuel) reposent sur cette traçabilité.

Ces informations doivent être visibles dans l'interface pour qu'on puisse les consulter sans aller en base. Le bon endroit, c'est le panneau de détail d'un job au sein d'un ticket : c'est là où on lit déjà les métriques d'exécution (tokens, durée, coût, modèle, contexte par turn). La version du plugin et la version de l'agent sont de la même nature — du metadata d'exécution qu'on consulte quand on inspecte ce qui s'est passé.

## Valeur

Pour chaque job exécuté :

- retrouver la version exacte du plugin utilisée
- retrouver la version exacte de l'agent CLI utilisée
- consulter ces deux infos directement dans le détail du job, à côté des autres métriques d'exécution

## Critères d'acceptation

- Tout job lancé après cette feature contient en base la version du plugin et la version de l'agent CLI utilisé.
- Les jobs antérieurs à cette feature peuvent rester sans cette donnée (pas de backfill nécessaire).
- Les 4 agents supportés (Claude, Codex, Gemini, Mistral) sont tous couverts.
- Si la capture échoue (cas technique rare), le job continue normalement, juste sans cette donnée.
- Sur la vue détail d'un job, la version du plugin et la version de l'agent apparaissent dans la même zone que les autres infos d'exécution.
- Si la donnée est absente (jobs antérieurs ou capture échouée), un placeholder discret s'affiche plutôt qu'un champ vide ou une erreur.
- L'affichage reste compact, dans le style des autres badges/labels d'exécution.

## Hors périmètre

- Détection automatique de bump nécessaire sur les PRs qui modifient le plugin.
- Utilisation de ces versions dans des analyses comparatives (benchmark, A/B, replay, counterfactuel).
- Page dédiée listant les versions du plugin avec leur changelog.
- Filtrage / recherche de jobs par version.
- Comparaison côte à côte de deux jobs avec leurs versions respectives.

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
