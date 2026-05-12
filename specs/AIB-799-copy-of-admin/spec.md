# Quick Implementation: Copy of Admin shell and access entry in user menu

**Feature Branch**: `AIB-799-copy-of-admin`
**Created**: 2026-05-12
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Contexte

L'espace `/admin` existe mais n'est accessible qu'en tapant l'URL directement : aucun lien dans l'application n'y mène. Le layout actuel est un placeholder rapide, peu structuré, qui rend visuellement cassé le header global sur les pages admin (la nav semble amputée).

## Besoin

Permettre aux utilisateurs allowlistés (admins) d'accéder facilement à leur espace admin via un point d'entrée discret dans l'interface, et préparer une structure de navigation extensible qui accueillera plusieurs sections à venir (Accueil, Insights, et plus tard Users, Projets, Jobs).

## Comportement attendu

**Entrée d'accès dans le menu utilisateur**
- Une entrée "Admin" apparaît dans le menu déroulant de l'avatar utilisateur, entre les entrées existantes et la déconnexion
- Elle est rendue **uniquement** pour les utilisateurs admins (vérification allowlist côté serveur). Invisible aux autres dans le DOM reçu
- Cliquer l'entrée mène à `/admin`

**Shell admin**
- Le header global de l'application est conservé tel quel sur les pages admin (logo, cloche notifications, avatar)
- Une sidebar gauche affiche un libellé "Espace admin", une liste verticale d'items extensible (icône + libellé + état actif marqué), un divider visuel pour grouper des sections de natures différentes, et un lien "Retour à l'app" en bas
- L'item correspondant à la page courante est visuellement marqué actif (background subtil + indication latérale)
- Le contenu principal occupe l'espace restant avec un padding cohérent

**Items présents dans la sidebar en V1**
- "Accueil" (page traitée par le ticket Accueil admin)
- "Insights LLM" (page existante, traitée par le ticket Insights LLM refresh)

## Criteres d'acceptation
- Un utilisateur non-admin ne voit aucune entree "Admin" dans son menu avatar et recoit un 404 indistinguable sur `/admin` (comportement existant a preserver)
- Un utilisateur admin clique son avatar, voit "Admin", clique, atterrit sur `/admin` avec la sidebar et le header global affiches correctement
- La sidebar respecte le design system existant de l'application
- L'etat actif de la sidebar fonctionne pour les items presents
- Le lien "Retour a l'app" ramene a la racine de l'application

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
