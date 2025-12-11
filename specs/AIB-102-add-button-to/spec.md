# Feature Specification: Add Button to Consult Summary

**Feature Branch**: `AIB-102-add-button-to`
**Created**: 2025-12-11
**Status**: Draft
**Input**: User description: "Now we have a summary file on full workflow added in implement step. We should have a button to consult the file like for the spec plan and task md. We can't edit the file just consult."

## Auto-Resolved Decisions

- **Decision**: Summary button will be read-only (no edit functionality)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - User explicitly stated "We can't edit the file just consult"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simpler implementation without edit mode handling
  2. No impact on timeline; reduces complexity
- **Reviewer Notes**: Confirm read-only is the permanent requirement for summary files

---

- **Decision**: Summary button visibility follows same pattern as Tasks button (requires completed implement job)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - Summary is created during implement step, consistent with existing job-based visibility patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Maintains consistency with existing UI patterns
  2. Button only appears when summary file exists
- **Reviewer Notes**: Verify that implement job completion is the correct trigger (not a separate summary job)

---

- **Decision**: Summary button will use the same modal-based DocumentationViewer component as spec/plan/tasks
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - Maintains UI consistency and reuses existing infrastructure
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Faster implementation by reusing existing components
  2. Consistent user experience across all documentation types
- **Reviewer Notes**: None - clear architectural choice based on existing patterns

---

- **Decision**: Button will use FileOutput icon (lucide-react) to differentiate from Spec's FileText icon
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (0.6) - Reasonable default; similar icon family maintains visual consistency
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clear visual distinction from Spec button
  2. May need adjustment based on team preferences
- **Reviewer Notes**: Icon choice can be adjusted during implementation if preferred

---

- **Decision**: Summary button will only appear for FULL workflow tickets (not QUICK or CLEAN)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - Summary files are only created during full workflow implement step
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent with how plan/tasks buttons work
  2. Avoids showing button when file doesn't exist
- **Reviewer Notes**: Confirm CLEAN workflow doesn't generate summary files

## User Scenarios & Testing

### User Story 1 - View Implementation Summary (Priority: P1)

As a user viewing a ticket that has completed the implement step, I want to view the summary file so I can understand what changes were made during implementation without navigating to the Git repository.

**Why this priority**: This is the core feature - without this, the feature has no value. Users need to quickly access implementation details.

**Independent Test**: Can be fully tested by completing an implement job on a ticket and verifying the Summary button appears and opens the summary content.

**Acceptance Scenarios**:

1. **Given** a ticket with a completed implement job in the BUILD stage, **When** user opens the ticket detail modal, **Then** a "Summary" button is visible alongside the Spec, Plan, and Tasks buttons

2. **Given** the Summary button is visible, **When** user clicks the Summary button, **Then** a modal opens displaying the summary.md content in formatted markdown

3. **Given** the summary modal is open, **When** user views the content, **Then** there is no Edit button available (read-only mode only)

---

### User Story 2 - View Summary After Shipping (Priority: P2)

As a user reviewing a shipped ticket, I want to view the implementation summary from the main branch so I can reference what was implemented.

**Why this priority**: Important for historical reference, but secondary to viewing during active development.

**Independent Test**: Can be tested by shipping a ticket and verifying the Summary button fetches content from main branch.

**Acceptance Scenarios**:

1. **Given** a ticket in SHIP stage that had a completed implement job, **When** user opens the ticket detail modal, **Then** the Summary button is visible

2. **Given** a shipped ticket with Summary button visible, **When** user clicks Summary, **Then** the summary content is fetched from the main branch (not the feature branch)

---

### User Story 3 - Summary Not Available Yet (Priority: P3)

As a user viewing a ticket that hasn't completed implementation, I understand why the Summary button is not shown.

**Why this priority**: Edge case handling for user clarity.

**Independent Test**: Can be tested by viewing tickets at various stages before implement job completion.

**Acceptance Scenarios**:

1. **Given** a ticket in SPECIFY or PLAN stage, **When** user opens the ticket detail modal, **Then** no Summary button is displayed

2. **Given** a ticket in BUILD stage without a completed implement job, **When** user opens the ticket detail modal, **Then** no Summary button is displayed

3. **Given** a QUICK workflow ticket, **When** user opens the ticket detail modal, **Then** no Summary button is displayed (since quick-impl doesn't create summary files)

---

### Edge Cases

- What happens when summary file doesn't exist but implement job is marked complete? System should show appropriate error message when modal opens.
- How does system handle rate limiting when fetching summary from GitHub? Same behavior as existing documentation endpoints (retry with backoff, show error toast).
- What happens if user loses network while viewing summary? Content already loaded remains visible; refresh attempts show error.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a "Summary" button in the ticket detail modal for FULL workflow tickets that have completed an implement job
- **FR-002**: System MUST open a modal displaying the summary.md content when user clicks the Summary button
- **FR-003**: System MUST NOT provide an edit option for the summary content (read-only viewing only)
- **FR-004**: System MUST fetch summary content from the feature branch for tickets not in SHIP stage
- **FR-005**: System MUST fetch summary content from the main branch for tickets in SHIP stage
- **FR-006**: System MUST display an appropriate error message if the summary file cannot be fetched
- **FR-007**: System MUST visually differentiate the Summary button from existing Spec, Plan, and Tasks buttons
- **FR-008**: System MUST support viewing commit history for the summary file (same as other documentation types)

### Key Entities

- **Summary Document**: A markdown file (`summary.md`) located in `specs/{branch-name}/summary.md` containing implementation details, changes made, key decisions, and files modified during the implement step
- **DocumentType**: Extended to include 'summary' as a valid document type alongside 'spec', 'plan', and 'tasks'

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can access the implementation summary within 2 clicks from the ticket detail view (open modal → click Summary button → view content)
- **SC-002**: Summary button appears within 5 seconds of implement job completion when viewing the ticket
- **SC-003**: Summary content loads and displays within the same time frame as other documentation types (spec, plan, tasks)
- **SC-004**: 100% of FULL workflow tickets with completed implement jobs display the Summary button
- **SC-005**: 0% of QUICK workflow tickets display the Summary button (since they don't generate summary files)
