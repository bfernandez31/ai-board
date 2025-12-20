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

### Documentation Buttons

The ticket detail modal provides quick access to workflow documentation files:

**Spec Button**:
- Displays for tickets with completed specify job
- Opens modal showing spec.md content
- Read-only and editable modes available
- Icon: FileText

**Plan Button**:
- Displays for tickets with completed plan job
- Opens modal showing plan.md content
- Read-only and editable modes available
- Icon: FileText

**Tasks Button**:
- Displays for tickets with completed plan job (tasks generated after planning)
- Opens modal showing tasks.md content
- Read-only and editable modes available
- Icon: ListTodo

**Summary Button**:
- Displays for FULL workflow tickets with completed implement job
- Opens modal showing summary.md content (implementation details, changes made, key decisions, files modified)
- Read-only mode only (no edit functionality)
- Icon: FileOutput
- Fetches content from feature branch for BUILD/VERIFY stages
- Fetches content from main branch for SHIP stage
- Not available for QUICK or CLEAN workflow types (summary files only created during full workflow implementation)

**Common Behaviors**:
- All documentation modals support commit history viewing
- Content displayed in formatted markdown
- Loading states shown during fetch operations
- Error messages displayed if file cannot be fetched
- Modal can be closed via close button, Escape key, or clicking outside

### Modal Behavior

The detail modal:
- Opens on ticket card click
- Displays in full-screen mode on mobile
- Centers with appropriate sizing on desktop
- Uses dark theme styling
- Provides clear typography and visual hierarchy
- Content organized in tabs (Details, Comments, Files, Stats)
- Each tab has unified scrolling with no nested scrollbars
- Description content flows naturally within tab scroll area

**Focus Management**:
- Modal maintains proper focus for keyboard accessibility
- Action buttons (Edit Policy, Duplicate) do not receive automatic focus on modal open
- Focus management follows accessibility best practices
- Prevents unintended actions from keyboard input immediately after modal opens
- Users can navigate to interactive elements using Tab key

### Stats Tab

The Stats tab displays aggregated telemetry metrics from all workflow jobs associated with the ticket. This tab provides visibility into resource consumption, costs, and workflow efficiency.

**Visibility**:
- Stats tab only appears when the ticket has at least one associated job
- Automatically shown/hidden based on job presence
- No empty state shown when tab is absent

**Summary Metrics**:
- **Total Cost**: Aggregated cost in USD from all jobs (formatted as $X.XX)
- **Total Duration**: Combined execution time across all jobs (formatted as Xm Xs)
- **Total Tokens**: Sum of input and output tokens used
- **Cache Efficiency**: Percentage of cache hits (cacheReadTokens / (inputTokens + cacheReadTokens))

**Jobs Timeline**:
- Chronological list of all jobs (oldest first)
- Each job displays:
  - Command/stage name (e.g., "specify", "implement", "verify")
  - Status icon (success checkmark, error icon, pending spinner)
  - Duration (formatted time)
  - Cost (formatted USD)
  - Model used (e.g., "claude-sonnet-4-5")
- Jobs are expandable to reveal detailed token breakdown:
  - Input tokens
  - Output tokens
  - Cache read tokens
  - Cache creation tokens

**Tools Usage**:
- Aggregated count of all tools used across jobs
- Sorted by frequency (most-used first)
- Displayed as badges with counts (e.g., "Edit (5)", "Read (3)")
- Empty state message when no tools recorded

**Real-Time Updates**:
- Stats automatically update as jobs complete via existing 2-second job polling
- No manual refresh required
- Metrics recalculate automatically when job data changes

### Closing the Modal

Users can close the detail modal by:
- Clicking the close button
- Pressing the Escape key
- Clicking outside the modal content area

## Ticket Duplication

### Duplicate Button

Users can create a copy of any existing ticket to reuse content for similar work items:

**Button Location**:
- Appears in the ticket detail modal header row
- Located next to other metadata actions (Edit Policy button)
- Visible for tickets in all stages (INBOX through SHIP)

**Duplication Process**:
1. User opens any ticket detail modal
2. User clicks the duplicate button (with copy icon)
3. System creates a new ticket in INBOX with:
   - Title: "Copy of [original title]" (truncated if needed to stay within 100 chars)
   - Description: Exact copy of original description
   - Clarification Policy: Same as original (or null if using project default)
   - Image Attachments: References to same images (uploaded and external URLs)
