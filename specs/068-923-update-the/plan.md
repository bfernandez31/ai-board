# Implementation Plan: Board Real-Time Update on Workflow Stage Transitions

**Branch**: `068-923-update-the` | **Date**: 2025-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/068-923-update-the/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix board real-time updates for workflow-initiated stage transitions. Currently, when GitHub Actions workflows complete and transition tickets between stages (e.g., BUILD → VERIFY), the board does not automatically refresh to show the updated ticket position. The solution uses TanStack Query cache invalidation triggered by job status polling to refetch ticket data when workflows complete.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, TanStack Query v5.90.5, Prisma 6.x
**Storage**: PostgreSQL 14+ (existing Job and Ticket models)
**Testing**: Vitest (unit tests), Playwright (integration/E2E tests)
**Target Platform**: Vercel serverless (Next.js API routes)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Board updates within 2 seconds of workflow completion (polling interval)
**Constraints**: No new API endpoints, reuse existing polling infrastructure (useJobPolling.ts)
**Scale/Scope**: Single feature affecting board component, job polling hook, and TanStack Query integration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle I - TypeScript-First Development**: ✅ PASS
- All changes will use TypeScript strict mode
- TanStack Query hooks and cache invalidation logic will have explicit types
- Job status types already defined (JobStatus enum)

**Principle II - Component-Driven Architecture**: ✅ PASS
- Changes limited to existing components (Board component, useJobPolling hook)
- No new UI components required
- Server Components remain default, Client Components already exist for board

**Principle III - Test-Driven Development**: ✅ PASS
- Existing test infrastructure: Vitest for utility functions, Playwright for E2E
- Will search for existing job polling tests before adding new tests
- Test pattern: Verify cache invalidation triggers refetch when job status changes

**Principle IV - Security-First Design**: ✅ PASS
- No new API endpoints or user inputs
- Reuses existing authenticated polling endpoint
- No sensitive data exposure (job status already public to project owners)

**Principle V - Database Integrity**: ✅ PASS
- No schema changes required
- Reuses existing Job and Ticket models
- No migrations needed

**Principle VI - Specification Clarification Guardrails**: ✅ PASS
- INTERACTIVE policy applied (spec already includes Auto-Resolved Decisions)
- No AUTO/PRAGMATIC decisions in this implementation
- All technical choices documented with rationale

## Project Structure

### Documentation (this feature)

```
specs/068-923-update-the/
├── spec.md              # Feature specification (already exists)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (TanStack Query patterns, cache invalidation)
├── data-model.md        # Phase 1 output (no new models, documents existing)
├── quickstart.md        # Phase 1 output (implementation guide)
├── contracts/           # Phase 1 output (no new APIs, documents existing)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/
├── lib/
│   ├── hooks/
│   │   ├── useJobPolling.ts          # MODIFY: Add cache invalidation on terminal status
│   │   └── queries/
│   │       └── useTickets.ts         # REFERENCE: Query key pattern to invalidate
│   └── query-keys.ts                 # REFERENCE: Hierarchical query key factory
│
└── projects/
    └── [projectId]/
        └── board/
            └── page.tsx                # Board component (uses useJobPolling)

components/
└── board/
    └── board.tsx                       # MODIFY: Verify cache integration works correctly

tests/
├── unit/
│   └── useJobPolling.test.ts         # MODIFY: Add cache invalidation tests
└── e2e/
    ├── real-time/
    │   └── job-polling.spec.ts        # SEARCH FIRST: May need updates
    └── board/
        └── workflow-transitions.spec.ts # CREATE: E2E test for board updates
```

**Structure Decision**: Next.js full-stack web application with App Router. All changes are modifications to existing hooks and components. No new API routes, no schema changes. The implementation focuses on client-side cache management using TanStack Query's invalidation API.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No constitution violations. All changes follow established patterns:
- Reuses existing TanStack Query infrastructure
- No new architecture patterns introduced
- Builds on existing job polling and cache management

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion*

**Principle I - TypeScript-First Development**: ✅ PASS
- Implementation maintains strict mode compliance
- All new types defined: `JobStatusDto[]` for previous state tracking
- `useRef<JobStatusDto[]>` explicitly typed
- `queryClient.invalidateQueries()` uses typed query keys from `queryKeys` factory

**Principle II - Component-Driven Architecture**: ✅ PASS
- Changes isolated to single hook (`useJobPolling`)
- No new components created
- Board component remains unchanged (passive consumer of cache updates)
- Follows existing mutation pattern from `useStageTransition`

**Principle III - Test-Driven Development**: ✅ PASS
- Unit tests defined in quickstart.md (4 test cases)
- E2E tests defined in quickstart.md (3 test cases)
- Test discovery workflow followed (search existing tests first)
- Tests written before implementation (TDD cycle)
- Both Vitest and Playwright test strategies documented

**Principle IV - Security-First Design**: ✅ PASS
- No new API endpoints or attack surface
- Reuses existing authenticated polling endpoint
- Cache invalidation is client-side only (no security implications)
- No user input handling required

**Principle V - Database Integrity**: ✅ PASS
- Zero database schema changes
- Existing Job and Ticket models sufficient
- No new migrations required
- No database queries modified

**Principle VI - Specification Clarification Guardrails**: ✅ PASS
- All design decisions documented in research.md
- Trade-offs explicitly captured (polling vs SSE, invalidation timing)
- No ambiguous implementation choices remaining
- INTERACTIVE policy maintained throughout planning

**Final Gate Status**: ✅ ALL GATES PASSED
- No constitution violations introduced during design phase
- Implementation complexity remains low (single hook modification)
- Test coverage adequate (7 new tests: 4 unit + 3 E2E)
- Ready to proceed to Phase 2 (tasks generation)
