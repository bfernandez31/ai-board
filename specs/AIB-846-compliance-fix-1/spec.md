# Quick Implementation: [Compliance] Fix 1 violation - Component-Driven Architecture

**Feature Branch**: `AIB-846-compliance-fix-1`
**Created**: 2026-06-05
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Health scan found 1 compliance violation for principle "Component-Driven Architecture":

components/board/ticket-card.tsx:59: The TicketCard component file is ~475 lines, exceeding the ~300-line extraction trigger in the Component-Driven Architecture principle (II). Sub-components such as the agent/custom-models badge block and the job-status indicator row are inline JSX that could be extracted to reduce the parent's size. Note: significant extraction has already been done (deploy/preview/auto-mode icons, modals), so much of the remaining body is cohesive single-card JSX.

---

## From AIB-847: [Compliance] Fix 1 violation - TypeScript-First Development
Health scan found 1 compliance violation for principle "TypeScript-First Development":

components/board/ticket-card.tsx:152: Unnecessary type-safety escape via double-cast 'ticket as unknown as Record<string, string | null | undefined>' to index codex stage-model fields. This bypasses strict typing with no justifying comment, violating the TypeScript-First principle. The cast is also redundant: the codex fields (codexSpecifyModel..codexVerifyModel) are already declared on the TicketWithVersion interface (lib/types.ts:36-40), so the keys can be indexed directly without escaping the type system.

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
