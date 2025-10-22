# Feature Specification: Ticket Comments with Tabs Layout

**Feature Branch**: `042-ticket-comments-context`
**Created**: 2025-01-22
**Status**: Draft
**Input**: User description: "Ticket Comments - Add a comment system to tickets and reorganize the modal using a modern tabs layout to improve usability and scalability."

## Auto-Resolved Decisions

- **Decision**: Real-time update mechanism (WebSocket vs polling)
  - **Policy Applied**: AUTO → CONSERVATIVE
  - **Confidence**: Medium (0.6) - User-facing feature with authorization signals detected
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. Polling is simpler but less instant than WebSocket
    2. Consistent with existing job polling pattern (reduces complexity)
    3. 10-second interval balances real-time feel with server load
  - **Reviewer Notes**: Confirm 10-second polling interval is acceptable for comment updates

- **Decision**: Comment content validation (strict vs permissive)
  - **Policy Applied**: CONSERVATIVE
  - **Confidence**: High - Authorization context + user-generated content
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. 2000-character limit prevents abuse and ensures reasonable message length
    2. Markdown rendering requires XSS protection (security requirement)
    3. Stricter validation reduces potential for malicious content
  - **Reviewer Notes**: Validate 2000-character limit is sufficient for typical use cases

- **Decision**: Comment deletion policy (soft vs hard delete)
  - **Policy Applied**: CONSERVATIVE
  - **Confidence**: High - User data + audit trail considerations
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. Hard delete immediately removes data (simpler, meets user expectation)
    2. No soft delete means no recovery after deletion (acceptable for comments)
    3. Cascade delete on ticket deletion prevents orphaned data
  - **Reviewer Notes**: Confirm no need for comment recovery/audit trail

- **Decision**: Comment edit functionality (included in v1 vs future)
  - **Policy Applied**: CONSERVATIVE
  - **Confidence**: High - Scope management + quality focus
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. Excluding edit from v1 reduces scope and complexity
    2. Users can delete and recreate if needed (acceptable workaround)
    3. Edit history and audit trail adds significant complexity
  - **Reviewer Notes**: Validate that delete+recreate is acceptable workaround for v1

- **Decision**: Tab keyboard navigation shortcuts (Cmd+[1-4] vs arrow keys only)
  - **Policy Applied**: CONSERVATIVE
  - **Confidence**: High - Accessibility and UX quality focus
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. Both arrow keys and Cmd+[1-4] shortcuts provide flexibility
    2. Improves accessibility for power users
    3. Slight increase in implementation complexity (acceptable)
  - **Reviewer Notes**: Ensure keyboard shortcuts don't conflict with browser/OS shortcuts

## User Scenarios & Testing

### User Story 1 - Add Comment to Ticket (Priority: P1)

A project owner opens a ticket and wants to add a comment to document a decision, ask a question, or provide updates to collaborators. They navigate to the Comments tab, type their message in the comment form with markdown support, and submit. The comment appears immediately in the list with their name, avatar, and timestamp.

**Why this priority**: Core functionality that delivers immediate value. Without the ability to create comments, the feature has no value.

**Independent Test**: Can be fully tested by creating a ticket, opening the modal, navigating to Comments tab, and submitting a comment. Delivers collaboration value independently.

**Acceptance Scenarios**:

1. **Given** a user opens a ticket modal, **When** they click the Comments tab, **Then** they see an empty state message "No comments yet. Be the first to comment!" with a comment form
2. **Given** a user types a comment (1-2000 characters), **When** they press Cmd/Ctrl+Enter or click Submit, **Then** the comment appears at the top of the list with their name, avatar, and relative timestamp
3. **Given** a user submits a comment, **When** the submission succeeds, **Then** the form is cleared and they can immediately add another comment
4. **Given** a user types a comment exceeding 2000 characters, **When** they try to submit, **Then** the submit button is disabled and a character counter shows the overflow

---

### User Story 2 - View Comments on Ticket (Priority: P1)

A project owner opens a ticket that has existing comments. They navigate to the Comments tab and see all comments in chronological order (newest first) with author information, timestamps, and markdown-rendered content. They can scroll through the comment list to review past discussions.

**Why this priority**: Essential for reading and understanding existing discussions. Equal priority to creating comments.

