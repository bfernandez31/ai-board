# Feature Specification: React Testing Library Component Testing Integration

**Feature Branch**: `AIB-119-copy-of-testing`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User description: "We have added testing trophy strategy to the project. We should add the component testing integration. Change the constitution and Claude.md to adapt the strategy to add some integration test on react component that need to. Look the best practice on that. Do not forget this is based on https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications. Add test to the relevant components. Use RTL rest testing library"

## Auto-Resolved Decisions

- **Decision**: Which components should receive RTL integration tests
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score: 4) - multiple neutral feature context signals, no conflicting buckets
- **Fallback Triggered?**: No - confidence ≥ 0.5 and no conflicting signal buckets
- **Trade-offs**:
  1. Testing complex interactive components (board, comments, forms) provides high confidence in user-facing functionality
  2. Initial implementation effort is higher but prevents regression bugs and improves maintainability
- **Reviewer Notes**: Verify that selected components align with team priorities. Consider phased rollout starting with highest-value components.

---

- **Decision**: Test coverage expectations for RTL component tests
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - testing infrastructure directly impacts code quality
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Higher coverage requirements ensure comprehensive testing but require more development time
  2. Focus on critical user interactions rather than exhaustive coverage
- **Reviewer Notes**: Target meaningful interactions (user events, form submissions, state changes) over implementation details.

---

- **Decision**: Organization of RTL component tests within existing test structure
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - aligns with existing Testing Trophy architecture
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Placing component tests in `tests/unit/` leverages existing happy-dom environment
  2. Clear separation from API integration tests in `tests/integration/`
- **Reviewer Notes**: Ensure test file naming follows existing conventions (`.test.ts` suffix).

## User Scenarios & Testing

### User Story 1 - Developer Tests Interactive Board Components (Priority: P1)

As a developer, I want to write RTL tests for board components so that I can verify ticket cards, drag-drop interactions, and modal behaviors work correctly without running slow E2E tests.

**Why this priority**: Board components are the core user interface with complex state management (TanStack Query), user interactions (click, edit, drag), and multiple integrated subcomponents. Testing these at the component level provides fast feedback during development.

**Independent Test**: Can be fully tested by rendering board components with mock data and simulating user interactions. Delivers confidence in core kanban functionality.

**Acceptance Scenarios**:

1. **Given** a TicketCard component with mock ticket data, **When** the user clicks the card, **Then** the detail modal opens with correct ticket information
2. **Given** a NewTicketModal component, **When** the user fills the form and submits, **Then** the form validation runs and mutation is called with correct data
3. **Given** a StageColumn component with tickets, **When** rendered, **Then** all ticket cards display with correct titles and status indicators

---

### User Story 2 - Developer Tests Comment Form Interactions (Priority: P2)

As a developer, I want to write RTL tests for comment components so that I can verify form submission, keyboard shortcuts, and mention autocomplete work correctly.

**Why this priority**: Comments involve complex user interactions (keyboard shortcuts, @mentions, form validation) that benefit from component-level testing without browser overhead.

**Independent Test**: Can be tested by rendering CommentForm with mock handlers and verifying user input handling, keyboard events, and submission behavior.

**Acceptance Scenarios**:

1. **Given** a CommentForm component, **When** the user types text and presses Enter, **Then** the onSubmit handler is called with the comment content
2. **Given** a MentionInput component, **When** the user types "@" followed by characters, **Then** the autocomplete suggestions appear with matching users
3. **Given** a CommentList component with mock comments, **When** rendered, **Then** all comments display with correct author and content

---

### User Story 3 - Developer Tests Project Components (Priority: P3)

As a developer, I want to write RTL tests for project components so that I can verify project cards display correctly and interactive elements function properly.

**Why this priority**: Project components have copy-to-clipboard functionality, external links, and conditional rendering that should be tested at component level.

**Independent Test**: Can be tested by rendering ProjectCard with mock project data and verifying display and interaction behaviors.

**Acceptance Scenarios**:

1. **Given** a ProjectCard component with mock project data, **When** the user clicks the copy button, **Then** the project key is copied to clipboard and feedback is shown
2. **Given** an EmptyProjectsState component, **When** rendered, **Then** the empty state message and create project action are displayed

---

### User Story 4 - Documentation Updated with RTL Testing Guidelines (Priority: P1)

As a developer, I want the project constitution and CLAUDE.md updated with RTL component testing guidelines so that all contributors understand when and how to write component tests.

**Why this priority**: Documentation ensures consistent testing practices across the team and guides AI agents (Claude Code) in writing appropriate tests.

**Independent Test**: Can be verified by reviewing documentation for completeness, clarity, and alignment with Testing Trophy principles.

**Acceptance Scenarios**:

1. **Given** the constitution file, **When** reviewed, **Then** it includes RTL component testing as part of the Testing Trophy strategy
2. **Given** CLAUDE.md, **When** reviewed, **Then** it includes guidelines for when to use RTL component tests vs unit/integration/E2E tests
3. **Given** documentation updates, **When** reviewed, **Then** test command examples include RTL component test execution

---

### Edge Cases

- What happens when a component requires TanStack Query context? → Wrap with QueryClientProvider using test QueryClient helper
- How does system handle components with complex prop types? → Use TypeScript to ensure type-safe mock data
- What happens when testing components that use browser APIs not in happy-dom? → Document limitations and fallback to Playwright E2E for those specific features

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide RTL component test setup that integrates with existing Vitest configuration
- **FR-002**: System MUST include a reusable wrapper component for providing TanStack Query context in tests
- **FR-003**: RTL component tests MUST be placed in `tests/unit/components/` directory following existing conventions
- **FR-004**: Constitution MUST be updated to include RTL component testing layer in Testing Trophy architecture
- **FR-005**: CLAUDE.md MUST be updated with guidelines for selecting RTL component tests over other test types
- **FR-006**: System MUST include RTL integration tests for high-priority interactive components (board, comments, projects)
- **FR-007**: Each RTL component test MUST follow Testing Library best practices: query by role/label, avoid implementation details, test user behavior
- **FR-008**: System MUST maintain existing test commands (`bun run test:unit`) to include new RTL component tests

### Key Entities

- **Component Test**: A test that renders a React component in isolation using RTL and verifies user interactions and rendered output
- **Test Wrapper**: A utility component that provides necessary context providers (QueryClientProvider, etc.) for component tests
- **Mock Data Factory**: Helper functions that generate type-safe mock data for components under test

## Success Criteria

### Measurable Outcomes

- **SC-001**: RTL component tests execute within the Vitest unit test suite without configuration changes
- **SC-002**: At least 5 high-priority components have comprehensive RTL tests covering primary user interactions
- **SC-003**: 100% of new RTL tests pass on first CI run after implementation
- **SC-004**: Constitution and CLAUDE.md documentation updates are complete and reviewed
- **SC-005**: Developers can write a new RTL component test in under 15 minutes using provided patterns and helpers
- **SC-006**: RTL component tests run in under 2 seconds total for all component tests (fast feedback)
