# Collaboration - Functional Specification

## Purpose

The collaboration system enables team members to discuss tickets through comments, mention colleagues for input, and request AI assistance for specifications and planning.

## Comment System

### Viewing Comments

Tickets display comments in a dedicated Comments tab within the ticket detail modal:

- Comments appear in reverse chronological order (newest first)
- Each comment shows:
  - Author name
  - Author avatar (or initials if avatar unavailable)
  - Comment content rendered as Markdown
  - Relative timestamp (e.g., "2 hours ago")

### Conversation Timeline

The Comments tab displays a unified timeline that interleaves comments with workflow job events:

**Timeline Events**:
- **User Comments**: Comments posted by team members or AI-BOARD
- **Job Start Events**: When automation jobs begin (SPECIFY, PLAN, BUILD, VERIFY stages)
- **Job Completion Events**: When automation jobs finish (success, failure, or cancelled)

**Visual Presentation**:
- Events ordered chronologically (oldest first) for natural conversation flow
- Job events displayed with distinct styling (icon, timestamp, status)
- Comments and job events clearly differentiated visually
- Job status indicators: success (green), failure (red), cancelled (gray)

**Included Job Types**:
- **Workflow Stages**:
  - SPECIFY: Specification generation workflows
  - PLAN: Planning and task breakdown workflows
  - BUILD: Implementation workflows
  - VERIFY: Verification workflows
  - SHIP: Deployment workflows
- **Deploy Previews**: Preview deployment jobs
- **AI-BOARD Assistance**: AI-powered collaboration requests

### Creating Comments

**Comment Form**:
- Accessible from the Comments tab in ticket detail view
- Provides a textarea for comment content
- Shows character counter (current/max: 2000 characters)
- Displays Submit button and supports Cmd/Ctrl+Enter shortcut

**Content Requirements**:
- Minimum length: 1 character
- Maximum length: 2000 characters
- Submit button disabled when content is empty or exceeds limit
- Loading state displayed during submission

**Submission Behavior**:
- Comment appears immediately with optimistic update
- Form clears after successful submission
- Multiple consecutive comments can be posted
- Auto-focus on textarea when Comments tab first opens

### Markdown Support

Comments support rich text formatting using Markdown:

- **Bold** and *italic* text
- Links to external resources
- Code blocks for technical content
- Ordered and unordered lists
- Headings for structure

**Security**:
- HTML content is automatically escaped
- No script execution allowed
- Safe rendering prevents XSS attacks

### Deleting Comments

**Authorization**:
- Users can only delete their own comments
- Delete button appears on hover for comment author
- Other users' comments show no delete option

**Deletion Process**:
1. User hovers over their own comment
2. Delete button (trash icon) appears
3. User clicks delete button
4. Confirmation prompt appears
5. User confirms deletion
6. Comment disappears immediately (optimistic update)
7. If deletion fails, comment reappears with error notification

**Behavior**:
- Deletion is permanent (no recovery)
- No soft delete or archive functionality
- When ticket is deleted, all comments are automatically removed

### Real-Time Updates

**Automatic Refresh**:
- Comments polling updates every 10 seconds
- New comments appear automatically without manual refresh
- Comment count badge updates in real-time
- Polling stops when ticket modal closes

**Update Behavior**:
- Only shows comments created by others (prevents duplicates)
- Filters out user's own optimistically-added comments
- Handles deletions by other users within 10 seconds

## User Mentions

### Mentioning Users

Comments support @mentions to notify specific users:

- Type @ symbol to see mention suggestion list
- Select user from project members
- Mentioned user receives real-time notification
- Multiple users can be mentioned in one comment

### AI-BOARD Mentions

**Special System User**:
- AI-BOARD appears in mention list as "@ai-board"
- Automatically added to all projects as a member
- Enables AI-powered collaboration on tickets

**Availability Rules**:

AI-BOARD can be mentioned when:
- Ticket is in SPECIFY, PLAN, BUILD, VERIFY, or SHIP stage
- No workflow job is currently running for the ticket

AI-BOARD cannot be mentioned when:
- Ticket is in INBOX stage (specification not started)
- Active job is PENDING or RUNNING for the ticket

**Visual Feedback**:
- Available: AI-BOARD appears in mention list normally
- Unavailable: AI-BOARD appears greyed out with tooltip explaining why
- Tooltips indicate specific reason (stage restriction or job running)

### Mention Validation