**Independent Test**: Can be tested by creating a ticket with multiple comments, then opening the modal and viewing the Comments tab. Delivers value independently.

**Acceptance Scenarios**:

1. **Given** a ticket has 5 comments, **When** a user opens the Comments tab, **Then** they see all 5 comments in reverse chronological order (newest first)
2. **Given** a comment contains markdown formatting (bold, italic, links, code blocks), **When** the comment is displayed, **Then** the markdown is rendered correctly using react-markdown
3. **Given** a comment was created "2 hours ago", **When** viewing the comment, **Then** the timestamp shows "2 hours ago" in relative format
4. **Given** a comment list exceeds viewport height, **When** scrolling, **Then** comments are loaded efficiently without performance degradation

---

### User Story 3 - Delete Own Comment (Priority: P2)

A project owner wants to remove a comment they created (e.g., posted incorrect information, duplicate, or no longer relevant). They hover over their own comment, click the delete button (trash icon), confirm the deletion, and the comment is immediately removed from the list.

**Why this priority**: Important for content management but not essential for basic collaboration. Users can work around by adding clarifying comments.

**Independent Test**: Can be tested by creating a comment, then deleting it. Delivers content management value independently.

**Acceptance Scenarios**:

1. **Given** a user views their own comment, **When** they hover over it, **Then** a delete button (trash icon) appears
2. **Given** a user clicks the delete button on their own comment, **When** they confirm the deletion, **Then** the comment is removed immediately with optimistic update
3. **Given** a user views another user's comment, **When** they hover over it, **Then** no delete button appears (authorization enforcement)
4. **Given** a user deletes a comment, **When** the deletion fails (network error), **Then** the comment reappears with an error toast notification

---

### User Story 4 - Navigate Between Tabs (Priority: P2)

A project owner opens a ticket modal and wants to quickly navigate between different types of information (Details, Comments, Files). They can click tab headers, use keyboard shortcuts (Cmd+[1-4]), or use arrow keys to switch tabs. The active tab is visually highlighted and its content is displayed.

**Why this priority**: Improves navigation efficiency but not critical for core functionality. Users can click tabs without shortcuts.

**Independent Test**: Can be tested by opening a ticket modal and switching between tabs using mouse and keyboard. Delivers navigation efficiency independently.

**Acceptance Scenarios**:

1. **Given** a user opens a ticket modal, **When** the modal loads, **Then** the Details tab is active by default
2. **Given** a user is on the Details tab, **When** they click the Comments tab header, **Then** the Comments tab becomes active and displays comment content
3. **Given** a user is on the Details tab, **When** they press Cmd/Ctrl+2, **Then** the Comments tab becomes active (keyboard shortcut)
4. **Given** a user is on the Comments tab, **When** they press the right arrow key, **Then** the Files tab becomes active (keyboard navigation)
5. **Given** the Comments tab contains 5 comments, **When** the tab header displays, **Then** it shows a badge "Comments (5)" with the count

---

### User Story 5 - Real-Time Comment Updates (Priority: P3)

A project owner has a ticket modal open on the Comments tab. Another user adds a comment to the same ticket. Within 10 seconds, the new comment appears automatically in the first user's comment list without requiring a manual refresh.

**Why this priority**: Nice-to-have for real-time collaboration but not essential. Users can manually refresh if needed.

**Independent Test**: Can be tested with two browser windows open to the same ticket, adding a comment in one window and observing the update in the other. Delivers real-time collaboration value independently.

**Acceptance Scenarios**:

1. **Given** a user has the Comments tab open, **When** another user creates a comment, **Then** the new comment appears within 10 seconds without manual refresh
2. **Given** a user has the Comments tab open, **When** polling detects a new comment, **Then** the comment count badge updates automatically (e.g., "Comments (5)" → "Comments (6)")
3. **Given** a user creates a comment, **When** polling runs, **Then** their own comment is not duplicated (polling filters out optimistically added comments)
4. **Given** a user closes the ticket modal, **When** the modal unmounts, **Then** polling stops to conserve resources

---

### User Story 6 - Reorganize Ticket Modal with Tabs (Priority: P1)

