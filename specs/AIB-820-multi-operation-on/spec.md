# Feature Specification: Multi-Ticket Bulk Operations on Inbox

**Feature Branch**: `AIB-820-multi-operation-on`
**Created**: 2026-05-21
**Status**: Draft
**Input**: User description: "should have a way to select multi ticket inbox to do operation like : change model, change agent, delete, fusion ticket. The fusion ticket should create a ticket with the title of the first ticket (lowest id) and edit the description with all the description of selected tickets, with the choice to edit the description/title. Determine the best UI/UX based on current behaviour. Should not truncate the description, so if all descriptions are more than 10k we can't just submit and should edit. In fusion, should open the first ticket in edit with auto-complete with image and concat description."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Scope of bulk operations limited to tickets in the **INBOX** stage only.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Medium (score 3) — user description explicitly says "ticket inbox"; expanding to other stages risks unintended impact on tickets already in-flight with jobs/branches.
- **Fallback Triggered?**: Yes — CONSERVATIVE limits blast radius. Other stages may be added later.
- **Trade-offs**:
  1. Users cannot bulk-manage tickets that have left INBOX (must edit individually).
  2. Avoids complex job/branch teardown logic for active tickets.
- **Reviewer Notes**: Confirm INBOX-only restriction matches operational intent; later expansion can lift the constraint per stage.

- **Decision**: Selection UX uses **checkboxes** on each card with **shift-click range selection** and a **"Select all in INBOX"** toggle. A persistent **bulk action bar** appears at the bottom when ≥1 ticket is selected.
- **Policy Applied**: AUTO (CONSERVATIVE)
- **Confidence**: High — standard, well-understood pattern; user delegated UI/UX choice.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Adds visual density to inbox cards (a checkbox per card).
  2. Mobile interaction may need long-press equivalent.
- **Reviewer Notes**: Validate checkbox placement does not break drag-and-drop affordance on INBOX cards.

- **Decision**: **Destructive bulk actions** (delete, fusion) require an explicit **confirmation dialog** listing the affected ticket keys before execution.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — bulk deletion is irreversible and data-integrity sensitive.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. One extra click per bulk delete/fusion action.
  2. Prevents accidental mass deletion.
- **Reviewer Notes**: Ensure confirmation explicitly states "this cannot be undone" for delete.

- **Decision**: **Maximum 50 tickets** per bulk operation.
- **Policy Applied**: AUTO (CONSERVATIVE)
- **Confidence**: Medium — protects API/DB from large transactions; aligned with typical inbox sizes.
- **Fallback Triggered?**: Yes — no signal given; cautious cap chosen.
- **Trade-offs**:
  1. Users with very large inboxes must batch their operations.
  2. Keeps response time predictable and avoids long-running transactions.
- **Reviewer Notes**: Adjust if observed inbox sizes routinely exceed 50.

- **Decision**: **Fusion behavior** — absorbs all selected tickets into the **lowest-`id` ticket** (the "anchor"). Anchor opens in an inline edit modal pre-populated with anchor's title (editable) and a description built by concatenating each ticket's description in ascending-id order with a `\n\n---\n\n` separator and a heading line containing the absorbed ticket's key and title. Attachments = union across selected tickets (anchor first), de-duplicated by URL, clipped to per-ticket cap. Other selected tickets are deleted only after the user saves; cancel discards everything.
- **Policy Applied**: AUTO (CONSERVATIVE)
- **Confidence**: High — user explicitly described this flow.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Comments on absorbed tickets are discarded.
  2. Attachment cap may force the user to drop images during edit when total exceeds 5.
- **Reviewer Notes**: Confirm separator format and ordering meet user expectation.

- **Decision**: **Comments** on absorbed tickets (rare on INBOX) are **discarded** during fusion; no notifications sent to comment authors.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Low — user did not address this.
- **Fallback Triggered?**: Yes — discarding is simpler and avoids re-parenting/notification spam.
- **Trade-offs**:
  1. Information in comments is lost on absorbed tickets.
  2. Avoids re-parenting complexity.
- **Reviewer Notes**: If comments on INBOX tickets become common, consider merging or warning pre-fusion.

