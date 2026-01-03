# Implementation Plan: Real-Time Ticket Modal Data Synchronization

**Branch**: `AIB-127-copy-of-update` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-127-copy-of-update/spec.md`

## Summary

Fix ticket modal data synchronization so that branch name, Spec button, and Stats tab update in real-time when job transitions to terminal status. The core issue is that while job polling correctly detects terminal states and invalidates the tickets cache, the modal does not reflect the updated ticket data until page reload.

**Technical Approach**: Enhance cache invalidation flow to ensure modal reactivity by:
1. Ensuring ticket data in modal derives from TanStack Query cache (not stale prop snapshot)
2. Verifying cache invalidation triggers re-render in open modal
3. Ensuring Stats tab uses same reactive data source as other modal content

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests), RTL for component tests
**Target Platform**: Web (Vercel-hosted Next.js)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: UI updates within 5 seconds of job completion (per SC-001)
**Constraints**: Job polling at 2-second interval; optimistic updates required for mutations
**Scale/Scope**: Single project management board with multiple concurrent users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate (Phase 0)

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First | ✅ PASS | All code will use strict TypeScript with explicit types |
| II. Component-Driven | ✅ PASS | Using existing shadcn/ui components; feature-based folder structure |
| III. Test-Driven Development | ✅ PASS | Tests required per Testing Trophy: Vitest integration for cache logic, RTL component tests for modal reactivity |
| IV. Security-First | ✅ PASS | No new user inputs; existing Prisma queries maintained |
| V. Database Integrity | ✅ N/A | No schema changes required |
| VI. AI-First Development | ✅ PASS | No documentation files created; following existing code patterns |

### Key Constitution Requirements for This Feature

1. **Testing Trophy Strategy (III)**:
   - Integration tests for cache invalidation logic (Vitest)
   - Component tests for modal reactivity (RTL + Vitest)
   - E2E only if browser-required (drag-drop, OAuth - NOT applicable here)

2. **State Management (Constitution)**:
   - TanStack Query v5 for server state (ONLY allowed library)
   - Optimistic updates required for mutations
   - No Redux/MobX/Zustand

3. **shadcn/ui Components (II)**:
   - Use existing Dialog, Tabs components
   - No custom UI primitives

## Project Structure

### Documentation (this feature)

```
specs/AIB-127-copy-of-update/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js App Router structure (existing)
app/
├── api/                                    # API routes (no changes needed)
│   └── projects/[projectId]/
│       ├── tickets/                        # Ticket CRUD
│       └── jobs/status/                    # Job polling endpoint
├── lib/
│   ├── hooks/
│   │   ├── queries/                        # TanStack Query hooks
│   │   │   └── useTickets.ts              # May need modification
│   │   └── useJobPolling.ts               # Cache invalidation trigger
│   └── query-keys.ts                       # Query key factory

components/
├── board/
│   ├── board.tsx                           # Parent component (job polling integration)
│   └── ticket-detail-modal.tsx            # Primary target for reactivity fix
└── ticket/
    └── ticket-stats.tsx                    # Stats tab component

tests/
├── unit/
│   ├── useJobPolling.test.ts              # Existing cache invalidation tests (extend)
│   └── components/                         # RTL component tests (new file needed)
└── integration/
    └── jobs/status.test.ts                # Existing API tests
```

**Structure Decision**: Next.js App Router web application. Primary changes in `components/board/ticket-detail-modal.tsx` and hooks. Tests follow Testing Trophy with Vitest for integration/unit and RTL for component tests.

## Complexity Tracking

*No violations detected - all gates pass.*

---

## Post-Design Constitution Check (Phase 1)

*Re-evaluation after design artifacts completed.*

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First | ✅ PASS | New `useTicketJobs` hook fully typed with `TicketJobWithTelemetry` interface |
| II. Component-Driven | ✅ PASS | No new UI components; using existing shadcn/ui Dialog, Tabs |
| III. Test-Driven Development | ✅ PASS | Tests planned: Vitest integration for cache, RTL component for modal |
| IV. Security-First | ✅ PASS | Using existing Prisma parameterized queries; no new user inputs |
| V. Database Integrity | ✅ N/A | No schema changes; enhanced API endpoint select clause only |
| VI. AI-First Development | ✅ PASS | No human-oriented docs; following existing patterns |

### Design Decisions Aligned with Constitution

1. **TanStack Query Only (State Management)**:
   - New `useTicketJobs` hook follows existing `useProjectTickets` pattern
   - Cache invalidation via existing `queryClient.invalidateQueries`
   - No new state management libraries introduced

2. **Testing Trophy Compliance**:
   - Integration tests: Cache invalidation (Vitest)
   - Component tests: Modal reactivity (RTL + Vitest)
   - No E2E tests needed (not browser-required)

3. **Existing Patterns Followed**:
   - Query hook pattern from `app/lib/hooks/queries/useTickets.ts`
   - Cache invalidation pattern from `app/lib/hooks/useJobPolling.ts`
   - API endpoint pattern from existing jobs routes

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/AIB-127-copy-of-update/research.md` | ✅ Complete |
| Data Model | `specs/AIB-127-copy-of-update/data-model.md` | ✅ Complete |
| API Contract | `specs/AIB-127-copy-of-update/contracts/ticket-jobs-api.yaml` | ✅ Complete |
| Quickstart | `specs/AIB-127-copy-of-update/quickstart.md` | ✅ Complete |

---

## Next Steps

Run `/speckit.tasks` to generate actionable task list from this plan.
