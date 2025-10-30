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

### Stage Progression Rules

Tickets must move through stages sequentially - they cannot skip stages or move backwards. The valid progression is:

```
INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
```

**Sequential Movement**:
- Tickets can only advance to the immediately next stage
- Backward movement is prohibited (e.g., SPECIFY cannot return to INBOX)
- Skipping stages is not allowed (e.g., INBOX cannot jump directly to BUILD)

**Quick Implementation Path**:
- Tickets can bypass SPECIFY and PLAN stages by moving directly from INBOX to BUILD
- This provides a fast-track workflow for simple tasks
- A confirmation modal explains the trade-offs before proceeding
- Quick implementation tickets are visually distinguished on the board

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

### Visual Feedback

**Hover States**:
- Ticket cards provide visual feedback when hovered
- No functional action occurs on click - cards open detail modal

**Empty Columns**:
- Columns with no tickets display an empty state message
- Message follows consistent pattern across all columns

## Responsive Behavior

- **Desktop** (≥1024px): All columns visible side-by-side
- **Mobile** (≥375px): Functional layout with appropriate sizing
- **Small Screens** (<375px): Horizontal scrolling enabled to view all columns

## Real-Time Updates

### Automatic Board Refresh

The board automatically synchronizes ticket positions when workflows complete and transition tickets to new stages:

**Workflow Completion Updates**:
- When a GitHub Actions workflow completes and transitions a ticket to a new stage, the board automatically refreshes
- Updates occur within 2-3 seconds of workflow completion (maximum: 2-second polling interval + API response time)
- No manual page refresh required
- Only affected tickets update (other tickets remain unchanged)

**Update Triggers**:
- Workflow job status changes to COMPLETED, FAILED, or CANCELLED (terminal states)
- TanStack Query cache automatically invalidates when terminal state detected
- Board refetches latest ticket data from server
- Updated ticket appears in correct stage column with correct job status indicator

**Manual Transitions**:
- Drag-and-drop transitions continue to use optimistic updates
- Immediate visual feedback (under 100ms perceived latency)
- Works independently alongside workflow-based automatic updates

### Update Behavior

**During Workflow Execution**:
- Ticket remains in current stage while job is PENDING or RUNNING
- Job status indicator updates every 2 seconds via polling
- Board position does not change until workflow transitions ticket to new stage

**After Workflow Success with Stage Transition**:
- Job status changes to COMPLETED
- Workflow transitions ticket to next stage (e.g., BUILD → VERIFY, VERIFY → SHIP)
- Polling hook detects terminal job status
- Cache invalidates automatically within 2 seconds
- Board refetches all tickets
- Ticket appears in new stage column with updated job status

**After Workflow Success without Stage Transition**:
- Job status changes to COMPLETED
- Ticket remains in current stage (e.g., SPECIFY job completes but ticket stays in SPECIFY)
- Cache invalidates automatically
- Board refetches to ensure consistency
- Ticket position unchanged but status indicator updates

**After Workflow Failure**:
- Job status changes to FAILED
- Ticket remains in current stage
- Cache invalidates to sync failure state
- Failure state visible in ticket detail view

**Multiple Concurrent Workflows**:
- System handles multiple tickets with active workflows
- TanStack Query deduplicates concurrent refetch requests
- Single API call fetches all updated tickets
- All affected tickets update simultaneously without UI flickering

**Race Condition Prevention**:
- Job polling runs every 2 seconds to detect status changes
- Terminal job IDs tracked on client to prevent duplicate cache invalidations
- TanStack Query request deduplication prevents excessive API calls
- Optimistic updates for manual drag-and-drop preserved during workflow updates

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