- **Decision**: **Long descriptions** — when the proposed merged description exceeds 10,000 characters (the `Ticket.description` limit), the edit modal opens with the full concatenation but **disables Save** and shows a banner ("Description exceeds 10,000 character limit by N characters — please edit before saving"). Save re-enables once the description fits.
- **Policy Applied**: AUTO (CONSERVATIVE)
- **Confidence**: High — user explicitly described this behavior.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. User must manually trim text rather than auto-truncation.
  2. Preserves user intent and avoids silent data loss.
- **Reviewer Notes**: Live character counter required for usability.

- **Decision**: **Bulk model change** opens a single dialog letting the user pick which **stage's model override** to set (Specify / Plan / Implement / Quick-Impl / Verify) and the model identifier. The chosen value overwrites that field on all selected tickets. An "Inherit project default" option clears the override.
- **Policy Applied**: AUTO (PRAGMATIC)
- **Confidence**: Medium — model override is per-stage; user did not name a stage.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. One extra selection (stage) per bulk model change.
  2. Avoids accidentally overwriting all five stage overrides at once.
- **Reviewer Notes**: Consider an "Apply to all stages" toggle in a future iteration.

- **Decision**: **Bulk agent change** opens a dialog with the same agent list as single-ticket Agent edit (CLAUDE / CODEX / MISTRAL / GEMINI / "Inherit project default"). The chosen value overwrites `agent` on all selected tickets.
- **Policy Applied**: AUTO (PRAGMATIC)
- **Confidence**: High — direct analog to existing single-ticket edit.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. None notable.
- **Reviewer Notes**: Reuse the existing `AgentEditDialog` component.

- **Decision**: **Authorization** — bulk operations require the same access level as single-ticket edits (owner OR project member). Server re-checks every ticket id; ineligible tickets are silently filtered and surfaced in the result summary.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — consistent with existing authorization model.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. None notable.
- **Reviewer Notes**: Server-side validation must re-check each ticket id against `verifyTicketAccess`.

- **Decision**: **Partial failure handling** — bulk delete/agent/model use **best-effort** semantics (per-ticket failures collected, successes kept). **Fusion** is **all-or-nothing** (single transaction).
- **Policy Applied**: AUTO (PRAGMATIC for bulk edits, CONSERVATIVE for fusion)
- **Confidence**: Medium — fusion's data-merge nature warrants atomicity; routine field updates tolerate per-ticket failures.
- **Fallback Triggered?**: Yes for fusion (CONSERVATIVE).
- **Trade-offs**:
  1. Mixed semantics may confuse users — must surface clear result summaries.
  2. Atomic fusion may fail entirely if one absorbed ticket is concurrently modified.
- **Reviewer Notes**: Result summary toast must list any per-ticket failures.

- **Decision**: **No notifications** are emitted to members for bulk operations; only a single in-session result toast is shown to the actor.
- **Policy Applied**: AUTO (PRAGMATIC)
- **Confidence**: Medium — avoids notification spam; INBOX edits are typically low-signal.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Co-collaborators not informed of bulk inbox changes.
  2. Notification volume stays manageable.
- **Reviewer Notes**: Re-evaluate if team workflows depend on inbox-edit visibility.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-select and bulk delete INBOX tickets (Priority: P1)

A user has accumulated several inbox tickets that are duplicates, no longer relevant, or spam-created from automated flows. They want to remove all of them in one action rather than opening and deleting each ticket individually.

**Why this priority**: Delete is the most common and lowest-risk-of-misuse bulk operation. It unblocks inbox grooming. Without selection, this entire feature has no entry point — so selection + delete is the foundational MVP slice.

**Independent Test**: Selection mechanism + bulk delete can be implemented and shipped without fusion or model/agent changes. Tested by selecting 3+ INBOX tickets, clicking "Delete", confirming the dialog, and observing all selected tickets disappear from INBOX while non-selected tickets remain.

**Acceptance Scenarios**:

1. **Given** an INBOX with 5 tickets, **When** I check the checkbox on 3 of them and click "Delete" in the bulk action bar and confirm, **Then** all 3 are deleted, the inbox shows the remaining 2 tickets, and a toast confirms "3 tickets deleted".
2. **Given** I have selected 4 tickets, **When** I shift-click the checkbox of another ticket 5 cards below, **Then** all tickets in the range between the last selection and the shift-clicked card become selected.
3. **Given** I have selected tickets and one of them was already deleted by another user, **When** I click "Delete" and confirm, **Then** the operation completes and the result summary shows "N deleted, 1 already gone".

