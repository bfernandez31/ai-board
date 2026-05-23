# Implementation Plan: Bulk actions on INBOX tickets

**Branch**: `AIB-824-bulk-actions-on` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-824-bulk-actions-on/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add board-level multi-select for INBOX tickets, a floating bulk action bar, and atomic bulk delete, bulk agent change, bulk model change, and merge flows. The implementation should reuse the existing flat React Query ticket cache, existing ticket auth helpers, and existing ticket/model editing patterns while introducing dedicated bulk mutation endpoints and transactional Prisma helpers for multi-ticket validation and updates.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)  
**Primary Dependencies**: Next.js 16 App Router, React 18, TanStack Query v5.95.2, Prisma 6.x, shadcn/ui, Radix UI, Zod  
**Storage**: PostgreSQL 14+ via Prisma ORM  
**Testing**: Vitest unit/integration, Playwright E2E  
**Target Platform**: Web application for desktop and mobile browsers  
**Project Type**: Next.js monolith (server-rendered board page with client board interactions)  
**Performance Goals**: Selection state changes feel immediate; bulk actions update the board on first attempt in line with SC-004; merge flow completes within the SC-002 usability target  
**Constraints**: INBOX-only scope, title max 100 chars, description max 10,000 chars, owner/member auth only, atomic all-or-nothing mutations, no dynamic Tailwind class generation, optimistic mutation handling required by constitution  
**Scale/Scope**: Single project board feature touching one board page, several board components, four new bulk endpoints, and multi-ticket Prisma transactions over small-to-moderate INBOX selections

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All planned changes stay in strict TypeScript and will define explicit request/response types for bulk actions. |
| II. Component-Driven | PASS | UI work extends existing board, ticket card, and dialog patterns with shadcn/ui primitives instead of introducing a new UI system. |
| III. Test-Driven Development | PASS | Existing board, ticket modal, integration ticket API, and board E2E suites can be extended; no test duplication is required. |
| IV. Security-First | PASS | Bulk routes will reuse `verifyProjectAccess` / `verifyTicketAccess`, Zod validation, and structured error responses. |
| V. Database Integrity | PASS | All multi-ticket mutations and merge delete/update steps will run inside Prisma transactions with pre-flight validation. |
| V. Spec Clarification Guardrails | PASS | The spec already documents conservative auto-resolved decisions, including atomicity and provenance requirements. |

## Project Structure

### Documentation (this feature)

```text
specs/AIB-824-bulk-actions-on/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── bulk-ticket-actions-api.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── projects/[projectId]/board/page.tsx                 # Existing board entry point
└── api/projects/[projectId]/tickets/
    ├── route.ts                                        # Existing board ticket list/create route
    ├── [id]/route.ts                                   # Existing single-ticket PATCH/DELETE patterns
    └── bulk/
        ├── delete/route.ts                             # NEW: atomic bulk delete
        ├── agent/route.ts                              # NEW: atomic bulk agent update
        ├── model-config/route.ts                       # NEW: atomic bulk model update
        └── merge/route.ts                              # NEW: atomic merge action

components/
└── board/
    ├── board.tsx                                       # MODIFY: selection state + bulk action orchestration
    ├── board-grid.tsx                                  # MODIFY: pass selection props into stage columns
    ├── stage-column.tsx                                # MODIFY: INBOX-only selection wiring
    ├── ticket-card.tsx                                 # MODIFY: checkbox, modifier-click, selection visuals
    ├── ticket-detail-modal.tsx                         # MODIFY: suppress open-on-select behavior and refresh merged ticket state
    ├── bulk-action-bar.tsx                             # NEW: floating action bar
    ├── bulk-change-agent-dialog.tsx                    # NEW: bulk agent picker dialog
    ├── bulk-change-model-dialog.tsx                    # NEW: bulk model picker dialog
    └── bulk-merge-dialog.tsx                           # NEW: merge preview and edit dialog

lib/
├── db/
│   └── tickets.ts                                      # MODIFY: bulk selection validation, bulk update, merge transaction helpers
├── validations/
│   └── ticket.ts                                       # MODIFY: bulk request schemas and merge payload validation
└── hooks/mutations/
    └── useDeleteTicket.ts                              # Pattern reference for optimistic rollback

tests/
├── unit/components/
│   ├── board/                                          # EXTEND: board/ticket-card selection and action bar tests
│   ├── ticket-detail-modal.test.tsx                    # EXTEND: selection should not open modal unintentionally
│   ├── model-override-dialog.test.tsx                  # Pattern reference for model-selection dialog behavior
│   └── agent-edit-dialog.test.tsx                      # Pattern reference for agent selection UI
├── integration/tickets/
│   ├── crud.test.ts                                    # EXTEND: bulk delete API coverage
│   └── model-override.test.ts                          # EXTEND: bulk model update API coverage
└── e2e/board/
    ├── drag-drop.spec.ts                               # Pattern reference for board setup/helpers
    └── bulk-actions.spec.ts                            # NEW: multi-select + merge happy paths and blocking cases
```

**Structure Decision**: Keep the existing Next.js monolith layout. Board-local selection remains in `components/board`, while server mutations are exposed as dedicated project-scoped bulk routes under `app/api/projects/[projectId]/tickets/bulk/*`. Transactional data logic belongs in `lib/db/tickets.ts` because that file already owns grouped board ticket reads, inline edits, and ticket cloning patterns.

## Complexity Tracking

*No constitution violations are currently required.*

## Post-Design Constitution Re-Check

*Verified after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. TypeScript-First | PASS | Contracted bulk payloads and response shapes are defined in `contracts/bulk-ticket-actions-api.md`; no untyped mutation surface is planned. |
| II. Component-Driven | PASS | New UI is limited to board feature components and dialogs composed from existing shadcn/ui primitives. |
| III. Test-Driven Development | PASS | The plan extends existing unit, integration, and board E2E suites before adding only one new board E2E file for the end-to-end bulk flow. |
| IV. Security-First | PASS | Every bulk endpoint validates IDs and payloads, re-checks project/ticket access, and returns structured blocking errors. |
| V. Database Integrity | PASS | Bulk delete, agent/model updates, and merge are all designed as Prisma transactions with all-or-nothing validation and survivor/source re-reads inside the transaction. |
| V. Spec Clarification Guardrails | PASS | Design choices preserve the spec’s conservative defaults for destructive actions and provenance retention. |

**Verification Complete**: Design satisfies constitution requirements and is ready for task generation.

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/AIB-824-bulk-actions-on/research.md` | Complete |
| Data Model | `specs/AIB-824-bulk-actions-on/data-model.md` | Complete |
| API Contract | `specs/AIB-824-bulk-actions-on/contracts/bulk-ticket-actions-api.md` | Complete |
