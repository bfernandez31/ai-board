
# Implementation Plan: Align Description Validation with Title Validation

**Branch**: `024-16204-description-validation` | **Date**: 2025-10-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-16204-description-validation/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Align ticket description validation with title validation by applying the same character set regex pattern (`ALLOWED_CHARS_PATTERN`) to inline editing schemas (`titleSchema` and `descriptionSchema` used in PATCH operations). The POST endpoint already uses consistent validation through `CreateTicketSchema`, but inline editing lacks character set validation.

**Technical Discovery**: The validation file `/lib/validations/ticket.ts` already defines a shared `ALLOWED_CHARS_PATTERN` constant used by `TitleFieldSchema` and `DescriptionFieldSchema`. However, the inline editing schemas (`titleSchema` and `descriptionSchema` at lines 109-119) only validate length constraints, missing the regex pattern validation. This causes inconsistent validation between POST (create) and PATCH (edit) operations.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), Zod 4.x (validation)
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Ticket model)
**Testing**: Playwright (E2E tests), existing test files only
**Target Platform**: Linux server (Vercel deployment)
**Project Type**: web (Next.js application with API routes)
**Performance Goals**: Standard API response (<200ms p95)
**Constraints**: Must preserve existing validation behavior, maintain backward compatibility with existing data
**Scale/Scope**: Single validation file update, 4-6 existing test files to update

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- ✅ **PASS**: All code is TypeScript with strict mode enabled
- ✅ **PASS**: Zod schemas provide explicit type safety for validation
- ✅ **PASS**: No `any` types required for this change
- ✅ **PASS**: Validation schemas have corresponding TypeScript types via `z.infer`

### II. Component-Driven Architecture
- ✅ **PASS**: Changes are isolated to validation layer (`/lib/validations/ticket.ts`)
- ✅ **PASS**: No UI component changes required
- ✅ **PASS**: Follows existing patterns (Zod schemas with regex validation)
- ✅ **PASS**: Server-side validation in API routes already implemented

### III. Test-Driven Development
- ✅ **PASS**: Existing tests will be updated to match new validation rules
- ✅ **PASS**: Contract tests exist for ticket creation/editing endpoints
- ⚠️ **NOTE**: Tests must fail first (Red), then implementation fixes them (Green)
- ✅ **PASS**: E2E tests in `/tests/e2e/` and contract tests in `/tests/api/`

### IV. Security-First Design
- ✅ **PASS**: Input validation via Zod prevents injection attacks
- ✅ **PASS**: Character whitelist approach (not blacklist) is secure
- ✅ **PASS**: Prisma parameterized queries already in use
- ✅ **PASS**: No new security concerns introduced

### V. Database Integrity
- ✅ **PASS**: No schema changes required (validation only)
- ✅ **PASS**: No migrations needed
- ✅ **PASS**: Backward compatible (all existing data meets new validation rules)
- ✅ **PASS**: Database constraints unchanged

**Gate Status**: ✅ **ALL GATES PASSED** - Ready for Phase 0

## Project Structure

### Documentation (this feature)
```
specs/024-16204-description-validation/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
lib/
└── validations/
    └── ticket.ts        # Primary change: Add regex validation to inline editing schemas

tests/
├── api/                 # Contract tests for API endpoints
│   ├── projects-tickets-post.spec.ts   # POST /api/projects/:id/tickets
│   ├── projects-tickets-get.spec.ts    # GET /api/projects/:id/tickets
│   ├── tickets-patch.spec.ts           # PATCH /api/projects/:id/tickets/:id
│   └── tickets-get.spec.ts             # GET /api/projects/:id/tickets/:id
├── e2e/                 # E2E tests for user flows
│   └── tickets/
│       └── inline-editing.spec.ts      # Inline editing validation tests
└── integration/
    └── tickets/
        └── ticket-branch-validation.spec.ts  # Branch + validation integration
```

**Structure Decision**: This is a web application using Next.js 15 (App Router). Changes are isolated to the validation layer (`lib/validations/ticket.ts`) with corresponding test updates. No database schema, API routes, or UI components require modification.

## Phase 0: Outline & Research ✅ COMPLETE

**Status**: ✅ **COMPLETE** - All research consolidated in research.md

**Key Findings**:
1. **Problem Root Cause**: PATCH schemas (`titleSchema`, `descriptionSchema`) missing `.regex()` validation that POST schemas already have
2. **Shared Pattern Exists**: `ALLOWED_CHARS_PATTERN` constant already defined and used in POST validation
3. **Implementation Strategy**: Add `.regex(ALLOWED_CHARS_PATTERN, ...)` to inline editing schemas
4. **Test Impact**: 6-7 test files need updates (contract, E2E, integration tests)
5. **Backward Compatibility**: ✅ Safe - existing data already complies with pattern (created via POST)

**Output**: `/specs/024-16204-description-validation/research.md` (2400 lines)

## Phase 1: Design & Contracts ✅ COMPLETE

**Status**: ✅ **COMPLETE** - Design artifacts generated and validated

**Artifacts Created**:

