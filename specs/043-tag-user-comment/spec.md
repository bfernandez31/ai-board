# Feature Specification: User Mentions in Comments

**Feature Branch**: `043-tag-user-comment`
**Created**: 2025-10-22
**Status**: Draft
**Input**: User description: "Tag user comment - I would like in comment to tag an user with the @ should propose the liste of user and filter when taping letter like other tag in comment systeme, ex : github, jira ..."

## Auto-Resolved Decisions

- **Decision**: Mention trigger character and activation behavior
- **Policy Applied**: INTERACTIVE (TEXT payload default)
- **Confidence**: High (0.9) - Industry standard pattern
- **Fallback Triggered?**: No - Clear industry precedent
- **Trade-offs**:
  1. Using @ symbol aligns with user expectations from GitHub/Jira but requires keyboard input handling
  2. Instant autocomplete on @ provides best UX but requires client-side filtering for performance
- **Reviewer Notes**: Verify @ symbol doesn't conflict with existing markdown formatting or comment syntax

---

- **Decision**: User search and filtering behavior
- **Policy Applied**: INTERACTIVE (TEXT payload default)
- **Confidence**: Medium (0.7) - Common pattern but implementation details matter
- **Fallback Triggered?**: No - Standard autocomplete pattern
- **Trade-offs**:
  1. Fuzzy matching provides better UX but requires more complex search logic
  2. Case-insensitive search is expected but may need careful handling for display names
- **Reviewer Notes**: Confirm whether partial matches should search both name and email, or name only

---

- **Decision**: Mention storage and notification behavior
- **Policy Applied**: INTERACTIVE (user clarification provided)
- **Confidence**: High (1.0) - User explicitly selected visual-only approach
- **Fallback Triggered?**: No - Clear user decision
- **Trade-offs**:
  1. Visual-only approach keeps MVP scope minimal and focused on core mention functionality
  2. No notification system required in initial implementation, can be added in future phase
  3. Users must manually check for mentions, reducing discoverability but avoiding notification overhead
- **Reviewer Notes**: Mentions are visual-only in this implementation. No in-app or email notifications will be triggered when users are mentioned. Future enhancement could add notification layer.

---

- **Decision**: Deleted user mention handling (Q1: Preserve with "[Removed User]" indicator)
- **Policy Applied**: INTERACTIVE (user clarification provided)
- **Confidence**: High (1.0) - User explicitly selected preservation approach
- **Fallback Triggered?**: No - Clear user decision
- **Trade-offs**:
  1. Preserving mentions maintains comment context and historical integrity
  2. "[Removed User]" indicator makes it clear someone was mentioned without losing comment meaning
  3. Simpler data model than full anonymization while maintaining audit trail
- **Reviewer Notes**: When a mentioned user is removed from the project, their mention remains in the comment but displays as "[Removed User]". This preserves comment context while indicating the user is no longer available.

---

- **Decision**: Name change handling in mentions (Q2: Always show current name)
- **Policy Applied**: INTERACTIVE (user clarification provided)
- **Confidence**: High (1.0) - User explicitly selected auto-update approach
- **Fallback Triggered?**: No - Clear user decision
- **Trade-offs**:
  1. Auto-updating to current name provides accuracy and reduces confusion
  2. Loses historical context of what name was shown at time of mention
  3. Simpler data model - only need to store user ID reference, not name snapshot
  4. Better for users who change names (no stale references in old comments)
- **Reviewer Notes**: Mentions automatically reflect the user's current name. When viewing old comments, users will see the mentioned person's current name, not the name they had when the mention was created. This requires storing user ID references rather than text snapshots.

## Multi-User Project Support

**Current Implementation**:
- User mentions support **multi-user projects** via ProjectMember join table
- The autocomplete dropdown shows all project members (owner + members)
- Comment storage and display fully support multiple user mentions
- Role-based membership (owner vs member) for future permission features

**Database Model**:
- **ProjectMember** table: many-to-many relationship between Project and User
- Fields: id, projectId, userId, role (owner/member), createdAt
- Unique constraint on (projectId, userId) to prevent duplicate memberships
- Cascade delete: removing a project or user removes associated memberships

## User Scenarios & Testing

### User Story 1 - Basic User Mention Autocomplete (Priority: P1)

A project member writes a comment mentioning another team member to draw their attention to a specific ticket discussion.

**Why this priority**: Core functionality that enables the mention feature - without autocomplete, users cannot effectively tag others. This is the MVP that delivers immediate value.

**Independent Test**: Can be fully tested by typing @ in a comment field and selecting a user from the dropdown. Delivers value by allowing users to reference team members in comments.

**Acceptance Scenarios**:

1. **Given** I am writing a comment on a ticket, **When** I type the @ character, **Then** an autocomplete dropdown appears showing all project members
2. **Given** the autocomplete dropdown is open, **When** I type "joh" after the @ symbol, **Then** the list filters to show only users whose names contain "joh" (case-insensitive)
3. **Given** the filtered user list is showing, **When** I click on a user from the dropdown, **Then** the user's name is inserted into the comment and the dropdown closes
4. **Given** I have mentioned a user using @, **When** I submit the comment, **Then** the mention appears as formatted text (e.g., bold or highlighted) in the saved comment