---

### User Story 2 - Bulk change agent or model override for selected tickets (Priority: P2)

A user wants to retarget several inbox tickets from CLAUDE to CODEX (or set a specific implement-stage model on a batch of related tickets) without opening each ticket's edit modal.

**Why this priority**: Common when planning a sprint or switching defaults. High-volume savings; lower risk than fusion; reuses existing single-ticket edit components.

**Independent Test**: Ships after Story 1's selection foundation. Tested by selecting tickets, clicking "Change agent", picking an agent, and verifying every selected ticket's `agent` field updated.

**Acceptance Scenarios**:

1. **Given** I have selected 4 INBOX tickets with mixed agents, **When** I click "Change agent" → select "CODEX" → confirm, **Then** all 4 tickets show agent=CODEX in the inbox and a toast confirms "4 tickets updated".
2. **Given** I have selected 3 tickets, **When** I click "Change model" → choose stage "Implement" → choose model `claude-opus-4-7` → confirm, **Then** all 3 tickets show the new `implementModel` override.
3. **Given** I have selected 5 tickets but 1 was moved out of INBOX by another user, **When** I confirm the bulk agent change, **Then** 4 tickets update successfully and the summary lists the 1 skipped ticket with reason "no longer in INBOX".
4. **Given** I select a model stage and choose "Inherit project default", **When** I confirm, **Then** that model override is cleared (set to null) on all selected tickets.

---

### User Story 3 - Fusion (merge) multiple inbox tickets into the anchor (Priority: P3)

A user has several inbox tickets that describe pieces of the same feature (drafts of the same idea or related sub-tasks). They want to merge them into one consolidated ticket without losing any description text or attached images.

**Why this priority**: Highest user-value but most complex flow. Depends on selection (Story 1). Requires confirmation, edit-before-save, attachment merging, and atomic deletion of absorbed tickets.

**Independent Test**: Select 2+ tickets, click "Fusion", verify the edit modal opens pre-populated with anchor's title and concatenated descriptions and combined images, edit if needed, save, and verify only the anchor ticket remains with merged content.

**Acceptance Scenarios**:

1. **Given** I select tickets AIB-101, AIB-102, AIB-103 (each with a short description), **When** I click "Fusion", **Then** an edit modal opens with title from AIB-101, and the description shows AIB-101's body followed by `--- [AIB-102] <title>` + AIB-102's body, followed by `--- [AIB-103] <title>` + AIB-103's body.
2. **Given** the fusion modal is open and the combined description is 12,000 characters, **When** I look at the Save button, **Then** Save is disabled and a banner says "Description exceeds 10,000 characters by 2,000 — please trim before saving"; **When** I edit it down to ≤10,000, **Then** Save becomes enabled.
3. **Given** I select 3 tickets with 2, 1, and 3 images respectively (6 total), **When** the fusion modal opens, **Then** the modal shows the first 5 images (anchor-first, then ascending-id order) and warns "1 image dropped due to per-ticket cap (5)"; I can remove others to keep dropped ones.
4. **Given** I'm in the fusion modal, **When** I close the modal without saving, **Then** no tickets are modified or deleted.
5. **Given** I save the fusion, **When** the operation completes, **Then** the anchor ticket (lowest id) holds the merged title/description/attachments, all other selected tickets are deleted, and a toast confirms "Fused N tickets into AIB-101".
6. **Given** one of the absorbed tickets was modified by another user between selection and save, **When** I click Save, **Then** the entire fusion fails (atomic), the modal stays open, and an error explains the conflict.

---

### Edge Cases

