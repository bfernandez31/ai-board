# Feature Specification: Testing Trophy Component Testing with React Testing Library

**Feature Branch**: `AIB-121-testing-trophy-component`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "We have added testing trophy strategy to the project. We should add the component testing integration. Change the constitution and CLAUDE.md to adapt the strategy to add some integration test on react component that need to. Look the best practice on that. Do not forget this is based on https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications. Add test to the relevants component. Use RTL react testing library."

## Auto-Resolved Decisions

*Policy: CONSERVATIVE (AUTO fallback due to low confidence)*
*Applied on: 2025-12-28*

The following ambiguities were automatically resolved based on the configured policy:

- **Decision**: Component test scope and priority
- **Policy Applied**: CONSERVATIVE (AUTO recommended PRAGMATIC with low confidence, fallback triggered)
- **Confidence**: Low (0.3) - netScore=-1, absScore=1 < 3
- **Fallback Triggered?**: Yes - low confidence (< 0.5) triggered CONSERVATIVE fallback
- **Trade-offs**:
  1. Comprehensive test coverage with higher initial development investment
  2. Better long-term maintainability and confidence in refactoring
- **Reviewer Notes**: Validate that the selected components represent the highest-value testing targets for the project

---

- **Decision**: RTL test patterns and helper utilities
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (industry best practices from Kent C. Dodds and Testing Library documentation)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Standard patterns ensure consistency and onboarding ease
  2. May require refactoring if custom patterns emerge later
- **Reviewer Notes**: Consider if any project-specific patterns warrant deviation from standard RTL practices

---

- **Decision**: Documentation update scope
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (clear scope from ticket description)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Comprehensive documentation updates across constitution and CLAUDE.md
  2. More documentation to maintain going forward
- **Reviewer Notes**: Ensure documentation additions are concise and actionable

## User Scenarios & Testing

### User Story 1 - AI Agent Writes Behavioral Component Tests (Priority: P1)

When an AI agent is tasked with implementing or modifying React components, it should have clear guidelines and patterns for writing RTL integration tests that verify component behavior from a user's perspective.

**Why this priority**: This is the core value proposition - enabling AI agents to confidently write maintainable component tests that catch real bugs without being brittle to implementation changes.

**Independent Test**: Can be fully tested by verifying that documentation exists and following the patterns to write a sample component test that passes.

**Acceptance Scenarios**:

1. **Given** the constitution and CLAUDE.md documents exist, **When** an AI agent reads them, **Then** it finds clear guidelines for when to use RTL component tests vs unit tests vs E2E tests.
2. **Given** a React component with user interactions exists, **When** an AI agent follows the RTL testing patterns in documentation, **Then** it can write tests that verify behavior without testing implementation details.
3. **Given** an RTL test file is created, **When** the test is run via `bun run test:unit`, **Then** it executes successfully and provides clear pass/fail feedback.

---

### User Story 2 - Component Test Infrastructure Ready (Priority: P1)

The testing infrastructure is configured with proper RTL setup, mock providers, and helper utilities so that component tests can be written without additional configuration.

**Why this priority**: Without proper infrastructure, no component tests can be written consistently.

**Independent Test**: Can be verified by creating a simple component test file that imports the setup and renders a component successfully.

**Acceptance Scenarios**:

1. **Given** the test setup file exists, **When** a component test imports the setup, **Then** it has access to render, screen, userEvent, and other RTL utilities.
2. **Given** a component uses TanStack Query, **When** it is tested with RTL, **Then** the test can mock query responses without complex setup.
3. **Given** a component renders, **When** the test needs DOM assertions, **Then** jest-dom matchers are available (toBeInTheDocument, toBeDisabled, etc.).

---

### User Story 3 - High-Priority Components Have Tests (Priority: P2)

The most complex interactive components have RTL integration tests that verify their core behaviors, providing confidence for future modifications.

**Why this priority**: Demonstrates the pattern in practice and provides immediate value by testing high-risk components.

**Independent Test**: Can be verified by running `bun run test:unit` and seeing component test results for the targeted components.

**Acceptance Scenarios**:

1. **Given** a modal component (e.g., NewTicketModal), **When** its RTL test runs, **Then** it verifies form submission, validation feedback, and cancel behavior.
2. **Given** a form component with keyboard shortcuts, **When** its RTL test runs, **Then** it verifies that Cmd/Ctrl+Enter triggers submission.
3. **Given** a component with conditional rendering, **When** its RTL test runs, **Then** it verifies correct content appears based on different states.

---

### User Story 4 - Documentation Guides Testing Decisions (Priority: P2)

The constitution and CLAUDE.md clearly explain when to use each test type (RTL component tests vs unit tests vs E2E) based on the Testing Trophy methodology.

**Why this priority**: Prevents AI agents from making incorrect testing decisions that lead to brittle or insufficient tests.

**Independent Test**: Can be verified by reading the documentation and determining the correct test type for sample scenarios.

**Acceptance Scenarios**:

1. **Given** a developer needs to test a pure utility function, **When** they consult the documentation, **Then** they are directed to write a Vitest unit test.
2. **Given** a developer needs to test a React component's behavior, **When** they consult the documentation, **Then** they are directed to write an RTL integration test.
3. **Given** a developer needs to test drag-and-drop interactions, **When** they consult the documentation, **Then** they are directed to write a Playwright E2E test.

---

### Edge Cases

- What happens when a component requires context providers (QueryClient, theme, etc.)? Tests should have access to a wrapper utility that provides common providers.
- How does the system handle async operations in component tests? Tests use RTL's `findBy*` queries and `waitFor` for async assertions.
- What if a component test needs to verify navigation or routing? Mock the router or use memory router for isolated testing.

## Requirements

### Functional Requirements

- **FR-001**: System MUST update the constitution document to include RTL component testing guidelines following the Testing Trophy methodology.
- **FR-002**: System MUST update CLAUDE.md to reflect the expanded testing categories including RTL component tests.
- **FR-003**: System MUST provide RTL test setup utilities that configure render, providers, and mocking infrastructure.
- **FR-004**: System MUST include RTL helper utilities for common patterns (modal testing, keyboard events, form interactions).
- **FR-005**: System MUST add RTL integration tests for at least 5 high-priority interactive components.
- **FR-006**: System MUST ensure RTL component tests run as part of the `bun run test:unit` command.
- **FR-007**: System MUST document the query priority hierarchy (getByRole preferred over getByTestId).
- **FR-008**: System MUST establish patterns for testing components that use TanStack Query.
- **FR-009**: System MUST document when to use userEvent vs fireEvent (prefer userEvent).
- **FR-010**: System MUST ensure all component tests verify behavior, not implementation details.

### Key Entities

- **Component Test**: A test file that uses RTL to render a React component and verify its behavior from a user's perspective.
- **Test Setup**: Configuration file that provides common providers, mocks, and utilities for component testing.
- **Test Helper**: Utility functions that simplify common testing patterns (opening modals, simulating keyboard shortcuts).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Constitution document contains a dedicated section for RTL component testing guidelines.
- **SC-002**: CLAUDE.md testing section includes RTL component tests as a distinct category.
- **SC-003**: At least 5 interactive components have passing RTL integration tests.
- **SC-004**: All RTL tests follow the query priority hierarchy (role > label > text > testId).
- **SC-005**: Component tests complete within the `bun run test:unit` execution without configuration errors.
- **SC-006**: Test documentation clearly distinguishes when to use RTL vs unit vs E2E testing.
- **SC-007**: No component tests rely on implementation details (class names, internal state, component instances).