**Client-Side Validation**:
- UI prevents mentioning unavailable users
- Tooltips explain why mentions are disabled
- Clear visual distinction between available and unavailable users

**Server-Side Enforcement**:
- API validates all mentions before processing
- Rejects unauthorized or invalid mentions
- Returns clear error messages for validation failures

## AI-BOARD Assistance

### Requesting Help

When users mention @ai-board in a comment:

1. System validates ticket stage and job status
2. Creates a workflow job to track the request
3. Dispatches GitHub Actions workflow
4. AI processes the request using Claude
5. AI-BOARD posts response as a comment

### Supported Stages

**SPECIFY Stage**:
- Request updates to specification document
- Add missing details or error scenarios
- Clarify requirements or acceptance criteria
- AI updates spec.md file and responds with summary

**PLAN Stage**:
- Request changes to implementation approach
- Adjust technical decisions in plan
- Update task breakdown in tasks.md
- AI ensures consistency across spec.md, plan.md, and tasks.md

**BUILD, VERIFY, and SHIP Stages**:
- Not implemented in current version
- AI-BOARD responds with "not implemented" message
- Job completes successfully without file modifications

**INBOX Stage**:
- Mentions blocked at UI level (greyed out)
- API rejects if validation bypassed
- Clear error message explains stage restriction

### AI Response Format

AI-BOARD responses include:
- Mention of the original requester (@username)
- Summary of changes made or decision provided
- List of files modified (if applicable)
- Explanation or rationale for the response

**Commit Behavior**:
- All file modifications committed atomically
- Commit message format: "AI-BOARD: [brief summary]"
- Changes pushed to ticket's feature branch
- Single commit per request (no partial updates)

### Request Validation

**Out-of-Context Requests**:
- AI validates requests are relevant to current feature
- Rejects requests unrelated to ticket scope
- Returns message: "Your request is out of context. Please focus on updating the [specification/plan] for this feature."
- No file modifications for invalid requests

**Context Requirements**:
- SPECIFY stage: Requests must concern spec.md for current feature
- PLAN stage: Requests must concern spec.md, plan.md, or tasks.md
- AI enforces scope boundaries automatically

### Concurrent Requests

**Protection**:
- Only one AI-BOARD job can run per ticket at a time
- New mentions blocked while existing job is PENDING or RUNNING
- UI shows "AI-BOARD unavailable (job running)" tooltip
- API rejects concurrent requests for same ticket

**Recovery**:
- When job completes (COMPLETED/FAILED), AI-BOARD becomes available again
- Users can submit new requests after previous job finishes
- Failed jobs don't block future requests

## Tab Navigation

### Available Tabs

The ticket detail modal organizes content into tabs:

1. **Details**: Ticket information, metadata, and actions (default)
2. **Comments**: Discussion and collaboration
3. **Files**: Image attachments and file gallery

### Navigation Methods

**Mouse/Touch**:
- Click tab headers to switch between tabs
- Active tab shows visual highlight (border, background color)
- Smooth transition animation between tabs

**Keyboard**:
- Arrow keys: Left/right arrows navigate between tabs
- Shortcuts: Cmd/Ctrl+1 (Details), Cmd/Ctrl+2 (Comments), Cmd/Ctrl+3 (Files)
- Tab order follows left-to-right sequence

**Mobile**:
- Tab headers horizontally scrollable when they exceed viewport width
- Touch-friendly tap targets
- Keyboard shortcuts ignored on mobile (touch-first interaction)

### Tab Indicators

**Comment Count Badge**:
- Comments tab shows count: "Comments (5)"
- Badge updates in real-time as comments are added or deleted
- Provides quick overview of discussion activity

**Active State**:
- Currently selected tab visually highlighted
- Clear indication of which content is displayed
- Consistent styling across all tabs

## Mention Notifications

### Notification Bell

The notification bell icon appears in the application header and provides access to mention notifications:

**Bell Icon**:
- Visible on all pages and all screen sizes when user is authenticated (mobile, tablet, desktop)
- Displays unread count badge when notifications exist
- Badge shows number (1-9) or "9+" for 10 or more unread notifications
- Badge styled with purple background (purple-500) and white text for visibility
- No badge displayed when all notifications are read
- Fully accessible on mobile devices via touch interaction

**Clicking Bell**:
- Opens dropdown menu with recent notifications
- Shows 5 most recent notifications by default
- Displays notification details for each item
- Provides "Mark all as read" and "View all" actions

