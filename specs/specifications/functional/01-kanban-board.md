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

**Note**: A seventh stage (CLOSED) exists for tickets that have been abandoned or cancelled from VERIFY stage. Closed tickets do not appear on the board but remain searchable for reference.

### Stage Progression Rules

Tickets move through stages sequentially with limited rollback and closure capabilities:

```
INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
                                    ↓
                                 CLOSED
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
- **BUILD to INBOX**: Quick-implementation tickets can return to INBOX if job failed/cancelled
- **VERIFY to PLAN**: Full workflow tickets can return to PLAN to re-implement
  - Available when: workflowType=FULL and latest workflow job is COMPLETED, FAILED, or CANCELLED
  - Requires confirmation modal explaining consequences
  - Reverts implementation changes while preserving spec files
  - Clears preview URL and deletes the workflow job record
  - Visual feedback: amber/red dashed border on PLAN column during drag

**Ticket Closure**:
- **VERIFY to CLOSED**: Tickets can be closed from VERIFY stage to abandon work
  - Available when latest job is not PENDING or RUNNING
  - Requires confirmation modal with title "Close Ticket {ticketKey}?"
  - SHIP column splits into two drop zones when dragging from VERIFY:
    - Ship zone (top ~60%): Normal completion path
    - Close zone (bottom ~40%): Closure path with red dashed border and archive icon
  - On closure: PRs closed, branch preserved, ticket removed from board
  - CLOSED is a terminal state with no outbound transitions
  - Closed tickets remain searchable but open in read-only mode

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

**Close Zone**:
- Appears at the bottom of SHIP column (~40% height) when dragging ticket from VERIFY stage
- Displays red dashed border, archive icon, and "Close" label
- Only highlights when hovering over the close zone (Ship zone remains unhighlighted)
- Available only for VERIFY stage tickets without active jobs
- Does not appear when dragging tickets from other stages (SHIP column behaves normally)

**Locked State Overlays**:
- When a ticket with an active job is dragged, all drop columns show a blocked overlay
- When project cleanup is in progress, all drop columns show a blocked overlay for ANY dragged ticket
- Overlay displays a Ban icon with contextual message:
  - Job lock: "Workflow in progress - Wait for job completion"
  - Cleanup lock: "Cleanup in progress - Wait for cleanup completion"
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
