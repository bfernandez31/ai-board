
# Implementation Plan: GitHub Workflow Transition API

**Branch**: `018-add-github-transition` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/b.fernandez/Workspace/ai-board/specs/018-add-github-transition/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ No NEEDS CLARIFICATION - all requirements specified
   → Project Type: Web application (Next.js)
   → Structure Decision: Next.js App Router with API routes
3. Fill the Constitution Check section
   → ✅ TypeScript strict mode, Prisma ORM, Zod validation aligned
4. Evaluate Constitution Check section
   → ✅ No violations detected
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → ✅ All dependencies known, no research needed
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ Generating design artifacts
7. Re-evaluate Constitution Check section
   → ✅ Post-design check passed
8. Plan Phase 2 → Describe task generation approach
   → ✅ Task approach documented
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Add POST `/api/projects/[projectId]/tickets/[id]/transition` endpoint to dispatch GitHub Actions workflows when tickets transition between stages. The API validates stage transitions, creates job records, and uses Octokit to trigger the `speckit.yml` workflow with appropriate command mappings (SPECIFY→specify, PLAN→plan, BUILD→implement). For VERIFY and SHIP stages, only the ticket stage is updated without workflow dispatch.

**Technical Approach**: Build Next.js API route using existing patterns from `/api/projects/[projectId]/tickets/[id]/route.ts`, leverage stage validation from `lib/stage-validation.ts`, integrate Octokit REST API for workflow dispatch, and follow established error handling and optimistic concurrency patterns.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**:
  - Next.js 15 (App Router) - API route framework
  - Prisma 6.x - Database ORM for Job and Ticket models
  - Zod 4.x - Request validation schemas
  - @octokit/rest - GitHub Actions workflow dispatch
**Storage**: PostgreSQL 14+ via Prisma (existing Project, Ticket, Job models)
**Testing**: Playwright - E2E testing with contract validation
**Target Platform**: Vercel serverless functions (Node.js runtime)
**Project Type**: Web application - Next.js full-stack app
**Performance Goals**:
  - API response time <500ms (p95)
  - GitHub Actions dispatch <2s
  - Database query time <100ms
**Constraints**:
  - GitHub API rate limits (5000 requests/hour authenticated)
  - Serverless function timeout 10s (Vercel Hobby) / 60s (Pro)
  - No webhook receiver (out of scope)
  - Sequential stage transitions only (enforced by stage-validation.ts)
**Scale/Scope**:
  - ~100-500 API requests/day
  - ~10-50 workflow dispatches/day
  - Single API route file
  - 3 validation schemas
  - 5 error scenarios

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- ✅ TypeScript 5.6 strict mode configured in tsconfig.json
- ✅ All function parameters explicitly typed
- ✅ Request/response interfaces defined with Zod schemas
- ✅ No `any` types in implementation
- ✅ Octokit types from @octokit/rest package

### II. Component-Driven Architecture ✅
- ✅ API route follows Next.js App Router conventions: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- ✅ Server-side only (no Client Components)
- ✅ Shared utilities in `/lib` (stage-validation.ts, validations/)
- ✅ Existing patterns followed (project/ticket validation, error responses)

### III. Test-Driven Development (NON-NEGOTIABLE) ✅
- ✅ Playwright E2E tests required before implementation
- ✅ Test scenarios defined in Phase 1 (quickstart.md)
- ✅ Contract tests for request/response schemas
- ✅ Tests must fail initially (Red), then pass (Green)
- ✅ Test file: `/tests/018-transition-api.spec.ts`

### IV. Security-First Design ✅
- ✅ Zod validation for all inputs (projectId, ticketId, targetStage)
- ✅ Prisma parameterized queries (no raw SQL)
- ✅ GITHUB_TOKEN in environment variables (never committed)
- ✅ Project ownership validation (403 for cross-project access)
- ✅ No sensitive data in API responses (job logs excluded)
- ✅ Error messages don't expose internal details

