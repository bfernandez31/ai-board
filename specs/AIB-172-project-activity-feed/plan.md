# Implementation Plan: Project Activity Feed

**Branch**: `AIB-172-project-activity-feed` | **Date**: 2026-01-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-172-project-activity-feed/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a project-wide activity feed at `/projects/{projectId}/activity` that aggregates events from tickets, jobs, and comments into a unified chronological timeline. Events are derived from existing data models (no new tables) using composite queries. The feed supports 15-second polling for real-time updates, 30-day data window, and pagination (50 events per page). Uses existing TanStack Query patterns for data fetching and existing timeline component patterns for display.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, shadcn/ui, date-fns
**Storage**: PostgreSQL 14+ via Prisma 6.x (using existing Job, Comment, Ticket tables)
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests only)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (Next.js monolith)
**Performance Goals**: Initial page load with 50 events renders promptly; polling at 15-second intervals
**Constraints**: 30-day data window; events derived from existing tables (no new schema)
**Scale/Scope**: Internal project management tool; moderate activity volume per project

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- All code will be written in TypeScript strict mode
- Explicit type annotations for API responses, activity events, and component props
- No `any` types; proper discriminated unions for event types (following existing ConversationEvent pattern)

### II. Component-Driven Architecture ✅
- Use shadcn/ui components exclusively (cards, buttons, badges, tooltips)
- Server Components by default; Client Components only for interactive timeline with polling
- Feature-based folder structure: `/components/activity/`, `/app/projects/[projectId]/activity/`
- API route at `/app/api/projects/[projectId]/activity/route.ts`

### III. Test-Driven Development ✅
- **Unit tests**: Pure functions (event mapping, timestamp formatting) in `tests/unit/`
- **Component tests**: Activity feed rendering, interactions (RTL) in `tests/unit/components/`
- **Integration tests**: API endpoint authorization, pagination, filtering in `tests/integration/`
- **E2E tests**: Full navigation flow, polling behavior in `tests/e2e/` (browser-required)

### IV. Security-First Design ✅
- Validate all inputs (projectId, pagination params) with Zod schemas
- Use `verifyProjectAccess()` authorization helper (owner OR member)
- Prisma parameterized queries only

### V. Database Integrity ✅
- No schema changes required (events derived from existing tables)
- Read-only queries against Job, Comment, Ticket tables
- Existing indexes support required queries

### VI. AI-First Development Model ✅
- No documentation files at project root
- Spec files in `specs/AIB-172-project-activity-feed/`
- Following existing patterns from codebase

**Pre-Design Gate Status: PASS** - All constitution principles satisfied

## Project Structure

### Documentation (this feature)

```
specs/AIB-172-project-activity-feed/
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
├── projects/[projectId]/
│   └── activity/
│       └── page.tsx                    # Activity feed page (Server Component wrapper)
├── api/projects/[projectId]/
│   └── activity/
│       └── route.ts                    # GET activity events API endpoint
├── lib/
│   ├── types/
│   │   └── activity-event.ts           # ActivityEvent discriminated union types
│   ├── utils/
│   │   └── activity-events.ts          # Event derivation and mapping utilities
│   └── hooks/queries/
│       └── use-activity-feed.ts        # TanStack Query hook with polling

components/
├── activity/
│   ├── activity-feed.tsx               # Main feed container (Client Component)
│   ├── activity-event-item.tsx         # Event renderer (dispatches by type)
│   ├── activity-event-icons.tsx        # Event type icons mapping
│   └── activity-empty-state.tsx        # Empty state component
└── layout/
    └── header.tsx                      # Existing - add Activity nav link

lib/
└── utils/
    └── format-timestamp.ts             # Existing - reuse for relative timestamps

tests/
├── unit/
│   ├── activity-event-mapping.test.ts  # Event derivation logic
│   └── components/
│       └── activity-feed.test.tsx      # Component rendering tests (RTL)
├── integration/
│   └── activity/
│       └── activity-api.test.ts        # API authorization, pagination, filtering
└── e2e/
    └── activity-feed.spec.ts           # Navigation flow, polling behavior
```

**Structure Decision**: Next.js App Router monolith following existing patterns. New activity feature adds page at `/app/projects/[projectId]/activity/`, API route at `/app/api/projects/[projectId]/activity/`, components in `/components/activity/`, and follows existing test organization by domain.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations.** Feature design follows existing patterns:
- Events derived from existing tables (no schema changes)
- Reuses established TanStack Query polling patterns
- Reuses existing timeline component architecture
- Follows standard authorization helper pattern

---

## Post-Design Constitution Re-Evaluation

*Re-checked after Phase 1 design completion.*

### I. TypeScript-First Development ✅
- **Verified**: `ActivityEvent` discriminated union defined in data-model.md with proper type guards
- **Verified**: API response types explicitly defined in contracts/activity-api.yaml
- **Verified**: No `any` types in design; all fields have explicit types

### II. Component-Driven Architecture ✅
- **Verified**: Using shadcn/ui components (Card, Button, Tooltip, Badge)
- **Verified**: Feature folder structure defined in quickstart.md
- **Verified**: Server/Client Component boundary clear (page=Server, feed=Client)

### III. Test-Driven Development ✅
- **Verified**: Testing Trophy adhered to:
  - Unit tests for event transformation logic
  - RTL component tests for feed interactions
  - Vitest integration tests for API (NOT Playwright)
  - E2E only for navigation flow (browser-required)
- **Verified**: Tests organized by domain in existing structure

### IV. Security-First Design ✅
- **Verified**: Zod validation schema defined in data-model.md
- **Verified**: Authorization via `verifyProjectAccess()` in API design
- **Verified**: All queries use Prisma (parameterized)

### V. Database Integrity ✅
- **Verified**: No new tables or schema changes required
- **Verified**: Read-only queries against existing tables with proper indexes
- **Verified**: No transactions needed (read-only operations)

### VI. AI-First Development Model ✅
- **Verified**: All spec files in `specs/AIB-172-project-activity-feed/`
- **Verified**: No documentation files at project root
- **Verified**: quickstart.md references existing code patterns, not tutorials

**Post-Design Gate Status: PASS** - All constitution principles verified against Phase 1 artifacts
