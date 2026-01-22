# Implementation Plan: Project Activity Feed

**Branch**: `AIB-181-copy-of-project` | **Date**: 2026-01-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-181-copy-of-project/spec.md`

## Summary

Implement a unified activity feed page at `/projects/{projectId}/activity` that aggregates events from existing data sources (jobs, comments, ticket changes) into a chronological timeline. Uses 15-second polling for real-time updates, "Load more" pagination (50 events per page), and click-through ticket references that open the ticket modal on the board page.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, shadcn/ui, lucide-react
**Storage**: PostgreSQL 14+ via Prisma 6.x (existing tables: Job, Comment, Ticket)
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests only)
**Target Platform**: Web (Vercel hosting), responsive design (desktop + mobile)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**:
- Initial load within 2 seconds (SC-001)
- Pagination requests within 1 second (SC-003)
- Ticket modal opens within 500ms (SC-007)
**Constraints**:
- 15-second polling interval (FR-012)
- 30-day activity history limit (FR-010)
- 50 events per page (FR-011)
- No new database tables (FR-005)
**Scale/Scope**: Project-level feed aggregating jobs, comments, ticket events

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gates (Phase 0)

| Principle | Requirement | Status |
|-----------|-------------|--------|
| I. TypeScript-First | Explicit types, no `any` | ✅ PASS - Using existing typed patterns |
| II. Component-Driven | shadcn/ui for UI primitives, Server Components default | ✅ PASS - Will use existing shadcn/ui components |
| III. Test-Driven | Tests verify behavior from specs, Testing Trophy | ✅ PASS - Integration tests for API, E2E only for ticket modal navigation |
| IV. Security-First | Validate inputs, use Prisma, auth middleware | ✅ PASS - Using `verifyProjectAccess` for authorization |
| V. Database Integrity | Prisma only, no new tables required | ✅ PASS - FR-005 explicitly states no new tables |
| VI. AI-First | No tutorial docs, follow constitution | ✅ PASS - Implementation follows existing patterns |

### Dependency Stack Compliance

| Mandatory | Status | Notes |
|-----------|--------|-------|
| shadcn/ui for primitives | ✅ | Button, Card, icons from lucide-react |
| TanStack Query for server state | ✅ | New `useActivityFeed` hook with polling |
| Prisma for database | ✅ | Existing Job, Comment, Ticket models |
| Zod for validation | ✅ | Route params validation |

### Forbidden Dependencies Check

- No additional UI libraries (shadcn/ui only) ✅
- No additional ORMs (Prisma only) ✅
- No client state management libraries (React hooks + TanStack Query) ✅

## Project Structure

### Documentation (this feature)

```
specs/AIB-181-copy-of-project/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── activity-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js App Router (web application)
app/
├── projects/[projectId]/activity/
│   └── page.tsx                     # Activity feed page (Server Component)
├── api/projects/[projectId]/activity/
│   └── route.ts                     # Activity feed API endpoint
└── lib/
    ├── hooks/queries/
    │   └── use-activity-feed.ts     # TanStack Query hook with 15s polling
    ├── types/
    │   └── activity-event.ts        # ActivityEvent type definitions
    └── utils/
        └── activity-events.ts       # Event aggregation utility

components/
├── activity/                        # Feature folder
│   ├── activity-feed.tsx            # Client component with feed list
│   ├── activity-event-item.tsx      # Individual event row component
│   └── activity-empty-state.tsx     # Empty state component
└── layout/
    ├── header.tsx                   # Add Activity icon link
    └── mobile-menu.tsx              # Add Activity link

tests/
├── integration/activity/
│   └── activity-api.test.ts         # API endpoint tests
└── e2e/
    └── activity-navigation.spec.ts  # Ticket modal navigation (browser-required)
```

**Structure Decision**: Using existing Next.js App Router structure. Activity feature follows the pattern established by analytics: dedicated page at `/projects/[projectId]/activity/page.tsx`, API route at `/api/projects/[projectId]/activity/route.ts`, and components in `components/activity/` feature folder.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations - design follows all constitution principles.

---

## Post-Design Constitution Check (Phase 1)

After completing the design phase, all constitution gates remain satisfied:

### Re-Evaluation Summary

| Principle | Post-Design Status | Notes |
|-----------|-------------------|-------|
| I. TypeScript-First | ✅ PASS | All types defined in `activity-event.ts`, discriminated unions with type guards |
| II. Component-Driven | ✅ PASS | Using shadcn/ui (Avatar, Button, Card, Tooltip), Server Component page, Client Component feed |
| III. Test-Driven | ✅ PASS | Integration tests for API (Vitest), E2E only for modal navigation (Playwright) |
| IV. Security-First | ✅ PASS | Zod validation for params, `verifyProjectAccess` for auth, Prisma queries |
| V. Database Integrity | ✅ PASS | No schema changes, reads from existing tables only |
| VI. AI-First | ✅ PASS | No tutorial docs, implementation guidance in quickstart.md |

### Design Decisions Validated

1. **No new database tables** (FR-005): Confirmed - virtual aggregation of Job, Comment, Ticket tables
2. **Event type coverage** (FR-004): All 9 event types mapped to existing data sources
3. **Pagination pattern**: Offset-based, consistent with existing notification/comparison APIs
4. **Polling interval**: 15 seconds, matching notification pattern (FR-012)
5. **Navigation pattern**: URL params for ticket modal, reusing board infrastructure

### Testing Strategy Compliance

Per Testing Trophy (Constitution III):
- **Unit tests**: Not required (no pure functions with complex logic)
- **Integration tests**: API endpoint (`/api/projects/[projectId]/activity`) - REQUIRED
- **E2E tests**: Ticket modal navigation (browser-required) - REQUIRED
- **E2E for API testing**: FORBIDDEN (use Vitest integration instead)

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/AIB-181-copy-of-project/plan.md` | ✅ Complete |
| Research Notes | `specs/AIB-181-copy-of-project/research.md` | ✅ Complete |
| Data Model | `specs/AIB-181-copy-of-project/data-model.md` | ✅ Complete |
| API Contract | `specs/AIB-181-copy-of-project/contracts/activity-api.yaml` | ✅ Complete |
| Implementation Guide | `specs/AIB-181-copy-of-project/quickstart.md` | ✅ Complete |
| Task List | `specs/AIB-181-copy-of-project/tasks.md` | Pending (`/speckit.tasks`) |
