# Ticket Management - Functional Specification

## Purpose

Tickets represent individual work items that flow through the Kanban workflow. Users can create, view, and move tickets between stages to track progress on features, bugs, and tasks.

## Ticket Creation

### Creation Interface

- A "+ New Ticket" button appears at the top of the INBOX column
- Clicking the button opens a modal dialog with a creation form

### Required Information

All tickets must include:

- **Title**: Brief description (maximum 100 characters)
  - Required field - cannot be empty or whitespace-only
  - Restricted to alphanumeric characters and basic punctuation
  - No special characters or emojis allowed

- **Description**: Detailed context (maximum 2000 characters)
  - Required field - cannot be empty or whitespace-only
  - Restricted to alphanumeric characters and basic punctuation
  - No special characters or emojis allowed

### Validation Behavior

- The Create button is disabled when fields are invalid
- Real-time validation errors appear as users type
- Character limits are enforced with visible counters
- Invalid characters trigger immediate error messages

### Creation Process

1. User clicks "+ New Ticket" button
2. Modal dialog opens with empty form
3. User enters title and description
4. User clicks Create or presses Cmd/Ctrl+Enter
5. System creates ticket with unique sequential ID
6. Ticket appears immediately in INBOX column
7. Modal closes and form is cleared

### Error Handling

- Creation requests timeout after 15 seconds
- Network failures show error message with retry option
- Validation errors prevent form submission
- Loading state displays during creation

### Form Cancellation

Users can cancel creation by:
- Clicking the Cancel button
- Clicking outside the modal area
- Pressing the Escape key

When cancelled, the modal closes without creating a ticket.

## Ticket Movement

### Drag-and-Drop Operations

Users move tickets between stages using drag-and-drop:

1. Click and hold on a ticket card
2. Drag to a target column
3. Release to drop the ticket

### Visual Feedback During Drag

**Valid Drop Zones**:
- Highlight with colored border and background
- Show stage-specific icons
- Change cursor to indicate drop is allowed

**Invalid Drop Zones**:
- Reduced opacity (50%)
- Prohibited icon (🚫)
- Cursor changes to "not-allowed"

**Special Behaviors**:
- INBOX tickets can drop on SPECIFY (normal workflow, blue highlighting) or BUILD (quick implementation, green highlighting)
- VERIFY tickets (workflowType=FULL, job COMPLETED/FAILED/CANCELLED) can drop on PLAN (rollback, amber/red dashed highlighting)
- All other transitions show next sequential stage as valid drop zone

### Stage Transition Behavior

**Normal Transitions**:
- Ticket moves immediately with optimistic update
- Stage persists to database
- Visual feedback confirms success
- Errors cause ticket to revert to original position

**Quick Implementation**:
- When dropping INBOX ticket on BUILD column
- Confirmation modal appears before transition
- Modal explains trade-offs (speed vs. documentation)
- User must confirm or cancel the operation

**VERIFY to PLAN Rollback**:
- When dropping VERIFY ticket on PLAN column (FULL workflows only)
- Confirmation modal appears explaining consequences:
  - Implementation commits will be removed (git reset to pre-BUILD state)
  - Spec files in `specs/{branch}/` folder are preserved automatically
  - Preview URL will be cleared
  - Original implement job record will be deleted
- Triggers rollback-reset workflow that:
  - Identifies the last commit before BUILD phase began
  - Backs up spec files using git stash
  - Performs hard reset to pre-BUILD commit
  - Restores spec files and commits them
  - Force-pushes the reset branch
- Available when latest workflow job is COMPLETED, FAILED, or CANCELLED
- Not available for QUICK or CLEAN workflow types
- Not available when job is RUNNING or PENDING
- Blocked during project cleanup (HTTP 423 Locked)
- Creates a `rollback-reset` job to track the git reset operation

### Performance

- Drag-and-drop operations complete with <100ms latency
- Response feels instantaneous for professional-grade UX
- Performance maintained regardless of ticket count

### Concurrent Updates

When two users modify the same ticket simultaneously:
- First write wins in the database
- Second user sees error message
- Ticket reverts to the current database position
- User can retry the operation

## Ticket Details

### Viewing Details

Clicking any ticket card opens a detail modal displaying:

- **Title**: Full ticket title (large, prominent)
- **Description**: Complete description text with markdown formatting
  - Renders markdown syntax as formatted content
  - Supports bold (`**text**`), italic (`*text*`), inline code (`` `code` ``)
  - Supports links (`[text](url)`) with `target="_blank"` and `rel="noopener noreferrer"`
  - Supports unordered lists (`- item`) and ordered lists (`1. item`)
  - Supports blockquotes (`> text`)
  - Supports headings (`# H1`, `## H2`, etc.)
  - Plain text without markdown renders normally
  - Uses prose styling optimized for dark theme
- **Stage Badge**: Current workflow stage with visual indicator
- **Metadata**:
  - Creation date
  - Last updated date
  - Branch name (when available)
  - Workflow type indicator (⚡ for quick implementation, ✨ for cleanup)
  - AI model badge (SONNET for standard workflows, OPUS for cleanup workflows)

### Modal Behavior

The detail modal:
- Opens on ticket card click
- Displays in full-screen mode on mobile
- Centers with appropriate sizing on desktop
- Uses dark theme styling
- Provides clear typography and visual hierarchy
- Content organized in tabs (Details, Comments, Files)
- Each tab has unified scrolling with no nested scrollbars
- Description content flows naturally within tab scroll area

### Closing the Modal

Users can close the detail modal by:
- Clicking the close button
- Pressing the Escape key
- Clicking outside the modal content area

