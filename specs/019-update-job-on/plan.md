# Implementation Plan: Update Job Status on GitHub Actions Completion

**Branch**: `019-update-job-on` | **Date**: 2025-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-update-job-on/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ All clarifications resolved in spec
   → Project Type: web (frontend+backend)
   → Structure Decision: Next.js App Router with API routes
3. Fill the Constitution Check section
   → ✅ Evaluating against AI Board Constitution v1.0.0
4. Evaluate Constitution Check section
   → ✅ No violations detected
   → Update Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   → IN PROGRESS
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → PENDING
7. Re-evaluate Constitution Check section
   → PENDING
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → PENDING
9. STOP - Ready for /tasks command
```

## Summary
This feature enables automatic Job status updates when GitHub Actions workflows complete executing spec-kit commands. The system will add a new CANCELLED status to the JobStatus enum, implement idempotent state transitions, and provide an API endpoint for workflows to update Job records using Job ID for correlation. This improves workflow visibility by eliminating manual status checks and ensures Job records accurately reflect workflow execution outcomes.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), Prisma 6.x, Zod 4.x, PostgreSQL 14+
**Storage**: PostgreSQL via Prisma ORM (existing Job model to be extended)
**Testing**: Playwright for E2E tests, existing test infrastructure
**Target Platform**: Vercel (Next.js hosting), GitHub Actions for workflows
**Project Type**: web (Next.js frontend + API routes backend)
**Performance Goals**: <200ms API response time for job updates, handle concurrent workflow completions
**Constraints**: Idempotent updates required, no retry mechanism for failed updates, minimal data capture (status + timestamp only)
**Scale/Scope**: Support multiple concurrent workflow executions, handle workflow cancellations and failures

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- [x] TypeScript strict mode enabled in project
- [x] All new code will use explicit type annotations
- [x] API request/response types defined with Zod schemas
- [x] Database model changes via Prisma schema with generated types
- **Status**: ✅ PASS - No violations

### II. Component-Driven Architecture
- [x] API routes follow Next.js 15 App Router conventions (`/app/api/...`)
- [x] No UI components required (backend-only feature)
- [x] Shared utilities in `/lib` for reusable validation logic
- **Status**: ✅ PASS - Follows App Router patterns

### III. Test-Driven Development (NON-NEGOTIABLE)
- [x] E2E tests required for critical workflow completion scenarios
- [x] Tests will be written before implementation (Red-Green-Refactor)
- [x] Test coverage for state transitions and idempotency
- **Status**: ✅ PASS - TDD workflow planned

### IV. Security-First Design
- [x] Input validation with Zod schemas for all API requests
- [x] Prisma parameterized queries (no raw SQL)
- [x] No sensitive data exposure in responses
- [x] Job ID authentication to prevent unauthorized updates
- **Status**: ✅ PASS - Security requirements met

### V. Database Integrity
- [x] Schema changes via `prisma migrate dev`
- [x] Transactions not required (single-record atomic updates)
- [x] Database constraints enforced at schema level
- [x] State transition validation at application level
- **Status**: ✅ PASS - Migration-based workflow

**Overall**: ✅ NO VIOLATIONS - Proceed with implementation

## Project Structure

### Documentation (this feature)
```
specs/019-update-job-on/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── job-update-api.yaml  # OpenAPI spec for Job update endpoint
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
app/
├── api/
│   └── jobs/
│       └── [id]/
│           └── status/
│               └── route.ts        # NEW: Job status update endpoint
├── lib/
│   ├── job-state-machine.ts       # NEW: State transition validation
│   └── job-update-validator.ts     # NEW: Zod schemas for job updates
└── prisma/
    └── schema.prisma               # MODIFIED: Add CANCELLED to JobStatus enum

.github/
└── workflows/
    └── speckit.yml                  # MODIFIED: Add job_id input, status update steps

