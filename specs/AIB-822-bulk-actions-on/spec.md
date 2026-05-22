# Feature Specification: Bulk Actions on INBOX Tickets (Multi-Select + Merge)

**Feature Branch**: `AIB-822-bulk-actions-on`
**Created**: 2026-05-22
**Status**: Draft
**Input**: User description: "Bulk actions on INBOX tickets — multi-select with checkbox, floating action bar, merge, delete, change agent/model"

## Auto-Resolved Decisions

- **Decision**: Maximum number of tickets selectable at once
- **Policy Applied**: CONSERVATIVE (AUTO fallback — confidence too low)
- **Confidence**: Low (0.3) — netScore -1, absScore 1, no conflicting buckets but insufficient signal strength
- **Fallback Triggered?**: Yes — AUTO recommended PRAGMATIC but confidence < 0.5, promoted to CONSERVATIVE
- **Trade-offs**: Capping selection prevents accidental mass operations; users with very large INBOX columns may need multiple passes.
- **Reviewer Notes**: Resolved as no arbitrary cap — selection is naturally bounded by INBOX tickets in the current project. Confirm this aligns with typical INBOX sizes (usually < 50 tickets).

---

- **Decision**: Handling attachment limit (max 5) when merging tickets whose combined attachments exceed 5
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes — no description guidance on this edge case
- **Trade-offs**: Blocking merge until attachments are within limit adds friction but prevents silent data loss.
- **Reviewer Notes**: Merge preview must show attachment count and warn if combined total exceeds 5. User must remove extras before confirming.

---

- **Decision**: Which model fields "Change model" applies to in bulk
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes — description says "Change model" without specifying stage-level granularity
- **Trade-offs**: Applying to all stage-specific model fields is the safest default; power users may want per-stage control later.
- **Reviewer Notes**: Bulk "Change model" sets all five stage-level model overrides to the selected model. Confirm this matches user mental model vs. per-stage selection.

---

- **Decision**: Behavior when a selected ticket is concurrently modified or deleted before bulk action executes
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes — no guidance in description
- **Trade-offs**: Failing the entire operation on any conflict is safest but may frustrate users with large selections; partial success with clear reporting balances safety and usability.
- **Reviewer Notes**: Bulk operations validate each ticket at execution time. If any ticket has been modified or deleted, that ticket is skipped with an error message. Successfully processed tickets are not rolled back.

---

- **Decision**: Cascading effects of hard-deleting merged source tickets (jobs, comments, notifications)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes — description says "hard delete" but doesn't address cascade consequences
- **Trade-offs**: Hard delete cascades all related data (jobs, comments, notifications) for source tickets, which is irreversible. Merge preview must warn users explicitly.
- **Reviewer Notes**: Merge confirmation must clearly state that job history, comments, and notifications from source tickets will be permanently lost. Only the base ticket retains its history.

---

- **Decision**: Whether empty descriptions in source tickets should appear in merged description
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes — edge case not addressed
- **Trade-offs**: Including empty-description tickets in the merged description adds noise; omitting them is cleaner.
- **Reviewer Notes**: Tickets with empty descriptions are listed in the merge preview but their section is omitted from the pre-filled merged description. The ticket header still appears so users know it was included.

## User Scenarios & Testing

### User Story 1 - Select and Delete Multiple INBOX Tickets (Priority: P1)

A project owner has accumulated many low-quality or duplicate tickets in their INBOX after running inbox-analysis. They want to quickly select several tickets and delete them all at once rather than opening each one individually.

**Why this priority**: Deleting unwanted tickets is the most common bulk operation and the simplest to implement. It unblocks the core multi-select interaction pattern that all other bulk actions depend on.

**Independent Test**: Can be fully tested by selecting 3+ INBOX tickets, clicking Delete, confirming in the modal, and verifying all selected tickets are removed from the board.

**Acceptance Scenarios**:

