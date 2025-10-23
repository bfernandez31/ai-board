# Feature Specification: Visual Job Type Distinction on Ticket Cards

**Feature Branch**: `045-visual-distinction-between`
**Created**: 2025-10-23
**Status**: Draft
**Input**: User description: "Visual distinction between stage transition jobs and AI-BOARD comment jobs on ticket cards"

## Auto-Resolved Decisions

- **Decision**: Visual indicator placement and design approach
- **Policy Applied**: AUTO
- **Confidence**: High (0.85) - Clear user intent for "most visual possible" distinction, existing badge pattern in codebase
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Adding visual indicators increases ticket card density but improves clarity
  2. Using color-coded badges follows existing UI patterns (workflowType badge) for consistency
- **Reviewer Notes**: Validate that color choices meet WCAG accessibility standards and don't conflict with existing badge colors (blue for SONNET, amber for Quick workflow)

---

- **Decision**: Icon selection for job types
- **Policy Applied**: AUTO
- **Confidence**: Medium (0.65) - Industry standard iconography for automation vs. manual actions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Stage transition icon (workflow automation) uses gear/cog symbol for automated processes
  2. AI-BOARD comment icon uses chat/message symbol to represent user-initiated requests
- **Reviewer Notes**: Consider user testing to ensure icons are immediately recognizable without tooltips

## User Scenarios & Testing

### User Story 1 - Distinguish Workflow Jobs from AI-BOARD Jobs (Priority: P1)

As a project manager viewing the board, I need to quickly identify which tickets are progressing through automated stage transitions versus which ones are being actively assisted by AI-BOARD through comments, so I can understand the ticket's current activity type at a glance.

**Why this priority**: This is the core value of the feature. Users explicitly requested "the most visual possible" distinction, indicating this is a critical pain point where users cannot currently tell what type of work is happening on a ticket.

**Independent Test**: Can be fully tested by creating two tickets - one with a stage transition job and one with an AI-BOARD comment job - and visually verifying that each displays a distinct, easily recognizable indicator on the ticket card.

**Acceptance Scenarios**:

1. **Given** a ticket with a running stage transition job (command: "specify"), **When** I view the ticket card on the board, **Then** I see a visual indicator showing automated workflow progression (e.g., gear icon with blue color)

2. **Given** a ticket with a running AI-BOARD comment job (command: "comment-specify"), **When** I view the ticket card on the board, **Then** I see a visual indicator showing AI-BOARD assistance (e.g., chat icon with purple color)

3. **Given** a ticket with a completed stage transition job, **When** I view the ticket card, **Then** the workflow indicator shows completed state with appropriate visual styling

4. **Given** a ticket with a failed AI-BOARD comment job, **When** I view the ticket card, **Then** the AI-BOARD indicator shows error state with appropriate visual styling

---

### User Story 2 - Understand Job Type Without Hovering (Priority: P2)

As a user scanning multiple tickets quickly, I need the job type distinction to be immediately visible without requiring hover interactions or modal clicks, so I can efficiently triage and prioritize my work across the board.

**Why this priority**: Enhances usability by ensuring information is accessible at a glance. This supports the "most visual possible" requirement by eliminating the need for user interaction to discover job types.

**Independent Test**: Can be fully tested by displaying a board with mixed job types and measuring whether users can correctly identify job types within 2 seconds of viewing the board (no hover or click required).

**Acceptance Scenarios**:

1. **Given** multiple tickets with different job types visible on screen, **When** I look at the board without any mouse interaction, **Then** I can immediately distinguish which tickets have workflow jobs versus AI-BOARD jobs based on visual indicators alone

2. **Given** a ticket card in any stage column, **When** a job starts or completes, **Then** the visual indicator updates in real-time without requiring page refresh

---

### User Story 3 - Differentiate Multiple Concurrent Jobs (Priority: P3)

As a user viewing a ticket with job history, I need to see which past jobs were stage transitions and which were AI-BOARD assists, so I can understand the ticket's assistance history and workflow progression over time.

**Why this priority**: Provides historical context and helps users understand how tickets evolved. Lower priority because it focuses on past activity rather than current state.

**Independent Test**: Can be fully tested by creating a ticket with mixed job history (both workflow and comment jobs), opening the ticket detail modal, and verifying that job history displays appropriate type indicators for each job entry.

**Acceptance Scenarios**:

1. **Given** a ticket detail modal showing job history, **When** I view the list of jobs, **Then** each job entry shows its type (workflow or AI-BOARD) with the same visual indicators used on the ticket card

2. **Given** a ticket with both completed and running jobs of different types, **When** I view the job list, **Then** I can quickly filter or identify jobs by their type using visual indicators

---

### Edge Cases

- What happens when a ticket has no jobs (new ticket)? No job type indicator should be displayed
- How does the system handle jobs with unknown/legacy command formats? Display default workflow indicator with a visual cue that command type is unknown
- What happens when job status updates but polling fails? The indicator should show last known state with a visual indication that data may be stale
- How are AI-BOARD jobs for different stages visually distinguished? Use the same icon but potentially different colors or labels to show the stage context (specify, plan, build, verify)

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a visual indicator on ticket cards when a job is associated with the ticket
- **FR-002**: System MUST differentiate between workflow jobs (commands: specify, plan, tasks, implement, quick-impl) and AI-BOARD comment jobs (commands: comment-specify, comment-plan, comment-build, comment-verify) using distinct visual indicators
- **FR-003**: Visual indicators MUST include both icon and color distinction to ensure accessibility for colorblind users
- **FR-004**: Indicators MUST update in real-time when job status changes (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED)
- **FR-005**: System MUST display job type indicators in both ticket card view and ticket detail modal
- **FR-006**: System MUST handle tickets with no jobs by not displaying any job type indicator
- **FR-007**: Visual indicators MUST be visible without requiring hover or click interactions
- **FR-008**: System MUST distinguish job types based on the Job.command field pattern (prefix "comment-" indicates AI-BOARD job)

### Key Entities

- **Job Type Indicator**: Visual element showing whether a job is a workflow transition or AI-BOARD assist
  - Derived from Job.command field (string pattern matching)
  - Displayed alongside existing job status indicator
  - Includes icon, color, and optional tooltip for accessibility

- **Job Command Pattern**: Classification rule for job types
  - Workflow jobs: Single-word commands (specify, plan, tasks, implement, quick-impl)
  - AI-BOARD jobs: Commands with "comment-" prefix (comment-specify, comment-plan, comment-build, comment-verify)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can distinguish between workflow jobs and AI-BOARD jobs within 2 seconds of viewing a ticket card (measured through user testing or eye-tracking)
- **SC-002**: Visual indicators meet WCAG 2.1 AA accessibility standards for color contrast (minimum 4.5:1 ratio for normal text, 3:1 for large text)
- **SC-003**: Job type indicators update within 2 seconds of job status changes (consistent with existing polling interval)
- **SC-004**: 95% of users correctly identify job type from visual indicators alone without tooltips in usability testing
- **SC-005**: Ticket cards maintain responsive layout on mobile devices (320px minimum width) with all indicators visible
