# Feature Specification: View Plan and Tasks Documentation

**Feature Branch**: `035-view-plan-and`
**Created**: 2025-10-18
**Status**: Draft
**Input**: User description: "View plan and tasks like for the spec we need to consult the md plan and tasks of the current branche, add a button for each file next to teh spec button in the ticket detail modal. This button are visible when it's a full ticket (no quick) and the job plan is completed. You have to get them on the branche of the ticket. but when the ticket is shipped then you should get the file from the main branche. you have to apply this last rule on the spec file too."

## Auto-Resolved Decisions

- **Decision**: Branch selection logic for retrieving documentation files
- **Policy Applied**: CONSERVATIVE (fallback from AUTO)
- **Confidence**: Low (0.3, netScore +1, only neutral UI enhancement signals)
- **Fallback Triggered?**: Yes — AUTO confidence was below 0.5 threshold, promoted to CONSERVATIVE for safety
- **Trade-offs**:
  1. **Impact on scope**: Ensures consistent behavior across all documentation files (spec, plan, tasks) by applying unified branch logic
  2. **Impact on timeline**: Minimal — reuses existing GitHub API patterns from spec file retrieval
- **Reviewer Notes**: Validate that "shipped" status correctly maps to SHIP stage and that fetching from main branch is appropriate for shipped tickets

---

- **Decision**: Visibility conditions for plan and tasks buttons
- **Policy Applied**: CONSERVATIVE (fallback from AUTO)
- **Confidence**: Medium (0.6, clear business rule from feature description)
- **Fallback Triggered?**: No — medium confidence is actionable under CONSERVATIVE
- **Trade-offs**:
  1. **Impact on scope**: Buttons only appear for full workflow tickets after plan stage completion, preventing confusion for quick-impl tickets
  2. **Impact on user experience**: Users see documentation controls only when relevant files exist
- **Reviewer Notes**: Confirm that "job plan is completed" refers to the PLAN stage job status being COMPLETED, not any specific field name

---

- **Decision**: File retrieval strategy for shipped vs. in-progress tickets
- **Policy Applied**: CONSERVATIVE (fallback from AUTO)
- **Confidence**: High (0.9, explicit requirement in feature description)
- **Fallback Triggered?**: No — high confidence with clear user intent
- **Trade-offs**:
  1. **Impact on data integrity**: Shipped tickets show frozen documentation from main branch, preserving historical accuracy
  2. **Impact on user experience**: Users see work-in-progress documentation for active tickets, final documentation for shipped features
- **Reviewer Notes**: Validate that this behavior aligns with user expectations for viewing documentation at different stages

## User Scenarios & Testing

### User Story 1 - View Implementation Plan for Active Ticket (Priority: P1)

As a developer reviewing an active ticket, I need to view the implementation plan (plan.md) to understand the technical approach and design decisions before starting work.

**Why this priority**: Core functionality enabling developers to access complete planning documentation, directly supports primary workflow

**Independent Test**: Can be fully tested by creating a full-workflow ticket in PLAN stage with completed plan job, opening ticket detail modal, clicking "View Plan" button, and verifying plan.md content displays from feature branch

**Acceptance Scenarios**:

1. **Given** a full-workflow ticket in PLAN or BUILD stage with completed plan job, **When** user opens ticket detail modal, **Then** "View Plan" button appears next to "View Spec" button
2. **Given** "View Plan" button is visible, **When** user clicks the button, **Then** plan.md content from the ticket's feature branch is displayed in a readable format
3. **Given** a quick-impl ticket (workflowType = QUICK), **When** user opens ticket detail modal, **Then** "View Plan" button does not appear (only spec button visible)
4. **Given** a full-workflow ticket in SPECIFY stage (plan job not completed), **When** user opens ticket detail modal, **Then** "View Plan" button does not appear

---

### User Story 2 - View Task List for Active Ticket (Priority: P2)

As a developer implementing a feature, I need to view the task breakdown (tasks.md) to understand the specific implementation steps and track progress against the plan.

**Why this priority**: Enhances developer workflow by providing access to detailed task breakdown, secondary to viewing the overall plan

**Independent Test**: Can be fully tested by creating a full-workflow ticket in BUILD stage with completed plan job, opening ticket detail modal, clicking "View Tasks" button, and verifying tasks.md content displays from feature branch

**Acceptance Scenarios**:

1. **Given** a full-workflow ticket in BUILD, VERIFY, or SHIP stage with completed plan job, **When** user opens ticket detail modal, **Then** "View Tasks" button appears next to "View Plan" button
2. **Given** "View Tasks" button is visible, **When** user clicks the button, **Then** tasks.md content from the ticket's feature branch is displayed
3. **Given** a full-workflow ticket in PLAN stage, **When** user opens ticket detail modal, **Then** "View Tasks" button does not appear (tasks.md not created until implementation begins)

---

### User Story 3 - View Shipped Feature Documentation (Priority: P3)

As a developer or stakeholder reviewing a shipped feature, I need to view the finalized documentation (spec.md, plan.md, tasks.md) from the main branch to see the canonical version of what was delivered.

**Why this priority**: Ensures historical accuracy for shipped features, important for reference but not critical for active development workflow

**Independent Test**: Can be fully tested by creating a shipped ticket (SHIP stage), opening ticket detail modal, clicking documentation buttons, and verifying all files are fetched from main branch instead of feature branch

**Acceptance Scenarios**:

1. **Given** a ticket in SHIP stage with completed jobs, **When** user opens ticket detail modal and clicks "View Spec", **Then** spec.md is fetched from main branch (not feature branch)
2. **Given** a shipped ticket (SHIP stage), **When** user clicks "View Plan", **Then** plan.md is fetched from main branch
3. **Given** a shipped ticket (SHIP stage), **When** user clicks "View Tasks", **Then** tasks.md is fetched from main branch
4. **Given** a ticket in BUILD stage (not shipped), **When** user clicks any documentation button, **Then** files are fetched from the feature branch specified in ticket.branch

---

### Edge Cases

- What happens when a documentation file (plan.md or tasks.md) does not exist on the expected branch? System should display a user-friendly error message indicating the file is not available yet
- How does the system handle network failures when fetching files from GitHub API? System should show an error state with retry option
- What happens if ticket.branch field is null or empty for a non-shipped ticket? System should disable documentation buttons and show a message indicating branch is not yet created
- How are documentation buttons displayed on mobile/small screens alongside the existing spec button? System should maintain usable spacing and touch targets
- What happens when a user clicks multiple documentation buttons rapidly? System should handle concurrent requests gracefully without race conditions
- How does the system handle very large documentation files (>1MB)? System should implement reasonable size limits and display warnings for large files

## Requirements

### Functional Requirements

- **FR-001**: System MUST display "View Plan" and "View Tasks" buttons in ticket detail modal for full-workflow tickets (workflowType = FULL) when the PLAN stage job status is COMPLETED
- **FR-002**: System MUST hide "View Plan" and "View Tasks" buttons for quick-impl tickets (workflowType = QUICK)
- **FR-003**: System MUST fetch documentation files (spec.md, plan.md, tasks.md) from the ticket's feature branch when ticket stage is not SHIP
- **FR-004**: System MUST fetch documentation files (spec.md, plan.md, tasks.md) from the main branch when ticket stage is SHIP
- **FR-005**: System MUST position "View Plan" and "View Tasks" buttons adjacent to the existing "View Spec" button with consistent spacing and styling
- **FR-006**: System MUST display plan.md content in a readable format when user clicks "View Plan" button
- **FR-007**: System MUST display tasks.md content in a readable format when user clicks "View Tasks" button
- **FR-008**: System MUST apply the same branch selection logic (feature branch vs. main branch) to the existing "View Spec" button based on ticket stage
- **FR-009**: System MUST show clear error messages when documentation files are not found on the expected branch
- **FR-010**: System MUST handle GitHub API failures gracefully with user-friendly error messages and retry options
- **FR-011**: System MUST disable documentation buttons when ticket.branch field is null or empty for non-shipped tickets

### Key Entities

- **Ticket**: Existing entity with workflowType (FULL/QUICK), stage (INBOX/SPECIFY/PLAN/BUILD/VERIFY/SHIP), and branch fields used to determine button visibility and file retrieval logic
- **Job**: Existing entity with status field used to check if PLAN stage job is COMPLETED before showing plan/tasks buttons
- **Documentation File**: Represents spec.md, plan.md, or tasks.md files retrieved from GitHub repository at specific branch or commit

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can access plan.md and tasks.md for any full-workflow ticket in PLAN or later stages within 2 clicks (open modal, click button)
- **SC-002**: Documentation files load and display within 3 seconds under normal network conditions
- **SC-003**: 100% of shipped tickets (SHIP stage) correctly retrieve documentation from main branch instead of feature branch
- **SC-004**: Zero instances of documentation buttons appearing for quick-impl tickets or tickets without completed plan jobs
- **SC-005**: Users can distinguish between the three documentation types (spec, plan, tasks) through clear button labels and consistent positioning
