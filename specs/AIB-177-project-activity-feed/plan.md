# Implementation Plan: Project Activity Feed

**Branch**: `AIB-177-project-activity-feed` | **Date**: 2026-01-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-177-project-activity-feed/spec.md`

## Summary

Add a project-level activity feed page that displays a unified timeline of all events happening across the project. The activity feed aggregates data from existing tables (jobs, comments, tickets) without creating new database tables. Events include ticket creation, stage changes, comments, job lifecycle events, PR creation, and preview deployments - all displayed in reverse chronological order with 15-second polling refresh.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, shadcn/ui, lucide-react, date-fns
**Storage**: PostgreSQL 14+ via Prisma ORM (no new tables - derive from jobs, comments, tickets)
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests only)
**Target Platform**: Web (Vercel), viewports 320px-2560px
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Initial page load <2 seconds (50 events), Load more <1 second, 15-second polling interval
**Constraints**: 30-day event history window, 50 events per page, cursor-based pagination
**Scale/Scope**: Per-project activity feed, typically <1000 events per 30-day window

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check (Phase 0)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All code in strict TypeScript, explicit types for ActivityEvent, Actor, TicketReference |
| II. Component-Driven | PASS | Uses shadcn/ui components, Server Component page with Client Component for polling |
| III. Test-Driven | PASS | Integration tests for API (Vitest), component tests for UI interactions, E2E only for navigation |
| IV. Security-First | PASS | Uses verifyProjectAccess helper, Prisma parameterized queries |
| V. Database Integrity | PASS | No schema changes - reads from existing tables (jobs, comments, tickets) |
| VI. AI-First Development | PASS | No human-oriented documentation created |

**Pre-Design Gate Result**: PASS - All constitution principles satisfied

### Post-Design Check (Phase 1)

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First | PASS | Discriminated union types in data-model.md, Zod validation schema in API contract |
| II. Component-Driven | PASS | Activity components follow shadcn/ui patterns, feature folder structure defined |
| III. Test-Driven | PASS | Testing strategy in quickstart.md follows Testing Trophy (unit → integration → E2E) |
| IV. Security-First | PASS | API contract includes auth (sessionAuth), validates projectId, uses verifyProjectAccess |
| V. Database Integrity | PASS | No schema changes, queries use existing indexes on jobs/comments/tickets |
| VI. AI-First Development | PASS | quickstart.md references code patterns, not human tutorials |

**Post-Design Gate Result**: PASS - Design artifacts comply with all constitution principles

## Project Structure

### Documentation (this feature)

```
specs/AIB-177-project-activity-feed/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── activity-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
app/
├── api/projects/[projectId]/activity/
│   └── route.ts                    # Activity feed API endpoint
├── lib/
│   ├── hooks/queries/
│   │   └── use-project-activity.ts # TanStack Query hook for activity
│   ├── types/
│   │   └── activity-event.ts       # ActivityEvent type definitions
│   └── utils/
│       └── activity-events.ts      # Event merging and transformation
├── projects/[projectId]/activity/
│   └── page.tsx                    # Activity page (Server Component)

components/
├── activity/
│   ├── activity-feed.tsx           # Client Component with polling
│   ├── activity-item.tsx           # Single activity event renderer
│   └── activity-empty-state.tsx    # Empty state component
├── layout/
│   └── header.tsx                  # Add Activity navigation link (modify)

tests/
├── unit/
│   └── activity-events.test.ts     # Unit tests for event merging
├── integration/
│   └── activity/
│       └── api.test.ts             # API integration tests
└── e2e/
    └── activity.spec.ts            # E2E tests for navigation only
```

**Structure Decision**: Follows existing Next.js App Router patterns. New activity feature uses same structure as analytics - Server Component page with Client Component for interactivity. Activity-specific components in `/components/activity/`. API follows existing `/api/projects/[projectId]/` pattern.

## Complexity Tracking

*No violations - design follows existing patterns and reuses components*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Known Bugs (To Fix)

### Bug 1: Race condition in polling merge logic

**Location**: `components/activity/activity-feed.tsx` line 46

**Problem**: The code uses `prev.length <= initialLimit` to detect if pagination has happened. This is unreliable because:
- Event count can change between polls (new events added, events moving outside 30-day window)
- If exactly `initialLimit` events exist and user hasn't paginated, then new events arrive, the detection logic fails

**Fix**: Track pagination state explicitly with a `hasPaginated` boolean flag instead of inferring from event count. Set flag to `true` when "Load more" is clicked.

### Bug 2: Cursor pagination silently restarts for expired cursors

**Location**: `app/lib/utils/activity-events.ts` `applyPagination` function (line 320-342)

**Problem**: When a cursor cannot be found (event was deleted or moved outside the 30-day window), the function silently sets `startIndex = 0`, restarting pagination from the beginning without any indication to the caller.

**Fix**:
1. Return a `cursorExpired: boolean` flag in the pagination response
2. When cursor event not found, set `cursorExpired: true` instead of silently restarting
3. Frontend should detect this and show user notification that their position was lost