### Receiving Notifications

When a user is mentioned in a comment:

**Notification Creation**:
- System detects @mentions in comment text when posted
- Creates notification for each mentioned project member
- Links notification to source comment, ticket, and actor
- No notification created for self-mentions
- No notification created for non-project members
- AI-BOARD comments create notifications for mentioned users
- AI-BOARD as actor appears in notification (shows "AI-BOARD mentioned you")

**Notification Delivery**:
- Notifications appear within 15 seconds via polling
- Bell badge updates automatically to show unread count
- Dropdown content refreshes to show new notifications
- Polling continues while user is authenticated

### Viewing Notifications

**Notification Details**:
- Actor name and avatar (user who mentioned you)
- Action text: "mentioned you in [TICKET-KEY]"
- Comment preview (truncated to 80 characters)
- Relative timestamp (e.g., "2 hours ago", "just now")
- Visual indicator for unread status (blue dot or highlight)

**Dropdown Display**:
- Shows 5 most recent notifications
- Unread notifications visually distinguished
- Scrollable when more than 5 notifications
- "View all" link in footer (for future full page)

### Managing Notifications

**Marking as Read**:
- Click notification to mark as read and navigate to comment
- Click "Mark all as read" button to clear all unread notifications
- Read status updates immediately with optimistic UI
- Changes sync across devices within 15 seconds

**Navigation**:
- Clicking notification navigates to the ticket's conversation tab
- Same-project notifications open in current window
- Cross-project notifications open in new browser tab
- Ticket modal automatically opens with conversation tab selected
- Comment scrolls into view automatically
- Notification marked as read before navigation begins

**Retention**:
- Notifications retained for 30 days (read and unread)
- Older notifications automatically deleted
- Deleted comments still show notification with appropriate message

### Notification Click Navigation

**Same-Project Navigation**:
When notification references a ticket in the same project:
- Opens ticket modal in current window
- No page reload or browser tab change
- Preserves current board state
- Conversation tab automatically selected
- Comment scrolls into view within 1 second
- Unread count updates immediately (within 200ms)

**Cross-Project Navigation**:
When notification references a ticket in a different project:
- Opens target project board in new browser tab
- Original tab remains unchanged
- New tab automatically opens ticket modal
- Conversation tab pre-selected on modal open
- Comment scrolls into view after modal loads
- Original project context preserved

**Navigation Context Detection**:
- System compares notification's project ID with current project
- Uses URL parameters to pass modal and tab state
- Modal opens automatically when URL contains appropriate parameters
- Comment anchor included in URL for scroll targeting

**Error Handling**:
- Deleted tickets: Shows error message instead of navigation
- Access denied: Displays "Access Denied" for unauthorized projects
- Missing comments: Opens conversation tab with "Comment not found" indicator
- Modal conflicts: Closes existing modal before opening new ticket

### Notification States

**Unread Notifications**:
- Contribute to bell badge count
- Display blue dot or background highlight
- Appear at top of dropdown list
- Count displayed as "9+" when exceeding 9

**Read Notifications**:
- No longer affect badge count
- Remove visual highlight indicator
- Timestamp shows when marked as read
- Remain visible in dropdown until deleted or expired

## Authorization

### Project Access

All collaboration features require project access (owner or member):
- Project owners can access all features
- Project members can access all collaboration features
- Non-members cannot view or interact with the project

### Comment Permissions

**Creating Comments**:
- Project owners can post comments
- Project members can post comments
- Non-members receive 403 Forbidden error

**Deleting Comments**:
- Users can only delete their own comments
- Comment author ID must match session user ID
- API returns 403 Forbidden for unauthorized deletion attempts
- UI hides delete button for comments user doesn't own

**Viewing Comments**:
- All project owners and members can view all comments
- Comments visible regardless of who created them
- No per-comment access restrictions

### Member Capabilities

**Project Members Can**:
- View all tickets and comments in the project
- Create and delete their own comments
- Mention other project members and @ai-board
- Transition tickets between workflow stages
- Create and update tickets

**Project Members Cannot**:
- Delete the project
- Add or remove project members
- Modify project settings (clarification policy, name, description)
- Delete comments by other users

### Owner-Only Actions

Project owners retain exclusive control over:
- Project deletion
- Member management (add/remove members)
- Project settings configuration
- All capabilities available to members
