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
- **BUILD to INBOX**: Quick-implementation tickets can return to INBOX if job failed/cancelled
- **VERIFY to PLAN**: Full workflow tickets can return to PLAN to re-implement
  - Available when: workflowType=FULL and latest workflow job is COMPLETED, FAILED, or CANCELLED
  - Requires confirmation modal explaining consequences
  - Reverts implementation changes while preserving spec files
  - Clears preview URL and deletes the workflow job record
  - Visual feedback: amber/red dashed border on PLAN column during drag

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

## Keyboard Shortcuts

The board supports keyboard shortcuts on desktop and tablet devices with a physical keyboard. Shortcuts are disabled on touch-only devices and when focus is on any text input, textarea, or contenteditable element.

| Key | Action |
|-----|--------|
| `N` | Open new ticket creation modal |
| `S` or `/` | Focus the search input |
| `1` – `6` | Scroll smoothly to the corresponding column (INBOX=1, SPECIFY=2, PLAN=3, BUILD=4, VERIFY=5, SHIP=6) |
| `?` | Toggle the keyboard shortcuts help overlay |
| `Escape` | Close the shortcuts help overlay |

**Help Overlay**: The first time a physical-keyboard user visits the board, the shortcuts modal opens automatically. Subsequent visits do not auto-open the modal (dismissed state stored in `localStorage` under `shortcuts-hint-dismissed`). The overlay can be toggled at any time with `?`.

**Device Detection**: Shortcuts activate only when `window.matchMedia('(hover: hover)').matches` is true, excluding touch-only devices.

**Components**:
- `hooks/use-board-keyboard-shortcuts.ts` — keyboard event handling and help overlay state
- `components/board/keyboard-shortcuts-modal.tsx` — the shortcuts reference dialog

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
