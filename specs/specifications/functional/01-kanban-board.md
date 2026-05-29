# Kanban Board - Functional Specification

## Purpose

The Kanban board provides a visual workflow system for managing tickets across six stages. Users can see the current state of all work items at a glance and move tickets through the workflow using drag-and-drop interactions.

## Workflow Stages

The board displays six columns representing distinct workflow phases:

1. **INBOX** - New tickets enter here by default
2. **SPECIFY** - Tickets undergo specification creation
3. **PLAN** - Tickets receive implementation planning
4. **BUILD** - Active implementation work
5. **VERIFY** - Testing and verification
6. **SHIP** - Completed and shipped features

**Additional Stage** (not displayed on board):
- **CLOSED** - Terminal state for abandoned or cancelled work (tickets removed from board but remain searchable)

### Stage Progression Rules

Tickets move through stages sequentially with limited rollback capabilities:

```
INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
                                         → CLOSED (alternative resolution)
```

**Sequential Movement**:
- Tickets can only advance to the immediately next stage
- Most backward movement is prohibited (e.g., SPECIFY cannot return to INBOX)
- Skipping stages is not allowed (e.g., INBOX cannot jump directly to BUILD)

**Quick Implementation Path**:
- Tickets can bypass SPECIFY and PLAN stages by moving directly from INBOX to BUILD
- This provides a fast-track workflow for simple tasks
- A confirmation modal explains the trade-offs before proceeding
- Quick implementation tickets are visually distinguished on the board

**Rollback Capabilities**:

Rollback is only available when the ticket's last workflow job is FAILED or CANCELLED (except VERIFY→PLAN which also allows COMPLETED). Tickets with RUNNING or PENDING jobs cannot be rolled back.

Valid rollback transitions:

| From | To | Workflow Type | Conditions | Git Action |
|------|----|---------------|------------|------------|
| SPECIFY | INBOX | FULL | Last job FAILED/CANCELLED | Branch deleted (if present) |
| PLAN | SPECIFY | FULL | Last job FAILED/CANCELLED | None (re-run specify overwrites plan) |
| BUILD | PLAN | FULL | Last job FAILED/CANCELLED | Backup tag created, branch reset |
| BUILD | INBOX | QUICK | Last job FAILED/CANCELLED | workflowType reset to FULL |
| VERIFY | BUILD | FULL | Last job FAILED/CANCELLED | None (re-run verify) |
| VERIFY | PLAN | FULL | Last job COMPLETED/FAILED/CANCELLED | Backup tag created, branch reset |

**Destructive rollbacks** (BUILD→PLAN, VERIFY→PLAN) create a backup git tag (`backup/{ticketKey}/{stage}-{jobId}`) before resetting the branch, preserving partial work for potential cherry-pick recovery. Backup tags are automatically deleted at the start of the next successful verify run.

**Board visual feedback during rollback drag**:
- Valid rollback target columns are highlighted; invalid columns are greyed out
- Dragging a ticket with a FAILED/CANCELLED job shows only valid drop targets
- A confirmation dialog appears before any rollback executes, with contextual messaging describing the consequences (e.g., branch deletion, code reset)

**Alternative Resolution**:
- **VERIFY to CLOSED**: Tickets can be closed without shipping
  - Available when: ticket in VERIFY stage with no active jobs
  - Requires confirmation modal explaining consequences
  - Closes associated GitHub PRs with explanatory comment
  - Preserves Git branch for future reference
  - Removes ticket from board display (still searchable)
  - Dual drop zone appears in SHIP column: Ship (top ~60%) or Close (bottom ~40%)

## Board Display

### Column Layout

- All six columns appear side-by-side
- Each column displays a header with the stage name and current ticket count
- Columns use distinct color coding for visual differentiation:
  - INBOX: Gray
  - SPECIFY: Blue
  - PLAN: Blue
  - BUILD: Green
  - VERIFY: Orange
  - SHIP: Purple

### Ticket Cards

Each ticket appears as a card within its current stage column. Cards display:

