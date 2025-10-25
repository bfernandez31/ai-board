# Feature Specification: Restricted Ticket Editing by Stage

**Feature Branch**: `051-895-restricted-description`
**Created**: 2025-10-24
**Status**: Draft
**Input**: User description: "#895 Restricted description update
description and policy can be updated only in inbox stage.
Do not show the edit policy button on other stage."

## Auto-Resolved Decisions

- **Decision**: Scope of "description" field restriction applies to both inline editing and modal editing
- **Policy Applied**: INTERACTIVE
- **Confidence**: High - feature description explicitly states "description can be updated only in inbox stage" without distinguishing between editing methods
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Scope**: Consistent editing experience across all UI entry points
  2. **Timeline**: Single implementation path reduces development time
- **Reviewer Notes**: Validate that all ticket description editing UI components (inline, modal, API endpoints) enforce stage-based restrictions

---

- **Decision**: "Other stages" refers to all non-INBOX stages (SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- **Policy Applied**: INTERACTIVE
- **Confidence**: High - based on established stage lifecycle in project
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **User Experience**: Prevents accidental changes to tickets in active workflow
  2. **Data Integrity**: Ensures specifications remain stable once work begins
- **Reviewer Notes**: Confirm this aligns with business rules around ticket immutability after INBOX

---

- **Decision**: Read-only display should replace editable fields in non-INBOX stages
- **Policy Applied**: INTERACTIVE
- **Confidence**: Medium - inferred from "do not show the edit policy button" pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **User Experience**: Clear visual indication of editing restrictions
  2. **Implementation**: Requires conditional rendering logic based on stage
- **Reviewer Notes**: Consider whether to show explanatory tooltip on why fields are read-only

## User Scenarios & Testing

### User Story 1 - Edit Ticket in INBOX Stage (Priority: P1)

As a project member, I want to freely edit ticket descriptions and policies while tickets are in INBOX, so that I can refine requirements before starting work.

**Why this priority**: This is the core functionality - enabling edits in INBOX where changes are expected and safe.

**Independent Test**: Can be fully tested by creating an INBOX ticket, verifying all edit controls are visible and functional, and successfully updating description and policy fields.

**Acceptance Scenarios**:

1. **Given** a ticket is in INBOX stage, **When** I view the ticket details, **Then** I see editable description field and visible edit policy button
2. **Given** a ticket is in INBOX stage, **When** I update the description and save, **Then** the description is successfully updated
3. **Given** a ticket is in INBOX stage, **When** I click edit policy button and change the policy, **Then** the clarification policy is successfully updated

---

### User Story 2 - Restricted Editing in Active Stages (Priority: P1)

As a project member, I want ticket descriptions and policies to become read-only after leaving INBOX, so that specifications remain stable during active development.

**Why this priority**: This is the primary constraint - preventing unintended changes once work has started.

**Independent Test**: Can be fully tested by moving a ticket to SPECIFY/PLAN/BUILD/VERIFY stage and verifying description field is read-only and edit policy button is hidden.

**Acceptance Scenarios**:

1. **Given** a ticket is in SPECIFY stage, **When** I view the ticket details, **Then** the description field is read-only and edit policy button is not visible
2. **Given** a ticket is in PLAN stage, **When** I view the ticket details, **Then** I cannot modify the description or clarification policy
3. **Given** a ticket is in BUILD stage, **When** I attempt to access edit controls via API, **Then** the API returns validation error preventing updates
4. **Given** a ticket is in VERIFY stage, **When** I view the ticket details, **Then** the description displays as static text without edit affordances
5. **Given** a ticket is in SHIP stage, **When** I view the ticket details, **Then** the description and policy remain read-only

---

### User Story 3 - Stage Transition Preservation (Priority: P2)

As a project member, I want description and policy to remain intact when tickets move between stages, so that I can trust the stability of ticket data.

**Why this priority**: Ensures data integrity through stage lifecycle, but is a supporting requirement to the core editing restrictions.

**Independent Test**: Can be fully tested by creating an INBOX ticket with specific description/policy, transitioning through multiple stages, and verifying values remain unchanged.

**Acceptance Scenarios**:

1. **Given** a ticket in INBOX with description "Feature X" and policy "PRAGMATIC", **When** I transition to SPECIFY stage, **Then** description and policy remain unchanged and become read-only
2. **Given** a ticket in SPECIFY stage, **When** I transition back to INBOX, **Then** description and policy fields become editable again

---

### Edge Cases

- What happens when a user has an unsaved edit open in INBOX and another user transitions the ticket to SPECIFY? (Expected: Show conflict warning and discard unsaved changes)
- What happens if a ticket is moved from SPECIFY back to INBOX? (Expected: Editing becomes enabled again)
- What happens if concurrent API requests attempt to update description in a non-INBOX stage? (Expected: All requests return 400 validation error)
- What happens to inline editing UI when stage changes in real-time polling updates? (Expected: UI immediately switches to read-only mode)

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow ticket description updates only when ticket stage is INBOX
- **FR-002**: System MUST allow clarification policy updates only when ticket stage is INBOX
- **FR-003**: System MUST hide the edit policy button when ticket stage is not INBOX
- **FR-004**: System MUST render description field as read-only when ticket stage is not INBOX (SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- **FR-005**: System MUST validate stage before accepting description or policy updates via API
- **FR-006**: System MUST return appropriate validation error when description or policy update is attempted in non-INBOX stage
- **FR-007**: System MUST re-enable description and policy editing if ticket transitions back to INBOX stage
- **FR-008**: System MUST apply stage-based restrictions to all editing interfaces (modal, inline, API)

### Key Entities

- **Ticket**: Represents a work item with editable description and clarification policy
  - Attributes: stage (INBOX | SPECIFY | PLAN | BUILD | VERIFY | SHIP), description, clarificationPolicy
  - Stage determines edit permissions for description and policy fields

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can successfully update ticket description and policy when ticket is in INBOX stage
- **SC-002**: Users cannot update ticket description or policy when ticket is in any non-INBOX stage (SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- **SC-003**: Edit policy button is hidden from UI when ticket is in non-INBOX stages
- **SC-004**: API validation prevents description/policy updates with appropriate error message when ticket is not in INBOX
- **SC-005**: Description and policy editing capabilities are restored when ticket transitions back to INBOX stage
- **SC-006**: 100% of stage-based edit attempts are correctly allowed or blocked based on current stage

## Assumptions

- Users understand the stage-based workflow and expect editing restrictions after INBOX
- The clarification policy field currently exists in the ticket data model
- Stage transitions are managed through existing stage transition API
- Real-time polling updates will reflect stage changes and trigger UI updates for edit controls
- No requirement to preserve edit history or show audit trail of when fields became read-only

## Scope

### In Scope

- Stage-based editing restrictions for ticket description field
- Stage-based editing restrictions for ticket clarification policy field
- UI changes to hide/show edit policy button based on stage
- UI changes to make description field read-only in non-INBOX stages
- API validation to enforce stage-based editing rules
- Re-enabling editing when ticket returns to INBOX stage

### Out of Scope

- Changes to stage transition logic or workflow
- Editing restrictions for other ticket fields (title, priority, etc.)
- Permission-based editing restrictions (user roles, project membership)
- Audit logging of when editing was restricted or attempted
- Notification system to alert users when editing becomes restricted
- Bulk editing or batch update restrictions
