# Feature Specification: Duplicate Ticket

**Feature Branch**: `AIB-106-duplicate-a-ticket`
**Created**: 2025-12-12
**Status**: Draft
**Input**: User description: "Add a button to duplicate a ticket from the ticket modal. Identify the best UX approach for implementing this feature. Duplicating a ticket should create a new ticket in the inbox with the same title, description, clarification policy, and image attachments. Add the relevant tests"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Button placement location in ticket modal
- **Policy Applied**: AUTO (resolved as PRAGMATIC)
- **Confidence**: High (0.8) - Internal feature enhancement with clear UX patterns in codebase
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Placing duplicate button in the modal header metadata row aligns with existing button patterns (Edit Policy button) and keeps primary content area clean
  2. Alternative dropdown menu would require additional clicks but scales better for future actions
- **Reviewer Notes**: Verify that header row has sufficient space for the duplicate button on mobile viewports

---

- **Decision**: Handling of duplicate title naming convention
- **Policy Applied**: AUTO (resolved as PRAGMATIC)
- **Confidence**: High (0.85) - Industry-standard pattern for duplicates
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prefixing with "Copy of " clearly indicates a duplicate vs appending "(Copy)" which may truncate on long titles
  2. Title length limit (100 chars) may be exceeded; truncation of original title before prefix required
- **Reviewer Notes**: Validate that truncated titles with prefix still make sense contextually

---

- **Decision**: Whether to copy image attachments by reference or create new copies
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (0.6) - Data integrity concern with external URLs vs uploaded images
- **Fallback Triggered?**: Yes - promoted to CONSERVATIVE due to data integrity implications
- **Trade-offs**:
  1. Copying by reference (keeping same URLs) is simpler but creates dependency on original ticket's images
  2. For uploaded images (Cloudinary), referencing same URL is safe as images persist independently
  3. External URLs are already references, so copying URL is appropriate
- **Reviewer Notes**: Both uploaded and external images can safely reference the same URLs; no need to re-upload

---

- **Decision**: Availability of duplicate action based on ticket stage
- **Policy Applied**: AUTO (resolved as PRAGMATIC)
- **Confidence**: High (0.9) - Functional requirement aligns with existing stage-based restrictions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Allowing duplication from any stage provides maximum flexibility
  2. Restricting to INBOX only would be more conservative but unnecessarily limiting
- **Reviewer Notes**: Users may want to duplicate a shipped ticket to create a follow-up; all stages should allow duplication

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Duplicate Ticket from Modal (Priority: P1)

A user wants to create a new ticket based on an existing one. They open the ticket modal for any ticket in the board, click the duplicate button, and a new ticket appears in the INBOX with the same content.

**Why this priority**: Core functionality that delivers the primary value of the feature - reducing time spent recreating similar tickets.

**Independent Test**: Can be fully tested by opening a ticket modal, clicking duplicate, and verifying a new ticket appears in INBOX with matching content.

**Acceptance Scenarios**:

1. **Given** a ticket exists with title, description, clarification policy, and attachments, **When** user opens the ticket modal and clicks the duplicate button, **Then** a new ticket is created in INBOX with title prefixed "Copy of ", same description, same clarification policy, and same attachments
2. **Given** a ticket modal is open, **When** user clicks the duplicate button, **Then** the modal closes and user sees a success toast notification
3. **Given** a ticket with a very long title (near 100 char limit), **When** user duplicates it, **Then** the title is truncated before "Copy of " prefix to stay within 100 characters

---

### User Story 2 - Duplicate Ticket Visual Feedback (Priority: P2)

A user needs clear visual indication of the duplicate action and confirmation of success.

**Why this priority**: Essential for user experience but secondary to core duplication logic.

**Independent Test**: Can be tested by performing duplicate action and verifying all visual elements (button appearance, toast, modal behavior).

**Acceptance Scenarios**:

1. **Given** a ticket modal is open, **When** user hovers over the duplicate button, **Then** a tooltip displays "Duplicate ticket"
2. **Given** the duplicate action is in progress, **When** the API call is pending, **Then** the button shows a loading state and is disabled
3. **Given** duplication succeeds, **When** the new ticket is created, **Then** a success toast displays "Ticket duplicated" with the new ticket key

---

### User Story 3 - Duplicate Error Handling (Priority: P3)

A user attempts to duplicate a ticket but the operation fails due to network or server issues.

**Why this priority**: Error handling is important for robustness but less common than the happy path.

**Independent Test**: Can be tested by simulating API failures and verifying error states.

**Acceptance Scenarios**:

1. **Given** user clicks duplicate, **When** the API request fails, **Then** an error toast displays with a descriptive message and the modal remains open
2. **Given** a network error occurs, **When** user retries the duplicate action, **Then** the action can be attempted again without requiring modal refresh

---

### Edge Cases

- What happens when user rapidly clicks the duplicate button multiple times? (Button disabled during API call prevents multiple duplicates)
- How does the system handle duplicating a ticket that was deleted by another user? (API returns 404, error toast displayed)
- What happens if the project has reached a ticket limit? (API returns appropriate error, displayed to user)
- How does duplication work with tickets that have the maximum 5 attachments? (All 5 attachments are copied to new ticket)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a duplicate button in the ticket detail modal header row
- **FR-002**: System MUST create a new ticket in INBOX stage when duplicate is activated
- **FR-003**: System MUST copy the original ticket's title with "Copy of " prefix to the new ticket
- **FR-004**: System MUST copy the original ticket's description verbatim to the new ticket
- **FR-005**: System MUST copy the original ticket's clarification policy (or null if using project default) to the new ticket
- **FR-006**: System MUST copy all image attachment references to the new ticket
- **FR-007**: System MUST assign a new ticket number and ticket key to the duplicated ticket
- **FR-008**: System MUST display a success toast notification upon successful duplication showing the new ticket key
- **FR-009**: System MUST display an error toast notification if duplication fails
- **FR-010**: System MUST close the modal after successful duplication
- **FR-011**: System MUST truncate original title if "Copy of " prefix would exceed 100 character limit
- **FR-012**: System MUST disable the duplicate button while duplication is in progress
- **FR-013**: System MUST allow duplication from tickets in any stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)

### Key Entities *(include if feature involves data)*

- **Ticket**: The existing ticket entity being duplicated. Key attributes: title, description, clarificationPolicy, attachments (JSON array of TicketAttachment objects)
- **TicketAttachment**: Represents image attachments with type (uploaded/external), url, filename, mimeType, sizeBytes, uploadedAt, and optional cloudinaryPublicId

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can duplicate a ticket in under 3 seconds (from button click to seeing new ticket in board)
- **SC-002**: 100% of ticket content (title, description, policy, attachments) is preserved in the duplicate
- **SC-003**: Duplicated tickets appear immediately in the INBOX column after creation
- **SC-004**: All E2E tests for ticket duplication pass successfully
- **SC-005**: The duplicate button is discoverable (visible in modal header) without needing instructions
