# Implementation Plan: Duplicate a Ticket

**Branch**: `AIB-105-duplicate-a-ticket` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-105-duplicate-a-ticket/spec.md`

## Summary

Add a duplicate button to the ticket detail modal that creates a new ticket in INBOX with copied content (title prefixed with "Copy of", description, clarification policy, and image attachments). The implementation uses existing create ticket API patterns with a new duplicate endpoint that handles title truncation and attachment reference copying.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, shadcn/ui, TanStack Query v5, Prisma 6.x
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit tests), Playwright (E2E tests)
**Target Platform**: Web (Vercel deployment)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Duplicate operation < 2 seconds perceived completion (SC-001)
**Constraints**: Title max 100 chars (must truncate "Copy of " prefix if needed), Description max 2500 chars
**Scale/Scope**: Internal team productivity tool, low-moderate concurrent users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All new code will use strict TypeScript with explicit types |
| II. Component-Driven | ✅ PASS | Uses shadcn/ui Button, uses existing Dialog/Modal patterns |
| III. Test-Driven (NON-NEGOTIABLE) | ✅ PASS | Will add Vitest unit tests for title truncation logic, Playwright E2E for duplicate flow |
| IV. Security-First | ✅ PASS | Uses existing auth helpers (verifyProjectAccess), Prisma parameterized queries |
| V. Database Integrity | ✅ PASS | No schema changes needed; uses existing Ticket model and createTicket pattern |
| V. Spec Clarification Guardrails | ✅ PASS | AUTO decisions documented in spec.md with trade-offs |

**Gate Evaluation**: All principles satisfied. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-105-duplicate-a-ticket/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/
├── api/
│   └── projects/[projectId]/tickets/
│       ├── route.ts                    # Existing: POST for create ticket
│       └── [id]/
│           └── duplicate/
│               └── route.ts            # NEW: POST duplicate endpoint
└── (protected)/projects/[id]/board/    # Board page (existing)

components/
├── board/
│   └── ticket-detail-modal.tsx         # MODIFY: Add duplicate button
└── ui/                                  # shadcn/ui components (existing)

lib/
├── db/
│   └── tickets.ts                      # MODIFY: Add duplicateTicket function
├── utils/
│   └── ticket-title.ts                 # NEW: Title truncation utility
└── validations/
    └── ticket.ts                       # Existing validation schemas

tests/
├── unit/
│   └── ticket-title.test.ts            # NEW: Vitest unit tests for title truncation
└── e2e/
    └── duplicate-ticket.spec.ts        # NEW: Playwright E2E tests
```

**Structure Decision**: Next.js App Router web application structure. New duplicate endpoint follows existing `/api/projects/[projectId]/tickets/[id]/` pattern. UI changes contained to existing ticket-detail-modal.tsx component.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations. Implementation uses existing patterns and minimal new code.

## Post-Design Constitution Re-Check

*Re-evaluation after Phase 1 design completion.*

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First | ✅ PASS | All artifacts specify strict TypeScript; `createDuplicateTitle` has explicit return type |
| II. Component-Driven | ✅ PASS | Uses shadcn/ui Button, lucide-react Copy icon; follows existing modal patterns |
| III. Test-Driven (NON-NEGOTIABLE) | ✅ PASS | Quickstart specifies TDD: unit tests first (Vitest), then E2E (Playwright) |
| IV. Security-First | ✅ PASS | API contract uses `verifyProjectAccess`; validates projectId/ticketId; no raw SQL |
| V. Database Integrity | ✅ PASS | Uses existing `createTicket()` with Prisma; no schema changes needed |
| V. Spec Clarification Guardrails | ✅ PASS | All AUTO decisions from spec documented with trade-offs |

**Post-Design Gate Evaluation**: All principles remain satisfied. Ready for Phase 2 (task generation via `/speckit.tasks`).
