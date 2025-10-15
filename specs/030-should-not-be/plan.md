# Implementation Plan: Job Completion Validation for Stage Transitions

**Branch**: `030-should-not-be` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/030-should-not-be/spec.md`

## Summary

Add validation logic to the ticket transition API endpoint to prevent stage transitions when the most recent job for the current ticket has not completed successfully. This ensures workflow integrity by blocking transitions from SPECIFY → PLAN, PLAN → BUILD, and BUILD → VERIFY when jobs are PENDING, RUNNING, FAILED, or CANCELLED. Manual stages (VERIFY → SHIP) and initial transitions (INBOX → SPECIFY) remain unrestricted.

**Technical Approach**: Integrate job status validation into the existing `handleTicketTransition()` function in `lib/workflows/transition.ts` by querying the most recent job for the current ticket (ordered by `startedAt DESC`) and checking its status before proceeding with workflow dispatch.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 15 (App Router), Prisma 6.x, Zod 4.x, @octokit/rest 22.0
**Storage**: PostgreSQL 14+ (existing Job, Ticket tables with indexed queries)
**Testing**: Playwright (E2E tests in `/tests/api/ticket-transition.spec.ts`)
**Target Platform**: Vercel serverless functions (Next.js API Routes)
**Project Type**: Web application (Next.js fullstack with App Router)
**Performance Goals**: <50ms job validation query, <200ms total API response time
**Constraints**: Serverless execution limits (10s timeout), PostgreSQL read-committed isolation
**Scale/Scope**: ~15 functional requirements, 4 user stories, 1 API endpoint modification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ **Principle I: TypeScript-First Development**
- **Compliance**: All job validation logic will use strict TypeScript with explicit types
- **Evidence**: Existing codebase uses `TransitionResult`, `TicketWithProject` interfaces; validation function will follow same pattern

### ✅ **Principle II: Component-Driven Architecture**
- **Compliance**: Changes isolated to server-side API logic, no UI component changes
- **Evidence**: Modification confined to `lib/workflows/transition.ts` and API route error handling

### ✅ **Principle III: Test-Driven Development (CRITICAL)**
- **Compliance**: **Existing test file found**: `/tests/api/ticket-transition.spec.ts` (10 test scenarios)
- **Action Required**: **UPDATE existing tests** to add job completion validation scenarios
- **Search Results**: Confirmed via Grep - existing test file covers transition API with 483 lines
- **Test Strategy**:
  1. Add new test scenarios for blocked transitions (PENDING/RUNNING/FAILED/CANCELLED jobs)
  2. Update existing tests that may break due to new validation (e.g., concurrent transition tests)
  3. Add test scenarios for multiple jobs (retry workflow)
  4. Keep existing test structure and helper functions (`transitionThrough`, `setupTestData`)

### ✅ **Principle IV: Security-First Design**
- **Compliance**: No new user inputs, existing Zod validation sufficient
- **Evidence**: Job queries use Prisma parameterized queries; authorization already handled by `verifyProjectOwnership()`

### ✅ **Principle V: Database Integrity**
- **Compliance**: No schema changes required (existing Job.status, Job.startedAt, Job.ticketId fields)
- **Evidence**: Existing indexes support efficient queries (`@@index([ticketId, status, startedAt])`)

### ✅ **Principle VI: Specification Clarification Guardrails**
- **Compliance**: CONSERVATIVE policy applied with documented trade-offs
- **Evidence**: Auto-Resolved Decisions section in spec.md captures 4 decisions with confidence scores

**GATE RESULT**: ✅ **PASS** - All principles satisfied, no violations requiring justification

## Project Structure

### Documentation (this feature)

```
specs/030-should-not-be/
├── spec.md             # ✅ Complete (feature specification)
├── plan.md             # ✅ This file (/speckit.plan command output)
├── research.md         # ⏳ Phase 0 output (next step)
├── data-model.md       # ⏳ Phase 1 output
├── quickstart.md       # ⏳ Phase 1 output
├── contracts/          # ⏳ Phase 1 output
│   └── job-validation-error.yaml
├── checklists/
│   └── requirements.md # ✅ Complete (spec validation checklist)
└── tasks.md            # ⏳ Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Note**: This is a Next.js 15 App Router web application with backend API routes.

```
app/
├── api/
│   └── projects/[projectId]/tickets/[id]/
│       └── transition/
│           └── route.ts                    # [MODIFY] Add job validation before transition
│
lib/
├── workflows/
│   └── transition.ts                       # [MODIFY] Add validateJobCompletion() function
├── validations/
│   └── ticket.ts                          # [EXISTING] Zod schemas (no changes)
└── stage-validation.ts                    # [EXISTING] Sequential validation (no changes)

prisma/
└── schema.prisma                          # [NO CHANGES] Existing Job/Ticket models sufficient

tests/
├── api/
│   └── ticket-transition.spec.ts          # [UPDATE] Add job completion validation tests
└── helpers/
    ├── db-setup.ts                        # [EXISTING] May need helper for job creation
    └── transition-helpers.ts              # [EXISTING] Reuse transitionThrough() helper
```

**Structure Decision**: Web application structure (Option 2) - Next.js App Router with `/app/api` routes for backend logic and `/lib` for shared business logic. Testing follows existing `/tests/api` convention with Playwright E2E tests.

## Complexity Tracking

*No constitution violations - this section is empty.*

