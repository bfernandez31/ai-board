# Implementation Plan: Real-Time UI Stage Synchronization

**Branch**: `076-934-ui-stages` | **Date**: 2025-10-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/076-934-ui-stages/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix real-time UI stage synchronization for workflow-initiated ticket transitions. Currently, when GitHub Actions workflows transition tickets to new stages (quick-impl → VERIFY, auto-ship → SHIP), the UI does not update automatically—users must refresh the page to see the correct stage. The database is correctly updated, but the frontend polling system does not detect stage changes, only job status changes. The fix enhances the existing `useJobPolling` hook to invalidate the tickets cache when terminal job statuses are detected, triggering automatic refetch of ticket data and UI update within 2 seconds.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, TanStack Query v5.90.5, @dnd-kit/core, @dnd-kit/sortable
**Storage**: PostgreSQL 14+ via Prisma ORM 6.17.1
**Testing**: Vitest 4.0.2 (unit tests for hooks), Playwright 1.48.0 (integration/E2E tests)
**Target Platform**: Web (Vercel serverless deployment)
**Project Type**: Web application (Next.js frontend + API routes backend)
**Performance Goals**: UI stage updates within 2-3 seconds of workflow completion, polling endpoint < 100ms p95 response time
**Constraints**: 2-second polling interval (existing), TanStack Query caching/deduplication (must preserve), backward compatibility with manual drag-and-drop transitions
**Scale/Scope**: Single-project codebase, affects board UI component, polling hook, and tickets query cache invalidation logic

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development
**Status**: ✅ PASS
- All code is TypeScript 5.6 strict mode
- Hook modifications maintain explicit type annotations
- No `any` types introduced
- Existing interfaces (`UseJobPollingReturn`, `JobStatusDto`) are reused

### Principle II: Component-Driven Architecture
**Status**: ✅ PASS
- Changes confined to existing hook (`useJobPolling.ts`) and query patterns
- No new UI components required
- Existing TanStack Query patterns preserved
- Feature folder structure (`app/lib/hooks/`) unchanged

### Principle III: Test-Driven Development
**Status**: ✅ PASS (with test strategy defined)
- **Test Discovery Required**: Search for existing `useJobPolling` tests before creating new files
- **Hybrid Strategy**:
  - Vitest unit tests for pure cache invalidation logic
  - Playwright E2E tests for full workflow-to-UI synchronization
- **Test Pattern**: Red-Green-Refactor cycle mandatory
- **Test Locations**:
  - Unit: `tests/unit/useJobPolling.test.ts` (search first)
  - E2E: `tests/e2e/real-time/ui-stage-sync.spec.ts` (search first)

### Principle IV: Security-First Design
**Status**: ✅ PASS
- No user input validation required (client-side hook only)
- No API changes (reuses existing `/api/projects/:projectId/jobs/status` endpoint)
- No sensitive data exposure risk
- Existing authorization patterns unchanged

### Principle V: Database Integrity
**Status**: ✅ PASS
- No database schema changes required
- No migrations needed
- No database queries modified
- Read-only operations via existing Prisma queries

### Technology Standards Compliance
**Status**: ✅ PASS
- Uses TanStack Query v5.90.5 (mandatory for server state)
- No forbidden dependencies introduced
- Maintains existing polling architecture
- Preserves Vercel deployment compatibility

### Clarification Guardrails (Principle V)
**Status**: ✅ PASS
- Feature spec used AUTO policy with high confidence (+3)
- All decisions resolved with clear technical rationale
- No NEEDS CLARIFICATION items in specification
- Trade-offs documented in spec.md Auto-Resolved Decisions section

**Overall Gate Status**: ✅ PASS - All principles satisfied, no violations to justify

## Project Structure

### Documentation (this feature)

```
specs/076-934-ui-stages/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (TanStack Query cache patterns)
├── data-model.md        # Phase 1 output (no schema changes, documents Job/Ticket relationship)
├── quickstart.md        # Phase 1 output (developer testing guide)
├── contracts/           # Phase 1 output (no API changes, documents existing endpoints)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/
├── lib/
│   ├── hooks/
│   │   ├── useJobPolling.ts          # MODIFIED: Add tickets cache invalidation
│   │   └── queries/
│   │       └── useTickets.ts         # UNCHANGED: Cache invalidated by useJobPolling
│   ├── query-keys.ts                 # UNCHANGED: Existing query key factory
│   └── schemas/
│       └── job-polling.ts            # UNCHANGED: Existing JobStatusDto schema
│
├── api/
│   └── projects/
│       └── [projectId]/
│           ├── jobs/
│           │   └── status/
│           │       └── route.ts      # UNCHANGED: Existing polling endpoint
│           └── tickets/
│               └── route.ts          # UNCHANGED: Existing tickets endpoint
│
└── components/
    └── board/
        └── board.tsx                 # UNCHANGED: Consumes invalidated cache

tests/
├── unit/
│   └── useJobPolling.test.ts         # MODIFIED: Add tests for cache invalidation
│
├── integration/
│   └── real-time/
│       └── job-polling.spec.ts       # MODIFIED: Add stage sync integration tests
│
└── e2e/
    └── real-time/
        └── ui-stage-sync.spec.ts     # NEW: E2E test for workflow → UI sync
```

**Structure Decision**: Web application (Next.js App Router). This feature modifies only the `useJobPolling` hook to detect terminal job statuses and invalidate the tickets cache, leveraging TanStack Query's built-in invalidation and refetch mechanisms. No new components, API routes, or database queries required. Test files follow the hybrid testing strategy (Vitest for unit tests, Playwright for integration/E2E).

## Complexity Tracking

*No violations detected - all constitution principles satisfied.*

---

## Post-Design Constitution Re-Check

**Date**: 2025-10-30
**Status**: ✅ PASS

### Principle I: TypeScript-First Development
**Status**: ✅ PASS
- All design artifacts maintain TypeScript strict mode
- Hook modifications documented with explicit types
- No `any` types introduced in design

### Principle II: Component-Driven Architecture
**Status**: ✅ PASS
- Design confirms changes confined to `useJobPolling` hook
- No new components required
- Existing patterns preserved (TanStack Query, React hooks)

### Principle III: Test-Driven Development
**Status**: ✅ PASS
- Test strategy documented in research.md
- Hybrid testing approach confirmed (Vitest + Playwright)
- Test locations identified before implementation

### Principle IV: Security-First Design
**Status**: ✅ PASS
- No security concerns introduced
- Existing authorization patterns unchanged
- Read-only operations via existing APIs

### Principle V: Database Integrity
**Status**: ✅ PASS
- data-model.md confirms no schema changes required
- No migrations needed
- All necessary data already exists

### Technology Standards Compliance
**Status**: ✅ PASS
- TanStack Query v5 usage confirmed (mandatory for server state)
- No forbidden dependencies added
- Vercel deployment compatibility maintained

### Clarification Guardrails
**Status**: ✅ PASS
- All research questions resolved
- No ambiguities remaining
- Implementation path clear

**Final Verdict**: ✅ Ready for Phase 2 (Task Generation)

All constitution principles remain satisfied post-design. The feature is well-scoped, requires minimal changes, and follows all established patterns and standards.
