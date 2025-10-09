# Tasks: GitHub Workflow Transition API

**Input**: Design documents from `/Users/b.fernandez/Workspace/ai-board/specs/018-add-github-transition/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/transition-api.yaml, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Loaded: TypeScript 5.6, Next.js 15, Prisma 6.x, @octokit/rest
2. Load optional design documents:
   → ✅ data-model.md: No schema changes, existing models validated
   → ✅ contracts/: POST /api/projects/[projectId]/tickets/[id]/transition
   → ✅ quickstart.md: 10 E2E test scenarios extracted
3. Generate tasks by category:
   → Setup: Install @octokit/rest, configure GITHUB_TOKEN
   → Tests: 10 Playwright E2E tests (TDD)
   → Core: API route, validation schemas, Octokit integration
   → Integration: Stage-to-command mapping, branch generation
   → Polish: Test execution, documentation
4. Apply task rules:
   → Setup tasks [P] (independent)
   → Test implementation [P] (different test scenarios)
   → API route implementation (sequential - same file)
   → Validation before execution
5. Number tasks sequentially (T001-T018)
6. Generate dependency graph (tests → implementation)
7. Create parallel execution examples
8. Validate task completeness:
   → ✅ All 10 test scenarios have test tasks
   → ✅ All implementation steps covered
   → ✅ TDD order enforced (tests before implementation)
9. Return: SUCCESS (18 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **API Routes**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- **Validation**: `lib/validations/ticket.ts`
- **Tests**: `tests/018-transition-api.spec.ts`
- **Helpers**: `tests/helpers/db-setup.ts`, `tests/helpers/transition-helpers.ts`

---

## Phase 3.1: Setup

- [ ] **T001** [P] Install @octokit/rest package
  ```bash
  npm install @octokit/rest
  ```
  **Files**: `package.json`, `package-lock.json`
  **Validation**: Verify @octokit/rest appears in dependencies

- [ ] **T002** [P] Add GITHUB_TOKEN to .env.example with documentation
  ```bash
  # Add the following line to .env.example:
  # GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE  # Classic token with repo + workflow scopes
  ```
  **Files**: `.env.example`
  **Validation**: Verify GITHUB_TOKEN entry exists with clear instructions

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

All tests in file: `tests/018-transition-api.spec.ts`

- [ ] **T003** [P] Write test helper functions in `tests/helpers/db-setup.ts`
  - `setupTestData()` - Creates test project and ticket in INBOX stage
  - Ensure helpers follow existing patterns from `tests/helpers/db-cleanup.ts`
  **Files**: `tests/helpers/db-setup.ts` (NEW)
  **Validation**: Functions compile without errors

- [ ] **T004** [P] Write test helper functions in `tests/helpers/transition-helpers.ts`
  - `transitionThrough(request, ticketId, stages[])` - Transitions ticket through multiple stages
  - `cleanupTestData()` - Removes [e2e] prefixed test data
  **Files**: `tests/helpers/transition-helpers.ts` (NEW)
  **Validation**: Functions compile without errors

- [ ] **T005** Write E2E test: Valid SPECIFY transition (Scenario 1)
  - Test: Ticket transitions from INBOX → SPECIFY
  - Assert: 200 OK, jobId present, job.command="specify", ticket.branch="feature/ticket-{id}", version incremented
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS (endpoint doesn't exist yet)

- [ ] **T006** Write E2E test: Valid PLAN transition (Scenario 2)
  - Test: Ticket transitions from SPECIFY → PLAN
  - Assert: 200 OK, jobId present, job.command="plan", branch unchanged
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS

- [ ] **T007** Write E2E test: Valid BUILD transition (Scenario 3)
  - Test: Ticket transitions from PLAN → BUILD
  - Assert: 200 OK, jobId present, job.command="implement"
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS

- [ ] **T008** Write E2E test: VERIFY stage without workflow (Scenario 4)
  - Test: Ticket transitions from BUILD → VERIFY
  - Assert: 200 OK, no jobId, message indicates no workflow, no new jobs created
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS

- [ ] **T009** Write E2E test: Invalid transition rejection (Scenario 5)
  - Test: Ticket attempts transition from INBOX → BUILD (skipping SPECIFY/PLAN)
  - Assert: 400 Bad Request, error message "Invalid stage transition", no changes to ticket
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS

- [ ] **T010** Write E2E test: Cross-project access forbidden (Scenario 6)
  - Test: Ticket in project 1 accessed via project 2 URL
  - Assert: 403 Forbidden, error "Forbidden", no changes to ticket
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS

- [ ] **T011** Write E2E test: Missing project (Scenario 7)
  - Test: POST to non-existent projectId
  - Assert: 404 Not Found, error "Project not found", code "PROJECT_NOT_FOUND"
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS

- [ ] **T012** Write E2E test: Missing ticket (Scenario 8)
  - Test: POST to non-existent ticketId
  - Assert: 404 Not Found, error "Ticket not found"
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS

- [ ] **T013** Write E2E test: Optimistic concurrency conflict (Scenario 9)
  - Test: Concurrent transition attempts
  - Assert: One succeeds (200), one fails (409 Conflict), error includes currentVersion
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS

- [ ] **T014** Write E2E test: GitHub API rate limit error (Scenario 10)
  - Test: GitHub API rate limit exceeded (mock Octokit)
  - Assert: 500 Internal Server Error, error contains "GitHub", code "GITHUB_ERROR", transaction rolled back
  **Files**: `tests/018-transition-api.spec.ts`
  **Validation**: Test compiles and FAILS

**GATE**: Run `npx playwright test tests/018-transition-api.spec.ts` - ALL TESTS MUST FAIL before proceeding to 3.3

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] **T015** Create TransitionRequestSchema in lib/validations/ticket.ts
  - Add Zod schema: `TransitionRequestSchema = z.object({ targetStage: z.nativeEnum(Stage) })`
  - Export schema for use in API route
  - Follow existing pattern from `patchTicketSchema` in same file
  **Files**: `lib/validations/ticket.ts` (EXTEND)
  **Reference**: Lines 1-30 for existing Zod validation patterns
  **Validation**: Schema compiles, exports successfully

- [ ] **T016** Create stage-to-command mapping constant in transition route
  - Create `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  - Add STAGE_COMMAND_MAP constant at top of file:
    ```typescript
    const STAGE_COMMAND_MAP: Record<Stage, string | null> = {
      INBOX: null,
      SPECIFY: 'specify',
      PLAN: 'plan',
      BUILD: 'implement',
      VERIFY: null,
      SHIP: null
    };
    ```
  - Import Stage enum from `@/lib/stage-validation`
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` (NEW)
  **Validation**: File compiles without errors

- [ ] **T017** Implement POST handler with project/ticket validation
  - Add POST function with proper Next.js 15 signature
  - Parse and validate projectId, ticketId from route params
  - Fetch project using `getProjectById(projectId)` from `@/lib/db/projects`
  - Return 404 if project not found
  - Fetch ticket with `prisma.ticket.findFirst({ where: { id: ticketId, projectId }, include: { project: true } })`
  - Return 404 if ticket not found, 403 if ticket belongs to different project
  - Parse request body with TransitionRequestSchema
  - Return 400 if validation fails
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  **Reference**: `app/api/projects/[projectId]/tickets/[id]/route.ts` for validation patterns
  **Validation**: Tests T011, T012 pass (404 errors)

- [ ] **T018** Implement stage transition validation
  - Import `isValidTransition` from `@/lib/stage-validation`
  - Validate transition with `isValidTransition(currentTicket.stage, targetStage)`
  - Return 400 with error message if invalid transition
  - Error message format: `"Cannot transition from {currentStage} to {targetStage}. Tickets must progress sequentially through stages."`
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  **Reference**: `lib/stage-validation.ts:68-71` for isValidTransition usage
  **Validation**: Test T009 passes (invalid transition rejected)

- [ ] **T019** Implement VERIFY/SHIP stage updates (no workflow)
  - Check if `STAGE_COMMAND_MAP[targetStage]` is null
  - If null, update ticket stage directly:
    ```typescript
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { stage: targetStage, version: { increment: 1 } }
    });
    ```
  - Return `{ success: true, message: "Stage updated (no workflow for VERIFY/SHIP)" }`
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  **Validation**: Test T008 passes (VERIFY stage update without job)

- [ ] **T020** Implement Job record creation for automated stages
  - If STAGE_COMMAND_MAP[targetStage] is not null, create Job:
    ```typescript
    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: STAGE_COMMAND_MAP[targetStage],
        status: 'PENDING',
        startedAt: new Date()
      }
    });
    ```
  - Import JobStatus enum from `@prisma/client`
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  **Reference**: `prisma/schema.prisma:62-81` for Job model structure
  **Validation**: Jobs table contains new records after API calls

- [ ] **T021** Implement branch generation for SPECIFY stage
  - Check if `targetStage === Stage.SPECIFY`
  - If true, generate branch name: `const branchName = \`feature/ticket-\${ticketId}\`;`
  - Update ticket.branch field in subsequent database update
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  **Validation**: Test T005 passes (SPECIFY transition creates branch)