## Phase 0: Research Tasks (NEEDS CLARIFICATION Resolution)

### Task 1: Job Query Performance Patterns
**Unknown**: Optimal Prisma query for most recent job with status check
**Research Goal**: Determine best practice for "get latest job by ticketId" query
**Output**: Query pattern with proper indexing validation

### Task 2: Error Response Structure for Job Validation
**Unknown**: Standard error code and message format for blocked transitions
**Research Goal**: Review existing error response patterns in codebase
**Output**: Consistent error response schema matching existing API conventions

### Task 3: Test Update Strategy
**Unknown**: Which existing tests will break and need updates
**Research Goal**: Analyze existing test file to identify affected test scenarios
**Output**: List of test cases requiring updates with specific modifications

## Phase 1: Design Artifacts (Pending Phase 0 Completion)

### Deliverables
1. **data-model.md**: Job validation logic flow diagram
2. **contracts/job-validation-error.yaml**: Error response schema
3. **quickstart.md**: Developer guide for testing job validation
4. **CLAUDE.md update**: Add job completion validation to development guidelines

## Post-Design Constitution Re-Evaluation

*Re-checked after Phase 1 design completion*

### ✅ **Principle I: TypeScript-First Development**
- **Post-Design Compliance**: All validation logic uses explicit TypeScript types
- **Evidence**:
  - `JobValidationResult` interface defined with explicit properties
  - `validateJobCompletion()` function has fully typed parameters and return type
  - Enum types (`Stage`, `JobStatus`) used throughout validation logic
- **Status**: ✅ **PASS** - No violations, strict mode maintained

### ✅ **Principle II: Component-Driven Architecture**
- **Post-Design Compliance**: Changes remain isolated to server-side logic
- **Evidence**:
  - Modified files: `lib/workflows/transition.ts` (validation logic)
  - Modified files: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` (error handling)
  - No UI component changes required
- **Status**: ✅ **PASS** - Architecture boundaries respected

### ✅ **Principle III: Test-Driven Development**
- **Post-Design Compliance**: Comprehensive test strategy documented and ready
- **Evidence**:
  - Test file identified: `/tests/api/ticket-transition.spec.ts` (existing, requires updates)
  - Test scenarios defined: 7 new scenarios + 3 updated scenarios
  - Helper function updates: `transitionThrough()` enhancement documented
  - Test execution strategy: Phase-based approach (helpers → new tests → updates)
- **Status**: ✅ **PASS** - TDD workflow preserved, existing tests reused

### ✅ **Principle IV: Security-First Design**
- **Post-Design Compliance**: No new attack surface introduced
- **Evidence**:
  - Validation uses Prisma parameterized queries (SQL injection safe)
  - No new user inputs (existing Zod schemas sufficient)
  - Authorization already handled by `verifyProjectOwnership()`
  - Job query filters by `ticketId` (prevents unauthorized data access)
- **Status**: ✅ **PASS** - Security model unchanged

### ✅ **Principle V: Database Integrity**
- **Post-Design Compliance**: Existing schema sufficient, no migrations needed
- **Evidence**:
  - Uses existing `Job` model with composite index `[ticketId, status, startedAt]`
  - Query leverages existing indexes for <10ms performance
  - No new nullable fields or schema changes
  - Maintains referential integrity (Job.ticketId FK constraint)
- **Status**: ✅ **PASS** - Database integrity preserved

### ✅ **Principle VI: Specification Clarification Guardrails**
- **Post-Design Compliance**: CONSERVATIVE policy decisions upheld in design
- **Evidence**:
  - Failed/cancelled jobs block transitions (CONSERVATIVE decision from spec)
  - Most recent job validation (CONSERVATIVE decision from spec)
  - Read-committed isolation (CONSERVATIVE decision from spec)
  - All auto-resolved decisions from spec reflected in data-model.md
- **Status**: ✅ **PASS** - Policy compliance verified

**FINAL GATE RESULT**: ✅ **PASS** - All principles satisfied post-design. No implementation blockers.

## Artifacts Generated

### Phase 0: Research (Complete)
- ✅ `research.md` - Implementation decisions with alternatives considered
  - Job query performance patterns (Prisma `findFirst()` with composite index)
  - Error response structure (`JOB_NOT_COMPLETED` error code)
  - Test update strategy (7 new + 3 updated scenarios)

### Phase 1: Design & Contracts (Complete)
- ✅ `data-model.md` - Validation logic flow and database interactions
  - High-level workflow diagram
  - Detailed validation logic with TypeScript signatures
  - Query performance analysis
  - State transition diagrams

- ✅ `contracts/job-validation-error.yaml` - OpenAPI error response specification
  - Complete error schema with examples
  - All 4 job statuses (PENDING, RUNNING, FAILED, CANCELLED)
  - Validation rules and guidelines
  - HTTP status code mapping

- ✅ `quickstart.md` - Developer implementation guide
  - Step-by-step implementation instructions
  - Complete code examples with TypeScript
  - Testing guide with test scenarios
  - Manual testing procedures
  - Troubleshooting section

- ✅ `CLAUDE.md` - Agent context updated
  - Technology stack confirmed
  - Dependencies documented
  - Project structure validated

## Next Steps

**Phase 2**: Execute `/speckit.tasks` command to generate implementation tasks.

The planning phase is complete. All design artifacts are ready for task breakdown and implementation.
