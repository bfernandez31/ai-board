# Feature Specification: Bulk actions on INBOX tickets (multi-select + merge)

**Feature Branch**: `AIB-824-bulk-actions-on`  
**Created**: 2026-05-23  
**Status**: Draft  
**Input**: User description: "Bulk actions on INBOX tickets (multi-select + merge)"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: AUTO resolved to a conservative operating mode for this spec because the request is a general user-facing board change with no strong speed-only or compliance-only signal.
- **Policy Applied**: AUTO recommendation fell back to CONSERVATIVE.
- **Confidence**: Low, score `+1` from neutral user-facing feature context with no stronger signals.
- **Fallback Triggered?**: Yes — low confidence under AUTO required a conservative fallback.
- **Trade-offs**: Stronger safeguards reduce ambiguity around destructive actions. Scope stays tighter, but some convenience behaviors are intentionally excluded.
- **Reviewer Notes**: Confirm the conservative defaults are acceptable for this ticket. Revisit only if product explicitly prefers faster but less strict bulk behavior.

- **Decision**: “Change model” is treated as applying one chosen workflow model selection across all editable ticket-level model settings that are already exposed to users, rather than inventing a new single-model concept.
- **Policy Applied**: CONSERVATIVE.
- **Confidence**: Medium, score `+1` with fallback context from existing product behavior around ticket-level model settings.
- **Fallback Triggered?**: No — this keeps the new action aligned with an existing editable concept instead of introducing a parallel configuration path.
- **Trade-offs**: This favors consistency over a simpler but ambiguous “one generic model” interpretation. Users may need a clearer label if product wants to emphasize all-stage application.
- **Reviewer Notes**: Validate that product wants bulk application of the existing ticket model settings. If not, the action label should be narrowed before implementation.

- **Decision**: Bulk delete, bulk agent change, bulk model change, and merge all succeed on an all-or-nothing basis for the selected set; no partial completion is considered successful.
- **Policy Applied**: CONSERVATIVE.
- **Confidence**: Medium, score `+1` with destructive data changes weighted toward integrity.
- **Fallback Triggered?**: No — the request already emphasizes irreversible actions and existing permission rules.
- **Trade-offs**: Atomic behavior prevents mixed outcomes and silent data loss. Large selections may fail more often when one ticket becomes ineligible during confirmation.
- **Reviewer Notes**: Confirm whether product wants retry guidance when one selected ticket blocks the full action. If partial success is preferred later, it should be a deliberate follow-up scope change.

- **Decision**: The merged ticket keeps all unique source attachments, preserves the base ticket as the surviving record, and records the source ticket keys inside the merged description preview so provenance is visible after source deletion.
- **Policy Applied**: CONSERVATIVE.
- **Confidence**: Medium, score `+1` with data-preservation bias.
- **Fallback Triggered?**: No — this is the safest interpretation of “all attachments are recovered on the resulting ticket.”
- **Trade-offs**: Preserving provenance improves traceability after hard delete. The merged ticket may become denser and require manual trimming.
- **Reviewer Notes**: Validate whether duplicate attachment references should be collapsed or shown separately when the same asset appeared on multiple source tickets.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select multiple INBOX tickets for one review pass (Priority: P1)

A project owner or member can select several INBOX tickets from the board without opening each ticket, so they can prepare a batch cleanup or triage pass after ticket creation spikes.

**Why this priority**: Bulk action value does not exist unless users can reliably build and inspect a selection first.

**Independent Test**: Can be fully tested by selecting and deselecting INBOX tickets through mouse and keyboard interactions and confirming that the board enters and exits selection mode without changing any ticket data.

**Acceptance Scenarios**:

1. **Given** the user is viewing a project board with INBOX tickets, **When** they select an INBOX ticket through its checkbox, **Then** the board enters selection mode and keeps selection controls visible while at least one ticket remains selected.
2. **Given** selection mode is active, **When** the user uses Shift+select on another INBOX ticket, **Then** every ticket between the anchor and target in the current INBOX order becomes selected.
3. **Given** selection mode is active, **When** the user uses Cmd/Ctrl+select on an INBOX card, **Then** that ticket toggles selection state without opening the ticket detail view.
4. **Given** one or more tickets are selected, **When** the user presses Escape or chooses Cancel, **Then** all selections are cleared and selection mode ends.

