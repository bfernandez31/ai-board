# Feature Specification: Testing Trophy Component Integration

**Feature Branch**: `AIB-117-testing-trophy-component`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "We have added testing trophy strategy to the project. We should add the component testing integration. Change the constitution and Claude.md to adapt the strategy to add some integration test on react component that need to. Look the best practice on that. Do not forget this is based on https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications. Add test to the relevants component."

## Auto-Resolved Decisions

- **Decision**: Component testing will use Vitest with React Testing Library for integration tests (not Playwright)
- **Policy Applied**: AUTO → CONSERVATIVE (fallback triggered)
- **Confidence**: Low (0.3) - net score +1 from mixed signals (testing/reliability +2, internal tool -2)
- **Fallback Triggered?**: Yes - confidence below 0.5 threshold, defaulted to CONSERVATIVE approach
- **Trade-offs**:
  1. Scope: Full integration testing of components with proper tooling setup
  2. Quality: Higher initial effort ensures comprehensive component coverage
- **Reviewer Notes**: Verify React Testing Library is the preferred tool for component testing in this stack. Confirm test file locations align with existing patterns.

---

- **Decision**: Priority components for testing based on complexity and user interaction frequency
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - based on codebase analysis showing clear complexity indicators
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Focus on forms (NewTicketModal, CommentForm) and search components (TicketSearch, MentionInput) first
  2. Lower priority for simple modal confirmations and display components
- **Reviewer Notes**: Priority order may be adjusted based on team capacity. P1 components have the highest ROI for testing investment.

---

- **Decision**: Constitution and CLAUDE.md updates will add component testing as a distinct integration test category
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) - aligns with existing Testing Trophy documentation but extends it
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Documentation updates required across multiple files for consistency
  2. Provides clear guidance for future component testing
- **Reviewer Notes**: Ensure updates are consistent between constitution.md and CLAUDE.md. Both must reflect the same testing philosophy.

## User Scenarios & Testing

### User Story 1 - Set Up Component Testing Infrastructure (Priority: P1)

Developers need a configured testing environment to write component integration tests using Vitest and React Testing Library, following the Testing Trophy methodology.

**Why this priority**: Without proper infrastructure, no component tests can be written. This is the foundation for all subsequent testing work.

**Independent Test**: Can be fully tested by running `bun run test:integration` and seeing component tests execute successfully. Delivers immediate value by enabling component-level testing.

**Acceptance Scenarios**:

1. **Given** the project has React Testing Library installed, **When** a developer runs `bun run test:integration`, **Then** component tests in `tests/integration/components/` directory are discovered and executed.
2. **Given** a component test file exists, **When** the test renders a React component, **Then** the component mounts correctly in the test environment with all providers available.
3. **Given** the constitution and CLAUDE.md are updated, **When** a developer reads the testing guidelines, **Then** they find clear instructions for when to use component integration tests.

---

### User Story 2 - Test Form Components with User Interactions (Priority: P1)

Developers can write integration tests for form components (NewTicketModal, CommentForm) that verify form validation, submission, and user interaction flows.

**Why this priority**: Form components are the primary user interaction points and have the highest complexity with state management, validation, and API calls.

**Independent Test**: Can be tested by creating a test for NewTicketModal that simulates user input, validates form state, and verifies submission behavior. Delivers value by catching form bugs before E2E tests.

**Acceptance Scenarios**:

1. **Given** the NewTicketModal component, **When** a user fills in required fields and submits, **Then** the form validates input and calls the appropriate mutation.
2. **Given** the CommentForm component, **When** a user types a message and presses Cmd+Enter, **Then** the comment is submitted via the mutation hook.
3. **Given** form validation rules exist, **When** invalid data is entered, **Then** appropriate error messages are displayed to the user.

---

### User Story 3 - Test Search and Autocomplete Components (Priority: P2)

