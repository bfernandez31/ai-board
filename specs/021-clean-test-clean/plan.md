# Implementation Plan: Test Suite Cleanup and Reorganization

**Branch**: `021-clean-test-clean` | **Date**: 2025-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/b.fernandez/Workspace/ai-board/specs/021-clean-test-clean/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ No NEEDS CLARIFICATION markers (all resolved in clarifications)
   → Detect Project Type: web (Next.js App Router frontend+backend)
   → Set Structure Decision: monolithic Next.js application
3. Fill the Constitution Check section
   → ✅ Evaluating against constitution principles
4. Evaluate Constitution Check section
   → Violations: None (test cleanup aligns with TDD principle)
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → Generate research for test organization patterns
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → No API contracts (file manipulation task)
   → Generate test reorganization mapping
7. Re-evaluate Constitution Check section
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach
9. STOP - Ready for /tasks command
```

## Summary
Clean up and reorganize the ai-board test suite by identifying and removing duplicate test files (>50% scenario overlap), consolidating test coverage into comprehensive test files, and reorganizing all tests into appropriate category folders (api/, e2e/, integration/, unit/, contracts/, database/) while preserving Git history and maintaining test execution performance.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Playwright (testing), @dnd-kit (drag-drop), Prisma 6.x (ORM), Next.js 15 (App Router)
**Storage**: PostgreSQL 14+ (test database fixtures)
**Testing**: Playwright E2E tests, existing test suite in /tests folder
**Target Platform**: Node.js test runner environment
**Project Type**: web (Next.js monolithic application)
**Performance Goals**: Maintain current test execution time (no degradation)
**Constraints**: Preserve Git history via git mv, maintain or improve test coverage percentage, >50% overlap threshold for duplicate detection
**Scale/Scope**: ~50 test files across 10 directories, consolidation target: reduce to ~35-40 organized test files

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development
- ✅ **PASS**: Test cleanup does not modify TypeScript code or type definitions
- ✅ **PASS**: No new code being written, only file reorganization
- ✅ **PASS**: Existing test files already use TypeScript strict mode

### Principle II: Component-Driven Architecture
- ✅ **PASS**: Test reorganization does not affect component structure
- ✅ **PASS**: No changes to shadcn/ui components or Next.js conventions

### Principle III: Test-Driven Development (NON-NEGOTIABLE)
- ✅ **PASS**: This feature ENHANCES test organization and maintainability
- ✅ **PASS**: Consolidation preserves all unique test scenarios (FR-005)
- ✅ **PASS**: Test coverage must be maintained or improved (NFR-002)
- ⚠️ **CONSIDERATION**: Manual validation approach (no automated pre-commit test run)
  - **Justification**: Developer runs tests manually after reorganization
  - **Mitigation**: CI/CD pipeline will catch any issues post-commit

### Principle IV: Security-First Design
- ✅ **PASS**: Test cleanup does not affect security validation or input handling
- ✅ **PASS**: No changes to Zod schemas, Prisma queries, or authentication

### Principle V: Database Integrity
- ✅ **PASS**: Test cleanup does not modify database schema or migrations
- ✅ **PASS**: Test helper functions (db-cleanup.ts, db-setup.ts) preserved in tests/helpers/

### Technology Standards Compliance
- ✅ **PASS**: No new dependencies introduced
- ✅ **PASS**: Playwright test framework unchanged
- ✅ **PASS**: Test naming conventions maintained

### Development Workflow Compliance
- ✅ **PASS**: Git history preserved via git mv (NFR-003)
- ✅ **PASS**: /tests folder structure remains standard
- ✅ **PASS**: Test organization improves discoverability (feature-based categorization)

**Overall Constitution Check**: ✅ **PASS** - Feature aligns with all constitutional principles

## Project Structure

### Documentation (this feature)
```
specs/021-clean-test-clean/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
tests/
├── api/                 # API endpoint tests (consolidated)
│   ├── projects-tickets-get.spec.ts
│   ├── projects-tickets-patch.spec.ts
│   └── projects-tickets-post.spec.ts
├── e2e/                 # End-to-end user flow tests
│   ├── board-*.spec.ts
│   ├── project-*.spec.ts
│   ├── ticket-*.spec.ts
│   └── sse-*.spec.ts
├── integration/         # Multi-component integration tests
│   ├── ticket-*.spec.ts
│   └── use-*.spec.ts
├── unit/                # Isolated unit tests
│   ├── job-state-machine.test.ts
│   └── validations/
├── contracts/           # API contract tests (consolidated)
│   ├── cleanup-*.spec.ts
│   ├── tickets-*.spec.ts
│   └── test-prefix.spec.ts
├── database/            # Database constraint and schema tests
│   └── ticket-project-constraints.spec.ts
├── helpers/             # Test utilities (preserved in root)
│   ├── db-cleanup.ts
│   ├── db-setup.ts
│   └── transition-helpers.ts
├── global-setup.ts      # Playwright global setup (preserved in root)
└── global-teardown.ts   # Playwright global teardown (preserved in root)
```

**Structure Decision**: Monolithic Next.js application with /tests directory organized by test category (api, e2e, integration, unit, contracts, database). All legacy test files in tests root (except global-setup.ts, global-teardown.ts, helpers/) will be moved to appropriate subdirectories. Duplicate test files will be consolidated into comprehensive test files.

## Phase 0: Outline & Research

### Research Tasks

1. **Test File Analysis**:
   - Catalog all current test files with their purposes and coverage
   - Identify test files with >50% scenario overlap (duplicate detection)
   - Document test import dependencies and helper function usage

2. **Test Organization Patterns**:
   - Research best practices for test folder structure in Playwright projects
   - Research git mv best practices for preserving file history
   - Review test categorization strategies (api vs e2e vs integration vs unit)

3. **Duplicate Detection Strategy**:
   - Define methodology for calculating scenario overlap percentage
   - Identify specific duplicate candidates:
     - tests/api/tickets-post.spec.ts vs tests/api-tickets-post.contract.spec.ts
     - tests/contracts/tickets-create.spec.ts overlap analysis
     - Legacy root test files that duplicate organized tests

4. **Performance Baseline**:
   - Capture current test execution time baseline
   - Document test parallelization configuration
   - Identify performance-critical test categories

**Output**: research.md with test inventory, duplicate candidates, reorganization mapping, and performance baseline

## Phase 1: Design & Contracts

### 1. Data Model (data-model.md)

**Entity Mapping**: Test File Reorganization Map
- Current file inventory with categorization
- Duplicate detection results (>50% overlap threshold)
- File movement mappings (git mv commands)
- Consolidation targets and merge strategies
- Import path migration rules

**Key Entities**:
- **Test File**: Path, action (MOVE|CONSOLIDATE|DELETE|PRESERVE), target location
- **Consolidation Group**: Files to merge, target file, overlap percentage
- **Migration Mapping**: Source path, destination path, import updates needed

### 2. API Contracts (contracts/)

**Not Applicable**: This feature does not introduce new API endpoints.
- Test cleanup is a file reorganization task
- No OpenAPI/GraphQL schemas needed
- No contract tests to generate

### 3. Quickstart Test (quickstart.md)

**Manual Validation Guide**:
- Pre-cleanup baseline capture (test count, execution time)
- Post-cleanup verification steps
- Git history validation (`git log --follow`)
- Import path verification
- Test suite execution validation
- Performance comparison checklist
- Success criteria confirmation

### 4. Agent Context Update (CLAUDE.md)

**Incremental Update**:
- ✅ Added test cleanup technology context
- ✅ Preserved manual additions (data isolation, branch management, etc.)
- ✅ Updated recent changes section
- ✅ Maintained under 150 lines for token efficiency

**New Technologies Added**:
- Playwright (testing framework)
- @dnd-kit (drag-drop library reference)
- Existing Next.js 15, Prisma 6.x, PostgreSQL 14+ confirmed

**Output**: data-model.md (reorganization mapping), quickstart.md (validation guide), CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

The /tasks command will generate tasks from Phase 1 design documents (data-model.md, quickstart.md) following this approach:

### Task Categories

1. **Preparation Tasks** (1-3):
   - Capture performance baseline (test count, execution time)
   - Create backup branch (optional safety measure)
   - Verify clean git status

2. **Consolidation Tasks** (4-15):
   - Each consolidation group → 1 task
   - Group 1: Consolidate Ticket POST API tests
   - Group 2: Consolidate Ticket Creation E2E tests
   - Group 3: Evaluate and consolidate Ticket Card tests (if overlap >50%)
   - Each task: Review overlap, merge unique scenarios, delete source files

3. **Migration Tasks** (16-30):
   - Each legacy root file → 1 task
   - Use `git mv` command to preserve history
   - Update import paths from `'./helpers/*'` to `'../helpers/*'`
   - Verify TypeScript compilation after each move

4. **Cleanup Tasks** (31-35):
   - Remove orphaned snapshot directories
   - Verify no test files in root (except global-*, helpers/)
   - Clean up any temporary files

5. **Validation Tasks** (36-40):
   - Run full test suite (`npx playwright test`)
   - Verify test count maintained (412 scenarios)
   - Verify execution time ≤ baseline (NFR-001)
   - Verify Git history preserved (`git log --follow` sample files)
   - Verify import paths correct (TypeScript compilation passes)
   - Compare before/after metrics

**Ordering Strategy**:
1. **Sequential Order**: Tasks must run in order (file operations have dependencies)
2. **Consolidation First**: Reduce file count before migration
3. **Migration Second**: Move remaining files to correct locations
4. **Cleanup Third**: Remove artifacts after consolidation/migration
5. **Validation Last**: Comprehensive validation after all changes

**No Parallel Tasks**: All tasks marked sequential [S] due to file system operations and Git history concerns

**Estimated Output**: 35-40 numbered, sequentially ordered tasks in tasks.md

**Key Task Principles**:
- Each task is atomic and testable
- Git history preservation enforced in migration tasks
- Import path updates validated in each migration task
- Performance constraints checked in validation tasks

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md with 35-40 sequential tasks)
**Phase 4**: Implementation (execute tasks.md following git mv and consolidation strategy)
**Phase 5**: Validation (run quickstart.md validation steps, verify all success criteria)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**No Violations**: This feature aligns with all constitutional principles.
- Test cleanup enhances TDD principle (Principle III)
- No new dependencies or architectural changes
- Git history preservation ensures accountability
- Performance constraints align with quality standards

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command) - 56 sequential tasks created
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (completed in /clarify)
- [x] Complexity deviations documented (none - full compliance)

**Artifacts Generated**:
- [x] research.md (test inventory, duplicate analysis, performance baseline)
- [x] data-model.md (reorganization mapping, consolidation groups)
- [x] quickstart.md (manual validation guide)
- [x] CLAUDE.md updated (incremental technology context)
- [x] tasks.md (56 sequential tasks with linear dependency chain)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
