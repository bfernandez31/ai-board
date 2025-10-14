
# Implementation Plan: Replace SSE with Client-Side Polling

**Branch**: `028-519-replace-sse` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-519-replace-sse/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Spec loaded and validated
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ Project Type: web (frontend + backend)
   → ✅ Structure Decision: Next.js App Router with API routes
3. Fill the Constitution Check section
   → ✅ Based on constitution v1.0.0
4. Evaluate Constitution Check section
   → ✅ No violations detected
   → ✅ Update Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   → ✅ No NEEDS CLARIFICATION - all clarified in /clarify session
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → In progress
7. Re-evaluate Constitution Check section
   → After Phase 1 design complete
8. Plan Phase 2 → Describe task generation approach
   → To be completed
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Replace the current Server-Sent Events (SSE) real-time update mechanism with client-side polling to address Vercel's serverless function limitations. The system will poll for job status updates every 2 seconds, stop polling for terminal state jobs, and maintain the same user experience as the current SSE implementation. This change removes SSE infrastructure (EventSource, text/event-stream, broadcast mechanisms) while preserving real-time status update UX through efficient polling.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x
**Storage**: PostgreSQL 14+ (Job status tracking, existing schema)
**Testing**: Playwright E2E tests
**Target Platform**: Vercel serverless (Next.js optimization)
**Project Type**: web (Next.js App Router with backend API routes)
**Performance Goals**: 2-second polling interval, <100ms API response time, minimal server load
**Constraints**: No SSE support on Vercel, maintain existing UX, stop polling terminal jobs
**Scale/Scope**: Single project board, multiple concurrent users, efficient network usage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Before Phase 0)

✅ **I. TypeScript-First Development**
- Strict mode enabled in tsconfig.json
- All new polling logic will use explicit types
- API response schemas will use Zod validation
- No `any` types (Job status types already defined)

✅ **II. Component-Driven Architecture**
- Polling logic in custom React hook (`useJobPolling`)
- Server Components for static board layout
- Client Component for polling (`"use client"` directive)
- API route: `/app/api/projects/[projectId]/jobs/status/route.ts`
- Follows Next.js 15 App Router conventions

✅ **III. Test-Driven Development (NON-NEGOTIABLE)**
- E2E tests required before implementation
- Replace SSE tests with polling equivalent tests
- Test files: `tests/e2e/real-time/polling-*.spec.ts`
- Verify 2-second update interval, terminal state optimization
- Red-Green-Refactor cycle for critical path

✅ **IV. Security-First Design**
- Zod validation for API requests/responses
- Prisma parameterized queries for job status fetching
- NextAuth.js session validation on polling endpoint
- No sensitive data in responses (only job ID, status, timestamps)
- Project authorization (userId validation)

✅ **V. Database Integrity**
- No schema changes required (existing Job model sufficient)
- Read-only queries for job status polling
- No transactions needed (single table reads)
- Existing constraints preserved

**Gate Status**: ✅ PASS - No constitutional violations

## Project Structure

### Documentation (this feature)
```
specs/028-519-replace-sse/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── job-polling-api.yml
│   └── polling-contract.spec.ts
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── jobs/
│               └── status/
│                   └── route.ts          # New: Polling endpoint
├── projects/
│   └── [projectId]/
│       └── board/
│           └── page.tsx                  # Modified: Remove SSEProvider
└── lib/
    └── hooks/
        └── useJobPolling.ts              # New: Polling hook

components/
└── board/
    └── TicketCard.tsx                    # Modified: Use polling hook

tests/
├── e2e/
│   └── real-time/
│       ├── polling-connection.spec.ts    # New: Replaces sse-connection.spec.ts
│       └── polling-job-broadcast.spec.ts # New: Replaces sse-job-broadcast.spec.ts
└── unit/
    └── useJobPolling.test.ts             # New: Hook unit tests
```

**Structure Decision**: Next.js 15 App Router structure with API routes in `app/api`, React components in `components/`, and E2E tests in `tests/e2e/`. Polling logic encapsulated in custom hook for reusability. Follows existing project conventions from CLAUDE.md.