---

### User Story 2 - Keyboard Navigation (Priority: P2)

A power user navigates the mention autocomplete using only their keyboard for faster comment authoring.

**Why this priority**: Significantly improves efficiency for frequent users but system works without it. Enhances UX but not required for basic functionality.

**Independent Test**: Can be tested by typing @ and using arrow keys + Enter to select users without touching the mouse. Delivers value through faster comment authoring.

**Acceptance Scenarios**:

1. **Given** the autocomplete dropdown is open, **When** I press the down arrow key, **Then** the next user in the list is highlighted
2. **Given** a user is highlighted in the dropdown, **When** I press the up arrow key, **Then** the previous user in the list is highlighted
3. **Given** a user is highlighted in the dropdown, **When** I press Enter, **Then** that user is inserted into the comment and the dropdown closes
4. **Given** the autocomplete dropdown is open, **When** I press Escape, **Then** the dropdown closes without inserting a mention

---

### User Story 3 - Multiple Mentions (Priority: P3)

A project manager mentions multiple team members in a single comment to notify them all about an important update.

**Why this priority**: Nice-to-have that improves multi-person collaboration but not essential for basic mention functionality.

**Independent Test**: Can be tested by adding multiple @ mentions in one comment. Delivers value for team coordination scenarios.

**Acceptance Scenarios**:

1. **Given** I have already mentioned one user, **When** I type @ again in the same comment, **Then** a new autocomplete dropdown appears
2. **Given** I have mentioned multiple users, **When** I submit the comment, **Then** all mentions are properly formatted in the saved comment
3. **Given** a comment contains multiple mentions, **When** I view the comment, **Then** each mentioned user is distinctly formatted and identifiable

---

### User Story 4 - Mention Persistence and Display (Priority: P1)

A user views a previously saved comment containing mentions and sees clear visual indication of who was tagged.

**Why this priority**: Essential for making mentions useful - users need to see who was mentioned in historical comments. Core to feature value.

**Independent Test**: Can be tested by saving a comment with mentions, refreshing the page, and verifying mentions still appear formatted. Delivers value through persistent mention tracking.

**Acceptance Scenarios**:

1. **Given** a comment contains user mentions, **When** I view the comment after page reload, **Then** the mentions are still visually formatted
2. **Given** I am viewing a comment with mentions, **When** I hover over a mention, **Then** I see the full user details (name and email)
3. **Given** a mentioned user has changed their name, **When** I view an old comment, **Then** the mention shows the user's current name (automatically updates)

---

### Edge Cases

- What happens when a user types @ but then continues typing without selecting anyone from the dropdown?
- How does the system handle mentions when a user is removed from the project?
- What happens if a user types @@ (double @)?
- How does the autocomplete behave when there are 50+ users in the project?
- What happens when a user types @ at the very end of the character limit for a comment?
- How does the system handle copy-pasting text that contains @ symbols?
- What happens when a user deletes a mention after inserting it?
- How does the autocomplete perform on mobile devices with smaller screens?

## Requirements

### Functional Requirements

- **FR-001**: System MUST display an autocomplete dropdown when user types @ character in comment input field
- **FR-002**: System MUST filter user list in real-time as user types characters after the @ symbol
- **FR-003**: User list MUST search against user names in a case-insensitive manner
- **FR-004**: System MUST allow users to select a user from the dropdown using mouse click
- **FR-005**: System MUST allow users to select a user from the dropdown using keyboard (arrow keys + Enter)
- **FR-006**: System MUST insert the selected user's name into the comment at the cursor position
- **FR-007**: System MUST close the autocomplete dropdown after a user is selected
- **FR-008**: System MUST close the autocomplete dropdown when user presses Escape key
- **FR-009**: System MUST persist mentions in the saved comment
- **FR-010**: System MUST visually distinguish mentions from regular text in displayed comments (e.g., bold, highlighted, or different color)
- **FR-011**: System MUST allow multiple mentions within a single comment
- **FR-012**: System MUST only show users who are members of the current project in the autocomplete
- **FR-013**: System MUST preserve mentions when mentioned user is later removed from project, displaying "[Removed User]" indicator in place of the user's name
- **FR-014**: System MUST limit autocomplete dropdown to a reasonable number of visible items (e.g., 10) with scrolling for additional users
- **FR-015**: System MUST dismiss autocomplete dropdown when user clicks outside the dropdown or comment field

### Key Entities

- **User Mention**: A reference to a project member within a comment, triggered by @ symbol. Contains the mentioned user's identifier and display text. Related to both the Comment entity (where it appears) and the User entity (who is mentioned).

- **Comment**: The container for user mentions, containing the comment text with embedded mention references. Related to Ticket and User (comment author).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can successfully insert a mention in under 3 seconds from typing @ to selection
- **SC-002**: Autocomplete filtering reduces visible user list by at least 50% after typing 2 characters
- **SC-003**: 95% of mention attempts result in successful user selection (not abandoned)
- **SC-004**: Keyboard navigation allows mention insertion without mouse interaction
- **SC-005**: System maintains responsive performance (under 100ms) for autocomplete filtering with up to 100 project members
- **SC-006**: Mentions remain visible and properly formatted after comment save and page reload
