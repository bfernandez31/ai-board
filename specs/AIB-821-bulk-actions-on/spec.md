# Feature Specification: Bulk actions on INBOX tickets (multi-select + merge)

**Feature Branch**: `AIB-821-bulk-actions-on`
**Created**: 2026-05-21
**Status**: Draft
**Input**: User description: "Allow users to manage several INBOX tickets at once — multi-select, then bulk delete / change agent / change model, or merge multiple tickets into one (squash-style). Typical use case: cleaning up after an inbox-analysis session that produces many tickets, deduplicating, or changing default agent/model on a batch."

## Auto-Resolved Decisions

- **Decision**: Bulk operations are atomic — if any selected ticket has moved out of INBOX, been deleted by another user, or fails its individual operation, the whole batch is rolled back with no partial changes.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 4; data-integrity signal dominates)
- **Fallback Triggered?**: Yes — atomic semantics chosen because hard delete + merge are irreversible.
- **Trade-offs**: 1) Safer (no half-finished merges or orphaned attachments). 2) A single conflicting ticket blocks the whole batch — user must retry.
- **Reviewer Notes**: Confirm the UX message clearly identifies which tickets caused the rollback so the user can re-select.

- **Decision**: Maximum batch size is capped at 50 tickets per bulk operation.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (no signal in description; chosen to prevent abuse / runaway transactions)
- **Fallback Triggered?**: Yes
- **Trade-offs**: 1) Covers all realistic post-analysis cleanup sessions. 2) Power users emptying very large inboxes need two passes.
- **Reviewer Notes**: Validate 50 matches the typical inbox-analysis output volume; raise to 100 if support requests appear.

- **Decision**: "Change model" applies a single chosen model to all five per-command model overrides on each selected ticket (specifyModel, planModel, implementModel, quickImplModel, verifyModel).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (description uses singular "model"; ticket has five model fields at INBOX)
- **Fallback Triggered?**: Yes — simplest interpretation that preserves single-action UX.
- **Trade-offs**: 1) Predictable batch outcome. 2) Users wanting different models per command-type must still edit tickets individually.
- **Reviewer Notes**: If product wants per-command model selection in bulk, requires a UI redesign beyond this scope.

- **Decision**: In the merge preview, non-base ticket sections appear in ascending ticket-id order (oldest first after the base), regardless of selection order.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (description specifies base = smallest id but is silent on subsequent order)
- **Fallback Triggered?**: Yes
- **Trade-offs**: 1) Deterministic, reproducible output. 2) User cannot reorder sections without manually editing the description.
- **Reviewer Notes**: The user may still edit the textarea before submitting — ordering is just the default.

- **Decision**: When a merge or delete affects a ticket created by another project member, a notification is sent to that creator naming the actor and the action; agent/model changes are silent.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (multi-member projects exist; merging someone else's ticket without trace is surprising)
- **Fallback Triggered?**: Yes
- **Trade-offs**: 1) Transparency on destructive actions. 2) Slightly more notification volume.
- **Reviewer Notes**: Confirm notification copy with product; reuse existing notification channel (15s polling).

## User Scenarios & Testing

### User Story 1 - Clean up an analysis-generated inbox by deleting irrelevant tickets in one pass (Priority: P1)

After an inbox-analysis run produces ~20 tickets, the user reviews them and selects every ticket they want to discard, then deletes them all at once via the floating action bar.

**Why this priority**: This is the most frequent post-analysis workflow and the simplest bulk operation; without it, the user must click "delete" 20 times.

**Independent Test**: Create 10 INBOX tickets, hover the first card to reveal the checkbox, select it, shift+click the fifth to range-select 5 tickets, click Delete in the floating bar, confirm in the modal, and verify that exactly 5 tickets disappear from INBOX while the other 5 remain.

**Acceptance Scenarios**:

1. **Given** at least one ticket is in INBOX, **When** the user hovers a card, **Then** a checkbox appears in the card's corner.
2. **Given** no tickets are selected, **When** the user clicks the checkbox on one card, **Then** the card is marked as selected, all INBOX checkboxes remain visible, and the floating action bar appears showing "1 selected".
3. **Given** at least one ticket is selected, **When** the user shift+clicks another card, **Then** every card between the two (in display order) becomes selected and the counter updates.
4. **Given** N tickets are selected and the user clicks Delete, **When** the confirmation modal opens and the user confirms, **Then** all N tickets are removed from the project, the floating bar disappears, and the user exits select mode.
5. **Given** the user is in select mode, **When** the user presses Escape, **Then** all selections are cleared, the floating bar disappears, and checkboxes are hidden again.

---

### User Story 2 - Merge duplicate tickets into a single ticket without losing context (Priority: P1)