1. **Given** a project with 5 INBOX tickets, **When** the user hovers over a ticket card in the INBOX column, **Then** a selection checkbox appears on the card.
2. **Given** no tickets are selected, **When** the user clicks a checkbox on a ticket card, **Then** the ticket is selected, checkboxes become permanently visible on all INBOX cards (select-mode), and a floating action bar appears at the bottom of the screen.
3. **Given** 3 tickets are selected, **When** the user clicks "Delete" on the floating action bar, **Then** a confirmation modal appears listing the 3 tickets and warning that this action is irreversible (hard delete).
4. **Given** the delete confirmation modal is open, **When** the user confirms deletion, **Then** all 3 tickets and their associated data (jobs, comments, notifications) are permanently removed and the board updates immediately.
5. **Given** 1 ticket is selected, **When** the user presses Escape, **Then** the selection is cleared, checkboxes hide on hover-only, and the floating action bar disappears.
6. **Given** a ticket with a PENDING or RUNNING job is selected for deletion, **When** the user confirms the bulk delete, **Then** that specific ticket is skipped with a clear error message while other selected tickets are deleted successfully.

---

### User Story 2 - Merge Duplicate INBOX Tickets (Priority: P2)

After inbox-analysis creates several tickets addressing overlapping concerns, the user wants to merge them into a single consolidated ticket that combines their descriptions and attachments.

**Why this priority**: Merge is the most complex and highest-value operation — it solves the duplicate ticket problem that specifically motivates this feature. It depends on the multi-select infrastructure from P1.

**Independent Test**: Can be tested by selecting 3 INBOX tickets, clicking Merge, reviewing the preview modal with combined title/description, editing if needed, and confirming. Verify the base ticket is updated and source tickets are deleted.

**Acceptance Scenarios**:

1. **Given** 3 INBOX tickets are selected (IDs 10, 15, 20), **When** the user clicks "Merge", **Then** a merge preview modal opens showing the tickets ordered by ID, with ticket #10 marked as "base".
2. **Given** the merge preview modal is open, **When** the user views the pre-filled title, **Then** it shows the title of the base ticket (oldest/lowest ID) and is editable.
3. **Given** the merge preview modal is open, **When** the user views the pre-filled description, **Then** it contains the base ticket's description followed by separator-delimited sections for each source ticket (with ticket key and title headers), and the field is editable.
4. **Given** the merged description exceeds 10,000 characters, **When** the user views the description field, **Then** the submit button is disabled and a character counter with error message appears below the textarea showing remaining characters to trim.
5. **Given** the merge preview is ready and within limits, **When** the user clicks "Merge N tickets", **Then** the base ticket is updated with the new title, description, and combined attachments, source tickets are hard-deleted, and the board refreshes.
6. **Given** the combined attachments from all source tickets plus the base ticket exceed 5, **When** the merge preview opens, **Then** a warning is displayed indicating that the attachment limit is exceeded and the user must choose which attachments to keep (max 5) before the merge can proceed.
7. **Given** only 1 ticket is selected, **When** the user views the floating action bar, **Then** the "Merge" button is disabled (grayed out).
8. **Given** source tickets have job history and comments, **When** the merge preview is displayed, **Then** a warning clearly states that job history, comments, and notifications from non-base tickets will be permanently lost upon merge.

---

### User Story 3 - Bulk Change Agent or Model (Priority: P3)

After creating a batch of tickets, the user realizes they want to use a different AI agent or model for all of them instead of changing each one individually.

**Why this priority**: Lower frequency than delete/merge but still a significant time-saver for batch operations. Builds on the same multi-select infrastructure.

**Independent Test**: Can be tested by selecting 4 INBOX tickets, clicking "Change agent", selecting a new agent from the dropdown, and verifying all 4 tickets now show the new agent on their cards.

**Acceptance Scenarios**:

1. **Given** 4 INBOX tickets are selected, **When** the user clicks "Change agent" on the floating action bar, **Then** a dropdown appears listing all available agents (Claude, Codex, Mistral, Gemini).
2. **Given** the agent dropdown is open, **When** the user selects "Gemini", **Then** all 4 selected tickets are updated to use Gemini as their agent and the board reflects the change immediately.
3. **Given** 4 INBOX tickets are selected, **When** the user clicks "Change model" on the floating action bar, **Then** a dropdown appears listing all available models.
4. **Given** the model dropdown is open, **When** the user selects a model, **Then** all 4 selected tickets have all their stage-specific model overrides set to the chosen model.
5. **Given** one of the selected tickets was concurrently modified by another process, **When** the bulk agent/model change executes, **Then** that ticket is skipped with an error notification and the remaining tickets are updated successfully.