## Phase 0: Outline & Research

**Status**: ✅ Complete (No unknowns - all resolved in /clarify session)

### Decisions from Clarifications

All technical unknowns were resolved in the `/clarify` session (2025-10-14):

1. **Polling Interval**: 2 seconds (aggressive, ~30 requests/min)
   - **Rationale**: Matches user expectation for real-time updates, balances responsiveness vs server load
   - **Alternatives considered**: 5s (too slow for "real-time" feel), 10s (unacceptable delay)

2. **Terminal State Optimization**: Stop polling jobs in COMPLETED/FAILED/CANCELLED states
   - **Rationale**: Reduces server load and network traffic, terminal states never change
   - **Alternatives considered**: Continue polling all jobs (wasteful, unnecessary load)

3. **Error Retry Strategy**: Fixed 2-second interval (no exponential backoff, no retry limits)
   - **Rationale**: Simplicity, matches polling interval, network errors typically transient
   - **Alternatives considered**: Exponential backoff (over-engineered for transient errors), stop after N failures (breaks real-time guarantee)

4. **Polling Scope**: Single request for all project jobs (project-wide aggregation)
   - **Rationale**: Minimizes network overhead, reduces server load, efficient database query
   - **Alternatives considered**: Per-ticket polling (N requests instead of 1, inefficient)

5. **Polling Lifecycle**: Start on mount, stop on unmount OR when all jobs terminal
   - **Rationale**: Automatic cleanup, no tab visibility logic (simplicity), optimal resource usage
   - **Alternatives considered**: Pause on tab blur (complexity), continue polling terminal jobs (wasteful)

### Technology Best Practices

**React Polling Pattern**:
- Use `useEffect` with `setInterval` for periodic polling
- Cleanup interval on unmount (`return () => clearInterval(id)`)
- Track terminal job IDs to exclude from polling filter
- Ref for interval ID to prevent stale closures

**Next.js API Route Pattern** (App Router):
- GET `/api/projects/[projectId]/jobs/status`
- Query params: `?excludeTerminal=true` (client-managed filter)
- Response: `{ jobs: Array<{ id, status, ticketId, updatedAt }> }`
- Zod validation for request/response schemas

**Performance Optimization**:
- Client-side filtering of terminal jobs (no server state)
- Database index on `projectId` + `status` for fast queries
- Conditional polling (stop when no active jobs remain)
- React.memo for TicketCard to prevent unnecessary re-renders

**Output**: research.md with decisions and rationale documented

## Phase 1: Design & Contracts

*Prerequisites: research.md complete ✅*

### 1. Data Model (`data-model.md`)

**Entities** (from feature spec):

- **Job** (existing model, no changes):
  - `id` (Int): Primary key
  - `status` (JobStatus enum): PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  - `command` (String): GitHub Actions command
  - `ticketId` (Int): Foreign key to Ticket
  - `projectId` (Int): Foreign key to Project
  - `createdAt`, `updatedAt`, `completedAt` (DateTime)

- **Polling State** (client-side only, not persisted):
  - `isPolling` (boolean): Whether polling is active
  - `lastPollTime` (number): Timestamp of last successful poll
  - `errorCount` (number): Consecutive error count (informational only)
  - `terminalJobIds` (Set<number>): Job IDs in terminal states (exclude from filter)

**No schema changes required** - existing Job model sufficient.

### 2. API Contracts (`contracts/job-polling-api.yml`)

**Endpoint**: `GET /api/projects/{projectId}/jobs/status`

**Request**:
- Path params: `projectId` (number, required)
- Query params: None (client filters terminal jobs client-side)
- Headers: Cookie (NextAuth.js session, required)

**Response** (200 OK):
```typescript
{
  jobs: Array<{
    id: number;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
    ticketId: number;
    updatedAt: string; // ISO 8601
  }>;
}
```