- [ ] **T022** Implement Octokit workflow dispatch
  - Import Octokit: `import { Octokit } from '@octokit/rest';`
  - Initialize Octokit with token: `const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });`
  - Call workflow dispatch:
    ```typescript
    await octokit.actions.createWorkflowDispatch({
      owner: ticket.project.githubOwner,
      repo: ticket.project.githubRepo,
      workflow_id: 'speckit.yml',
      ref: 'main',
      inputs: {
        ticket_id: ticketId.toString(),
        command: STAGE_COMMAND_MAP[targetStage],
        branch: ticket.branch || branchName,
        ...(targetStage === Stage.SPECIFY && {
          ticketTitle: ticket.title,
          ticketDescription: ticket.description
        })
      }
    });
    ```
  - Add after job creation, before ticket update
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  **Reference**: `.github/workflows/speckit.yml:6-43` for expected workflow inputs
  **Validation**: Tests T005, T006, T007 pass (workflow dispatch succeeds)

- [ ] **T023** Implement GitHub API error handling
  - Wrap Octokit call in try-catch
  - Handle RequestError from @octokit/request-error:
    - 401: Return 500 with "GitHub authentication failed"
    - 403: Return 500 with "GitHub rate limit exceeded", code "GITHUB_ERROR"
    - 404: Return 500 with "Workflow file not found"
  - Log all errors with context: `console.error('GitHub workflow dispatch failed:', { ticketId, command, error })`
  - If dispatch fails, DO NOT update ticket stage (transaction should roll back)
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  **Validation**: Test T014 passes (GitHub error handling)