---

### User Story 2 - Apply non-merge bulk updates to selected INBOX tickets (Priority: P2)

A project owner or member can delete a batch of INBOX tickets or update the agent or model settings for a batch, so repetitive cleanup can be done in one action instead of ticket by ticket.

**Why this priority**: This delivers immediate operational savings for large INBOX backlogs even if merge is not used.

**Independent Test**: Can be fully tested by selecting several INBOX tickets, invoking each bulk action, and confirming the expected confirmations, permission checks, and ticket updates on the board.

**Acceptance Scenarios**:

1. **Given** at least one INBOX ticket is selected, **When** the floating action bar appears, **Then** it shows the current selection count plus actions for Merge, Delete, Change agent, Change model, and Cancel.
2. **Given** one or more eligible INBOX tickets are selected, **When** the user confirms bulk delete, **Then** all selected tickets are permanently removed together or none are removed if the action cannot complete safely.
3. **Given** one or more INBOX tickets are selected, **When** the user applies a new agent selection, **Then** every selected ticket reflects the new agent choice and no tickets outside the selection are changed.
4. **Given** one or more INBOX tickets are selected, **When** the user applies a new model selection, **Then** every selected ticket receives the chosen model setting consistently and no unselected ticket is changed.

---

### User Story 3 - Merge duplicate or related INBOX tickets into one survivor (Priority: P3)

A project owner or member can merge multiple related INBOX tickets into one result, so duplicated work is consolidated before the ticket enters later workflow stages.

**Why this priority**: Merge is high value, but it depends on the selection and bulk-action foundations already working correctly.

**Independent Test**: Can be fully tested by selecting two or more INBOX tickets, reviewing the merge preview, editing the result, and confirming that one surviving ticket remains with combined content and attachments.

**Acceptance Scenarios**:

1. **Given** fewer than two INBOX tickets are selected, **When** the action bar is shown, **Then** Merge is visible but disabled.
2. **Given** two or more INBOX tickets are selected, **When** the user opens Merge, **Then** the preview identifies the oldest selected ticket as the base and lists the remaining tickets in merge order.
3. **Given** the merge preview is open, **When** the user accepts the prefilled title and edited or prefilled description within the allowed limit, **Then** the merge produces one surviving ticket based on the oldest ticket and removes the other selected tickets.
4. **Given** the edited merged description exceeds the allowed limit, **When** the user attempts to submit, **Then** submission is blocked and the interface shows a clear error plus a live remaining-character indicator until the content is shortened.

### Edge Cases