---

### User Story 4 - Range and Multi-Select Interactions (Priority: P1)

The user needs efficient keyboard/mouse shortcuts to quickly select multiple tickets without clicking each checkbox individually.

**Why this priority**: Core interaction quality — without range select and keyboard shortcuts, bulk actions on large INBOX columns become tedious and defeat the purpose.

**Independent Test**: Can be tested by clicking one checkbox, then Shift+clicking another checkbox 5 rows away, and verifying all tickets in between are selected.

**Acceptance Scenarios**:

1. **Given** ticket A is selected, **When** the user Shift+clicks the checkbox on ticket E (with B, C, D between them), **Then** tickets A through E are all selected (inclusive range).
2. **Given** tickets A, B, C are selected, **When** the user Cmd/Ctrl+clicks on ticket B's card, **Then** ticket B is deselected while A and C remain selected. The card does not open.
3. **Given** 5 tickets are selected, **When** the user presses Escape, **Then** all tickets are deselected and the floating action bar disappears.
4. **Given** select-mode is active (at least 1 ticket selected), **When** the user views the INBOX column, **Then** all ticket checkboxes are visible (not just on hover).
5. **Given** select-mode is active, **When** the user clicks "Cancel" on the floating action bar, **Then** all tickets are deselected and select-mode exits.

---

### Edge Cases

- What happens when a user selects tickets, then another user deletes one of them before the bulk action executes? The deleted ticket is skipped, remaining tickets are processed, and a notification shows which tickets were skipped.
- What happens when the INBOX column is empty? No checkboxes appear and no bulk action UI is available.
- What happens when only 1 ticket exists in INBOX? The checkbox still appears on hover. Only delete, change agent, and change model are available (merge is disabled).
- What happens when all INBOX tickets are selected and deleted? The board shows an empty INBOX column with no floating action bar.
- What happens during a merge if the base ticket has a PENDING/RUNNING job? The merge is blocked — tickets with active jobs cannot participate in merge operations. An error message explains which ticket has an active job.
- What happens if a non-member tries to perform bulk actions? The existing permission system applies — only project owners and members can perform actions. Unauthorized users do not see the multi-select UI.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a selection checkbox on INBOX ticket cards when the user hovers over them (INBOX column only — no other stage columns).
- **FR-002**: System MUST enter select-mode when any INBOX ticket checkbox is activated, making all INBOX checkboxes persistently visible until selection is fully cleared.
- **FR-003**: System MUST support Shift+click for range selection between two INBOX ticket checkboxes (selects all tickets between the two, inclusive).
- **FR-004**: System MUST support Cmd/Ctrl+click on a ticket card to toggle its selection without opening the ticket detail modal.
- **FR-005**: System MUST exit select-mode and clear all selections when the user presses Escape or clicks "Cancel" on the floating action bar.
- **FR-006**: System MUST display a floating action bar at the bottom of the screen when at least one INBOX ticket is selected, showing: selected count, Merge button, Delete button, Change Agent dropdown, Change Model dropdown, and Cancel button.
- **FR-007**: The Merge button MUST be disabled when fewer than 2 tickets are selected.
- **FR-008**: The Delete action MUST display a confirmation modal listing all selected tickets and warning that the action is irreversible (hard delete with cascading removal of jobs, comments, and notifications).
- **FR-009**: Bulk delete MUST skip tickets that have PENDING or RUNNING jobs, report skipped tickets to the user, and proceed with deleting the remaining eligible tickets.
- **FR-010**: Bulk delete MUST skip tickets that have been concurrently modified or deleted, report the conflict, and proceed with remaining tickets.
- **FR-011**: The Merge action MUST open a preview modal showing all selected tickets ordered by ID (lowest first, marked as "base"), with editable title and description fields.
- **FR-012**: The merge description MUST be pre-filled by concatenating the base ticket's description followed by separator-delimited sections for each additional ticket using the format: `---` separator, then `## From {TICKET_KEY}: {title}`, then that ticket's description. Tickets with empty descriptions MUST have their section omitted from the pre-filled text.
- **FR-013**: The merge preview MUST block submission when the description exceeds 10,000 characters, showing a live character counter and clear error message indicating how many characters must be removed.
- **FR-014**: The merge operation MUST update the base ticket with the new title, description, and combined attachments, then hard-delete all other selected tickets.
- **FR-015**: If the combined attachment count from all tickets exceeds 5, the merge preview MUST warn the user and require them to select which attachments to keep (maximum 5) before allowing submission.
- **FR-016**: The merge preview MUST warn users that job history, comments, and notifications from non-base tickets will be permanently lost.
- **FR-017**: Merge MUST be blocked if any selected ticket has a PENDING or RUNNING job, with a clear error message identifying the problematic ticket(s).
- **FR-018**: The "Change agent" dropdown MUST list all available agents and apply the selected agent to all selected INBOX tickets.
- **FR-019**: The "Change model" dropdown MUST list all available models and apply the selected model to all five stage-level model override fields on each selected INBOX ticket.
- **FR-020**: Bulk agent and model changes MUST skip tickets that were concurrently modified, report conflicts to the user, and proceed with remaining tickets.
- **FR-021**: All bulk operations MUST respect existing project access permissions — only project owners and members may perform actions.
- **FR-022**: The multi-select UI (checkboxes, floating action bar) MUST only be available on the INBOX column. Other stage columns are unaffected.
- **FR-023**: The floating action bar MUST display the count of selected tickets (e.g., "3 selected").