- [ ] **T024** Implement optimistic concurrency ticket update
  - Update ticket after successful workflow dispatch:
    ```typescript
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId, version: currentTicket.version },
      data: {
        stage: targetStage,
        version: { increment: 1 },
        ...(branchName && { branch: branchName })
      }
    });
    ```
  - Catch Prisma P2025 error (record not found = version mismatch)
  - Return 409 Conflict with currentVersion if version mismatch
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  **Reference**: `app/api/projects/[projectId]/tickets/[id]/route.ts:249-313` for optimistic concurrency pattern
  **Validation**: Test T013 passes (concurrent transition conflict)

- [ ] **T025** Implement success response and final error handling
  - Return success response:
    ```typescript
    return NextResponse.json({
      success: true,
      ...(job && { jobId: job.id }),
      message: job ? 'Workflow dispatched successfully' : 'Stage updated (no workflow)'
    }, { status: 200 });
    ```
  - Add try-catch around entire handler for 500 errors
  - Ensure `prisma.$disconnect()` in finally block
  **Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  **Validation**: Tests T005-T008 pass (success responses correct)

---

## Phase 3.4: Integration & Validation

- [ ] **T026** Run all E2E tests and verify they pass
  ```bash
  npx playwright test tests/018-transition-api.spec.ts
  ```
  **Expected**: All 10 test scenarios pass (T005-T014)
  **Validation**: 10/10 tests passing, zero failures

- [ ] **T027** Manual testing with real GitHub repository
  - Set GITHUB_TOKEN in .env.local
  - Create test ticket in database
  - POST to transition endpoint
  - Verify GitHub Actions workflow triggered
  - Check job record created
  - Verify ticket stage updated
  **Validation**: Real GitHub workflow runs successfully