The user spots three INBOX tickets that all describe variants of the same need. They select all three, click Merge, edit the consolidated title and description in the preview modal, then submit. The oldest ticket survives with the combined content and all attachments; the other two are deleted.

**Why this priority**: Deduplication is the second core motivation for this feature; without it, users must manually copy-paste descriptions and re-upload attachments.

**Independent Test**: Create three INBOX tickets with different ids, titles, descriptions, and at least one attachment each. Select all three, click Merge, accept the prefilled title and description, click "Merge 3 tickets", and verify that only the oldest ticket remains with the concatenated description (in id order), all attachments transferred, and the other two tickets gone.

**Acceptance Scenarios**:

1. **Given** fewer than 2 tickets are selected, **When** the user looks at the floating bar, **Then** the Merge button is disabled.
2. **Given** 2 or more tickets are selected and the user clicks Merge, **When** the preview modal opens, **Then** the oldest ticket is labeled "base", the title field is prefilled with the base ticket's title, and the description field is prefilled with the base description followed by `---` and `## From AIB-X: <title>` blocks for each non-base ticket in ascending id order.
3. **Given** the merge preview is open, **When** the user edits the title or description, **Then** the live character counter under the description updates and the "Merge N tickets" button reflects validity (disabled when description exceeds 10,000 characters).
4. **Given** a valid merge is submitted, **When** the operation completes, **Then** the base ticket holds the edited title and description, all attachments from every source ticket are present on the base, the other source tickets no longer exist, and the user exits select mode.
5. **Given** a merge submission with a description above 10,000 characters, **When** the user clicks "Merge N tickets", **Then** the button stays disabled, an error message under the textarea explains the limit, and the live counter shows how many characters must be trimmed.

---

### User Story 3 - Switch a batch of tickets to a different agent or default model (Priority: P2)

The user has 8 INBOX tickets created with the default agent and wants to try a different agent (or a different default model) on all of them. They select the 8 tickets, pick the new agent (or model) from the floating-bar dropdown, and every selected ticket is updated in one action.

**Why this priority**: Less frequent than delete/merge but still saves substantial clicks; users often realize after creation that a different agent fits better.

**Independent Test**: Create 5 INBOX tickets with agent CLAUDE. Select all 5, open the "Change agent" dropdown, pick CODEX. Verify all 5 tickets now show CODEX as their agent without any other field changing.

**Acceptance Scenarios**:

1. **Given** at least one ticket is selected, **When** the user opens "Change agent", **Then** the dropdown shows every agent currently supported by the project's configuration.
2. **Given** the user picks an agent in the dropdown, **When** they confirm the choice, **Then** every selected ticket's `agent` field is updated to that value and no other ticket fields change.
3. **Given** the user picks a model in "Change model", **When** they confirm, **Then** every selected ticket has all five command-specific model overrides set to that single value.
4. **Given** the bulk update succeeds, **When** the operation completes, **Then** the floating bar shows a brief success indication and the user remains in select mode with the same tickets still selected, so they can chain another action.

---

### User Story 4 - Discover and exit the multi-select interaction safely (Priority: P3)

A new user accidentally clicks a checkbox, sees the floating bar appear, and wants to back out without taking any action.

**Why this priority**: Affordance and reversibility for accidental entry into select mode; protects against destructive missclicks.

**Independent Test**: Click one checkbox to enter select mode; then either click "Cancel" in the floating bar, press Escape, or click the same checkbox again. In each case, the floating bar disappears, all selections are cleared, and checkboxes are hidden until next hover.

**Acceptance Scenarios**:

1. **Given** the user is in select mode, **When** they click "Cancel" in the floating bar, **Then** all selections clear and select mode exits.
2. **Given** the user is in select mode and Cmd/Ctrl+clicks a card, **When** the click registers, **Then** that ticket's selection toggles and the ticket detail panel does NOT open.
3. **Given** only INBOX tickets support bulk select, **When** the user hovers a card in SPECIFY/PLAN/BUILD/VERIFY/SHIP, **Then** no checkbox appears and select-mode interactions are not available.

---

### Edge Cases

- A selected ticket is moved out of INBOX (or deleted) by another user between selection and submission → the entire batch is rejected with a message listing the conflicting tickets; nothing is changed.
- The user selects more than 50 tickets → the action buttons disable with a tooltip "Select at most 50 tickets per bulk action".
- The merge target description, after concatenation, already exceeds 10,000 characters before the user edits anything → the modal opens with the textarea over-limit, the live counter showing the negative remaining count, and the submit button disabled until trimmed.
- The user attempts to merge tickets that have different agents or models → the merge proceeds; the base ticket's agent/model values are retained (the merge is a content-level squash, not a settings merge).
- The actor lacks write access to one of the selected tickets (e.g., revoked membership during the session) → the entire batch is rejected with an authorization error.
- The user refreshes the page or navigates away while in select mode → select mode and selections are discarded; this is purely client-side ephemeral state.
- Two users perform overlapping bulk operations on the same tickets concurrently → the second operation sees the first's results when it reaches the atomic check and is rejected with a conflict message.
- A bulk action is triggered on an empty selection (e.g., race condition where last item was deselected just before clicking) → the floating bar disappears and no action is performed.