### V. Database Integrity ✅
- ✅ Existing Prisma schema (Job, Ticket models already defined)
- ✅ Optimistic concurrency via ticket.version field
- ✅ Atomic updates with version increment
- ✅ Foreign key constraints (Job.ticketId → Ticket.id)
- ✅ No schema changes required (models support all fields)

**Result**: ✅ All constitution principles satisfied. No violations or complexity deviations.

## Project Structure

### Documentation (this feature)
```
specs/018-add-github-transition/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (minimal - dependencies known)
├── data-model.md        # Phase 1 output (Job, Ticket, Stage mappings)
├── quickstart.md        # Phase 1 output (E2E test scenarios)
├── contracts/           # Phase 1 output (OpenAPI spec)
│   ├── transition-api.yaml
│   └── error-responses.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── tickets/
│               └── [id]/
│                   ├── route.ts              # Existing (reference pattern)
│                   ├── branch/
│                   │   └── route.ts          # Existing (reference pattern)
│                   └── transition/
│                       └── route.ts          # NEW - this feature

lib/
├── stage-validation.ts                      # Existing (reuse)
├── validations/
│   └── ticket.ts                            # Existing (extend with TransitionSchema)
└── db/
    ├── projects.ts                          # Existing (reuse getProjectById)
    └── tickets.ts                           # Existing (reference)

tests/
└── 018-transition-api.spec.ts               # NEW - E2E tests
```

**Structure Decision**: Next.js App Router web application. API routes in `/app/api` with dynamic route segments `[projectId]` and `[id]`. New `/transition` route follows established nested pattern. Shared validation logic in `/lib`, existing models unchanged. Playwright tests in `/tests` root.

## Phase 0: Outline & Research

### Research Findings

Since this feature integrates with existing, well-known technologies and follows established patterns, minimal research is required. All technical decisions are predetermined:

**Decision 1: Octokit Integration**
- **Decision**: Use @octokit/rest package v21.x for GitHub Actions workflow dispatch
- **Rationale**: Official GitHub REST API client with TypeScript support, established in Node.js ecosystem
- **Alternatives Considered**:
  - Direct REST API calls via fetch - rejected (no type safety, manual auth handling)
  - GitHub CLI (gh) - rejected (requires shell execution, harder error handling)
- **Best Practices**:
  - Initialize Octokit with personal access token from env
  - Use `octokit.actions.createWorkflowDispatch()` method
  - Handle rate limit errors (403) with exponential backoff pattern

**Decision 2: Stage-to-Command Mapping**
- **Decision**: Use lookup object for stage-to-command mapping
  ```typescript
  const STAGE_COMMAND_MAP: Record<Stage, string | null> = {
    SPECIFY: 'specify',
    PLAN: 'plan',
    BUILD: 'implement',
    VERIFY: null,
    SHIP: null,
    INBOX: null
  }
  ```
- **Rationale**: Clear, maintainable, type-safe mapping with null for non-automated stages
- **Alternatives Considered**:
  - Switch statement - rejected (verbose, error-prone)
  - String manipulation - rejected (fragile, no type safety)

**Decision 3: Branch Naming Convention**
- **Decision**: Generate branch as `feature/ticket-<id>` for SPECIFY stage only
- **Rationale**: Matches spec-kit workflow expectations, ticket ID provides traceability
- **Alternatives Considered**:
  - User-provided branch names - rejected (out of scope)
  - UUID-based branches - rejected (less human-readable)

**Decision 4: Error Handling Strategy**
- **Decision**: Match existing route error patterns (400/403/404/409/500)
- **Rationale**: Consistency with codebase, clear HTTP semantics
- **Best Practices**:
  - 400: Validation errors with Zod issue details
  - 403: Cross-project access attempts
  - 404: Missing project or ticket
  - 409: Version conflicts (optimistic concurrency)
  - 500: Database/Octokit errors with logs

**Output**: Consolidated in `research.md` below

## Phase 1: Design & Contracts

### Data Model

