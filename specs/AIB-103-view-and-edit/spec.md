# Feature Specification: View and Edit the Constitution

**Feature Branch**: `AIB-103-view-and-edit`
**Created**: 2025-12-11
**Status**: Draft
**Input**: User description: "on the project setting view add a button to consult the constitution.md of the project. It's a markdown file, use the same rendering than for other markdown file previous in the site. We could edit the file and show the history like for the spec, plan and task file of a ticket."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Apply CONSERVATIVE policy despite initial AUTO scoring suggesting PRAGMATIC
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) - netScore=-1, absScore=1, below threshold
- **Fallback Triggered?**: Yes - Low confidence score (<0.5) triggered automatic fallback to CONSERVATIVE
- **Trade-offs**:
  1. Slightly more implementation effort for robust error handling and validation
  2. Better long-term maintainability and security for configuration file editing
- **Reviewer Notes**: Constitution file editing has significant impact on project governance; CONSERVATIVE approach is appropriate. Validate that markdown validation and edit confirmation patterns follow existing implementation.

---

- **Decision**: Edit permissions for constitution file follow project owner/member access pattern
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - matches existing project settings access patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Only project owners and members can edit; may require role expansion later
  2. Consistent with existing authorization model
- **Reviewer Notes**: Verify that edit permissions align with `verifyProjectAccess` helper used in other project settings endpoints.

---

- **Decision**: File location follows existing `.specify/memory/constitution.md` convention
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - existing codebase pattern established
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Requires target repository to have spec-kit structure
  2. Consistent with existing documentation paths
- **Reviewer Notes**: Handle case where constitution file doesn't exist in target repository with appropriate user feedback.

---

- **Decision**: Version history displayed using same commit-based approach as spec/plan/tasks
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - follows established patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Relies on GitHub commit history (may be empty for new files)
  2. Consistent user experience across all markdown viewers
- **Reviewer Notes**: Validate that GitHub API calls follow same patterns as existing doc-fetcher implementation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Constitution (Priority: P1)

A project owner or member wants to review the current project constitution to understand development guidelines, testing requirements, and governance rules before starting work on a ticket.

**Why this priority**: Reading the constitution is the foundational capability - users must be able to view the document before any editing or history features are useful.

**Independent Test**: Can be fully tested by navigating to project settings, clicking the constitution button, and verifying the markdown content renders correctly.

**Acceptance Scenarios**:

1. **Given** a project with a constitution file exists, **When** user navigates to project settings and clicks the constitution button, **Then** a modal displays the rendered markdown content of `.specify/memory/constitution.md`.
2. **Given** a project without a constitution file, **When** user clicks the constitution button, **Then** a clear message indicates the file doesn't exist with guidance on how to create one.
3. **Given** the constitution file contains code blocks, tables, and headers, **When** the file is displayed, **Then** all markdown elements render correctly with syntax highlighting for code.

---

### User Story 2 - Edit Constitution (Priority: P2)

A project owner or member needs to update the constitution to add new principles, modify existing guidelines, or fix documentation errors.

**Why this priority**: Editing extends the core viewing capability and is the primary action users will take after reading the constitution.

**Independent Test**: Can be fully tested by opening the constitution viewer, clicking edit, modifying content, saving, and verifying the changes persist in the repository.

**Acceptance Scenarios**:

1. **Given** user has project access and is viewing the constitution, **When** they click the edit button, **Then** a textarea editor appears with the raw markdown content and save/cancel buttons.
2. **Given** user modifies the constitution content, **When** they click save, **Then** changes are committed to the repository with a descriptive commit message and the viewer refreshes to show updated content.
3. **Given** user has unsaved changes in the editor, **When** they attempt to close or navigate away, **Then** a confirmation prompt warns about losing unsaved changes.
4. **Given** user enters invalid markdown syntax, **When** they attempt to save, **Then** validation prevents the save and displays a helpful error message.

---

### User Story 3 - View Constitution History (Priority: P3)

A project member wants to understand how the constitution has evolved over time, who made changes, and when amendments were made.

**Why this priority**: History provides transparency and audit trail for governance changes, supporting team collaboration and accountability.

**Independent Test**: Can be fully tested by viewing the constitution, clicking history tab, selecting a commit, and verifying diff display matches the actual changes.

**Acceptance Scenarios**:

1. **Given** the constitution has multiple commits, **When** user clicks the history tab, **Then** a chronological list of commits displays with author, date, and commit message.
2. **Given** user selects a specific commit from history, **When** the selection is confirmed, **Then** a diff view shows additions (green) and deletions (red) for that commit.
3. **Given** the constitution has no commit history (new file), **When** user clicks history, **Then** an appropriate message indicates no history is available yet.

---

### Edge Cases

- What happens when the GitHub API rate limit is exceeded? Display user-friendly error with retry guidance.
- How does system handle network errors during save? Show error toast, preserve user's edits in the editor, allow retry.
- What happens if multiple users edit simultaneously? Last save wins; consider adding stale content warning in future.
- How does system handle very large constitution files? Apply same rendering approach as existing documentation viewer (no arbitrary limits per PRAGMATIC pattern in codebase).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Constitution" button in the project settings page that opens a modal viewer.
- **FR-002**: System MUST fetch and render the constitution file from `.specify/memory/constitution.md` in the project's GitHub repository.
- **FR-003**: System MUST render markdown content using the same components as existing spec/plan/tasks viewers (react-markdown with syntax highlighting).
- **FR-004**: System MUST provide an edit mode with a textarea for modifying the raw markdown content.
- **FR-005**: System MUST validate markdown syntax before allowing save operations.
- **FR-006**: System MUST commit changes to the repository with a descriptive commit message including the modification context.
- **FR-007**: System MUST display a confirmation prompt when user has unsaved changes and attempts to close the editor.
- **FR-008**: System MUST provide a history view showing commits that modified the constitution file.
- **FR-009**: System MUST display diff information for selected historical commits showing additions and deletions.
- **FR-010**: System MUST show appropriate error messages when the constitution file doesn't exist or cannot be fetched.
- **FR-011**: System MUST restrict edit capabilities to users with valid project access (owner or member).

### Key Entities *(include if feature involves data)*

- **Constitution Document**: The markdown file at `.specify/memory/constitution.md` containing project governance principles, development guidelines, and amendment procedures.
- **Constitution Commit**: A Git commit that modified the constitution file, containing author, timestamp, message, and diff information.
- **Project Settings Page**: The existing page at `/projects/[projectId]/settings` where the constitution button will be added.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view the constitution content within 3 seconds of clicking the button (including fetch time).
- **SC-002**: Users can complete a constitution edit (open → modify → save) in under 2 minutes.
- **SC-003**: 100% of markdown elements (headers, code blocks, tables, lists, links) render correctly matching existing documentation viewer behavior.
- **SC-004**: History view loads commit list within 5 seconds for repositories with up to 100 constitution commits.
- **SC-005**: All error scenarios display user-friendly messages that guide users toward resolution.
- **SC-006**: No data loss occurs when save operation fails - user's edits remain in the editor for retry.
