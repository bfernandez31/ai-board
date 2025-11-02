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

## Ticket Display

### Card Display Format

Ticket cards on the Kanban board display the following information:

- **Ticket Key**: Prefixed before the title in format `#{TICKET_KEY}`
  - Example: `#ABC-123`
  - Styled in blue accent color for visual distinction
  - Provides quick identification and reference
- **Title**: Ticket title text following the ticket key
  - Format: `#{TICKET_KEY} - {TITLE}`
  - Example: `#ABC-123 - Fix login bug`
- **Badges**: Visual indicators for workflow type and AI model
  - ⚡ Quick badge for quick implementation tickets
  - SONNET badge indicating AI model

### Viewing Details

Clicking any ticket card opens a detail modal displaying:

- **Title**: Full ticket title (large, prominent)
- **Description**: Complete description text
- **Stage Badge**: Current workflow stage with visual indicator
- **Metadata**:
  - Creation date
  - Last updated date
  - Branch name (when available)
  - Workflow type indicator (⚡ for quick implementation)

### Modal Behavior

The detail modal:
- Opens on ticket card click
- Displays in full-screen mode on mobile
- Centers with appropriate sizing on desktop
- Uses dark theme styling
- Provides clear typography and visual hierarchy

### Closing the Modal

Users can close the detail modal by:
- Clicking the close button
- Pressing the Escape key
- Clicking outside the modal content area

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
- **Last Updated**: When the ticket was last modified (updates on any change)

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
  - Set once during first BUILD transition
  - Immutable after being set

### Optional Configuration

- **Clarification Policy**: How ambiguities are resolved during specification
  - Can inherit from project default
  - Can be overridden for specific tickets
  - Values: AUTO, CONSERVATIVE, PRAGMATIC, INTERACTIVE