A project owner opens a ticket modal and sees a clean, organized interface with tabs (Details, Comments, Files) instead of a long scrollable list. All existing functionality (title editing, description editing, images, actions, metadata) remains accessible in the Details tab, with improved organization and reduced scrolling.

**Why this priority**: Core structural change that enables all other user stories. Must be completed first.

**Independent Test**: Can be tested by opening a ticket modal and verifying all existing functionality works in the new tab structure. Delivers improved organization independently.

**Acceptance Scenarios**:

1. **Given** a user opens a ticket modal, **When** the modal loads, **Then** they see tab headers (Details, Comments, Files) at the top
2. **Given** a user is on the Details tab, **When** they view the content, **Then** they see title (editable), description (editable), metadata (badges, branch link), action buttons (View Spec, View Plan, View Tasks), and dates (Created, Last Updated)
3. **Given** a user is on the Files tab, **When** the tab loads, **Then** they see the existing ImageGallery component with all current functionality preserved
4. **Given** a user edits the ticket title in the Details tab, **When** they save, **Then** the edit succeeds and the change is reflected (regression test - existing functionality preserved)
5. **Given** a user uploads an image in the Files tab, **When** the upload succeeds, **Then** the image appears in the gallery (regression test - existing functionality preserved)

---

### Edge Cases

- **What happens when a user submits an empty comment?** Submit button is disabled when comment content is empty (1-2000 characters validation)
- **What happens when comment content contains malicious HTML/JavaScript?** Markdown renderer (react-markdown) escapes HTML by default, preventing XSS attacks
- **What happens when polling fails (network error)?** Polling continues with exponential backoff, user sees last successful state, no error toast (silent failure acceptable for polling)
- **What happens when a user deletes a comment that another user is currently reading?** The comment disappears from the other user's view within 10 seconds via polling (eventual consistency)
- **What happens when a user navigates away from the Comments tab?** Polling continues for real-time updates, but content is not rendered (performance optimization)
- **What happens when the Comments tab has 100+ comments?** All comments are rendered (no pagination in v1), but virtualization can be added in future if performance issues arise
- **What happens when a user tries to delete another user's comment via API manipulation?** API returns 403 Forbidden (authorization check: comment.userId must match session user ID)
- **What happens when keyboard shortcuts conflict with browser shortcuts?** Tab-specific shortcuts (Cmd+[1-4]) are uncommon and unlikely to conflict; if conflict occurs, user can still use arrow keys or click tabs
- **What happens when mobile users try to use keyboard shortcuts?** Shortcuts are ignored on mobile (touch-first interaction), users navigate via tab header clicks

## Requirements

### Functional Requirements

#### Comment System

- **FR-001**: System MUST allow authenticated project owners to create comments on tickets they own
- **FR-002**: System MUST validate comment content between 1-2000 characters (inclusive)
- **FR-003**: System MUST render comment content as markdown using react-markdown library with HTML escaping enabled
- **FR-004**: System MUST display comments in reverse chronological order (newest first)
- **FR-005**: System MUST show comment metadata: author name, author avatar (or initials fallback), relative timestamp (e.g., "2 hours ago")
- **FR-006**: System MUST allow comment authors to delete their own comments
- **FR-007**: System MUST prevent users from deleting comments they did not create (authorization enforcement)
- **FR-008**: System MUST cascade delete all comments when a ticket is deleted (foreign key constraint with ON DELETE CASCADE)
- **FR-009**: System MUST support markdown features: bold, italic, links, code blocks, lists, headings
- **FR-010**: System MUST display empty state message "No comments yet. Be the first to comment!" when no comments exist

#### Tabs Navigation

- **FR-011**: System MUST display tab headers: Details (default), Comments, Files
- **FR-012**: System MUST show active tab with visual highlight (border, background color)
- **FR-013**: System MUST display comment count badge on Comments tab header (e.g., "Comments (5)")
- **FR-014**: System MUST update comment count badge in real-time when comments are added or deleted
- **FR-015**: System MUST support keyboard navigation between tabs using arrow keys (left/right)
- **FR-016**: System MUST support keyboard shortcuts: Cmd/Ctrl+1 (Details), Cmd/Ctrl+2 (Comments), Cmd/Ctrl+3 (Files)
- **FR-017**: System MUST make tabs horizontally scrollable on mobile when tab headers exceed viewport width
- **FR-018**: System MUST preserve existing functionality in Details tab: title editing, description editing, metadata display, action buttons, dates