- **Single-ticket selection + bulk action**: Bulk action bar still appears but operations behave equivalently to single-ticket actions (no special-casing needed).
- **Selecting a non-INBOX ticket**: Not possible — checkboxes are only rendered on INBOX cards; if a ticket transitions out of INBOX while selected, it is silently removed from the selection on next refresh.
- **Drag during selection**: Dragging an INBOX card while items are selected drags only the dragged card (not the whole selection) to avoid unintended transitions. Selection is preserved unless the dragged ticket lands outside INBOX.
- **Empty selection + click bulk action**: Bulk action bar is hidden when zero selected; impossible to trigger.
- **All selected tickets fail authorization**: Server returns 0 affected, toast shows "No tickets updated — check permissions".
- **Fusion of a single ticket**: Fusion option is disabled when only 1 ticket is selected.
- **Fusion result equals one of the inputs**: Anchor's merged description identical to its original (only one ticket had content). Still valid — modal opens, user saves, others are deleted.
- **Selected ticket has a running job**: INBOX tickets have no jobs by definition; if a job exists due to a stuck state, deletion follows existing single-ticket delete cleanup logic.
- **Concurrent fusion attempts**: First fusion to commit wins (optimistic concurrency on every absorbed ticket); second fails atomically.
- **Description length exactly 10,000**: Save is enabled at exactly the limit; disabled at 10,001+.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a selection checkbox on every ticket card while the ticket is in the INBOX stage.
- **FR-002**: System MUST support selecting multiple tickets via individual checkbox clicks, shift-click range selection, and a "Select all in INBOX" toggle.
- **FR-003**: System MUST display a persistent bulk action bar (with action buttons: Change agent, Change model, Fusion, Delete, and the current selection count) whenever ≥1 INBOX ticket is selected.
- **FR-004**: System MUST limit a single bulk operation to a maximum of 50 selected tickets and disable bulk actions when more than 50 are selected, surfacing a clear message.
- **FR-005**: Users MUST be able to delete all selected INBOX tickets in one action; the system MUST require explicit confirmation listing affected ticket keys before deletion.
- **FR-006**: Users MUST be able to change the `agent` field for all selected INBOX tickets in one action, with the same agent options as single-ticket edits, including an "Inherit project default" choice.
- **FR-007**: Users MUST be able to change a per-stage model override (Specify / Plan / Implement / Quick-Impl / Verify) for all selected INBOX tickets in one action, including an "Inherit project default" choice that clears the override.
- **FR-008**: Users MUST be able to "Fusion" (merge) two or more selected INBOX tickets into the ticket with the lowest `id` (the anchor); the Fusion button MUST be disabled when fewer than 2 tickets are selected.
- **FR-009**: System MUST open an inline edit modal during fusion, pre-populated with the anchor's title and a concatenated description constructed by joining each ticket's description in ascending-id order, separated by `\n\n---\n\n` and a heading line containing the absorbed ticket's key and title.
- **FR-010**: System MUST pre-populate the fusion modal's attachments with the union of all selected tickets' attachments, ordered anchor-first then ascending id, de-duplicated by URL, and clipped to the per-ticket attachment cap with a visible warning when clipping occurs.
- **FR-011**: System MUST NOT truncate the merged description; if the combined description exceeds 10,000 characters, the Save action MUST be disabled and a banner MUST show the excess character count until the user reduces the description to ≤10,000 characters.
- **FR-012**: System MUST display a live character counter on the fusion modal's description field at all times.
- **FR-013**: System MUST execute the fusion atomically: on save, the anchor is updated and all other absorbed tickets are deleted in a single transaction. If any step fails, no ticket is modified or deleted.
- **FR-014**: System MUST keep all modifications scoped to tickets in the INBOX stage; any selected ticket that has left INBOX between selection and execution MUST be skipped and reported.
- **FR-015**: System MUST enforce existing project access rules (owner or member) on every ticket affected by a bulk operation; ineligible tickets MUST be silently filtered server-side and surfaced in the result summary.
- **FR-016**: System MUST apply best-effort semantics to bulk delete, bulk agent change, and bulk model change: per-ticket failures (e.g., version conflict, ticket gone) MUST NOT abort successful peer operations and MUST be reported back in a per-ticket result list.
- **FR-017**: System MUST display a single summary toast/result panel after each bulk operation showing total affected, total skipped, and the reason for each skip.
- **FR-018**: System MUST require explicit confirmation dialogs for the destructive bulk actions (Delete, Fusion), listing the affected ticket keys; non-destructive actions (Change agent, Change model) do not require a confirmation step beyond the action dialog itself.
- **FR-019**: System MUST clear the current selection automatically after a successful bulk operation; on a failed operation the selection MUST be preserved so the user can retry.
- **FR-020**: System MUST prevent the "Select all" toggle from selecting more than 50 tickets at once — if the INBOX contains more than 50, the toggle selects the first 50 by display order and warns the user.
- **FR-021**: System MUST preserve existing drag-and-drop behavior on INBOX cards even when a card is selected (drag affects only the dragged ticket, not the selection set).
- **FR-022**: System MUST NOT emit per-ticket notifications for bulk operations; only the actor receives the result summary in-session.
- **FR-023**: System MUST validate that the bulk model dialog's model value passes the same allow-list checks used by single-ticket model edits before applying changes.

