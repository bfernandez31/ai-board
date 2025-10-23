# Implementation Plan: Dual Job Display

**Branch**: `046-dual-job-display` | **Date**: 2025-10-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/046-dual-job-display/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Display two types of jobs (workflow and AI-BOARD) on ticket cards with contextual status labels (WRITING/CODING/ASSISTING) and strict visibility rules. Workflow jobs are always visible; AI-BOARD jobs are stage-filtered to match current ticket stage (e.g., "comment-specify" visible only in SPECIFY stage). The feature prevents critical error masking by prominently displaying FAILED/CANCELLED states for both job types.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, TanStack Query v5.90.5, @dnd-kit/core
**Storage**: PostgreSQL 14+ (existing Job table with ticketId, command, status, startedAt indexes)
**Testing**: Vitest (unit tests for utilities), Playwright (integration and E2E tests)
**Target Platform**: Web application (Vercel deployment)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: <100ms job retrieval per ticket, <2s UI updates via polling, support 100+ tickets on board
**Constraints**: Two database queries per ticket (workflow + AI-BOARD jobs), must preserve existing polling mechanism, no schema changes required
**Scale/Scope**: Frontend component updates (TicketCard, Board), utility functions for job filtering and label transformation, integration with existing Job polling system

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development
✅ **PASS** - All new code will use TypeScript strict mode with explicit types. Job filtering and label transformation utilities will have proper type definitions. Component props will be explicitly typed.

### Principle II: Component-Driven Architecture
✅ **PASS** - Feature uses existing shadcn/ui components (no new UI primitives). Updates existing `TicketCard` and `JobStatusIndicator` components. Follows feature-based folder structure (`components/board/`, `lib/utils/`). No API routes required (reuses existing job polling).

### Principle III: Test-Driven Development
✅ **PASS** - Hybrid testing strategy: Vitest unit tests for utility functions (fast, isolated), Playwright integration tests for component behavior, Playwright E2E tests for critical user flows. Existing test file `/tests/integration/tickets/ticket-card-job-status.spec.ts` will be extended. Tests written before implementation (TDD).

### Principle IV: Security-First Design
✅ **PASS** - No new API routes or user input. Reuses existing job polling endpoint with established authentication. No database mutations. Read-only data transformation on client side.

### Principle V: Database Integrity
✅ **PASS** - No schema changes required. Uses existing Job table with current indexes on `ticketId`, `command`, `status`, and `startedAt`. Leverages existing Prisma queries pattern.

### Overall Gate Status: ✅ PASS - Ready for Phase 0 Research

No constitution violations. Feature is purely frontend enhancement using existing data structures and API endpoints.

---

## Constitution Re-Check (Post Phase 1 Design)

*Re-evaluated after completing Phase 1 (research, data-model, contracts)*

### Principle I: TypeScript-First Development
✅ **PASS** - All designed utilities use explicit TypeScript types:
- `DualJobState` interface with explicit Job | null types
- `ContextualLabel` and `DisplayStatus` discriminated unions
- Strict null checks enforced in all filtering functions
- Component props with explicit type annotations

### Principle II: Component-Driven Architecture
✅ **PASS** - Design follows feature-based patterns:
- Utilities in `lib/utils/` (job-filtering, job-label-transformer, stage-matcher)
- Component updates maintain shadcn/ui usage
- No new UI primitives created
- Extends existing components (TicketCard, JobStatusIndicator)

### Principle III: Test-Driven Development
✅ **PASS** - Hybrid testing strategy documented:
- **Unit tests** (Vitest): Pure utility functions (`job-filtering.test.ts`, `job-label-transformer.test.ts`, `stage-matcher.test.ts`)
- **Integration tests** (Playwright): Component behavior (`tests/integration/tickets/ticket-card-job-status.spec.ts`)
- **E2E tests** (Playwright): Critical user flows (`tests/e2e/dual-job-display.spec.ts`)
- TDD workflow: Write tests → Implement → Verify

### Principle IV: Security-First Design
✅ **PASS** - No security concerns:
- No new API endpoints or user input
- Read-only client-side data transformations
- Reuses existing authenticated polling endpoint
- No sensitive data exposure

### Principle V: Database Integrity
✅ **PASS** - No database changes:
- Uses existing Job table schema
- Leverages existing indexes (ticketId, status, startedAt)
- No migrations required
- Client-side filtering only

### Overall Gate Status: ✅ PASS - Ready for Phase 2 (Task Generation)

Design maintains full constitution compliance. All principles satisfied with no exceptions or violations.

## Project Structure

### Documentation (this feature)

```
specs/046-dual-job-display/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Next.js 15 App Router structure with feature-based organization:

```
app/
├── api/                           # Existing API routes (no changes needed)
│   └── projects/[projectId]/jobs/status/  # Existing polling endpoint
└── projects/[projectId]/board/    # Board page (minor updates)

components/
└── board/                         # Board feature components
    ├── ticket-card.tsx            # UPDATE: Accept dual job props
    ├── job-status-indicator.tsx   # UPDATE: Support contextual labels
    ├── board.tsx                  # UPDATE: Fetch both job types
    └── stage-column.tsx           # (no changes)

lib/
├── hooks/
│   ├── useJobPolling.ts          # (no changes - polling works as-is)
│   └── queries/                  # (existing TanStack Query hooks)
├── utils/
│   ├── job-filtering.ts          # NEW: Workflow/AI-BOARD job filtering
│   ├── job-label-transformer.ts  # NEW: Contextual label logic
│   └── stage-matcher.ts          # NEW: AI-BOARD stage matching
└── types/
    └── job-types.ts              # UPDATE: Add dual job types

tests/
├── unit/                              # NEW: Vitest unit tests
│   ├── job-filtering.test.ts          # Unit tests for job filtering utilities
│   ├── job-label-transformer.test.ts  # Unit tests for label transformation
│   └── stage-matcher.test.ts          # Unit tests for stage matching
├── integration/tickets/
│   └── ticket-card-job-status.spec.ts # EXTEND: Playwright integration tests
└── e2e/
    └── dual-job-display.spec.ts       # NEW: Playwright E2E tests
```

**Structure Decision**: Next.js App Router with feature-based components. All changes are in `components/board/` and `lib/utils/`. No new API routes required. Extends existing test suites in `/tests/integration/tickets/`.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No constitution violations - this section is not applicable.