- What happens when the selected set changes because one ticket is deleted, moved, or becomes unavailable before the user confirms a bulk action? The action must fail safely, keep remaining tickets unchanged, and explain which ticket invalidated the request.
- What happens when the user selects tickets, then the board order changes? Existing selections remain tied to ticket identity, and any new range selection uses the visible INBOX order at the time of the Shift+select action.
- What happens when a selected ticket already has the same agent or model value the user chose? That ticket remains selected and is treated as a no-op rather than an error.
- What happens when the merge preview contains blank descriptions on some source tickets? The preview still lists those tickets and preserves their headings while omitting empty body text.
- What happens when the same attachment appears on more than one source ticket? The merged result must not lose any referenced asset and must avoid creating confusing duplicate entries for the same attachment reference.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow multi-selection only for tickets currently in the INBOX column of a single project board view.
- **FR-002**: The system MUST reveal a selection checkbox on INBOX cards when the user hovers a card and MUST keep all INBOX selection checkboxes visible while selection mode is active.
- **FR-003**: The system MUST enter selection mode when the user selects an INBOX ticket through its checkbox and MUST exit selection mode when the selection becomes empty, the user presses Escape, or the user chooses Cancel.
- **FR-004**: The system MUST support contiguous range selection within the current INBOX ordering when the user performs a Shift+select after establishing a selection anchor.
- **FR-005**: The system MUST support toggling an INBOX ticket in or out of the current selection through Cmd/Ctrl+select without opening that ticket.
- **FR-006**: The system MUST show a floating bulk action bar whenever at least one INBOX ticket is selected and MUST display the current number of selected tickets.
- **FR-007**: The floating bulk action bar MUST offer Merge, Delete, Change agent, Change model, and Cancel actions, and MUST keep Merge unavailable until at least two tickets are selected.
- **FR-008**: The system MUST require explicit confirmation before permanently deleting selected tickets and MUST describe the action as irreversible with no undo.
- **FR-009**: The system MUST apply each bulk action only to tickets the current user is already allowed to manage under existing project membership rules.
- **FR-010**: The system MUST execute bulk delete, bulk agent change, bulk model change, and merge as atomic actions for the selected set so the outcome is either fully applied or not applied at all.
- **FR-011**: When bulk delete succeeds, the system MUST permanently remove all selected INBOX tickets from the board immediately and MUST NOT leave any of the deleted tickets partially available in the project.
- **FR-012**: When bulk agent change succeeds, the system MUST update the selected tickets to the chosen agent value and preserve every other editable ticket field unchanged.
- **FR-013**: When bulk model change succeeds, the system MUST apply the chosen model setting consistently to each selected ticket using the same ticket-level model concept already available elsewhere in the product and preserve unrelated ticket fields unchanged.
- **FR-014**: The system MUST allow merge only when all selected tickets are in INBOX and must use the oldest selected ticket as the surviving base record.
- **FR-015**: The merge preview MUST show the selected tickets in merge order, clearly identify the base ticket, prefill the merged title from the base ticket title, and allow the user to edit the final title before submission.
- **FR-016**: The merge preview MUST prefill the merged description with the base ticket description followed by clearly separated sections for each additional source ticket that include the source ticket key and title, and the user MUST be able to edit the full result before submission.
- **FR-017**: The merged ticket MUST retain all attachments from the selected source tickets without losing provenance of which source tickets contributed to the merged content.
- **FR-018**: The system MUST prevent merge submission when the final merged description exceeds 10,000 characters and MUST display a clear validation message together with a live indication of remaining or excess characters.
- **FR-019**: When merge succeeds, the system MUST keep the base ticket as the single surviving ticket, permanently delete the other merged tickets, and present the user with the merged result on the board.
- **FR-020**: The system MUST not provide bulk selection or bulk actions for tickets outside INBOX as part of this feature.
- **FR-021**: The system MUST surface a clear error message when a bulk action cannot be completed and MUST leave ticket data unchanged for the attempted selection.

### Key Entities *(include if feature involves data)*

- **Selected INBOX Ticket Set**: The user-defined group of INBOX tickets targeted by a single bulk action, including the selection count, anchor ticket for range selection, and current eligibility for each action.
- **Bulk Action Request**: A user-confirmed request to delete, change agent, change model, or merge the selected ticket set under existing project permissions.
- **Merge Preview**: The editable preview of the surviving ticket's title and combined description, including ordered source ticket references and attachment carryover expectations.

### Assumptions

- Bulk actions are initiated only from one project board at a time and never span multiple projects.
- The current visible order of INBOX tickets is the authoritative order for range selection and merge preview listing.
- Existing project-level permission rules remain unchanged; this feature adds no new roles.
- Any ticket model value offered through bulk action uses the same allowed choices already available to users elsewhere in the product.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability validation with representative project members, at least 90% of participants can select and clear a batch of five INBOX tickets without opening an unintended ticket.
- **SC-002**: For a prepared set of duplicate INBOX tickets, users can complete a reviewed merge of three tickets into one surviving ticket in under 2 minutes from first selection to confirmed result.
- **SC-003**: In acceptance testing, 100% of confirmed bulk delete and merge actions leave the project in a fully consistent state with either the complete requested outcome or no data change.
- **SC-004**: During release verification, at least 95% of tested bulk update attempts on eligible INBOX tickets complete successfully on the first try without requiring manual page refresh.