## Requirements

### Functional Requirements

**Selection model**

- **FR-001**: System MUST display a selection checkbox on hover for every ticket card in the INBOX column, and MUST NOT display checkboxes on cards in any other stage column.
- **FR-002**: System MUST enter "select mode" the first time the user clicks a checkbox or Cmd/Ctrl+clicks a card. While in select mode, every INBOX checkbox MUST remain visible regardless of hover state, until select mode ends.
- **FR-003**: System MUST exit select mode and clear all selections when (a) the user presses Escape, (b) clicks Cancel in the floating action bar, (c) deselects the last selected ticket, or (d) a destructive bulk action (Delete, Merge) completes successfully.
- **FR-004**: System MUST remain in select mode with selections preserved after a non-destructive bulk action (Change agent, Change model) completes, so the user can chain further actions on the same batch.
- **FR-005**: System MUST treat Shift+click on a card as a range select: every ticket between the most recently clicked anchor and the shift-clicked card (inclusive, in displayed order) becomes selected.
- **FR-006**: System MUST treat Cmd/Ctrl+click on a card as a selection toggle for that ticket and MUST NOT open the ticket detail panel for that click.
- **FR-007**: System MUST treat a plain click on the checkbox (not the card body) as a toggle of that ticket's selection without opening the detail panel.
- **FR-008**: System MUST limit each bulk operation to at most 50 tickets and disable bulk action buttons (with explanatory tooltip) when this cap is exceeded.

**Floating action bar**

- **FR-009**: System MUST display a floating action bar at the bottom of the screen whenever at least one ticket is selected, and MUST hide it when zero tickets are selected.
- **FR-010**: System MUST show in the floating bar, in order: a "N selected" counter, a Merge button, a Delete button, a "Change agent" dropdown, a "Change model" dropdown, and a Cancel button.
- **FR-011**: System MUST disable the Merge button when fewer than 2 tickets are selected.
- **FR-012**: System MUST keep the floating bar visible across scroll and viewport resize so the user can always access the bulk actions while inspecting cards.

**Bulk delete**

- **FR-013**: System MUST require explicit confirmation via a modal dialog before performing a bulk delete, naming the count of tickets and warning that the action is irreversible.
- **FR-014**: System MUST perform bulk delete as a hard delete (no soft-delete, consistent with the existing INBOX delete behavior).
- **FR-015**: System MUST execute bulk delete atomically — either all selected tickets are deleted or none are; partial deletion is not permitted.

**Bulk merge**

- **FR-016**: System MUST designate the selected ticket with the smallest id as the merge "base" and treat the others as sources to be absorbed.
- **FR-017**: System MUST open a preview modal before any merge is committed, listing all selected tickets in ascending id order with the base ticket clearly labeled.
- **FR-018**: System MUST prefill the merge preview's title field with the base ticket's current title and allow free-form editing within the existing title length limit.
- **FR-019**: System MUST prefill the merge preview's description field with the base ticket's description followed, for each non-base ticket in ascending id order, by `\n\n---\n\n## From <ticketKey>: <title>\n<description>` blocks; the field is fully editable.
- **FR-020**: System MUST show a live character counter under the description field and MUST block submission when the description exceeds 10,000 characters, with a clear error message indicating the overflow.
- **FR-021**: System MUST, on merge submission, atomically (a) update the base ticket with the edited title and description, (b) transfer every attachment from every source ticket onto the base ticket, and (c) hard-delete every source ticket. If any step fails, no changes are persisted.
- **FR-022**: System MUST preserve the base ticket's id, ticketKey, agent, model overrides, workflowType, autoMode, clarificationPolicy, and stage; only title, description, and attachments are mutated by the merge.

**Bulk agent / model change**

- **FR-023**: Users MUST be able to pick one agent from a dropdown in the floating bar and apply it to every selected ticket in a single action, updating only the `agent` field.
- **FR-024**: Users MUST be able to pick one model from a dropdown in the floating bar and apply it to every selected ticket, setting all five per-command model overrides (`specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`) to that single value.
- **FR-025**: System MUST execute bulk agent and bulk model updates atomically across the selection.

**Authorization, conflict, and atomicity**