The feature leverages existing Prisma models without schema changes:

**Job Model** (existing):
```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)        // "specify", "plan", "implement"
  status      JobStatus @default(PENDING)       // PENDING, RUNNING, COMPLETED, FAILED
  branch      String?   @db.VarChar(200)        // Populated by workflow callback (nullable)
  commitSha   String?   @db.VarChar(40)         // Populated by workflow callback (nullable)
  logs        String?   @db.Text                // Populated by workflow callback (nullable)
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  ticket      Ticket    @relation(...)
}
```

**Ticket Model** (existing):
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  stage       Stage    @default(INBOX)          // INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP
  branch      String?  @db.VarChar(200)         // Updated for SPECIFY stage only
  version     Int      @default(1)              // Optimistic concurrency control
  projectId   Int
  project     Project  @relation(...)
  jobs        Job[]
}
```

**Project Model** (existing):
```prisma
model Project {
  id          Int      @id @default(autoincrement())
  githubOwner String   @db.VarChar(100)         // GitHub repository owner
  githubRepo  String   @db.VarChar(100)         // GitHub repository name
  tickets     Ticket[]
}
```

**Stage Enum** (existing in lib/stage-validation.ts):
```typescript
enum Stage {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP'
}
```

**State Transitions**:
- INBOX → SPECIFY: Create job (command="specify"), generate branch, dispatch workflow
- SPECIFY → PLAN: Create job (command="plan"), use existing branch, dispatch workflow
- PLAN → BUILD: Create job (command="implement"), use existing branch, dispatch workflow
- BUILD → VERIFY: Update stage only (no job, no dispatch)
- VERIFY → SHIP: Update stage only (no job, no dispatch)

**Validation Rules**:
- projectId: Positive integer, project must exist
- ticketId: Positive integer, ticket must exist and belong to projectId
- targetStage: Valid Stage enum value, must be next sequential stage
- ticket.version: Must match current database version (optimistic concurrency)

### API Contracts

**Endpoint**: `POST /api/projects/[projectId]/tickets/[id]/transition`

**Request Schema** (Zod):
```typescript
const TransitionRequestSchema = z.object({
  targetStage: z.nativeEnum(Stage)
});
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "jobId": 123,
  "message": "Workflow dispatched successfully"
}
```

**Alternative Success Response** (200 OK - non-automated stages):
```json
{
  "success": true,
  "message": "Stage updated (no workflow for VERIFY/SHIP)"
}
```

**Error Responses**:

400 Bad Request - Invalid Input:
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "issues": [/* Zod validation errors */]
}
```

400 Bad Request - Invalid Transition:
```json
{
  "error": "Invalid stage transition",
  "message": "Cannot transition from BUILD to INBOX"
}
```

403 Forbidden - Cross-Project Access:
```json
{
  "error": "Forbidden",
  "code": "FORBIDDEN"
}
```

404 Not Found - Missing Resource:
```json
{
  "error": "Project not found",
  "code": "PROJECT_NOT_FOUND"
}
```

409 Conflict - Version Mismatch:
```json
{
  "error": "Conflict: Ticket was modified by another user",
  "currentVersion": 5
}
```

500 Internal Server Error - GitHub/Database Error:
```json
{
  "error": "GitHub workflow dispatch failed",
  "message": "Rate limit exceeded",
  "code": "GITHUB_ERROR"
}
```

### Contract Tests

Tests defined in Phase 1 quickstart.md and implemented in `/tests/018-transition-api.spec.ts`:

1. **Contract Test: Valid SPECIFY Transition**
   - Request: POST with `{targetStage: "SPECIFY"}`
   - Assert: 200 response, jobId present, job.command="specify", ticket.branch populated

2. **Contract Test: Valid PLAN Transition**
   - Request: POST with `{targetStage: "PLAN"}`
   - Assert: 200 response, jobId present, job.command="plan", existing branch used

