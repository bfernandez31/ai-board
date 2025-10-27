# Implementation Plan: GitHub-Style Ticket Conversations

**Branch**: `065-915-conversations-je` | **Date**: 2025-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/065-915-conversations-je/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Redesign the ticket comment section to display a unified GitHub-style conversation timeline that includes both user comments and automated job lifecycle events. The feature generates conversation events from existing Job records (PENDING/RUNNING → start event, COMPLETED/FAILED/CANCELLED → completion event) and displays them chronologically alongside user comments. Job events use user-friendly stage terminology (SPECIFY, PLAN, BUILD) instead of command names, and indicate workflow type when quick workflow is used. No database schema changes required - all events generated from existing Job and Comment tables. VERIFY and SHIP stages excluded (no jobs for those stages yet).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, TanStack Query v5.90.5, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM (no schema changes - read-only from Job and Comment tables)
**Testing**: Hybrid strategy - Vitest for unit tests (~1ms), Playwright for integration/E2E tests (~500ms-2s)
**Target Platform**: Web application (Vercel serverless deployment)
**Project Type**: Web (Next.js full-stack with App Router)
**Performance Goals**: <2 seconds page load for tickets with 50+ conversation items, <100ms API response
**Constraints**: No database schema changes, GitHub-like visual experience, client-side polling (no SSE)
**Scale/Scope**: Support up to 50 conversation items per ticket, retroactive event generation from Job records

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- **Status**: PASS
- **Evidence**: All code written in TypeScript strict mode, explicit types for conversation event union types, Job/Comment query responses
- **Risks**: None - standard TypeScript patterns apply

### II. Component-Driven Architecture ✅
- **Status**: PASS
- **Evidence**: Uses shadcn/ui components for timeline UI, follows Next.js App Router conventions, conversation component in `/components/ticket/` feature folder
- **Risks**: None - standard component patterns

### III. Test-Driven Development ✅
- **Status**: PASS
- **Evidence**: Hybrid testing strategy - Vitest unit tests for event generation/formatting logic (~1ms), Playwright integration tests for conversation timeline rendering and real-time updates
- **Action Items**: Search for existing test files before creating new ones, extend existing test suites where applicable
- **Risks**: None - clear test boundaries (unit: event generation, integration: timeline display)

### IV. Security-First Design ✅
- **Status**: PASS
- **Evidence**: Read-only queries from Job/Comment tables, Zod validation for API responses, existing NextAuth session validation on routes
- **Risks**: None - no new attack surface (read-only feature)

### V. Database Integrity ✅
- **Status**: PASS
- **Evidence**: No schema changes required - uses existing Job and Comment tables via Prisma queries
- **Risks**: None - read-only operations

### VI. State Management (TanStack Query) ✅
- **Status**: PASS
- **Evidence**: Conversation data fetched via TanStack Query hook with caching, automatic refetch when comments added or job statuses change
- **Risks**: None - standard query pattern

### VII. Specification Clarification Guardrails ✅
- **Status**: PASS
- **Evidence**: Spec includes Auto-Resolved Decisions section documenting CONSERVATIVE policy application and trade-offs
- **Risks**: None - all decisions documented with rationale

**Gate Result**: ✅ ALL CHECKS PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

This is a Next.js 15 full-stack web application (App Router). The feature adds conversation timeline components and utilities without database schema changes.

```
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── tickets/
│               └── [ticketId]/
│                   └── timeline/
│                       └── route.ts           # NEW: Timeline API endpoint

components/
├── timeline/                                  # NEW: Timeline UI components
│   ├── timeline.tsx                           # Layout wrapper with vertical line
│   ├── timeline-badge.tsx                     # Badge wrapper (avatar/icon)
│   ├── timeline-content.tsx                   # Content wrapper
│   ├── timeline-item.tsx                      # Event dispatcher (switch)
│   ├── comment-timeline-item.tsx              # Comment display
│   └── job-event-timeline-item.tsx            # Job event display
└── ticket/
    └── conversation-timeline.tsx              # NEW: Container component

lib/
├── types/
│   └── conversation-event.ts                  # NEW: ConversationEvent types
├── utils/
│   ├── conversation-events.ts                 # NEW: Merge/sort logic
│   └── job-display-names.ts                   # NEW: Command → display name
└── hooks/
    └── queries/
        └── useConversationTimeline.ts         # NEW: TanStack Query hook

tests/
├── unit/
│   ├── conversation-events.test.ts            # NEW: Unit tests (Vitest)
│   └── job-display-names.test.ts              # NEW: Unit tests (Vitest)
├── api/
│   └── timeline.spec.ts                       # NEW: API contract tests (Playwright)
└── integration/
    └── timeline/
        └── conversation-timeline.spec.ts      # NEW: Integration tests (Playwright)
```