- **FR-026**: System MUST enforce existing project-level permissions on every bulk operation: only the project owner or a project member may perform any bulk action, and only on tickets within projects they have access to.
- **FR-027**: System MUST reject any bulk operation in which any selected ticket has changed stage (no longer INBOX) or been deleted between selection time and submission time, returning an error that identifies the conflicting tickets, with no partial mutation.
- **FR-028**: System MUST forbid mixing tickets from different projects in a single bulk operation (selection is scoped to a single project board).

**Notifications & audit**

- **FR-029**: System MUST send a notification to the original creator of any source ticket affected by a Merge or Delete, when that creator is not the user performing the action, identifying the actor and the action taken.
- **FR-030**: System MUST NOT generate notifications for bulk agent or model changes.
- **FR-031**: System MUST log every bulk operation (delete, merge, change-agent, change-model) to the existing activity stream with actor, project, affected ticket keys, and operation type.

**Accessibility**

- **FR-032**: System MUST allow the user to toggle selection of a focused card via the keyboard (Space when the checkbox has focus), use Tab to traverse checkboxes when select mode is active, and trigger every floating-bar action via keyboard.

### Key Entities

- **Ticket selection** (UI-only, ephemeral): the set of ticket ids currently selected on the INBOX column, plus the anchor id used for range-select; cleared on navigation, refresh, Escape, Cancel, or successful destructive action.
- **Merge request** (transient): base ticket id, ordered list of source ticket ids, edited title, edited description, derived attachment list; validated client-side and re-validated server-side at submission.
- **Ticket** (existing model): only tickets at stage INBOX within a single project are eligible. Identity, ticketKey, stage, agent, and model overrides on the base ticket are preserved by a merge; only title, description, and attachments change.

### Internal Processes

- **Bulk delete process**: Triggered by user confirmation in the bulk-delete modal.
  - **Input**: actor identity, project id, list of ticket ids to delete.
  - **Phases**: 1) re-verify actor permissions on the project; 2) reload the listed tickets and verify each is in INBOX and belongs to the project; 3) hard-delete all tickets in a single transactional unit; 4) record activity log entries; 5) emit notifications to non-actor creators.
  - **Output**: tickets removed from storage; activity entries; notifications. UI exits select mode and refreshes the INBOX column.
  - **Error behavior**: any verification failure or storage failure rolls back the entire batch; the user sees a message identifying conflicting tickets or the failure cause. Operation is not retried automatically.

- **Bulk merge process**: Triggered by user confirmation in the merge preview modal.
  - **Input**: actor identity, project id, base ticket id, ordered source ticket ids, edited title, edited description, expected base version (for optimistic concurrency).
  - **Phases**: 1) re-verify actor permissions; 2) verify base and all sources are in INBOX, belong to the same project, and base version matches; 3) validate edited title length and description ≤ 10,000 chars; 4) in one transactional unit: append source attachments onto the base attachments list, update base title/description and bump version, hard-delete every source ticket; 5) record an activity log entry naming base and sources; 6) emit notifications to non-actor creators of source tickets.
  - **Output**: a single updated base ticket containing edited content and aggregated attachments; deleted source tickets; activity log; notifications.
  - **Error behavior**: any precondition failure (stage drift, version mismatch, length violation) or storage failure rolls back the whole transaction; the merge modal stays open with an inline error so the user can adjust and retry.

- **Bulk agent/model update process**: Triggered when the user picks a value in the floating-bar dropdown.
  - **Input**: actor identity, project id, list of ticket ids, target field set (either `agent`, or all five model override fields), single chosen value.
  - **Phases**: 1) re-verify actor permissions; 2) verify each ticket is INBOX and in the project; 3) update target fields on all tickets in a single transactional unit; 4) record an activity log entry.
  - **Output**: tickets updated; activity log entry. UI keeps select mode open with selections preserved and shows a brief success indication.
  - **Error behavior**: any precondition or storage failure rolls back the batch; the floating bar shows an inline error and the selection is preserved so the user can retry or adjust.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can delete 10 INBOX tickets in a single batch in under 15 seconds from first selection to confirmation, compared to roughly 60 seconds when deleting one ticket at a time today.
- **SC-002**: A user can merge 3 duplicate INBOX tickets into one — including reviewing the prefilled title, trimming the prefilled description, and confirming — in under 60 seconds.
- **SC-003**: After completing a bulk action, the INBOX column reflects the change within 2 seconds without requiring a manual page reload.
- **SC-004**: Zero data-loss incidents from partial bulk operations: every bulk delete or merge either fully succeeds or leaves all involved tickets exactly as they were before the action.
- **SC-005**: At least 80% of users who run an inbox-analysis session containing more than 5 generated tickets use at least one bulk action (delete, merge, or change-agent/model) on the resulting batch within the same browsing session.
- **SC-006**: Bulk operations on the maximum supported batch (50 tickets) complete server-side in under 3 seconds at p95.