### Key Entities *(include if feature involves data)*

- **Ticket selection set**: A transient client-side collection of INBOX ticket ids currently checked by the user. Not persisted across page reloads. Cleared on successful bulk operation.
- **Bulk operation request**: A server-bound message containing the operation type (`delete` | `set-agent` | `set-model` | `fusion`), the list of ticket ids, current `version` of each ticket (for optimistic concurrency), and operation-specific payload (agent value, stage+model value, or fusion result).
- **Bulk operation result**: A server-returned summary listing per-ticket outcomes — `affected` (id list), `skipped` (id + reason), and for fusion, the resulting anchor ticket's new state.
- **Fusion draft**: An in-modal, unsaved combination of the anchor ticket's editable fields populated from the selected tickets. Discarded on cancel; only committed via the atomic fusion request.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Bulk delete**: User confirms deletion → server validates each ticket id (access + stage=INBOX) → per-ticket delete cleanup runs (cancel any orphan job, remove branch reference) → result aggregated and returned.
  - **Input**: List of ticket ids + per-ticket versions.
  - **Phases**: Authorize → filter to INBOX → per-ticket delete (best-effort) → aggregate results.
  - **Output**: Result summary; affected/skipped lists; client cache invalidation.
  - **Error behavior**: Best-effort; per-ticket failure recorded as skipped; no rollback of successful peers.

- **Bulk field update (agent / model override)**: User picks new value → server validates each id and version → updates field per ticket → returns aggregated outcome.
  - **Input**: Operation type, target field, new value, list of `(id, version)` pairs.
  - **Phases**: Authorize → validate field value (model allow-list, agent enum) → per-ticket update with optimistic-concurrency check → aggregate.
  - **Output**: Result summary with new versions for updated tickets.
  - **Error behavior**: Best-effort; version conflicts and stage mismatches reported per ticket; client refreshes affected tickets.

- **Fusion**: User confirms merged content → server runs atomic transaction → anchor updated, absorbed tickets deleted, result returned. If any precondition fails, transaction rolls back.
  - **Input**: Anchor ticket id, full edited title/description/attachments, list of absorbed ticket ids + versions.
  - **Phases**: Authorize all ids → re-check INBOX stage for all → version-check all → update anchor → delete absorbed → commit.
  - **Output**: Updated anchor ticket payload + count of deleted tickets; client cache replaces anchor and removes absorbed.
  - **Error behavior**: All-or-nothing; on any failure, no state changes, modal stays open with actionable error (conflict / permission / stage mismatch).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can delete 10 INBOX tickets in a single action in under 15 seconds (selection + confirm + completion), compared to roughly 60+ seconds when deleting one at a time today.
- **SC-002**: 95% of bulk operations on ≤50 tickets complete and return a result summary in under 3 seconds end-to-end.
- **SC-003**: When fusing tickets whose combined descriptions exceed 10,000 characters, the system never silently truncates content — the user is always given the opportunity to edit, measured by zero data-loss reports related to fusion.
- **SC-004**: 90% of users who attempt a bulk operation succeed on the first try (no abandoned confirmation dialogs, no >1 retry on the same selection).
- **SC-005**: After a successful fusion, the resulting anchor ticket contains text from every selected ticket (verified by spot checks of a representative sample of fused tickets — zero missing fragments).
- **SC-006**: Inbox grooming sessions (defined as ≥5 INBOX edits/deletes by the same user within 10 minutes) decrease in average duration by at least 50% compared to pre-feature baseline.
- **SC-007**: No bulk operation ever modifies a ticket outside the INBOX stage (zero incidents in production), verified by audit of post-feature ticket history.