Developers can write integration tests for search components (TicketSearch, MentionInput) that verify debouncing, keyboard navigation, and result selection.

**Why this priority**: Search components have complex interaction patterns (debouncing, keyboard events) that are difficult to test in E2E but straightforward in component tests.

**Independent Test**: Can be tested by creating tests that simulate typing, arrow key navigation, and Enter key selection in TicketSearch. Delivers value by ensuring search UX works correctly.

**Acceptance Scenarios**:

1. **Given** the TicketSearch component, **When** a user types a search term, **Then** the query is debounced before making API calls.
2. **Given** search results are displayed, **When** a user navigates with arrow keys, **Then** the selection index updates correctly.
3. **Given** the MentionInput component, **When** a user types `@` followed by text, **Then** the autocomplete dropdown appears with matching users.

---

### User Story 4 - Test Modal and Confirmation Components (Priority: P3)

Developers can write integration tests for modal components (CleanupConfirmDialog, DeleteConfirmationModal) that verify confirmation flows and callbacks.

**Why this priority**: Modal components are simpler but still benefit from integration tests to verify callback behavior and loading states.

**Independent Test**: Can be tested by rendering CleanupConfirmDialog and verifying that clicking confirm triggers the expected callback. Delivers value by catching modal interaction bugs.

**Acceptance Scenarios**:

1. **Given** the CleanupConfirmDialog is open, **When** a user clicks Confirm, **Then** the onConfirm callback is invoked and loading state is shown.
2. **Given** a confirmation modal is open, **When** a user clicks Cancel, **Then** the modal closes without triggering the action.
3. **Given** a delete confirmation modal, **When** the delete action completes, **Then** appropriate success feedback is provided.

---

### Edge Cases

- What happens when a component test needs to mock TanStack Query hooks?
- How does the test handle components that depend on providers (QueryClientProvider, ThemeProvider)?
- What happens when testing components with complex drag-and-drop (DnD Kit) integration?

## Requirements

### Functional Requirements

- **FR-001**: System MUST include React Testing Library as a development dependency for component testing
- **FR-002**: System MUST configure Vitest to discover and run tests in `tests/integration/components/` directory
- **FR-003**: System MUST provide test utilities for wrapping components with required providers (QueryClient, Theme, etc.)
- **FR-004**: System MUST document component testing patterns in constitution.md and CLAUDE.md
- **FR-005**: System MUST include example component tests for NewTicketModal demonstrating form testing patterns
- **FR-006**: System MUST include example component tests for TicketSearch demonstrating debounce and keyboard testing
- **FR-007**: System MUST include example component tests for CommentForm demonstrating mutation and keyboard shortcut testing
- **FR-008**: System MUST include example component tests for MentionInput demonstrating autocomplete testing
- **FR-009**: System MUST provide guidance on mocking TanStack Query hooks for isolated component testing
- **FR-010**: Test utilities MUST provide a consistent way to render components with all necessary providers

### Key Entities

- **Component Test**: A Vitest test that renders a React component in isolation with mocked dependencies and verifies behavior through user interaction simulation
- **Test Provider Wrapper**: A utility component that wraps tested components with QueryClientProvider, ThemeProvider, and other required context providers
- **Mock Hook**: A function that replaces TanStack Query hooks with controlled mock implementations for testing

## Success Criteria

### Measurable Outcomes

- **SC-001**: All prioritized components (NewTicketModal, CommentForm, TicketSearch, MentionInput) have at least 3 integration tests each covering core user interactions
- **SC-002**: Component tests execute in under 500ms each on average (10x faster than E2E equivalent)
- **SC-003**: Constitution.md and CLAUDE.md include updated Testing Trophy documentation with component testing section
- **SC-004**: `bun run test:integration` command successfully runs all component tests alongside API tests
- **SC-005**: New developers can write a component test within 15 minutes by following the documented patterns
- **SC-006**: Test coverage for form validation logic increases by at least 50% compared to E2E-only testing
