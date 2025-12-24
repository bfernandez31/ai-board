# Feature Specification: Restructure Test Suite to Testing Trophy Architecture

**Feature Branch**: `AIB-116-restructure-test-suite`
**Created**: 2025-12-24
**Status**: Draft
**Input**: User description: Migrate test suite from Playwright-heavy (~92 .spec.ts files) to Kent C. Dodds' Testing Trophy architecture with Vitest for API/integration tests and Playwright reserved for browser-required E2E only.

## Auto-Resolved Decisions

### Decision 1: API Test Migration Strategy
- **Decision**: Migrate all 26 API tests from Playwright to Vitest integration tests using native fetch
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - Clear technical benefit with no user-facing risk
- **Fallback Triggered?**: No - Strong consensus on performance improvement (500ms→50ms per test)
- **Trade-offs**:
  1. Requires one-time migration effort for 26 test files
  2. Enables 10x faster API test execution, improving CI feedback loops
- **Reviewer Notes**: Verify that existing `x-test-user-id` auth header pattern works with native fetch

### Decision 2: Database Test Migration
- **Decision**: Migrate 3 database constraint tests to Vitest (they use Prisma directly, no HTTP/browser needed)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - Tests already use Prisma without browser
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Minor refactoring to use Vitest test syntax
  2. Faster execution and simpler test setup
- **Reviewer Notes**: Ensure Prisma client initialization works correctly in Vitest environment

### Decision 3: Integration Test Directory Structure
- **Decision**: Organize Vitest integration tests by domain (projects, tickets, comments, jobs) rather than 1:1 with spec files
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.85) - Aligns with Testing Trophy principle of testing user behavior, not implementation
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Tests grouped by what users interact with, not internal structure
  2. May require adjusting existing mental models about test organization
- **Reviewer Notes**: Domain grouping improves test discoverability and reduces duplication

### Decision 4: Worker Isolation Pattern
- **Decision**: Reuse existing worker isolation pattern mapping VITEST_POOL_ID to project IDs [1, 2, 4, 5, 6, 7], skipping project 3 (development)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.95) - Pattern proven in Playwright, no reason to change
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent isolation model across test frameworks
  2. Relies on existing helper code in `tests/helpers/worker-isolation.ts`
- **Reviewer Notes**: Verify VITEST_POOL_ID environment variable is available in Vitest workers

### Decision 5: E2E Test Retention Criteria
- **Decision**: Keep Playwright tests ONLY for scenarios requiring real browser: OAuth flows, drag-drop (DnD Kit), viewport testing, keyboard navigation, visual state (cleanup banner)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - Clear technical boundary between browser-required and API-testable scenarios
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reduces E2E suite from ~92 to ~47 files (browser-required subset)
  2. Faster CI runs, but requires careful audit of which tests to delete
- **Reviewer Notes**: Each E2E test deletion must verify equivalent coverage exists in new Vitest integration tests

## User Scenarios & Testing

### User Story 1 - Developer Runs Fast API Tests (Priority: P1)

A developer makes changes to an API route and wants quick feedback on whether their changes broke anything. They run `bun run test:integration` and get results in seconds instead of minutes.

**Why this priority**: This is the core value proposition - dramatically faster feedback loops during development enable more confident, rapid iteration.

**Independent Test**: Can be fully tested by running `bun run test:integration` against a single API endpoint and verifying sub-100ms execution time per test.

**Acceptance Scenarios**:

1. **Given** a developer has modified `/api/tickets/route.ts`, **When** they run `bun run test:integration`, **Then** all ticket-related API tests complete in under 5 seconds total
2. **Given** the integration test suite contains 30+ API tests, **When** running the full suite, **Then** total execution time is under 30 seconds
3. **Given** a test requires database state, **When** the test runs, **Then** it uses an isolated project ID based on worker pool and cleans up after itself

---

### User Story 2 - CI Pipeline Validates Changes Quickly (Priority: P1)

The CI pipeline runs all tests on every push. With the Testing Trophy architecture, the majority of tests run at the fast integration layer, reducing total CI time while maintaining coverage confidence.

**Why this priority**: CI speed directly impacts team velocity. Slow CI causes context switching and blocks merges.

**Independent Test**: Can be fully tested by measuring total CI test job duration before and after migration.

**Acceptance Scenarios**:

1. **Given** a PR is opened with code changes, **When** CI runs the test suite, **Then** the integration test job completes in under 2 minutes
2. **Given** both Vitest and Playwright tests exist, **When** CI runs `bun run test`, **Then** both test types execute and report results correctly
3. **Given** an API test fails, **When** viewing CI logs, **Then** the failure message clearly indicates which test and assertion failed

---

### User Story 3 - Developer Writes New API Tests in Vitest (Priority: P2)

A developer adding a new API endpoint follows the established pattern to write integration tests using Vitest, not Playwright. The test infrastructure provides helpers for auth, database setup, and API calls.

**Why this priority**: Consistent patterns ensure new tests follow the Testing Trophy architecture, preventing regression to slow patterns.

**Independent Test**: Can be fully tested by creating a new API test file and verifying it uses Vitest conventions and runs quickly.

**Acceptance Scenarios**:

