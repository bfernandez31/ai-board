# Feature Specification: Enhanced Implementation Workflow with Database Setup and Selective Testing

**Feature Branch**: `052-896-workflow-implement`
**Created**: 2025-10-25
**Status**: Draft
**Input**: User description: "#896 Workflow implement - we need to change the workflow speckit for command implement. if it's the commande implement we have to configure a bdd and playwright so the test e2e can be checked. install the dependancie too. And for the command uptade claude --dangerously-skip-permissions /speckit.implement to claude --dangerously-skip-permissions "/speckit.implement IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests""

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Determined that "configure a bdd" refers to database (BDD = Base De Données in French context, not Behavior-Driven Development)
- **Policy Applied**: AUTO
- **Confidence**: High (0.8) - context of Playwright + testing + existing PostgreSQL setup strongly indicates database initialization
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Assumes PostgreSQL database setup (consistent with existing test infrastructure)
  2. May need adjustment if BDD was meant as Behavior-Driven Development testing framework
- **Reviewer Notes**: Validate that database setup includes schema migrations and test data seeding, not BDD testing framework

---

- **Decision**: Interpreted "only impacted tests" to mean intelligent test selection based on code changes
- **Policy Applied**: AUTO
- **Confidence**: High (0.85) - clear directive to avoid full test suite execution for performance
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Faster CI/CD pipeline execution at cost of potentially missing integration issues
  2. Requires clear guidance to Claude on how to identify impacted tests
- **Reviewer Notes**: Verify that the instruction provides sufficient context for Claude to determine which tests are impacted by implementation changes

---

- **Decision**: Dependency installation includes both Playwright and database client libraries
- **Policy Applied**: AUTO
- **Confidence**: Medium (0.65) - aligns with test infrastructure needs
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Increases workflow execution time for dependency installation
  2. Ensures test environment is fully functional before implementation
- **Reviewer Notes**: Confirm that dependency caching is used to minimize installation overhead on subsequent runs

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated Implementation with Test Validation (Priority: P1)

As a developer triggering the `/speckit.implement` command, I need the GitHub Actions workflow to automatically set up the complete test environment (database and Playwright) so that my implementation can be validated with E2E tests without manual intervention.

**Why this priority**: This is the core value proposition - enabling automated implementation validation. Without this, the workflow cannot fulfill its primary purpose of automated code generation with test verification.

**Independent Test**: Can be fully tested by triggering the implement workflow with a simple feature spec and verifying that: (1) database is accessible during implementation, (2) Playwright tests can execute, (3) workflow completes successfully.

**Acceptance Scenarios**:

1. **Given** a ticket in BUILD stage with a valid implementation plan, **When** the implement workflow is triggered, **Then** the workflow sets up PostgreSQL database before Claude begins implementation
2. **Given** the database setup has completed, **When** Claude generates implementation code, **Then** Playwright and database client dependencies are available for test execution
3. **Given** Claude has completed implementation, **When** tests are executed, **Then** only tests related to modified code are run (not the full test suite)
4. **Given** the implementation workflow completes, **When** reviewing the workflow logs, **Then** database setup, dependency installation, and selective test execution steps are clearly visible

---

### User Story 2 - Intelligent Test Selection (Priority: P1)

As Claude executing the implementation command, I need clear instructions to run only impacted tests so that I can validate my changes quickly without executing the entire test suite.

**Why this priority**: Critical for workflow performance and Claude's ability to iterate quickly. Running full test suite on every implementation change would make the workflow impractically slow.

**Independent Test**: Can be tested independently by providing Claude with a small code change and verifying it only runs related test files (e.g., modify `/api/tickets/route.ts` → only runs `tests/api/tickets.spec.ts`, not all E2E tests).

**Acceptance Scenarios**:

1. **Given** Claude modifies API route files, **When** determining which tests to run, **Then** Claude identifies and executes only API contract tests for those routes
2. **Given** Claude modifies UI components, **When** determining which tests to run, **Then** Claude identifies and executes only E2E tests that interact with those components
3. **Given** Claude modifies shared utility functions, **When** determining which tests to run, **Then** Claude identifies and executes both unit tests for utilities and integration tests that depend on them
4. **Given** Claude completes implementation, **When** reporting test results, **Then** the output clearly indicates which tests were selected and why (based on code changes)

---

### User Story 3 - Database-Dependent Implementation (Priority: P2)

As Claude implementing features that require database operations, I need a properly configured and seeded test database available so that I can write and validate data access code during implementation.

**Why this priority**: Many features require database operations. Without database availability during implementation, Claude cannot validate database-dependent code or run tests that require data persistence.

**Independent Test**: Can be tested by providing a spec that requires database operations (e.g., "Add ticket priority field") and verifying that Claude can execute Prisma migrations and run database-dependent tests during implementation.

**Acceptance Scenarios**:

1. **Given** the implement workflow begins, **When** database setup executes, **Then** PostgreSQL is running and accepting connections
2. **Given** the database is running, **When** database setup completes, **Then** all Prisma migrations have been applied successfully
3. **Given** migrations are applied, **When** Claude begins implementation, **Then** test data fixtures (test user, test projects 1-2) are available for E2E tests
4. **Given** Claude generates database-dependent code, **When** running impacted tests, **Then** tests can successfully create, read, update, and delete data

---

### User Story 4 - Dependency Management (Priority: P3)

As a workflow maintainer, I need the implement workflow to automatically install and cache dependencies so that the test environment is consistent and setup time is minimized.

**Why this priority**: Important for workflow reliability and performance, but not blocking if dependencies are pre-installed in the CI environment. Supports the primary scenarios but is not essential for MVP.

**Independent Test**: Can be tested by clearing the dependency cache and verifying that the workflow successfully installs Playwright, database client libraries, and completes the implementation process.

**Acceptance Scenarios**:

1. **Given** the workflow starts with no cached dependencies, **When** dependency installation executes, **Then** all required packages (Playwright, PostgreSQL client, Prisma) are installed
2. **Given** dependencies are already cached from a previous run, **When** dependency installation executes, **Then** the workflow uses cached dependencies and completes installation in under 30 seconds
3. **Given** new dependencies are added to package.json, **When** the workflow runs, **Then** the cache is invalidated and fresh dependencies are installed

---

### Edge Cases

- What happens when database setup fails (e.g., PostgreSQL service doesn't start)?
  - Workflow should fail fast with clear error message indicating database unavailable
  - Claude should not attempt implementation if database prerequisite fails

- What happens when Playwright installation fails?
  - Workflow should fail with clear indication that E2E testing is unavailable
  - May still proceed with implementation if only unit tests are needed (graceful degradation)

- What happens when Claude cannot determine which tests are impacted?
  - Claude should err on the side of running a broader test suite rather than skipping critical tests
  - Clear guidance should specify: "When in doubt about test impact, run all tests in the affected module"

- What happens when selective tests pass but full test suite would fail?
  - This is an acceptable trade-off for speed; full test suite will run in PR validation
  - Workflow should note that selective testing was used and full validation is pending

- What happens when implementation requires dependency updates mid-workflow?
  - Claude should be able to modify package.json and have workflow re-install dependencies
  - May require workflow retry or manual dependency update step

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Workflow MUST set up PostgreSQL database service before Claude begins implementation
- **FR-002**: Workflow MUST apply all Prisma database migrations before test execution
- **FR-003**: Workflow MUST seed test database with standard fixtures (test user, projects 1-2) as defined in `tests/global-setup.ts`
- **FR-004**: Workflow MUST install Playwright and its browser dependencies before E2E test execution
- **FR-005**: Workflow MUST pass enhanced command instruction to Claude: "/speckit.implement IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests"
- **FR-006**: Claude instruction MUST explicitly prohibit prompting user for clarifications during implementation
- **FR-007**: Claude instruction MUST explicitly require identifying and running only tests impacted by code changes
- **FR-008**: Workflow MUST cache dependencies (node_modules, Playwright browsers) to optimize subsequent runs
- **FR-009**: Workflow MUST provide database connection string to Claude's environment (DATABASE_URL)
- **FR-010**: Workflow MUST fail fast if database setup or dependency installation fails, with clear error messages
- **FR-011**: Workflow MUST execute only when command is "implement" (not specify/plan commands)
- **FR-012**: Workflow MUST support running E2E tests that require database persistence and browser automation

### Key Entities *(include if feature involves data)*

- **Workflow Configuration**: GitHub Actions YAML defining job steps, environment setup, and conditional execution based on command type
- **Database Service**: PostgreSQL container or service providing persistent storage for test data
- **Test Environment**: Combination of database, Playwright, and dependencies required for E2E test execution
- **Command Instruction**: Enhanced prompt passed to Claude with specific directives about implementation approach and test selection
- **Dependency Cache**: Stored artifacts (node_modules, Playwright browsers) to accelerate workflow execution

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Workflow successfully sets up database and executes E2E tests for implement command in under 10 minutes (end-to-end)
- **SC-002**: Selective test execution reduces test runtime by at least 50% compared to full test suite (measured on typical feature implementation)
- **SC-003**: Database setup completes successfully and migrations apply in under 2 minutes
- **SC-004**: Playwright installation (including browsers) completes in under 3 minutes with caching enabled
- **SC-005**: Claude completes implementation without prompting user for clarifications (100% autonomous execution)
- **SC-006**: At least 80% of implement workflow runs successfully execute selective tests without requiring full test suite
- **SC-007**: Dependency caching reduces installation time to under 30 seconds on subsequent runs (cache hit rate > 80%)
- **SC-008**: Zero test failures due to missing database or Playwright dependencies (100% environment reliability)