4. Modal closes automatically
5. New ticket appears immediately at the bottom of INBOX column
6. Success toast displays with new ticket key (e.g., "Ticket ABC-107 duplicated")

**Visual Feedback**:
- Tooltip displays "Duplicate ticket" on hover
- Button shows loading state during API call
- Button is disabled while duplication is in progress
- Success toast notification confirms creation with ticket key
- Error toast displays if duplication fails

**Title Handling**:
- Original title prefixed with "Copy of "
- If prefix would exceed 100 character limit, original title is truncated first
- Truncation preserves "Copy of " prefix and includes as much of original title as fits

**Attachment Handling**:
- All image attachments (up to 5) are copied by reference
- Uploaded images (Cloudinary URLs) safely reference same URL
- External image URLs are copied as-is
- No re-uploading or duplication of image files

**Error Handling**:
- Network failures show error toast with descriptive message
- Modal remains open on error to allow retry
- Validation errors prevent duplication (e.g., source ticket not found)
- User can click duplicate button again to retry after error

**Performance**:
- Duplication completes in under 3 seconds from button click to new ticket visible
- Optimistic UI update shows new ticket immediately
- Database operation is atomic (all-or-nothing)

## Ticket Search

### Search Interface

Users can quickly find tickets using a search input in the header:

**Location**:
- Search input appears centered in the header when viewing a project board
- Hidden when no project is selected (homepage, settings pages)
- Visible on desktop and tablet viewports (hidden on mobile due to space constraints)

**Search Scope**:
- Searches within the currently selected project only
- No cross-project search (keeps results focused and relevant)

**Search Fields**:
- **Ticket Key**: Matches partial or complete ticket keys (e.g., "AIB-42", "42")
- **Title**: Searches for keywords in ticket titles (case-insensitive)
- **Description**: Searches for keywords in ticket descriptions (case-insensitive)

### Search Behavior

**Trigger**:
- Search activates after typing 2 or more characters
- Debounced by 300ms to reduce API calls during fast typing
- Results update automatically as user types

**Results Display**:
- Dropdown appears below search input when results are available
- Shows up to 10 matching tickets
- Each result displays:
  - Ticket key (monospace font for easy identification)
  - Ticket title (truncated if too long)
- Results ordered by relevance:
  1. Exact key matches first
  2. Partial key matches second
  3. Title matches third
  4. Description matches last
  - Within same match type, sorted by most recently updated

**Empty States**:
- "No tickets found" when query has no matches
- "Search unavailable" when API returns error
- "Searching..." loading indicator during API call
- Placeholder text guides users: "Search tickets..."

### Keyboard Navigation

Users can navigate search results using keyboard for efficient workflow:

**Navigation Keys**:
- **Down Arrow**: Move to next result in list
- **Up Arrow**: Move to previous result in list
- **Enter**: Open the currently highlighted ticket modal
- **Escape**: Close dropdown (if open) or clear search input (if closed)

**Focus Management**:
- Search input remains focused during keyboard navigation
- Highlighted result scrolls into view automatically
- Selected result visually distinct (highlighted background)

### Result Selection

**Opening Tickets**:
- Clicking a result opens the ticket detail modal
- Pressing Enter on highlighted result opens the ticket modal
- Search input clears automatically after ticket opens
- Dropdown closes after selection

**Modal Integration**:
- Ticket modal opens with Details tab active by default
- All ticket information accessible (comments, files, stats, documentation)
- Search state resets for next search

### Performance

**Response Time**:
- Search results appear within 500ms of user stopping typing
- Debounce (300ms) provides smooth UX without lag
- API optimized with database indexes on projectId

**Accessibility**:
- Keyboard-only navigation fully supported
- Screen reader compatible (ARIA labels and roles)
- Focus indicators clearly visible

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

**Multiple Consecutive Deletions**:
- Users can delete multiple tickets in sequence without errors
- Each deletion is processed independently with optimistic UI updates
- The system handles cache invalidation properly between consecutive deletions
- No need to refresh the page between deletions

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