- [ ] **T028** Run TypeScript compilation and linting
  ```bash
  npm run build
  npm run lint
  ```
  **Expected**: No TypeScript errors, no linting errors
  **Validation**: Build succeeds, lint passes

---

## Dependencies

```
Setup (T001-T002)
  ↓
Tests (T003-T014) [P - can run in parallel]
  ↓
Implementation Phase:
  T015 (schema)
  ↓
  T016 (mapping constant)
  ↓
  T017 (POST handler with validation) → T018 (stage validation)
  ↓
  T019 (VERIFY/SHIP updates)
  ↓
  T020 (job creation) → T021 (branch generation) → T022 (Octokit dispatch) → T023 (error handling) → T024 (optimistic update) → T025 (response)
  ↓
Integration (T026-T028) [sequential]
```

**Key Constraints**:
- T003-T014 MUST fail before T015-T025 (TDD enforcement)
- T017-T025 modify same file → sequential (no [P])
- T026 requires T015-T025 complete
- T027 requires T026 passing

---

## Parallel Execution Example

**Setup Phase** (run together):
```bash
# Terminal 1
npm install @octokit/rest  # T001

# Terminal 2 (simultaneous)
echo "GITHUB_TOKEN=ghp_..." >> .env.example  # T002
```

**Test Phase** (run together after setup):
```typescript
// Launch T003-T014 test writing in parallel
// Different test scenarios = different sections of same file
// Can be written by different developers or AI agents simultaneously
// Example: One agent writes T005-T008, another writes T009-T014
```

**Implementation Phase** (sequential - same file):
```typescript
// T015-T025 MUST run sequentially
// All modify app/api/projects/[projectId]/tickets/[id]/transition/route.ts
// No parallel execution possible
```

---

## Notes

- **[P] tasks**: Different files, no dependencies (T001-T002 setup, T003-T004 helpers)
- **TDD enforcement**: Tests (T003-T014) MUST be written and failing before implementation (T015-T025)
- **Validation**: Each task includes specific validation criteria
- **File paths**: All paths are absolute from repository root
- **Constitution compliance**: TypeScript strict mode, Prisma ORM, Zod validation enforced throughout

---

## Task Generation Rules Applied

1. **From Contracts** (contracts/transition-api.yaml):
   - 1 endpoint → 11 implementation tasks (T015-T025)
   - POST /api/projects/[projectId]/tickets/[id]/transition broken into logical steps

2. **From Data Model** (data-model.md):
   - No schema changes required → No migration tasks
   - Existing Job, Ticket, Project models validated in T015-T025

3. **From User Stories** (quickstart.md):
   - 10 test scenarios → 10 test tasks (T005-T014) [P]
   - 2 helper files → 2 helper tasks (T003-T004) [P]

4. **Ordering**:
   - Setup (T001-T002) [P]
   - Tests (T003-T014) [P for helpers, sequential for scenarios]
   - Implementation (T015-T025) [sequential - same file]
   - Validation (T026-T028) [sequential]

---

## Validation Checklist

- [x] All contracts have corresponding tests (10 scenarios covered)
- [x] All entities use existing models (no new models needed)
- [x] All tests come before implementation (T003-T014 before T015-T025)
- [x] Parallel tasks truly independent (T001-T002, T003-T004 are independent)
- [x] Each task specifies exact file path (✓)
- [x] No task modifies same file as another [P] task (T017-T025 are sequential)
- [x] TDD order enforced (tests MUST fail before implementation)
- [x] Constitutional principles preserved (TypeScript strict, Prisma, Zod, TDD)

---

**Total Tasks**: 28 tasks (2 setup, 12 tests, 11 implementation, 3 validation)
**Estimated Completion Time**: 6-8 hours for complete implementation
**Next Command**: `/implement` or execute tasks T001-T028 in order

---

**Status**: ✅ Tasks generation complete - Ready for execution
**Phase 3**: Tasks.md created with 28 dependency-ordered tasks
**Phase 4**: Execute tasks T001-T028 following TDD principles
**Phase 5**: Validation via T026-T028
