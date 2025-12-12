# Implementation Plan: Duplicate Ticket

**Branch**: `AIB-106-duplicate-a-ticket` | **Date**: 2025-12-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-106-duplicate-a-ticket/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a duplicate button to the ticket detail modal that creates a new ticket in INBOX with copied title ("Copy of " prefix), description, clarification policy, and image attachments. Implementation requires: API endpoint for duplication, frontend button with loading states, and E2E tests following TDD.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, shadcn/ui, TanStack Query v5, Prisma 6.x
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit), Playwright (integration/E2E)
**Target Platform**: Web (browser-based)
**Project Type**: Web application (Next.js monolith)
**Performance Goals**: Duplicate action completes in <3 seconds (per SC-001)
**Constraints**: Title max 100 chars, description max 2500 chars, max 5 attachments
**Scale/Scope**: Single project board feature, minimal DB impact (single INSERT)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All code in strict TypeScript, explicit types for API contracts |
| II. Component-Driven | ✅ PASS | Uses existing shadcn/ui Button, Toast components; follows feature folder pattern |
| III. Test-Driven Development | ✅ PASS | Will write Playwright E2E tests first (button interactions, API integration) |
| IV. Security-First | ✅ PASS | Uses existing verifyProjectAccess helper; Prisma parameterized queries |
| V. Database Integrity | ✅ PASS | Single INSERT via Prisma; no schema changes needed (reuses existing Ticket model) |
| V. Spec Clarification Guardrails | ✅ PASS | AUTO policy applied with documented decisions in spec.md |

## Project Structure

### Documentation (this feature)

```
specs/AIB-106-duplicate-a-ticket/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js Web Application Structure
app/
├── api/
│   └── projects/[projectId]/tickets/
│       ├── route.ts                 # Existing POST endpoint (reference)
│       └── [id]/
│           └── duplicate/
│               └── route.ts         # NEW: POST endpoint for duplication
└── lib/
    └── types/
        └── ticket.ts                # TicketAttachment interface (existing)

components/
└── board/
    └── ticket-detail-modal.tsx      # MODIFY: Add duplicate button

lib/
├── db/
│   └── tickets.ts                   # MODIFY: Add duplicateTicket function
└── validations/
    └── ticket.ts                    # Existing schemas (reference)

tests/
├── e2e/
│   └── ticket-duplicate.spec.ts     # NEW: E2E tests for duplicate feature
└── api/
    └── tickets-duplicate.spec.ts    # NEW: API contract tests
```

**Structure Decision**: Next.js monolith with App Router. Feature adds a new API route (`/api/projects/[projectId]/tickets/[id]/duplicate`) and modifies existing `ticket-detail-modal.tsx` component. Tests follow existing patterns in `/tests/e2e/` and `/tests/api/`.

## Complexity Tracking

*No constitution violations - feature reuses existing patterns and infrastructure.*

## Post-Design Constitution Re-Check

*Verified after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. TypeScript-First | ✅ PASS | API contract types defined in `contracts/duplicate-ticket-api.ts`; explicit types throughout |
| II. Component-Driven | ✅ PASS | Reuses Button, Toast from shadcn/ui; no new UI primitives needed |
| III. Test-Driven Development | ✅ PASS | Test files specified in quickstart.md; Playwright for E2E and API tests |
| IV. Security-First | ✅ PASS | API uses `verifyProjectAccess` + `verifyTicketAccess` pattern; no raw SQL |
| V. Database Integrity | ✅ PASS | Single INSERT via Prisma; no schema migrations required |
| V. Spec Clarification Guardrails | ✅ PASS | All AUTO decisions documented with rationale in spec.md |

**Verification Complete**: All constitution principles satisfied. Ready for task generation.

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/AIB-106-duplicate-a-ticket/research.md` | ✅ Complete |
| Data Model | `specs/AIB-106-duplicate-a-ticket/data-model.md` | ✅ Complete |
| API Contract | `specs/AIB-106-duplicate-a-ticket/contracts/duplicate-ticket-api.ts` | ✅ Complete |
| Quickstart | `specs/AIB-106-duplicate-a-ticket/quickstart.md` | ✅ Complete |