1. **Given** a developer needs to test a new API endpoint, **When** they create a test in `tests/integration/`, **Then** they can use the provided `apiClient` helper with built-in auth
2. **Given** a test needs database fixtures, **When** using `tests/fixtures/vitest/setup.ts`, **Then** the test gets an isolated project ID and clean state
3. **Given** test files exist in `tests/integration/**/*.test.ts`, **When** running `bun run test:integration`, **Then** Vitest discovers and runs all integration tests

---

### User Story 4 - Browser-Required Tests Run in Playwright (Priority: P2)

Tests that genuinely require a browser (drag-drop, OAuth redirects, viewport testing, keyboard navigation) continue to use Playwright, providing the necessary real-browser environment.

**Why this priority**: Not all tests can run without a browser. Maintaining Playwright for appropriate use cases ensures complete coverage.

**Independent Test**: Can be fully tested by running Playwright E2E tests and verifying they interact with real browser features.

**Acceptance Scenarios**:

1. **Given** a drag-drop test exists in `tests/e2e/board/drag-drop.spec.ts`, **When** running E2E tests, **Then** the test uses real browser drag events via DnD Kit
2. **Given** an OAuth flow test exists, **When** running E2E tests, **Then** the test can handle browser redirects and session cookies
3. **Given** a viewport test checks responsive layout, **When** running with different viewport sizes, **Then** the test verifies correct rendering at each breakpoint

---

### User Story 5 - Documentation Reflects Testing Strategy (Priority: P3)

The constitution and CLAUDE.md are updated to reflect the Testing Trophy architecture, ensuring AI agents and developers follow the correct patterns when writing tests.

**Why this priority**: Documentation ensures long-term consistency and prevents regression to old patterns.

**Independent Test**: Can be fully tested by reading the updated documentation and verifying it describes the Testing Trophy approach.

**Acceptance Scenarios**:

1. **Given** `.specify/memory/constitution.md` has a testing section, **When** reviewing Section III, **Then** it describes Testing Trophy with Vitest for integration and Playwright for E2E only
2. **Given** `CLAUDE.md` has testing commands, **When** an AI agent reads the file, **Then** it knows to use Vitest for API tests and Playwright for browser tests
3. **Given** a developer searches for test guidance, **When** reading either documentation file, **Then** they understand the distinction between integration and E2E tests

---

### Edge Cases

- What happens when a test needs both API calls and browser interaction?
  - Split into two tests: Vitest for API logic, Playwright for browser-specific behavior
- How do integration tests handle database transactions that span multiple API calls?
  - Each test gets an isolated project ID; cleanup runs after each test to reset state
- What if VITEST_POOL_ID is not available?
  - Default to project ID 1 with a warning; tests still run but without parallelization
- How do tests handle flaky network or database connections?
  - Retry logic at the API client level with configurable timeout; test failures report clear error context

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a Vitest integration test infrastructure in `tests/fixtures/vitest/` with setup, API client, and global setup files
- **FR-002**: System MUST configure Vitest to discover and run tests matching `tests/integration/**/*.test.ts`
- **FR-003**: System MUST migrate all existing API tests (26 files in `tests/api/`) to Vitest integration tests organized by domain
- **FR-004**: System MUST migrate all database tests (3 files in `tests/database/`) to Vitest integration tests
- **FR-005**: System MUST retain Playwright E2E tests only for browser-required scenarios (auth flows, drag-drop, viewport, keyboard navigation, visual state)
- **FR-006**: System MUST delete Playwright tests that duplicate API coverage now handled by Vitest integration tests
- **FR-007**: System MUST provide an API client helper that wraps fetch with `x-test-user-id` header for test authentication
- **FR-008**: System MUST implement worker isolation for Vitest using VITEST_POOL_ID mapped to project IDs [1, 2, 4, 5, 6, 7]
- **FR-009**: System MUST update `.specify/memory/constitution.md` Section III to replace hybrid Vitest/Playwright strategy with Testing Trophy architecture
- **FR-010**: System MUST update `CLAUDE.md` testing section to reflect the new Testing Trophy strategy and commands
- **FR-011**: System MUST ensure `bun run test` executes both Vitest integration tests and Playwright E2E tests
- **FR-012**: System MUST organize integration tests by domain (projects, tickets, comments, jobs, etc.) not by spec document

### Key Entities

- **Integration Test**: A Vitest test that calls API endpoints via fetch, interacts with the database via Prisma, and validates HTTP responses - does not require a browser
- **E2E Test**: A Playwright test that requires a real browser for DOM interaction, user input simulation, or cross-origin navigation
- **API Client**: A fetch wrapper providing authenticated HTTP methods for integration tests
- **Worker Isolation**: A pattern that assigns each parallel test worker a unique project ID to prevent data conflicts

## Success Criteria

### Measurable Outcomes

- **SC-001**: Integration tests (API + database) complete in under 30 seconds total for the full suite
- **SC-002**: Individual integration tests execute in under 100ms on average
- **SC-003**: Total CI test duration decreases by at least 40% compared to current Playwright-only approach
- **SC-004**: E2E test suite contains only browser-required tests (target: 40-50 test files, down from 92)
- **SC-005**: All existing test coverage is maintained or improved - no functionality loses test protection
- **SC-006**: New API tests written after migration use Vitest, not Playwright (measured by code review)
- **SC-007**: Constitution and CLAUDE.md accurately describe the Testing Trophy architecture with clear guidance on test type selection
