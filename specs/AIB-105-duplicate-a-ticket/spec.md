# Feature Specification: Duplicate a Ticket

**Feature Branch**: `AIB-105-duplicate-a-ticket`
**Created**: 2025-12-11
**Status**: Draft
**Input**: User description: "Add a button to duplicate a ticket from the ticket modal. Identify the best UX approach for implementing this feature. Duplicating a ticket should create a new ticket in the inbox with the same title, description, clarification policy, and image attachments."

## Auto-Resolved Decisions

- **Decision**: Button placement within ticket modal
- **Policy Applied**: AUTO (detected: user-facing UI feature)
- **Confidence**: High (0.9) - Clear user interaction pattern, no security/compliance concerns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Placing in header metadata row keeps actions discoverable without cluttering the interface
  2. Using a subtle icon button matches existing "Edit Policy" pattern
- **Reviewer Notes**: Verify button placement feels natural alongside existing badges and actions

---

- **Decision**: Duplicate title format
- **Policy Applied**: AUTO → PRAGMATIC (internal tool, user productivity feature)
- **Confidence**: High (0.9) - Standard duplication pattern across applications
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prepending "Copy of" is immediately recognizable but adds length
  2. Could truncate original title if copy prefix exceeds max length
- **Reviewer Notes**: Ensure copied title respects 100 character max limit by truncating original if needed

---

- **Decision**: Confirmation dialog behavior
- **Policy Applied**: AUTO → PRAGMATIC (non-destructive action)
- **Confidence**: High (0.9) - Duplication is non-destructive, can be easily deleted
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. No confirmation needed since action is reversible (user can delete duplicate)
  2. Provides immediate feedback via toast notification
- **Reviewer Notes**: Consider if users might accidentally duplicate tickets; current pattern is consistent with other non-destructive actions

---

- **Decision**: Image attachment handling
- **Policy Applied**: AUTO → CONSERVATIVE (data integrity for user assets)
- **Confidence**: Medium (0.6) - Image copying involves external storage (Cloudinary)
- **Fallback Triggered?**: No (medium confidence but clear technical path)
- **Trade-offs**:
  1. Re-uploading to Cloudinary creates independent copies (more storage, but safer)
  2. Referencing same Cloudinary URLs risks orphaned data issues if original is deleted
- **Reviewer Notes**: Confirm Cloudinary cost implications are acceptable; reference approach is simpler but creates data dependency

---

- **Decision**: Which stages allow duplication
- **Policy Applied**: AUTO → PRAGMATIC (user productivity)
- **Confidence**: High (0.9) - Duplicating from any stage is useful
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Allowing from all stages maximizes utility
  2. Duplicates always go to INBOX regardless of source stage
- **Reviewer Notes**: Verify this matches user expectations; some users might expect duplicate to preserve stage

## User Scenarios & Testing

### User Story 1 - Duplicate Ticket from Modal (Priority: P1)

A user viewing a ticket in the detail modal wants to create a similar ticket quickly without re-entering all the information. They click a duplicate button, and a new ticket is created in the INBOX with the same content.

**Why this priority**: Core feature functionality - without this, the feature has no value. Represents the primary use case of saving time when creating similar tickets.

**Independent Test**: Can be fully tested by opening any ticket modal, clicking duplicate, and verifying a new ticket appears in INBOX with copied content. Delivers immediate value by reducing ticket creation time.

**Acceptance Scenarios**:

1. **Given** a ticket with title, description, clarification policy, and attachments exists, **When** user opens the ticket modal and clicks the duplicate button, **Then** a new ticket is created in INBOX with:
   - Title: "Copy of [original title]" (truncated to 100 chars if needed)
   - Description: Exact copy of original
   - Clarification policy: Same as original (explicit value or null for project default)
   - Attachments: Same images referenced from original

2. **Given** a ticket modal is open on any stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, or SHIP), **When** user clicks duplicate, **Then** the duplicate is always created in INBOX stage

3. **Given** a ticket with a title of 90+ characters exists, **When** user duplicates it, **Then** the new title is truncated to ensure "Copy of [title]" does not exceed 100 characters

---

### User Story 2 - Immediate Feedback After Duplication (Priority: P2)

After duplicating a ticket, the user needs confirmation that the action succeeded and an easy way to access the new ticket.

**Why this priority**: Essential for good UX - users need feedback that their action worked and a way to find/edit the duplicate.

**Independent Test**: Can be tested by duplicating any ticket and observing the toast notification appears with the new ticket key, then clicking the toast action to navigate.

**Acceptance Scenarios**:

1. **Given** user clicks duplicate on a ticket, **When** the duplicate is successfully created, **Then** a success toast appears with message "Ticket duplicated" and shows the new ticket key (e.g., "AIB-106")

2. **Given** a success toast is shown after duplication, **When** user clicks "View" action on toast, **Then** user is navigated to the board with the new ticket's modal opened

3. **Given** user clicks duplicate on a ticket, **When** the duplication fails (network error, etc.), **Then** an error toast appears with message "Failed to duplicate ticket. Please try again."

---

### User Story 3 - Duplicate Ticket with Long Description (Priority: P3)

Users with detailed ticket descriptions (approaching the 2500 character limit) can still duplicate their tickets successfully.

**Why this priority**: Edge case handling - ensures the feature works reliably even at content boundaries.

**Independent Test**: Can be tested by creating a ticket with maximum length description and verifying duplication succeeds with full content preserved.

**Acceptance Scenarios**:

1. **Given** a ticket with description at or near 2500 characters, **When** user duplicates it, **Then** the full description is copied without truncation

---

### Edge Cases

- What happens when user duplicates a ticket while offline? → Show error toast, no ticket created
- What happens when duplicating a ticket with images that no longer exist in Cloudinary? → Include broken image references; let user handle cleanup
- What happens if max ticket count is reached for project? → Let existing ticket count limits (if any) apply normally
- What happens when user rapidly clicks duplicate multiple times? → Disable button during API call to prevent double-submission

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a duplicate button within the ticket detail modal header area
- **FR-002**: System MUST create a new ticket in INBOX stage when duplicate is triggered
- **FR-003**: System MUST copy the following fields to the duplicate: title (with "Copy of" prefix), description, clarification policy, and image attachments
- **FR-004**: System MUST truncate the duplicate title if "Copy of [original]" exceeds 100 characters
- **FR-005**: System MUST show a success toast notification with the new ticket key after successful duplication
- **FR-006**: System MUST show an error toast notification if duplication fails
- **FR-007**: System MUST disable the duplicate button while the duplication request is in progress
- **FR-008**: System MUST reference the same image URLs from the original ticket (no re-upload required)
- **FR-009**: System MUST allow duplication from tickets in any stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- **FR-010**: Toast notification SHOULD include an action to navigate to the duplicated ticket

### Key Entities

- **Ticket**: The entity being duplicated - contains title, description, clarificationPolicy, attachments, stage, and projectId
- **TicketAttachment**: Image attachment metadata - contains type ('uploaded'|'external'), url, filename, mimeType, sizeBytes, uploadedAt, and optionally cloudinaryPublicId

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can duplicate a ticket within 2 seconds (perceived action completion via optimistic UI or fast response)
- **SC-002**: Duplicated tickets retain 100% of source content (title pattern, description, policy, attachments)
- **SC-003**: 95% of duplicate operations succeed on first attempt (network conditions permitting)
- **SC-004**: Users can locate duplicated ticket within 5 seconds via toast action or board INBOX column