### Key Entities

- **Selection Set**: The group of INBOX tickets currently selected by the user. Exists only in the client session — not persisted. Contains ticket identifiers and maintains insertion order for range selection.
- **Merge Result**: The consolidated ticket produced by a merge operation. Retains the identity (ID, key, history) of the base ticket (oldest by ID) while incorporating the title, description, and attachments from all source tickets.
- **Floating Action Bar**: A transient UI element that appears at the bottom of the screen during select-mode, providing access to all bulk operations and showing the current selection count.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can select and delete 10 INBOX tickets in under 15 seconds (vs. ~2 minutes doing it individually).
- **SC-002**: Users can merge 3 duplicate tickets into one consolidated ticket in under 30 seconds.
- **SC-003**: Users can change the agent or model for 10 tickets in under 10 seconds.
- **SC-004**: 100% of bulk operations respect existing permission boundaries — no unauthorized modifications occur.
- **SC-005**: When a bulk operation partially fails (due to concurrent modifications or job constraints), the user receives a clear summary showing which tickets succeeded and which were skipped, within 2 seconds of the operation completing.
- **SC-006**: The merged ticket description accurately combines all source ticket content in the specified format, with no data loss from tickets that had descriptions.
- **SC-007**: All attachments from source tickets are preserved on the merged ticket (up to the 5-attachment limit) with no orphaned files.

## Assumptions

- The existing 5-attachment-per-ticket limit remains in effect during merge operations.
- The existing 10,000-character description limit remains in effect for merged descriptions.
- Tickets in INBOX stage do not have GitHub branches (branches are created during later stages), so no branch cleanup is needed during merge or bulk delete of INBOX tickets.
- The existing optimistic concurrency control (version field) is used to detect concurrent modifications during bulk operations.
- Hard delete behavior follows the existing cascade pattern (removing jobs, comments, notifications alongside the ticket).

## Out of Scope

- Multi-select in non-INBOX columns (SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- Undo/rollback after merge or delete operations
- Drag-to-select (mouse lasso) interaction
- Bulk actions across multiple projects simultaneously
- Soft-delete or archival as an alternative to hard delete
- Preserving job history or comments from source tickets during merge (beyond what's on the base ticket)
- Per-stage model selection in the bulk "Change model" dropdown (applies uniformly to all stages)