#### Comment Form

- **FR-019**: System MUST display comment form in Comments tab with textarea, character counter, submit button
- **FR-020**: System MUST auto-focus textarea when Comments tab is opened for the first time
- **FR-021**: System MUST show character counter displaying current/max characters (e.g., "250 / 2000")
- **FR-022**: System MUST disable submit button when content is empty or exceeds 2000 characters
- **FR-023**: System MUST submit comment on Cmd/Ctrl+Enter keyboard shortcut
- **FR-024**: System MUST clear form after successful comment submission
- **FR-025**: System MUST show loading state (disabled form, "Submitting..." button text) during comment submission
- **FR-026**: System MUST implement optimistic updates: show comment immediately, rollback on error

#### Real-Time Updates

- **FR-027**: System MUST poll for new comments every 10 seconds when Comments tab is open
- **FR-028**: System MUST stop polling when ticket modal is closed or unmounted
- **FR-029**: System MUST update comment list automatically when polling detects new comments
- **FR-030**: System MUST prevent duplicate comments (filter out optimistically added comments during polling)
- **FR-031**: System MUST update comment count badge when polling detects changes

#### Files Tab

- **FR-032**: System MUST display existing ImageGallery component in Files tab
- **FR-033**: System MUST preserve all existing image upload, view, and delete functionality
- **FR-034**: System MUST maintain current lazy loading behavior for images

#### Authorization & Security

- **FR-035**: System MUST validate project ownership: only project owners can view/create/delete comments
- **FR-036**: System MUST validate comment authorship: only comment authors can delete their own comments
- **FR-037**: System MUST return 403 Forbidden for unauthorized comment access attempts
- **FR-038**: System MUST sanitize markdown output to prevent XSS attacks (react-markdown default escaping)
- **FR-039**: System MUST validate comment content server-side using Zod schema

### Key Entities

- **Comment**: Represents a user comment on a ticket
  - ID (integer, auto-increment)
  - Ticket ID (foreign key to Ticket, cascade delete)
  - User ID (foreign key to User, cascade delete)
  - Content (string, 1-2000 characters, markdown-formatted)
  - Created At (timestamp)
  - Updated At (timestamp)
  - Relationships: Belongs to Ticket, Belongs to User
  - Indexes: (ticketId, createdAt) for efficient query sorting, (userId) for author filtering

- **Ticket**: Extended with comments relationship
  - Comments (one-to-many relationship with Comment model)
  - All existing fields preserved

- **User**: Extended with comments relationship
  - Comments (one-to-many relationship with Comment model)
  - All existing fields preserved

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can create a comment and see it appear in the list within 2 seconds (including network latency)
- **SC-002**: Users can navigate between tabs using keyboard shortcuts in under 1 second (instant UI response)
- **SC-003**: Comment polling updates appear within 10 seconds of creation by another user (real-time collaboration)
- **SC-004**: Users can view 100 comments without perceivable lag (< 500ms render time)
- **SC-005**: Markdown rendering correctly displays all supported features (bold, italic, links, code blocks, lists, headings) for 100% of valid markdown syntax
- **SC-006**: Comment deletion succeeds within 2 seconds with optimistic update (instant perceived deletion)
- **SC-007**: Tab navigation works on mobile devices with touch interaction (100% success rate on iOS and Android)
- **SC-008**: All existing ticket modal functionality (title edit, description edit, image upload) works without regression (100% feature parity)
- **SC-009**: E2E test coverage achieves ≥90% for comment system and tabs navigation
- **SC-010**: API authorization prevents 100% of unauthorized comment access/deletion attempts (security validation)

### Qualitative Outcomes

- **SC-011**: Users report improved ticket modal organization and reduced scrolling (post-launch survey)
- **SC-012**: Users find the Comments tab interface intuitive and easy to use (measured via usability testing)
- **SC-013**: Keyboard navigation improves efficiency for power users (measured via user feedback)
- **SC-014**: Real-time comment updates enhance collaboration without requiring manual refresh (measured via user behavior analytics)
- **SC-015**: Markdown support enables richer communication (code snippets, formatted text) compared to plain text (measured via markdown usage rate)