- **Title**: Truncated to 2 lines with ellipsis for longer titles
- **Ticket ID**: Unique identifier (format: #1, #2, etc.)
- **Stage Badge**: Current workflow stage with appropriate color
- **Timestamp**: Last updated time in relative format ("2 hours ago") for recent updates or absolute format ("2025-09-30 14:30") for older updates
- **Quality Score Badge** (conditional): Small colored badge showing the integer score (0-100), shown only for tickets with a COMPLETED verify job that has a quality score
  - Green: Excellent (90-100)
  - Blue: Good (70-89)
  - Amber: Fair (50-69)
  - Red: Poor (0-49)
  - Not shown for QUICK workflows or failed/cancelled verify jobs

### Ticket Ordering

Tickets are ordered differently depending on their stage:

- **INBOX**: Tickets are sorted by ticket number in ascending order (oldest first, newest last)
  - Provides a natural FIFO (First In, First Out) queue
  - Newly created tickets appear at the bottom of the INBOX column
  - Helps teams process work in the order it was submitted

- **All Other Stages** (SPECIFY, PLAN, BUILD, VERIFY, SHIP): Tickets are sorted by last updated time in descending order (most recently updated first)
  - Recently modified tickets appear at the top
  - Helps teams focus on active work
  - Provides visibility into stale tickets at the bottom

### Auto-Transition Mode

Users can enable a per-ticket "auto mode" that automatically chains the SPECIFY → PLAN → BUILD workflow after each successful job, removing the need to drag the card between stages manually.

**Toggle icon**:
- A double-chevron icon appears on FULL-workflow ticket cards in INBOX, SPECIFY, or PLAN
- Never rendered on QUICK-workflow tickets in any stage
- Never rendered on full-workflow tickets in BUILD, VERIFY, SHIP, or CLOSED
- Off state: hidden by default, visible only on card hover (matches the cancel-X pattern) — plain double-chevron with no background, border, or glow
- On state: permanently visible as an animated mauve glyph (the chevron slides horizontally with a gentle opacity pulse) so the state is obvious across the board without hovering. No background, border, or box-shadow. Respects `prefers-reduced-motion` by pausing the animation at a steady opacity.
- Tooltip: "Enable auto-transition" when off, "Auto-transition on — click to disable" when on

**Enabling auto-mode** (from off):
- Clicking the icon opens a confirmation modal listing the stages that will run automatically (e.g., from INBOX: "SPECIFY → PLAN → BUILD will run automatically")
- Confirming turns auto-mode on and persists the state for the ticket
- If no workflow job is currently running, the next-stage transition is dispatched immediately
- If a workflow job is currently running, no new transition is dispatched — the chain starts when that job completes successfully
- Cancelling the modal leaves auto-mode off and dispatches nothing

**Disabling auto-mode** (from on):
- A single click on the icon disables auto-mode immediately — no confirmation modal
- Any running job is not interrupted, cancelled, or otherwise affected
- The icon reverts to hover-only visibility

**Automatic chaining on success**:
- When a workflow job on an auto-mode ticket completes successfully, the ticket auto-advances to the next stage (SPECIFY → PLAN, PLAN → BUILD) using the same authorization and dispatch path as a manual drag
- BUILD → VERIFY continues to be driven by the existing post-BUILD auto-transition (auto-mode's icon is not shown from BUILD onward)
- Manually dragging a card forward while auto-mode is on keeps auto-mode on; the next successful job completion still triggers the next transition

**Safety: auto-disengage on failure**:
- If any workflow job on an auto-mode ticket reaches FAILED or CANCELLED, auto-mode turns itself off automatically
- The ticket stays on its current stage; no further transition is dispatched
- Re-enabling auto-mode after a failure requires an explicit user action (the same activation flow)
- If the immediate dispatch triggered on activation fails (missing credential, quota exhausted, etc.), auto-mode is reverted to off
- Failures surface through the existing job-failure notification path

**Rollback interaction**:
- When a ticket is rolled back from VERIFY to PLAN, auto-mode is turned off as part of the rollback
- This prevents the PLAN → BUILD → VERIFY → PLAN infinite loop

**Persistence and scope**:
- Auto-mode state is stored per ticket and persists across page reloads and user sessions
- All users viewing a ticket see the same on/off state (property of the ticket, not a per-user preference)
- Auto-mode on one ticket does not affect any other ticket
- Any user permitted to advance the ticket manually (project owner or member) is permitted to toggle auto-mode

### Cancel Running Jobs

Users can cancel a RUNNING or PENDING job directly from the board without navigating to the ticket detail:

**Board card (hover)**:
- When hovering a ticket card that has an active (RUNNING or PENDING) job, a cancel button (X icon) appears next to the job status indicator
- Clicking the cancel button opens a confirmation dialog: "Annuler le workflow {command} en cours ?"
- After confirmation, the job transitions to CANCELLED and the card updates within the next polling cycle (≤2s)
- The cancel button is disabled immediately after the first click to prevent duplicate requests

**Ticket detail modal (always visible)**:
- A cancel button is always visible on each RUNNING or PENDING job row in the job timeline
- Clicking it triggers the same confirmation dialog and cancellation flow

**Cancellation behavior**:
- RUNNING jobs: the associated GitHub Actions workflow run is terminated via the GitHub API
- PENDING jobs (no workflow run started yet): marked CANCELLED directly without calling GitHub API; if the workflow starts afterward, its first status callback is rejected with 409, causing it to self-abort
- If the job reaches a terminal state before the cancel request is processed, the UI updates to reflect the current status without showing an error

### Bulk Actions on INBOX Tickets

The INBOX column supports multi-selection so users can clean up large batches of tickets in one pass — typically after an inbox-analysis run produces many tickets that need deduplication, deletion, or default-agent/model changes. Multi-select is INBOX-only; other stages never expose checkboxes.

**Selection affordance**:

- Every INBOX ticket card reveals a checkbox in its corner on hover. Cards in SPECIFY/PLAN/BUILD/VERIFY/SHIP never show a checkbox
- "Select mode" begins the first time the user clicks a checkbox or Cmd/Ctrl+clicks a card. While in select mode, every INBOX checkbox stays visible regardless of hover
- The selection cap is 50 tickets per bulk action; the action buttons disable above this with a tooltip "Select at most 50 tickets per bulk action"

**Selection gestures**:

| Gesture | Effect |
|---|---|
| Click on checkbox | Toggles that ticket's selection; does not open the detail panel |
| Cmd/Ctrl+click on card body | Toggles that ticket's selection; does not open the detail panel |
| Shift+click on card | Range-selects every ticket between the most recent anchor and the shift-clicked card (inclusive, in displayed order) |
| Plain click on card body | Opens the ticket detail panel as usual, even when select mode is active |
| Tab | Traverses INBOX checkboxes when select mode is active |
| Space (with checkbox focused) | Toggles selection |
| Escape | Clears all selections and exits select mode |

Selection is purely client-side: refreshing the page, navigating away, or unmounting the board discards the selection.

**Floating action bar**:

A floating bar pinned to the bottom of the viewport appears whenever at least one INBOX ticket is selected and stays visible across scroll and viewport resize. From left to right, it shows:

1. A live "N selected" counter (announced via `aria-live="polite"`)
2. A **Merge** button — disabled when fewer than 2 tickets are selected, or when more than 50 are
3. A **Delete** button (destructive variant) — disabled above 50 tickets
4. A **Change agent** dropdown — lists the agents supported by the project's configuration; selection commits immediately
5. A **Change model** dropdown — lists the whitelisted models for the project's default agent (Claude or Codex); selection commits immediately
6. A **Cancel** button — clears the selection and exits select mode

All buttons are reachable via Tab with a visible focus ring; disabled buttons carry tooltips explaining the disable reason.

**Bulk delete**:

Triggered from the floating bar. A confirmation modal opens showing the count and a warning that the action permanently deletes the tickets, all attachments, comments, and history. On confirm, every selected ticket is hard-deleted in a single atomic operation; the floating bar disappears and select mode exits.

**Bulk merge**:

Triggered from the floating bar when 2–50 tickets are selected. A preview modal opens with:

- The selected ticket with the smallest id labeled as the **base** ("Base: AIB-{n} — {title}")
- Each non-base ticket listed in ascending id order with a "will be deleted" badge
- A title field prefilled with the base ticket's current title (editable, up to 100 chars, live character counter)
- A description textarea prefilled with the base description followed, for each non-base ticket in ascending id order, by `\n\n---\n\n## From <ticketKey>: <title>\n<description>` blocks (editable, up to 10,000 chars, live character counter that turns red and disables submit when the limit is exceeded)
- A line showing "Combined attachments: {n}" derived from the base + all sources

On submit, the base ticket atomically receives the edited title, the edited description, and the concatenated attachment list from every source, while the source tickets are hard-deleted. The base's id, ticketKey, agent, per-stage model overrides, workflowType, autoMode, clarificationPolicy, branch, previewUrl, and stage are all preserved — merge is content-level squash, never a settings merge.

**Bulk change agent / change model**:

Picking a value from either dropdown commits immediately (no confirmation modal):

- **Change agent** updates only the `agent` field on every selected ticket
- **Change model** writes the chosen model (Claude or Codex) to all five per-command overrides (`specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`) on every selected ticket

After a non-destructive action succeeds, the floating bar shows a brief success indication and select mode stays open with the same tickets selected, so the user can chain another action.

**Atomicity, conflicts, and authorization**:

- Every bulk operation either fully succeeds or leaves all involved tickets untouched — no partial mutations
- If any selected ticket has moved out of INBOX or been deleted by another user between selection and submission, the whole batch is rejected and the response identifies the conflicting tickets so the user can re-select
- For delete and merge, optimistic-concurrency version checks block conflicting concurrent edits
- Bulk operations are limited to a single project board — selecting across projects is not possible
- Only project owners and members may perform bulk actions

**Edge cases**:

- An empty selection caused by a race (last item deselected just before the click) collapses the floating bar with no action
- A merge whose prefilled description already exceeds 10,000 chars opens the modal with submit disabled and the counter showing the negative remaining count
- Merging tickets with different agents or model overrides proceeds normally — the base ticket's values are kept
- Browser refresh or navigation while in select mode discards selection (client-side only)

**Notifications & audit**:

- Bulk delete and bulk merge send a notification to the original creator of any affected source ticket when that creator is not the actor; the notification names the actor and the action
- Bulk change-agent and change-model operations are silent — no notifications generated
- Every bulk operation (delete, merge, change-agent, change-model) is logged to the activity stream with actor, project, affected ticket keys, and operation type

### Visual Feedback

**Hover States**:
- Ticket cards provide visual feedback when hovered
- No functional action occurs on click - cards open detail modal

**Empty Columns**:
- Columns with no tickets display an empty state message
- Message follows consistent pattern across all columns

**Trash Zone**:
- Appears at the bottom of the board during active drag operations
- Only visible when dragging tickets from non-SHIP stages
- Shows enabled state for tickets without active jobs
- Shows disabled state (reduced opacity, strikethrough) for tickets with pending or running jobs
- Hidden when no drag operation is active
- **Responsive Positioning**:
  - Mobile (<768px): Positioned at bottom-left with 1rem spacing from edges
  - Desktop (≥768px): Centered at bottom of viewport
  - Adaptive sizing: smaller icons (20px) and text (14px) on mobile, larger (24px icons, 16px text) on desktop
  - Reduced padding on mobile (12px) vs desktop (16px)

**Close Zone**:
- Appears at the bottom of the board during drag operations when dragging VERIFY tickets
- Used for VERIFY to CLOSED transitions (alternative to shipping)
- Shows enabled state for tickets without active jobs
- Shows disabled state for tickets with pending or running jobs
- Hidden when no drag operation is active
- **Responsive Positioning**:
  - Mobile (<768px): Positioned at bottom-right with 1rem spacing from edges
  - Desktop (≥768px): Positioned at bottom-right with 2rem spacing from edge
  - Adaptive sizing: smaller icons (20px) and text (14px) on mobile, larger (24px icons, 16px text) on desktop
  - Reduced padding on mobile (12px) vs desktop (16px)

**Locked State Overlays**:
- When a ticket with an active job is dragged, all drop columns show a blocked overlay
- Overlay displays a Ban icon with contextual message:
  - Job lock: "Workflow in progress - Wait for job completion"
- Drop zones appear with 50% opacity and "not-allowed" cursor
- Users receive clear visual feedback about why transitions are temporarily disabled

## Responsive Behavior

- **Desktop** (≥1024px): All columns visible side-by-side
- **Mobile** (≥375px): Functional layout with appropriate sizing
- **Small Screens** (<375px): Horizontal scrolling enabled to view all columns

## Real-Time Updates

### Automatic Board Refresh

The board automatically updates when workflow-initiated stage transitions occur:

**Workflow Completion Updates**:
- When a GitHub Actions workflow completes and transitions a ticket to a new stage, the board automatically refreshes
- Updates occur within 2 seconds of workflow completion (maximum polling interval)
- No manual page refresh required
- Only the affected ticket updates (other tickets remain unchanged)

**Update Triggers**:
- Workflow job status changes to COMPLETED, FAILED, or CANCELLED
- TanStack Query cache automatically invalidates
- Board refetches latest ticket data from server
- Updated ticket appears in correct stage column

**Manual Transitions**:
- Drag-and-drop transitions continue to use optimistic updates
- Immediate visual feedback (under 100ms perceived latency)
- No impact from workflow-based update mechanism

### Update Behavior

**During Workflow Execution**:
- Ticket remains in current stage while job is PENDING or RUNNING
- Job status updates every 2 seconds via polling
- No board refresh until job reaches terminal state

**After Workflow Success**:
- Job status changes to COMPLETED
- Cache invalidates automatically
- Board refetches tickets
- Ticket appears in new stage column (e.g., BUILD → VERIFY)

**After Workflow Failure**:
- Job status changes to FAILED
- Ticket remains in current stage
- Failure state visible in ticket detail view

**Multiple Concurrent Workflows**:
- System handles multiple tickets with active workflows
- TanStack Query deduplicates concurrent refetch requests
- Single API call fetches all updated tickets
- All affected tickets update simultaneously

## Keyboard Shortcuts

Keyboard shortcuts are available on the board page for desktop and tablet users with a physical keyboard. Shortcuts are automatically disabled on touch-only devices.

### Device Detection

Shortcuts are enabled only when the CSS media query `(hover: hover)` matches, indicating a device with fine pointer input (mouse or trackpad). Touch-only devices do not register shortcuts.

### Available Shortcuts

| Key | Action |
|-----|--------|
| `N` | Open new ticket creation modal |
| `S` or `/` | Focus the search input |
| `1` – `6` | Scroll board to column (1=INBOX, 2=SPECIFY, 3=PLAN, 4=BUILD, 5=VERIFY, 6=SHIP) |
| `?` | Toggle keyboard shortcuts help overlay |
| `Esc` | Close the topmost open modal or overlay |

### Shortcut Suppression

All shortcuts (except `Escape`) are suppressed when the focused element is an `<input>`, `<textarea>`, `<select>`, or `contenteditable` element. This prevents accidental activations while typing.

Shortcuts are completely inactive when the ticket detail modal is open. `Escape` continues to work to close modals via the native shadcn/ui Dialog behavior.

### Column Navigation

Number keys `1`–`6` smoothly scroll the board container horizontally to bring the target stage column into view. The scroll is idempotent — pressing the same key when the column is already visible re-scrolls to ensure it is fully in frame.

### Help Overlay

A floating keyboard icon button is visible at the bottom-right of the board on hover-capable devices. Clicking it or pressing `?` toggles a centered dialog listing all shortcuts in a Key | Action format.

**First-visit behavior**: The help overlay is shown automatically on a user's first board visit. A `shortcuts-hint-dismissed` localStorage flag is set on dismiss to prevent it from appearing again. If localStorage is unavailable, the dialog degrades gracefully without errors.

## Performance Expectations

- Board loads and displays correctly on all supported viewport sizes
- Page remains functional with up to 100 tickets across all columns
- Ticket count in column headers updates when tickets are created or moved
- Automatic workflow updates complete within 2 seconds of job completion

## Visual Theme

The board uses a dark theme by default, providing:
- Reduced eye strain for extended viewing
- Clear contrast for stage colors and ticket information
- Consistent theming across the application
