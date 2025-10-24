# Quick Implementation: Rework detail ticket
Refactoriser l'affichage des dates dans le ticket detail modal pour gagner de l'espace et ajouter l'ID du ticket :

  1. Ajouter l'ID du ticket : Afficher #<ticketId> à gauche du titre dans le DialogHeader (avant le titre, style text-sm font-mono text-muted-foreground)
  2. Déplacer les dates en footer sticky (uniquement dans tab Details) :
    - Supprimer la section dates actuelles (lignes 1022-1039 de ticket-detail-modal.tsx)
    - Créer un footer compact APRÈS le TabsContent du tab Details (mais DANS le TabsContent)
    - Footer layout : Une seule ligne avec séparateurs · : #46 · 📅 Created 4h ago · ✏️ Updated 2h ago
    - Utiliser formatDistanceToNow de date-fns pour les dates relatives (ex: "4 hours ago")
    - Styling footer : border-t border-border mt-4 pt-3 text-xs text-muted-foreground
    - Desktop : Footer sticky visible en scroll (position sticky bottom-0 dans TabsContent)
    - Mobile : Footer non-sticky (comportement normal)
  3. Corriger le scroll :
    - Le scroll doit être UNIQUEMENT sur la description, PAS sur tout le TabsContent
    - Structure : TabsContent avec flex column → Description scrollable → Footer fixe en bas
  4. Mettre à jour les tests E2E :
    - Fichier : tests/e2e/tickets/detail-modal.spec.ts
    - Corriger les tests qui vérifient la présence des dates (actuellement lignes 1022-1039 n'existeront plus)
    - Ajouter test pour vérifier que l'ID du ticket s'affiche dans le header
    - Ajouter test pour vérifier le footer avec dates relatives

  Contraintes :
  - Utiliser date-fns/formatDistanceToNow pour les dates relatives
  - Le footer doit rester visible lors du scroll de la description (desktop seulement)
  - Mobile : pas de sticky footer, comportement normal

**Feature Branch**: `049-rework-detail-ticket`
**Created**: 2025-10-24
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Rework detail ticket
Refactoriser l'affichage des dates dans le ticket detail modal pour gagner de l'espace et ajouter l'ID du ticket :

  1. Ajouter l'ID du ticket : Afficher #<ticketId> à gauche du titre dans le DialogHeader (avant le titre, style text-sm font-mono text-muted-foreground)
  2. Déplacer les dates en footer sticky (uniquement dans tab Details) :
    - Supprimer la section dates actuelles (lignes 1022-1039 de ticket-detail-modal.tsx)
    - Créer un footer compact APRÈS le TabsContent du tab Details (mais DANS le TabsContent)
    - Footer layout : Une seule ligne avec séparateurs · : #46 · 📅 Created 4h ago · ✏️ Updated 2h ago
    - Utiliser formatDistanceToNow de date-fns pour les dates relatives (ex: "4 hours ago")
    - Styling footer : border-t border-border mt-4 pt-3 text-xs text-muted-foreground
    - Desktop : Footer sticky visible en scroll (position sticky bottom-0 dans TabsContent)
    - Mobile : Footer non-sticky (comportement normal)
  3. Corriger le scroll :
    - Le scroll doit être UNIQUEMENT sur la description, PAS sur tout le TabsContent
    - Structure : TabsContent avec flex column → Description scrollable → Footer fixe en bas
  4. Mettre à jour les tests E2E :
    - Fichier : tests/e2e/tickets/detail-modal.spec.ts
    - Corriger les tests qui vérifient la présence des dates (actuellement lignes 1022-1039 n'existeront plus)
    - Ajouter test pour vérifier que l'ID du ticket s'affiche dans le header
    - Ajouter test pour vérifier le footer avec dates relatives

  Contraintes :
  - Utiliser date-fns/formatDistanceToNow pour les dates relatives
  - Le footer doit rester visible lors du scroll de la description (desktop seulement)
  - Mobile : pas de sticky footer, comportement normal

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