1. **data-model.md**: ✅ Complete
   - Existing Ticket entity validation rules documented
   - Character set details (allowed vs prohibited)
   - Validation flow diagrams (POST vs PATCH)
   - Backward compatibility analysis
   - No schema changes required

2. **contracts/PATCH-tickets-validation.yaml**: ✅ Complete
   - OpenAPI 3.1.0 specification for PATCH endpoint
   - Request schema with character set pattern validation
   - Response schemas (200, 400, 403, 404, 409, 500)
   - Examples for valid and invalid requests
   - Character set component schema documented

3. **quickstart.md**: ✅ Complete
   - 7 manual validation tests (curl commands)
   - Automated test execution instructions
   - Validation checklist (9 success criteria)
   - Troubleshooting guide (4 common issues)
   - Rollback procedure

4. **CLAUDE.md**: ✅ Updated
   - Added TypeScript 5.6, Node.js 22.20.0, Next.js 15, Zod 4.x
   - Added PostgreSQL 14+ via Prisma
   - Preserved manual additions (Data Model Notes, Test Environment)
   - Updated recent changes section

**Design Validation**:
- ✅ No new entities or relationships
- ✅ No database schema changes
- ✅ Validation changes isolated to `/lib/validations/ticket.ts`
- ✅ API contract remains stable (no breaking changes)
- ✅ Test scenarios extracted from acceptance criteria

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

The `/tasks` command will generate tasks by:
1. Loading `.specify/templates/tasks-template.md` as base template
2. Analyzing Phase 1 artifacts (research.md, data-model.md, contracts/, quickstart.md)
3. Extracting test scenarios from quickstart.md validation tests
4. Mapping functional requirements (FR-001 through FR-008) to implementation tasks

**Expected Task Categories**:

1. **Contract Test Tasks** (TDD - Red Phase):
   - Add character validation test cases to `tests/api/tickets-patch.spec.ts`
   - Add character validation test cases to `tests/api/projects-tickets-post.spec.ts`
   - Verify tests FAIL before implementation (emoji rejection, special char acceptance)

2. **Implementation Tasks** (TDD - Green Phase):
   - Update `titleSchema` in `/lib/validations/ticket.ts` (add `.regex()`)
   - Update `descriptionSchema` in `/lib/validations/ticket.ts` (add `.regex()`)

3. **E2E Test Tasks** (TDD - Red Phase):
   - Update `tests/e2e/tickets/inline-editing.spec.ts` with special character tests
   - Add bracket `[e2e]` prefix validation to inline editing flow

4. **Integration Test Tasks**:
   - Update `tests/integration/tickets/ticket-branch-validation.spec.ts` for new validation

5. **Validation Tasks** (TDD - Green Phase):
   - Run all contract tests and verify they pass
   - Run all E2E tests and verify they pass
   - Execute quickstart.md manual validation tests

**Ordering Strategy**:

Following TDD principles (Red-Green-Refactor):
```
1. [P] Add contract test for PATCH description character validation (FAIL expected)
2. [P] Add contract test for PATCH title character validation (FAIL expected)
3. [P] Add E2E test for inline edit with special characters (FAIL expected)
4. Update titleSchema with regex validation (tests turn GREEN)
5. Update descriptionSchema with regex validation (tests turn GREEN)
6. [P] Run full test suite validation
7. [P] Execute quickstart manual tests
```

- **[P] markers**: Parallel-executable tasks (independent test files)
- **Sequential tasks**: Implementation must follow test creation (TDD)
- **Test-first approach**: All test tasks before implementation tasks

**Task Characteristics**:
- **Small scope**: Each task modifies 1-2 files max
- **Clear acceptance criteria**: Task complete when specific tests pass
- **No schema changes**: All tasks are code-level only
- **Isolated changes**: Validation file + test files (no API routes, UI, or database)

**Estimated Task Count**: 8-10 tasks

**Dependencies**:
- Test tasks have no dependencies (can run in parallel)
- Implementation tasks depend on test tasks being created first
- Validation tasks depend on implementation being complete

**IMPORTANT**: This phase is executed by the `/tasks` command, NOT by `/plan`

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**Status**: ✅ **NO VIOLATIONS** - All constitutional principles satisfied

No complexity deviations or justifications required for this feature.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- ✅ Phase 0: Research complete (/plan command) - research.md created
- ✅ Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md created
- ✅ Phase 2: Task planning complete (/plan command - approach documented, ready for /tasks)
- ⏳ Phase 3: Tasks generated (/tasks command) - **NEXT STEP**
- ⏳ Phase 4: Implementation complete (execute tasks.md)
- ⏳ Phase 5: Validation passed (run quickstart.md tests)

**Gate Status**:
- ✅ Initial Constitution Check: PASS (all 5 principles satisfied)
- ✅ Post-Design Constitution Check: PASS (no new violations introduced)
- ✅ All NEEDS CLARIFICATION resolved (no unknowns in Technical Context)
- ✅ Complexity deviations documented (none required)

**Execution Summary**:
- Started: 2025-10-11
- Branch: `024-16204-description-validation`
- Artifacts: 5 files generated (research.md, data-model.md, quickstart.md, PATCH-tickets-validation.yaml, plan.md)
- Ready for: `/tasks` command to generate tasks.md

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