## Ticket Deletion

### Drag-to-Trash Feature

Users can delete tickets by dragging them to a trash zone that appears during drag operations:

**Trash Zone Visibility**:
- Appears at the bottom of the board only during active drag operations
- Available for tickets in INBOX, SPECIFY, PLAN, BUILD, and VERIFY stages
- Not available for SHIP stage tickets (completed work cannot be deleted)
- Hidden when no drag operation is active

**Deletion Eligibility**:
- Tickets with pending or running jobs cannot be deleted
- Trash zone appears but shows disabled state (reduced opacity, strikethrough)
- Tooltip explains: "Cannot delete ticket while job is in progress"
- Only tickets with completed, failed, or cancelled jobs can be deleted

**Deletion Process**:
1. User drags ticket card to trash zone at bottom of board
2. Confirmation modal appears before any deletion occurs
3. Modal displays stage-specific information about what will be deleted:
   - **INBOX**: "This ticket has no workflow artifacts and will be permanently deleted"
   - **SPECIFY**: Lists branch name and spec.md file
   - **PLAN**: Lists branch name, spec.md, plan.md, and tasks.md files
   - **BUILD**: Lists branch name, implementation artifacts, and any open pull requests
   - **VERIFY**: Lists branch name, preview deployment (if active), pull requests, and all workflow artifacts
4. User confirms or cancels the deletion
5. If confirmed, ticket is permanently deleted along with:
   - Database record (ticket, jobs, comments)
   - Git branch from repository
   - All open pull requests where head branch matches ticket branch
   - Workflow artifact files (spec.md, plan.md, tasks.md)

**Visual Feedback**:
- Trash zone highlights when valid ticket is dragged over it:
  - Border turns red (dashed)
  - Background changes to light red (red-50)
  - Trash icon turns red
  - "Delete Ticket" text turns red
- Disabled state shown for tickets with active jobs (grayed out with reduced opacity)
- Immediate removal from board upon successful deletion
- Error message displayed if deletion fails (ticket remains unchanged)

**Deletion Behavior**:
- Deletion is transactional: all GitHub artifacts must be deleted successfully before database deletion
- If GitHub API fails, ticket remains in database (no partial deletion)
- Orphaned branches or pull requests are prevented through this transactional approach
- Preview deployments become orphaned after deletion (Vercel cleanup is manual)

**Branch Already Deleted Handling**:
- If the Git branch has already been deleted from GitHub (manual cleanup, another process)
- System treats this as successful deletion (idempotent operation)
- Ticket deletion proceeds normally without error
- GitHub API returns 404 (not found) or 422 (reference does not exist)
- Both responses indicate branch is already deleted and are handled gracefully

## Data Persistence

### Automatic Saving

All ticket data persists automatically:
- New tickets save on creation
- Stage changes save on drag-and-drop
- Data persists across page refreshes
- No manual save action required

### Unique Identification

**Ticket Keys**:
- Each ticket receives a unique human-readable key in format "{PROJECT_KEY}-{TICKET_NUMBER}"
- Example: ABC-1, ABC-2, DEF-123
- Project key: 3-character uppercase identifier (e.g., "ABC", "DEF")
- Ticket number: Sequential integer starting from 1 within each project
- Ticket numbers increment independently per project

**Internal ID**:
- Each ticket has an internal numeric ID for database relationships
- Internal IDs not exposed in user-facing contexts
- Used only for foreign keys and backward compatibility

### Timestamps

The system tracks two timestamps for each ticket:
- **Created**: When the ticket was first created (never changes)
- **Last Updated**: When the ticket was last modified (automatically updates on any change, including stage transitions)

Timestamps display in user-friendly formats:
- Relative time for recent updates (e.g., "2 hours ago")
- Absolute timestamp for older updates (e.g., "2025-09-30 14:30")

## Ticket Attributes

### Core Fields

- **Ticket Key**: Human-readable unique identifier (e.g., "ABC-123")
  - Format: {PROJECT_KEY}-{TICKET_NUMBER}
  - Used in URLs, UI displays, and references
  - Stable across ticket lifecycle
- **Ticket Number**: Project-scoped sequential number (1, 2, 3, ...)
  - Increments independently per project
  - Combined with project key to form ticket key
- **Internal ID**: System-generated numeric identifier (not user-facing)
- **Title**: User-provided short description
- **Description**: User-provided detailed context
- **Stage**: Current workflow position (one of six stages)

### Workflow Fields

- **Branch**: Git branch associated with the ticket
  - Empty for new tickets in INBOX
  - Set automatically when workflow creates feature branch
  - Maximum 200 characters

- **Workflow Type**: Indicates which workflow path was used
  - FULL: Normal workflow (INBOX → SPECIFY → PLAN → BUILD)
  - QUICK: Quick implementation (INBOX → BUILD)
  - CLEAN: Cleanup workflow (automated technical debt cleanup)
  - Set once during first BUILD transition
  - Immutable after being set
  - Visual badges distinguish workflow types on ticket cards:
    - QUICK: ⚡ Quick badge (amber styling)
    - CLEAN: ✨ Clean badge with sparkles icon (purple styling)

### Optional Configuration

- **Clarification Policy**: How ambiguities are resolved during specification
  - Can inherit from project default
  - Can be overridden for specific tickets
  - Values: AUTO, CONSERVATIVE, PRAGMATIC, INTERACTIVE

- **Preview URL**: Vercel deployment URL for testing
  - Set when manual deployment is triggered from VERIFY stage
  - Accessible via clickable icon on ticket card
  - Opens preview application in new browser tab
  - Only one active preview allowed per project at a time
