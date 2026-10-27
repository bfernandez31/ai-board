# Quick Implementation: Infinite scroll sur la colonne SHIP - remplace Load more

**Feature Branch**: `AIB-891-infinite-scroll-sur`
**Created**: 2026-10-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Contexte

La colonne **SHIP** est la seule colonne paginée du board. Elle peut contenir beaucoup de tickets, donc ils arrivent par lots. Aujourd'hui, pour voir les suivants, il faut cliquer sur un bouton **« Load more (N remaining) »** en bas de la colonne. Les autres colonnes (INBOX → VERIFY) ne sont pas paginées et n'ont pas besoin de l'être, parce qu'elles ne contiennent jamais beaucoup de tickets.

## Besoin

Remplacer le bouton « Load more » de la colonne SHIP par un **infinite scroll** : quand l'utilisateur fait défiler la colonne et approche du bas, le lot suivant se charge tout seul, sans clic.

## Comportement attendu

- Le bouton « Load more » disparaît.
- Quand le bas de la liste SHIP devient visible pendant le défilement, le lot suivant se charge automatiquement, un peu avant d'atteindre le tout dernier ticket pour que le défilement reste fluide.
- Pendant le chargement, un indicateur discret (spinner) s'affiche en bas de la colonne.
- Un seul chargement à la fois : pas de requêtes en double ou en parallèle si l'utilisateur défile vite, et pas de tickets en double dans la liste.
- Quand tous les tickets sont chargés, plus aucune requête ne part. Le compteur de l'en-tête (`chargés/total`) continue de refléter l'état réel.
- Si un chargement échoue, l'utilisateur voit une erreur avec une possibilité de réessayer, et on ne boucle pas sur des requêtes en échec.
- Le comportement reste correct avec le polling du board (les tickets déjà chargés ne disparaissent pas au rafraîchissement) et pendant un drag & drop.
- Si le premier lot ne remplit pas la hauteur de la colonne (grand écran), le chargement continue jusqu'à remplir la colonne ou épuiser les tickets.

## Mobile (obligatoire)

- Ça doit marcher au défilement tactile sur mobile (iOS Safari, Chrome Android), dans le scroll interne de la colonne.
- Ça reste compatible avec les boutons flottants de défilement haut/bas de la colonne sur mobile, et avec le défilement horizontal entre colonnes.
- Pas de saut de position ni de saccade quand les nouveaux tickets s'ajoutent.

## Hors périmètre

- Les autres colonnes : pas de pagination à ajouter.
- Le fil d'activité, qui a aussi un « Load more » : pas concerné par ce ticket.

## Critères d'acceptation

- [ ] Plus de bouton « Load more » dans la colonne SHIP.
- [ ] Le défilement jusqu'en bas de SHIP charge automatiquement le lot suivant, sur desktop comme sur mobile.
- [ ] Pas de doublons, pas de requêtes concurrentes, arrêt une fois tout chargé.
- [ ] État de chargement et état d'erreur (avec réessai) visibles.
- [ ] Les tests existants autour du « Load more » SHIP sont mis à jour et couvrent le nouveau comportement.

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