**Error Responses**:
- 401 Unauthorized: No valid session
- 403 Forbidden: Project not owned by session user
- 404 Not Found: Project does not exist
- 500 Internal Server Error: Database error

**Performance Requirements**:
- Response time: <100ms (p95)
- Query optimization: Index on (projectId, status)
- Pagination: Not required (typical board has <50 jobs)

### 3. Contract Tests (`contracts/polling-contract.spec.ts`)

```typescript
// Test cases (written first, fail initially):
// 1. Returns 401 when no session cookie
// 2. Returns 403 when project belongs to different user
// 3. Returns 404 when project does not exist
// 4. Returns 200 with empty array when no jobs exist
// 5. Returns 200 with job array (all statuses)
// 6. Response schema matches OpenAPI spec
// 7. Response time <100ms (p95)
```

### 4. Integration Test Scenarios (`quickstart.md`)

**Test Scenarios** (from user stories):

1. **User views board with RUNNING job → sees COMPLETED within 2s**
   - Setup: Create ticket with RUNNING job
   - Action: Open board page
   - Assert: Status changes to COMPLETED within 2s

2. **User views board with multiple active jobs → all update**
   - Setup: Create 3 tickets with PENDING/RUNNING jobs
   - Action: Transition jobs to terminal states
   - Assert: All tickets reflect new statuses

3. **Job reaches terminal state → polling stops for that job**
   - Setup: Create ticket with RUNNING job
   - Action: Complete job, observe network requests
   - Assert: No further polls include completed job ID

4. **Network error during poll → retries at 2s interval**
   - Setup: Mock API failure
   - Action: Observe retry behavior
   - Assert: Retry after 2s, no exponential backoff

5. **All jobs terminal → polling stops completely**
   - Setup: Create 2 tickets with RUNNING jobs
   - Action: Complete both jobs
   - Assert: Polling stops (no further requests)

### 5. Update CLAUDE.md (Incremental)

Execute update script to add new technologies:

```bash
.specify/scripts/bash/update-agent-context.sh claude
```

**Changes to add**:
- Recent change: "028-519-replace-sse: Replaced SSE with 2-second client polling"
- No new technologies (uses existing Next.js, React, Prisma stack)

**Output**: data-model.md, contracts/, failing contract tests, quickstart.md, updated CLAUDE.md

## Phase 1 Constitution Re-Check

✅ **No new violations** after Phase 1 design:

- TypeScript types defined for all API contracts (Zod schemas)
- Custom React hook follows React conventions (useEffect cleanup)
- TDD approach: Contract tests written before implementation
- Security: Session validation, userId filtering preserved
- Database: Read-only queries, no schema changes

**Gate Status**: ✅ PASS

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- **Contract tests first** (TDD): polling-contract.spec.ts [P]
- **API implementation**: GET /api/projects/[projectId]/jobs/status/route.ts
- **Hook implementation**: useJobPolling.ts with terminal state tracking
- **Component updates**: Remove SSEProvider, add polling hook
- **E2E tests**: Replace SSE tests with polling equivalents
- **Cleanup**: Delete SSE files (SSEProvider.tsx, /api/sse/route.ts, etc.)

**Ordering Strategy** (TDD + Dependency):
1. **Tests First** (Red):
   - Contract tests for polling endpoint [P]
   - E2E tests for polling scenarios [P]
2. **API Layer** (Green):
   - Implement polling endpoint (make contract tests pass)
3. **Client Layer** (Green):
   - Implement useJobPolling hook
   - Update TicketCard component
   - Remove SSEProvider integration
4. **Cleanup**:
   - Delete SSE files and tests [P]
   - Update remaining tests referencing SSE

**Estimated Output**: 18-22 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, verify 2s polling)

## Complexity Tracking

*No violations to document - all Constitution Check gates passed*

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - All clarifications from /clarify session
- [x] Phase 1: Design complete (/plan command) - Contracts, data model, quickstart documented
- [x] Phase 2: Task planning complete (/plan command - approach described)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (via /clarify session 2025-10-14)
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