3. **Contract Test: VERIFY Stage (No Workflow)**
   - Request: POST with `{targetStage: "VERIFY"}`
   - Assert: 200 response, no jobId, message indicates no workflow

4. **Contract Test: Invalid Transition**
   - Request: POST from INBOX to BUILD (skipping SPECIFY)
   - Assert: 400 response with error message

5. **Contract Test: Cross-Project Access**
   - Request: POST to ticket in different project
   - Assert: 403 Forbidden response

6. **Contract Test: Missing Project**
   - Request: POST with non-existent projectId
   - Assert: 404 Not Found

7. **Contract Test: Octokit Error Handling**
   - Simulate: GitHub API 403 (rate limit)
   - Assert: 500 response with error details logged

### Quickstart Test Scenarios

See `quickstart.md` generated below for full E2E test scenarios.

### Agent File Update

Update `/Users/b.fernandez/Workspace/ai-board/CLAUDE.md` via script:
- Add technology: @octokit/rest (GitHub Actions API)
- Add command: `npm install @octokit/rest`
- Add recent change: "018-add-github-transition: Added @octokit/rest for GitHub Actions workflow dispatch"

**Output**: data-model.md, contracts/transition-api.yaml, tests/018-transition-api.spec.ts (failing), quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base template
2. Generate tasks from Phase 1 artifacts:
   - **Contract Tests** (from contracts/): 7 test scenarios → 7 test tasks [P]
   - **Data Model** (from data-model.md): No schema changes, validate existing models → 1 validation task
   - **API Route** (from contracts/): Main transition endpoint → 1 implementation task
   - **Validation Logic** (from contracts/): Request schema, stage validation → 2 implementation tasks [P]
   - **Octokit Integration** (from contracts/): Workflow dispatch, error handling → 2 implementation tasks
   - **E2E Tests** (from quickstart.md): 7 acceptance scenarios → 1 comprehensive E2E test file

**Task Ordering Strategy**:
1. **Setup Phase** (dependency installation):
   - Task 1: Install @octokit/rest package [P]
   - Task 2: Add GITHUB_TOKEN to .env.example [P]
2. **TDD Phase** (write failing tests first):
   - Task 3: Write contract test stubs (7 scenarios) [P]
   - Task 4: Write E2E test file structure [P]
3. **Implementation Phase** (make tests pass):
   - Task 5: Create TransitionRequestSchema in lib/validations/ticket.ts
   - Task 6: Implement stage-to-command mapping logic
   - Task 7: Create API route file with project/ticket validation
   - Task 8: Implement Octokit workflow dispatch
   - Task 9: Add SPECIFY stage branch generation logic
   - Task 10: Add error handling for GitHub API errors
   - Task 11: Implement optimistic concurrency update
4. **Validation Phase**:
   - Task 12: Run contract tests, verify all pass
   - Task 13: Run E2E tests, verify all acceptance scenarios pass
   - Task 14: Manual testing with real GitHub repository
   - Task 15: Update CLAUDE.md via script

**Dependency Ordering**:
- Tests (3-4) are independent [P]
- Schema (5) before route implementation (7-11)
- Route validation (7) before Octokit integration (8-10)
- All implementation (5-11) before validation (12-14)

**Estimated Output**: 15 numbered, dependency-ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md with 15 tasks)
**Phase 4**: Implementation (execute tasks 1-15 following TDD and constitutional principles)
**Phase 5**: Validation (contract tests pass, E2E tests pass, manual GitHub dispatch verification)

## Complexity Tracking
*No violations detected - table intentionally left empty*

No constitutional violations or complexity deviations identified. Feature follows established patterns, uses existing models, and integrates standard dependencies (@octokit/rest).

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - Octokit integration patterns identified
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md ready
- [x] Phase 2: Task planning complete (/plan command - 15-task approach documented)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS - All 5 principles satisfied
- [x] Post-Design Constitution Check: PASS - No new violations introduced
- [x] All NEEDS CLARIFICATION resolved - None present in specification
- [x] Complexity deviations documented - None required

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
