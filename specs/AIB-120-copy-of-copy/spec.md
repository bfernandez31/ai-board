# Feature Specification: React Component Testing with Testing Library

**Feature Branch**: `AIB-120-copy-of-copy`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Testing trophy component testing strategy using React Testing Library (RTL)"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Determined scope of "relevant components" to test
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (score: +2) - testing infrastructure is low-risk but affects entire codebase
- **Fallback Triggered?**: No - confidence sufficient but CONSERVATIVE chosen for infrastructure changes
- **Trade-offs**:
  1. Prioritizing components with user interaction logic over pure presentational components reduces initial testing scope but maximizes ROI
  2. Starting with a curated list of testable components allows incremental adoption without overwhelming the test suite
- **Reviewer Notes**: Verify the selected components align with team priorities; add more components as patterns mature

---

- **Decision**: Determined which test layer RTL component tests belong to (unit vs integration)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High - Kent C. Dodds' Testing Trophy clearly designates component tests as integration tests
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Classifying RTL tests as integration tests aligns with Testing Trophy philosophy but requires happy-dom environment
  2. Keeping tests in `tests/unit/` with existing hook tests maintains consistency with current patterns
- **Reviewer Notes**: The constitution allows unit tests for hooks; RTL component tests testing behavior (not implementation) fit unit tests pattern per existing codebase conventions

---

- **Decision**: Determined Claude skill location and naming convention
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - Claude Code documentation is explicit about project skill location
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Project-level skill (`.claude/skills/`) ensures all AI agents have access
  2. Skill name `component-testing` provides semantic clarity for automatic invocation
- **Reviewer Notes**: Ensure skill description includes trigger keywords like "RTL", "component test", "React testing"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Component Tests (Priority: P1)

AI agents run component tests to verify React component behavior matches specifications before completing implementation.

**Why this priority**: Core functionality - without working tests, the feature provides no value

**Independent Test**: Can be fully tested by running `bun run test:unit` and verifying new component tests execute with passing results

**Acceptance Scenarios**:

1. **Given** a React component with user interactions, **When** `bun run test:unit` is executed, **Then** RTL-based tests run and report pass/fail status
2. **Given** a component test file using RTL patterns, **When** the test runner executes, **Then** components render in happy-dom environment and assertions verify expected behavior

---

### User Story 2 - Create Component Tests Using Skill (Priority: P1)

AI agents invoke the component testing skill to generate appropriate test files following established patterns.

**Why this priority**: Equal to P1 - the skill is the primary mechanism for AI agents to create consistent tests

**Independent Test**: Can be tested by invoking `/component-testing` skill in Claude and verifying it provides correct guidance

**Acceptance Scenarios**:

1. **Given** an AI agent working on a component, **When** the skill is invoked, **Then** the skill provides RTL testing patterns and guidance
2. **Given** a request to test a specific component, **When** the skill reads the component file, **Then** it generates tests that follow existing codebase patterns

---

### User Story 3 - Updated Documentation Guides Testing Decisions (Priority: P2)

Constitution and CLAUDE.md reflect RTL component testing strategy so AI agents make correct testing decisions.

**Why this priority**: Documentation enables correct behavior but existing patterns may suffice initially

**Independent Test**: Can be verified by reading constitution.md and CLAUDE.md and confirming component testing guidance exists

**Acceptance Scenarios**:

1. **Given** the constitution.md file, **When** an AI agent reads testing guidelines, **Then** RTL component testing is documented as part of Testing Trophy strategy
2. **Given** CLAUDE.md, **When** reviewing testing guidance, **Then** component testing patterns and when to use them are clearly stated

---

### Edge Cases

- What happens when testing a Server Component? RTL requires client-side rendering; Server Components should be tested via integration tests for their API/data fetching behavior
- How does testing handle async components with data fetching? Use RTL's async utilities (`waitFor`, `findBy*`) with mocked fetch
- What about components with complex context dependencies? Wrap test renders with necessary providers following existing patterns (see `useJobPolling.test.ts`)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST include React Testing Library (@testing-library/react) and related packages in devDependencies
- **FR-002**: System MUST configure Vitest to support RTL component testing with happy-dom environment
- **FR-003**: Component tests MUST be placed in `tests/unit/` directory following existing naming conventions (`[component].test.ts`)
- **FR-004**: AI agents MUST have access to a Claude skill that provides component testing guidance
- **FR-005**: Constitution.md MUST document RTL component testing as part of Testing Trophy strategy
- **FR-006**: CLAUDE.md MUST include component testing guidance in the Testing Guidelines section
- **FR-007**: Component tests MUST test behavior (user interactions, rendered output) not implementation details
- **FR-008**: Component tests MUST follow existing patterns for provider wrapping (QueryClientProvider, etc.)

### Key Entities

- **Component Test File**: Test file in `tests/unit/` that imports RTL utilities and tests a React component's behavior
- **Claude Skill**: Markdown file in `.claude/skills/` providing RTL testing guidance with semantic triggers
- **Test Configuration**: Vitest config supporting RTL with happy-dom environment (already configured)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 3 representative components have RTL-based tests that pass on `bun run test:unit`
- **SC-002**: Claude skill for component testing is invocable and provides actionable testing guidance
- **SC-003**: Constitution.md and CLAUDE.md contain updated testing documentation referencing RTL component tests
- **SC-004**: Component tests execute in under 100ms each (maintaining unit test speed expectations)
- **SC-005**: All existing tests continue to pass after changes (no regressions)