tests/
└── job-status-update.spec.ts       # NEW: E2E tests for workflow completion
```

**Structure Decision**: Next.js App Router with API routes backend. New API endpoint at `/api/jobs/[id]/status` for workflow-initiated updates. State machine logic extracted to `/lib` for reusability and testability. GitHub workflow modified to pass job_id and call status update endpoint.

## Phase 0: Outline & Research
**Status**: ✅ COMPLETE

### Research Topics Addressed
1. **GitHub Actions workflow conclusion states**: success, failure, cancelled, skipped, timed_out
2. **Next.js API route error handling patterns**: try-catch with structured responses
3. **Prisma optimistic concurrency**: Not needed (single atomic update with WHERE clause)
4. **State machine patterns in TypeScript**: Enum-based transitions with validation function
5. **Idempotency in REST APIs**: HTTP 200 for no-op transitions, validation before update

### Key Decisions
- **Correlation Mechanism**: Job ID passed as workflow input (clarified in spec)
- **State Transitions**: Enum-based validation with explicit allowed transitions
- **Error Handling**: Log-only approach (no retry) per clarification
- **Data Capture**: Minimal (status + timestamp) per clarification
- **API Design**: REST endpoint `/api/jobs/[id]/status` with PATCH method

All technical unknowns resolved. Ready for Phase 1 design.

## Phase 1: Design & Contracts
**Status**: ✅ COMPLETE

### Artifacts Generated
1. **data-model.md**: JobStatus enum extension, state transition rules, Job model impact
2. **contracts/job-update-api.yaml**: OpenAPI 3.0 spec for PATCH `/api/jobs/[id]/status`
3. **quickstart.md**: Manual testing guide for workflow completion scenarios
4. **CLAUDE.md**: Updated with new API route, state machine patterns, testing requirements

### Design Overview

**Database Changes** (Prisma schema):
```prisma
enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED  // NEW
}

// Job model unchanged (already has status, completedAt fields)
```

**API Contract**:
- **Endpoint**: `PATCH /api/jobs/[id]/status`
- **Request**: `{ status: "COMPLETED" | "FAILED" | "CANCELLED" }`
- **Response**: `{ id: number, status: JobStatus, completedAt: DateTime }`
- **Errors**: 400 (invalid transition), 404 (job not found), 500 (server error)

**State Machine**:
- PENDING → RUNNING
- RUNNING → COMPLETED | FAILED | CANCELLED
- Terminal states (COMPLETED, FAILED, CANCELLED) cannot transition

**GitHub Workflow Changes**:
- Add `job_id` as workflow input
- Add status update step using `curl` to call API endpoint
- Handle workflow cancellation with status update

### Constitution Re-Check
- [x] TypeScript types for status transitions
- [x] Zod validation for API requests
- [x] Prisma migration for enum change
- [x] E2E tests planned for state transitions
- **Status**: ✅ PASS - No new violations

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. **Database Tasks**:
   - Add CANCELLED to JobStatus enum in Prisma schema
   - Generate and apply migration
   - Verify migration with `prisma studio`

2. **API Tasks**:
   - Create Zod schema for status update request
   - Implement state machine validation function
   - Create PATCH `/api/jobs/[id]/status` route
   - Add error handling and logging

3. **GitHub Workflow Tasks**:
   - Add `job_id` input parameter to workflow
   - Add status update step after command execution
   - Handle workflow cancellation with status update
   - Test workflow with manual trigger

4. **Testing Tasks** (TDD - tests first):
   - Write E2E test for successful workflow completion
   - Write E2E test for workflow failure
   - Write E2E test for workflow cancellation
   - Write test for idempotent updates
   - Write test for invalid state transitions
   - Implement features to make tests pass

**Ordering Strategy**:
1. Database migration (prerequisite for all code)
2. State machine validation (pure function, testable in isolation)
3. E2E tests (Red phase - must fail initially)
4. API endpoint implementation (Green phase - make tests pass)
5. Workflow integration (connects all pieces)
6. Manual quickstart verification

**Task Dependencies**:
- Database migration → API implementation
- State machine → API endpoint
- E2E tests → Feature implementation
- API endpoint → Workflow integration

**Estimated Output**: 18-20 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations requiring justification*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