**Structure Decision**: Web application structure (Option 2) using Next.js App Router. All new files organized by feature domain (timeline components, conversation utilities). No database migrations or Prisma schema changes required.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - All constitution principles satisfied by this feature design.

---

## Post-Design Constitution Check

*GATE: Re-evaluate constitution compliance after design phase*

### I. TypeScript-First Development ✅
- **Status**: PASS (confirmed after design)
- **Evidence**:
  - All types defined in `lib/types/conversation-event.ts` with explicit type annotations
  - Discriminated union pattern ensures type safety (ConversationEvent)
  - No `any` types in design
  - API responses have TypeScript interfaces
- **Design Review**: Type system enforces exhaustive checking in switch statements (assertNever helper)

### II. Component-Driven Architecture ✅
- **Status**: PASS (confirmed after design)
- **Evidence**:
  - All components use shadcn/ui primitives (Avatar, Badge)
  - Feature-based folder structure (`components/timeline/`, `components/ticket/`)
  - Server Components by default, no Client Components needed (stateless presentation)
  - API route follows Next.js App Router conventions
- **Design Review**: Component hierarchy matches shadcn/ui patterns; no custom primitives

### III. Test-Driven Development ✅
- **Status**: PASS (confirmed after design)
- **Evidence**:
  - Hybrid testing strategy documented in quickstart.md
  - Unit tests for pure functions (conversation-events.ts, job-display-names.ts) using Vitest
  - Integration tests for timeline rendering using Playwright
  - Test discovery workflow documented (search before create)
- **Design Review**: Clear test boundaries defined; quickstart.md includes test implementation phases

### IV. Security-First Design ✅
- **Status**: PASS (confirmed after design)
- **Evidence**:
  - API route validates session, project ownership, ticket existence
  - Read-only queries (no mutations, no data modification)
  - Zod validation not needed (read-only responses, Prisma type safety sufficient)
  - No new attack surface introduced
- **Design Review**: Authorization logic follows existing patterns (userId validation)

### V. Database Integrity ✅
- **Status**: PASS (confirmed after design)
- **Evidence**:
  - No schema changes (read-only from Comment and Job tables)
  - Leverages existing indexes for performance
  - No raw SQL, all queries via Prisma
- **Design Review**: No migration risks; existing constraints sufficient

### VI. State Management (TanStack Query) ✅
- **Status**: PASS (confirmed after design)
- **Evidence**:
  - TanStack Query hook with proper query keys (`['timeline', projectId, ticketId]`)
  - 10-second stale time and refetch interval (matches existing polling pattern)
  - Query invalidation on comment creation and job status updates
  - No local state needed (stateless presentation)
- **Design Review**: Query pattern consistent with existing hooks (useTickets.ts)

### VII. Specification Clarification Guardrails ✅
- **Status**: PASS (confirmed after design)
- **Evidence**:
  - Spec includes Auto-Resolved Decisions section
  - CONSERVATIVE policy applied with documented trade-offs
  - Research phase resolved all clarifications
- **Design Review**: All decisions traceable to spec requirements

**Post-Design Gate Result**: ✅ ALL CHECKS PASS - Ready for Phase 2 (Task Generation)

---

## Implementation Readiness

**Phase 0 (Research)**: ✅ Complete
- research.md generated with UI patterns, data merging strategy, command mapping

**Phase 1 (Design)**: ✅ Complete
- data-model.md generated with TypeScript types and transformation logic
- contracts/conversation-api.yaml generated with OpenAPI spec
- contracts/component-contracts.md generated with React component hierarchy
- quickstart.md generated with implementation guide
- CLAUDE.md updated with technology additions

**Phase 2 (Tasks)**: ⏭️ Next Step
- Run `/speckit.tasks` command to generate tasks.md
- Tasks will reference design artifacts for implementation details

**Phase 3 (Implementation)**: ⏭️ After Tasks
- Run `/speckit.implement` command to execute tasks
