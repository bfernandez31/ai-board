# Ticket Management

## Overview

This domain covers ticket interaction features including movement between stages, viewing details, and editing content. These capabilities enable users to manage tickets throughout their workflow lifecycle.

**Current Capabilities**:
- Drag-and-drop movement between stages
- Ticket detail modal viewer
- Inline title and description editing
- Sequential workflow enforcement

---

## Drag-and-Drop Movement

**Purpose**: Users need to move tickets through workflow stages quickly. Drag-and-drop provides an intuitive, visual way to update ticket status without opening forms or dialogs.

### What It Does

The system enables dragging tickets between columns with visual feedback:

**Drag Operations**:
- **Pick Up**: Click and hold any ticket card
- **Visual Feedback**:
  - Ghost/preview of dragged ticket
  - Valid drop zones highlighted
  - Invalid zones indicated
- **Drop**: Release ticket in target column
- **Cancel**: Press ESC or release outside valid zones

**Movement Rules**:
- **Sequential Only**: Tickets can only move to next immediate stage
  - INBOX → SPECIFY
  - SPECIFY → PLAN
  - PLAN → BUILD
  - BUILD → VERIFY
  - VERIFY → SHIP
- **No Skipping**: Cannot skip stages (e.g., INBOX → PLAN blocked)
- **No Backwards**: Cannot move to earlier stages (e.g., BUILD → PLAN blocked)
- **Job Completion Required**: Automated stages (SPECIFY, PLAN, BUILD) require workflow completion before next transition
  - SPECIFY → PLAN: Blocked until specify job status is COMPLETED
  - PLAN → BUILD: Blocked until plan job status is COMPLETED
  - BUILD → VERIFY: Blocked until implement job status is COMPLETED
  - Manual stages (VERIFY, SHIP) and initial transition (INBOX → SPECIFY) have no job completion requirements

**Visual Indicators**:
- Smooth animations for drag, drop, and return
- Next valid stage highlighted during drag
- Invalid transitions show rejection animation
- Touch device support (mobile/tablet)

**Performance**:
- Optimistic UI updates (instant visual feedback)
- Database update in background
- Rollback if database update fails
- <100ms latency target

### Requirements

**Drag Interaction**:
- Click and drag any ticket card
- Ghost/preview during drag
- Valid drop zones highlighted (only next sequential stage)
- Smooth animations for all movements
- Touch device support

**Stage Transitions**:
- Sequential progression only (one stage at a time)
- No skipping stages
- No backwards movement
- Visual rejection for invalid transitions
- Job completion validation for automated stages (SPECIFY, PLAN, BUILD)
- Transitions blocked when job status is PENDING, RUNNING, FAILED, or CANCELLED
- Transitions allowed when job status is COMPLETED
- Clear error messages when blocked due to incomplete job

**Data Updates**:
- Optimistic UI update (immediate visual change)
- Database update after drop
- Rollback to original position if update fails
- Error message displayed on failure

**Concurrency**:
- First-write-wins for simultaneous updates
- Second user sees error and ticket reverts
- Version-based conflict detection

**Performance**:
- <100ms latency from drop to visual update
- Maintains performance with 100+ tickets per column

**Authentication**:
- Any authenticated user can move any ticket
- Unauthenticated users cannot drag tickets

**Offline**:
- Drag-and-drop disabled when network unavailable
- Visual indicator when disabled

### Data Model

**Stage Sequence**:
```
INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
```

**Ticket Update**:
- `stage`: Updated to target stage
- `version`: Incremented for concurrency control
- `updatedAt`: Set to current timestamp

---

## Ticket Detail Viewer

**Purpose**: Users need to see complete ticket information including full title, description, dates, stage, comments, and file attachments. The detail modal provides a focused view organized in tabs without navigating away from the board.

### What It Does

The system displays full ticket details in a tabbed modal dialog:

**Opening Detail View**:
- Click any ticket card
- Modal opens with tabbed interface

**Tab Navigation**:
- **Details Tab** (default): Ticket information, description, metadata, action buttons
- **Comments Tab**: Comment thread, comment form, real-time updates
- **Files Tab**: Image gallery with upload/management functionality
- **Tab Headers**: Display with visual active indicator and comment count badge
- **Keyboard Navigation**:
  - Arrow keys (left/right): Navigate between tabs
  - Cmd/Ctrl+1: Details tab
  - Cmd/Ctrl+2: Comments tab
  - Cmd/Ctrl+3: Files tab
- **Mobile**: Horizontally scrollable tabs when exceeding viewport width

**Details Tab Content**:
- **Title**: Full title (editable)
- **Description**: Complete description text (editable)
- **Stage**: Current stage as visual indicator
- **Metadata**: Badges (workflow type, model, clarification policy), branch link
- **Action Buttons**: View Spec, View Plan, View Tasks (when applicable)
- **Dates**: Created and last updated timestamps
- **Typography**: Clear hierarchy and readability

**Comments Tab Content**:
- **Comment List**: All comments in reverse chronological order (newest first)
- **Comment Form**: Textarea with character counter, submit button
- **Author Information**: Name, avatar (or initials), relative timestamp
- **Markdown Rendering**: Bold, italic, links, code blocks, lists, headings
- **Empty State**: "No comments yet. Be the first to comment!" message
- **Real-Time Updates**: Polling every 10 seconds for new comments

**Files Tab Content**:
- **Image Gallery**: Existing ImageGallery component with all functionality preserved
- **Upload Operations**: Drag-and-drop or file selection
- **Management**: Replace, delete, reorder images
- **Access Control**: Stage-based permissions (editable in INBOX only)

**Modal Controls**:
- **Close Button**: X button in corner
- **ESC Key**: Closes modal
- **Click Outside**: Closes modal
- **Responsive**:
  - Mobile: Full-screen modal
  - Desktop/Tablet: Centered with appropriate sizing
- **Dark Theme**: Consistent with application styling

### Requirements

**Modal Display**:
- Opens when clicking any ticket card
- Displays tabbed interface with Details, Comments, Files tabs
- Details tab active by default
- Tab headers show visual active indicator
- Comments tab header displays count badge (e.g., "Comments (5)")
- Clear typography and visual hierarchy
- Dark theme styling

**Tab Navigation**:
- Click tab headers to switch tabs
- Arrow keys (left/right) navigate between tabs
- Keyboard shortcuts: Cmd/Ctrl+[1-3] for quick access
- Active tab visually highlighted (border, background color)
- Mobile: Horizontal scrolling for tab headers

**Details Tab**:
- Displays title prominently (editable)
- Shows full description text (editable)
- Shows current stage indicator
- Shows metadata (badges, branch link)
- Shows action buttons (View Spec/Plan/Tasks)
- Shows creation and update dates

**Comments Tab**:
- Displays all comments in reverse chronological order
- Shows author name, avatar/initials, relative timestamp
- Renders markdown content with HTML escaping
- Comment form with textarea and submit button
- Character counter (1-2000 characters)
- Auto-focus textarea on first Comments tab open
- Submit on Cmd/Ctrl+Enter or click Submit button
- Delete button on user's own comments
- Real-time updates via polling (10-second interval)
- Empty state message when no comments

**Files Tab**:
- Displays existing ImageGallery component
- Preserves all image upload, view, delete functionality
- Maintains lazy loading behavior

**Modal Dismissal**:
- Close button
- ESC key
- Click outside modal content

**Responsive**:
- Full-screen on mobile devices
- Centered with responsive sizing on desktop/tablet
- Horizontally scrollable tabs on mobile

### Data Model

**Displayed Fields**:
- `title`: Full text without truncation
- `description`: Complete description
- `stage`: Current workflow stage
- `workflowType`: Workflow path indicator (enum: FULL/QUICK, defaults to FULL)
- `clarificationPolicy`: Optional policy override (enum: AUTO/CONSERVATIVE/PRAGMATIC/INTERACTIVE, NULLABLE)
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp
- `comments`: Array of Comment objects (related via foreign key)
- `attachments`: Array of image attachments (JSON field)

---

## Ticket Comments

**Purpose**: Users need to discuss tickets, document decisions, ask questions, and provide updates to collaborators. The comment system enables asynchronous collaboration directly within tickets, supporting markdown-formatted messages with real-time updates.

### What It Does

The system provides a threaded comment system within each ticket:

**Comment Display**:
- **Reverse Chronological Order**: Newest comments appear first
- **Author Information**:
  - Name displayed prominently
  - Avatar image or initials fallback (first letter of name)
  - Relative timestamp (e.g., "2 hours ago")
- **Markdown Rendering**:
  - Bold, italic, links, code blocks
  - Lists (ordered, unordered)
  - Headings (h1-h6)
  - HTML escaping enabled for security (XSS prevention)
- **Empty State**: "No comments yet. Be the first to comment!" when no comments exist

**Comment Creation**:
- **Form Location**: Bottom of Comments tab
- **Textarea Input**:
  - Auto-focus on first Comments tab open
  - Character counter displaying current/max (e.g., "250 / 2000")
  - Minimum 1 character, maximum 2000 characters
- **Submit Methods**:
  - Click Submit button
  - Press Cmd/Ctrl+Enter keyboard shortcut
- **Validation**:
  - Submit button disabled when content empty or exceeds 2000 characters
  - Character counter shows overflow (red) when limit exceeded
- **Optimistic Updates**:
  - Comment appears immediately after submission
  - Loading state shown during save ("Submitting...")
  - Rollback if save fails with error message
- **Form Clearing**: Form clears automatically after successful submission

**Comment Deletion**:
- **Authorization**: Only comment authors can delete their own comments
- **Delete Button**: Trash icon appears on hover for user's own comments
- **Confirmation**: User confirms deletion before removal
- **Optimistic Updates**:
  - Comment removed immediately from list
  - Rollback if deletion fails with error notification

**Real-Time Updates**:
- **Polling Mechanism**: Client polls for new comments every 10 seconds
- **Automatic Updates**: New comments from other users appear automatically
- **Comment Count Badge**: Updates in real-time on tab header
- **Deduplication**: Optimistically added comments filtered from polling results
- **Lifecycle**:
  - Polling starts when Comments tab opened
  - Polling continues while modal open
  - Polling stops when modal closed

**Security & Validation**:
- **Content Validation**: 1-2000 characters enforced server-side (Zod schema)
- **HTML Escaping**: react-markdown default escaping prevents XSS attacks
- **Authorization**:
  - Only project owners can view/create/delete comments
  - Only comment authors can delete their own comments
  - API returns 403 Forbidden for unauthorized operations

### Requirements

**Display**:
- Comments displayed in reverse chronological order (newest first)
- Shows author name, avatar/initials, relative timestamp per comment
- Markdown rendering with XSS protection (HTML escaping)
- Empty state message when no comments exist
- Smooth scrolling for long comment lists

**Comment Form**:
- Textarea with character counter (current/max)
- Auto-focus on first tab open
- Submit button and Cmd/Ctrl+Enter shortcut
- Character limit: 1-2000 characters
- Disabled submit when invalid (empty or over limit)
- Loading state during submission ("Submitting..." button text)
- Form clears after successful submission

**Creation**:
- Optimistic UI update (instant display)
- Database save in background
- Rollback on error with notification
- Success feedback (visual confirmation)

**Deletion**:
- Delete button (trash icon) on user's own comments only
- Confirmation dialog to prevent accidental deletion
- Optimistic removal from list
- Rollback on error with notification
- Comment count updates automatically

**Real-Time Updates**:
- Poll every 10 seconds when Comments tab open
- Automatically display new comments from other users
- Update comment count badge in tab header
- Filter out optimistically added comments (prevent duplicates)
- Stop polling when modal closes

**Authorization**:
- Project ownership required for all comment operations
- Only comment authors can delete their own comments
- API returns 403 Forbidden for unauthorized attempts
- Server-side validation with Zod schemas

**Performance**:
- Comment creation: <2 seconds (including network latency)
- Comment deletion: <2 seconds with optimistic update
- Polling updates: Within 10 seconds of creation by another user
- List rendering: <500ms for 100 comments (no perceivable lag)

### Data Model

**Comment Entity**:
- `id`: Integer (auto-increment primary key)
- `ticketId`: Foreign key to Ticket (cascade delete)
- `userId`: Foreign key to User (cascade delete)
- `content`: String (1-2000 characters, markdown-formatted)
- `createdAt`: Timestamp (creation time)
- `updatedAt`: Timestamp (last modification time)

**Relationships**:
- Belongs to Ticket (one-to-many: ticket has many comments)
- Belongs to User (one-to-many: user has many comments)

**Indexes**:
- `(ticketId, createdAt)`: Efficient query sorting and pagination
- `(userId)`: Author filtering and authorization checks

**Validation Rules**:
- Content: 1-2000 characters (inclusive)
- No empty or whitespace-only content
- Markdown formatting supported (no HTML injection)
- Allowed characters: All printable UTF-8 characters

**API Endpoints**:
- `GET /api/projects/{projectId}/tickets/{id}/comments`: Fetch all comments for ticket
- `POST /api/projects/{projectId}/tickets/{id}/comments`: Create new comment
- `DELETE /api/projects/{projectId}/tickets/{id}/comments/{commentId}`: Delete comment (author only)

**Real-Time Mechanism**:
- Client-side polling (10-second interval)
- TanStack Query for data fetching and caching
- Optimistic updates with rollback on error
- Deduplication via comment ID comparison

---

## User Mentions in Comments

**Purpose**: Users need to reference and draw attention to specific team members within ticket discussions. Mentions enable direct communication, clearer collaboration context, and easier identification of relevant stakeholders in comment threads.

### What It Does

The system enables tagging project members in comments using @ symbol autocomplete:

**Mention Creation**:
- **Trigger**: Type @ character in comment textarea
- **Autocomplete Dropdown**: Opens immediately showing all project members
- **Real-Time Filtering**: Type letters after @ to filter users by name or email (case-insensitive)
- **Selection Methods**:
  - Mouse: Click on user from dropdown
  - Keyboard: Arrow keys to navigate + Enter to select
- **Insertion**: Selected user's name inserted as formatted mention
- **Multiple Mentions**: Can mention multiple users in single comment, @ opens autocomplete again

**Mention Display**:
- **Visual Format**: Rendered as styled chips with distinct appearance
- **Hover Tooltips**: Show user's full name and email on hover
- **Current Name**: Always displays user's current name (auto-updates if user changes name)
- **Deleted Users**: Shows "[Removed User]" when mentioned user removed from project
- **Persistence**: Mentions maintain formatting after comment save and page reload

**Keyboard Navigation**:
- **Arrow Keys**: Up/Down to navigate autocomplete dropdown
- **Enter**: Select highlighted user
- **Escape**: Close autocomplete without selection
- **Tab**: Close autocomplete and continue typing

**Data Storage**:
- **Format**: Comments stored as markdown with mention syntax `@[User Name](userId)`
- **User IDs**: References stored by user ID, not name (enables auto-update behavior)
- **Parsing**: Custom markdown renderer converts mention syntax to visual chips

### Requirements

**Autocomplete**:
- Opens on @ character in comment textarea
- Displays all project members (owner + members from ProjectMember table)
- Filters in real-time as user types (searches name and email fields)
- Case-insensitive search
- Highlights matching text in dropdown results
- Maximum 10 visible items with scrolling for additional users
- <100ms response time for filtering up to 100 project members

**Selection**:
- Click on user to select (mouse interaction)
- Arrow keys (up/down) to navigate dropdown (keyboard interaction)
- Enter key to select highlighted user
- ESC key to close dropdown without selection
- Inserts `@[User Name](userId)` syntax into textarea
- Closes dropdown after selection
- Cursor positioned after inserted mention

**Display**:
- Mentions rendered as styled chips in saved comments
- Chip styling: Rounded background, distinct color, hover effect
- Tooltip on hover: Shows user's full name and email
- Test ID: `mention-chip` for E2E testing
- Displays current user name (fetched from User table on render)
- Deleted users: Shows "[Removed User]" text when user not found in project

**Multiple Mentions**:
- Supports unlimited mentions per comment (within 2000 character limit)
- Typing @ reopens autocomplete dropdown for subsequent mentions
- Each mention maintains independent styling and behavior
- Comment text can mix plain text, markdown, and mentions

**Authorization**:
- Only project members appear in autocomplete (filtered by ProjectMember table)
- Any project member can mention any other project member
- Mentioned users do NOT receive notifications (visual-only in this implementation)

**Performance**:
- Autocomplete filtering: <100ms for project with 100 members
- Mention rendering: <500ms for comment with 10 mentions
- No performance degradation with multiple mentions per comment

### Data Model

**Comment Content Format**:
- Markdown with custom mention syntax: `@[Display Name](userId)`
- Example: `Hey @[Alice Smith](user-alice), can you review this?`
- User ID references enable auto-updating names

**Mention Parsing**:
- Regex pattern: `/\@\[([^\]]+)\]\(([^)]+)\)/g`
- Capture groups: `$1` = Display Name (ignored), `$2` = User ID (used for lookup)
- Custom react-markdown component renders mentions as chips

**User Lookup**:
- On comment render: Extract user IDs from mention syntax
- Fetch current user data from User table
- Display user's current name (not stored name from syntax)
- If user not found: Display "[Removed User]" fallback

**ProjectMember Integration**:
- Autocomplete queries ProjectMember table for current project
- Returns users with role 'owner' or 'member'
- Includes user name and email for filtering
- Ensures only project members appear in dropdown

**Relationships**:
- Comment belongs to Ticket (foreign key: ticketId)
- Comment belongs to User (foreign key: userId, comment author)
- Mentions reference Users (via user IDs in markdown syntax)
- ProjectMember join table: many-to-many between Project and User

---

## Inline Editing

**Purpose**: Users need to update ticket information quickly without navigating to separate edit screens. Inline editing provides contextual editing directly in the detail modal.

### What It Does

The system enables editing title and description directly in the detail modal:

**Edit Activation**:
- **Title**: Click on title to edit
- **Description**: Click on description to edit
- **Visual Indicator**: Pencil icon appears on hover

**Title Editing**:
- Click title → becomes input field with focus
- Type changes
- Save: Press Enter or click outside
- Cancel: Press ESC (restores original)
- Max 100 characters enforced

**Description Editing**:
- Click description → becomes textarea with focus
- Type changes
- Character counter displayed
- 90% warning at 900 characters
- Save: Click save button
- Cancel: Click cancel button or press ESC
- Min 1, max 1000 characters enforced

**Validation**:
- Real-time validation as user types
- Save button disabled when invalid
- Cannot save empty or whitespace-only content
- Clear inline error messages

**Save Process**:
- Optimistic UI update (immediate display)
- Loading state shown
- Database update in background
- Rollback if save fails
- Success toast notification
- Board state refreshes to reflect changes

**Concurrent Editing**:
- Version-based conflict detection
- Descriptive error if conflict detected
- Prompt to refresh ticket data
- Lost update protection

### Requirements

**Edit Activation**:
- Click title or description to edit
- Pencil icon on hover indicates editability
- Auto-focus input field when entering edit mode

**Title Editing**:
- Enter edit mode on click
- Max 100 characters
- No empty or whitespace-only
- Save on Enter or click outside
- Cancel on ESC

**Description Editing**:
- Enter edit mode on click
- Character counter displayed
- Min 1, max 1000 characters
- 90% warning at 900 characters
- No empty or whitespace-only
- Save and cancel buttons visible during edit

**Validation**:
- Real-time validation
- Save disabled when invalid
- Inline error messages

**Save & Concurrency**:
- Optimistic UI update
- Loading state during save
- Rollback on failure
- Version-based conflict detection
- Success/error notifications
- Board refresh after save

### Data Model

**Editable Fields**:
- `title`: 1-100 characters
- `description`: 1-1000 characters
- `clarificationPolicy`: Optional policy override (nullable, see [08-clarification-policies.md](08-clarification-policies.md))
- `version`: Incremented on each update (concurrency control)
- `updatedAt`: Set to current timestamp on save

**Read-Only Fields**:
- `workflowType`: Set automatically during initial BUILD transition, immutable thereafter

**Validation Rules**:
- Allowed characters: letters (a-z, A-Z), numbers (0-9), spaces, and special characters (`. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`)
- Rejects characters outside allowed set (emojis, control characters, other Unicode)
- No empty or whitespace-only values
- Character limits enforced
- Same validation rules apply to both title and description fields

---

## Workflow Type Tracking

**Purpose**: Users need to quickly identify which tickets were implemented through the quick-implementation path versus the full specification workflow. The workflow type badge provides a persistent visual indicator that distinguishes between these two implementation approaches.

### What It Does

The system tracks and displays the workflow path used for each ticket:

**Workflow Types**:
- **FULL** (default): Standard workflow path (INBOX → SPECIFY → PLAN → BUILD)
  - Creates complete specification, planning documents, and task breakdown
  - Appropriate for complex features, architectural changes, and unclear requirements
  - No badge displayed on ticket card
- **QUICK**: Quick-implementation path (INBOX → BUILD)
  - Bypasses formal specification and planning
  - Appropriate for simple fixes, typos, obvious bugs, and minor UI tweaks
  - Displays ⚡ Quick badge on ticket card

**Badge Display**:
- **Visual Indicator**: Lightning bolt emoji (⚡) with "Quick" text
- **Positioning**: Appears in ticket card header, positioned LEFT of the model badge (SONNET)
- **Styling**: Amber color scheme for visual distinction
  - Light theme: `bg-amber-100` background, `text-amber-800` text
  - Dark theme: `bg-amber-900` background, `text-amber-200` text
- **Persistence**: Badge remains visible throughout ticket lifecycle (BUILD → VERIFY → SHIP)

**Automatic Detection**:
- System automatically sets `workflowType=QUICK` when ticket transitions INBOX → BUILD
- System maintains `workflowType=FULL` (default) for all other transitions
- Field is immutable after initial setting (cannot be changed through UI)

**Data Integrity**:
- Atomic transaction: `workflowType` updated in same transaction as Job creation
- Rollback safety: If workflow dispatch fails, `workflowType` is NOT updated
- Version control: Included in optimistic concurrency control

### Requirements

**Field Definition**:
- Database field: `workflowType` enum (FULL, QUICK)
- Default value: FULL (backward compatible with existing tickets)
- Nullability: NOT NULL (always has a value)
- Index: Composite index on (projectId, workflowType) for future filtering features

**Automatic Setting**:
- Quick-impl detection: `currentStage === INBOX && targetStage === BUILD`
- Set to QUICK: During INBOX → BUILD transition, atomic with Job creation
- Set to FULL: All other transitions (default value preserved)
- Immutability: Value never changed after initial BUILD transition

**Badge Rendering**:
- Conditional display: Show badge only when `workflowType === 'QUICK'`
- Component: shadcn/ui Badge with variant="outline"
- Position: Card header, left of model badge (SONNET)
- Accessibility: Proper ARIA labels for screen readers
- Performance: <100ms render time, no layout shift

**Data Model Integration**:
- TypeScript type: `TicketWithVersion` includes `workflowType: WorkflowType`
- Board query: Selects `workflowType` field from database
- API response: Includes `workflowType` in transition endpoint response
- State management: Merged from server response into client state after transitions

**Validation**:
- Migration: All existing tickets default to FULL
- New tickets: Default to FULL via database default
- Quick-impl tickets: Automatically set to QUICK during transition
- Manual updates: Not supported through UI (database-only for corrections)

### Data Model

**WorkflowType Enum**:
- `FULL`: Standard workflow (INBOX → SPECIFY → PLAN → BUILD)
- `QUICK`: Quick-implementation (INBOX → BUILD)

**Ticket Field**:
- `workflowType`: WorkflowType enum, NOT NULL, defaults to FULL
- Set during first BUILD transition
- Immutable after setting (application-level enforcement)
- Indexed with projectId for future filtering

**Badge Styling**:
- Light theme: `bg-amber-100 text-amber-800`
- Dark theme: `bg-amber-900 dark:text-amber-200`
- Size: `text-xs px-1.5 py-0.5 font-semibold`
- Layout: `flex items-center gap-2` with model badge

**State Management**:
- Optimistic update: Badge appears immediately after drag-and-drop
- Server sync: `workflowType` merged from API response into local state
- Rollback: Reverts to FULL if transition fails

---

## Image Attachments

**Purpose**: Users need to attach visual context (screenshots, diagrams, UI mockups) to tickets for clearer specification and implementation. Image attachments enable visual documentation that complements text descriptions, particularly useful for UI bugs, design references, and architectural diagrams.

### What It Does

The system enables uploading, viewing, replacing, and deleting image attachments on tickets:

**Image Gallery**:
- **Badge Indicator**: Image count badge displays on ticket cards when attachments exist
- **Gallery Access**: Click image badge to open full image gallery modal
- **Lightbox Viewer**: Click any image to view full-size with navigation controls
- **Maximum Capacity**: Up to 5 images per ticket

**Upload Operations**:
- **File Selection**: Click upload button or drag-and-drop images
- **Supported Formats**: JPEG, PNG, GIF, WebP
- **Size Limit**: 10MB maximum per image
- **Storage**: Cloudinary CDN for fast, public access
- **Progress Feedback**: Upload progress indicator with loading states

**Management Operations**:
- **Replace Image**: Click replace icon → select new image → overwrites at same position
- **Delete Image**: Click delete icon → confirmation → removes from attachments
- **Reorder**: Images maintain upload order, indexed 0-4

**Access Control**:
- **Editable Stages**: INBOX stage only (attach mockups/screenshots before specification)
- **Read-Only Stages**: SPECIFY, PLAN, BUILD, VERIFY, SHIP (view-only)
- **Permission Guards**: UI controls disabled and API endpoints enforce stage restrictions

**Cloudinary Integration**:
- **Public URLs**: Images accessible via HTTPS URLs without authentication
- **CDN Performance**: Global CDN for fast image loading
- **Folder Structure**: `ai-board/tickets/{ticketId}/` organization
- **Deletion Management**: Cloudinary publicId stored for cleanup operations
- **Free Tier**: 25GB storage, 25GB bandwidth/month included

**Claude Workflow Integration**:
- **Specification Generation**: Images included in Claude prompts during spec/plan workflows
- **Public Access**: Claude can access images via Cloudinary URLs in GitHub Actions
- **No Repository Storage**: Images stored externally, keeping repository lightweight
- **Prompt Context**: Visual context enhances AI-generated specifications and plans

### Requirements

**Upload**:
- Max 5 images per ticket
- Supported formats: JPEG, PNG, GIF, WebP
- Max 10MB per file
- Cloudinary CDN storage with public URLs
- Upload progress indicator
- Success/error notifications
- Automatic attachment count update

**Gallery Display**:
- Image count badge on ticket cards
- Grid layout with thumbnails
- Click to open lightbox viewer
- Navigation controls (prev/next)
- Responsive sizing (mobile/desktop)
- Loading states for async operations

**Replace**:
- Replace icon on each image thumbnail
- File selection dialog
- Same validation as upload (format, size)
- Overwrites at same array position
- Deletes old image from Cloudinary
- Uploads new image to Cloudinary
- Preserves gallery position

**Delete**:
- Delete icon on each image thumbnail
- Confirmation dialog (prevent accidental deletion)
- Removes from attachments array
- Deletes image from Cloudinary
- Updates attachment count immediately

**Permission Control**:
- **SPECIFY Stage**: Full CRUD operations (upload, replace, delete)
- **PLAN Stage**: Full CRUD operations (upload, replace, delete)
- **Other Stages**: Read-only access (view only)
- UI controls disabled in read-only modes
- API returns 403 Forbidden for unauthorized operations

**Concurrent Editing**:
- Version-based conflict detection (same as title/description)
- Optimistic updates with rollback on conflict
- Error message prompts refresh on version mismatch
- Lost update protection

**Cloudinary Operations**:
- Upload: Buffer → Cloudinary → Public URL
- Delete: Cloudinary publicId → destroy operation
- Replace: Upload new → delete old (fail-safe order)
- Configuration validation: Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- Error handling: Continue database operations even if Cloudinary delete fails (prevents orphaned records)

### Data Model

**TicketAttachment Interface**:
```typescript
{
  type: 'uploaded' | 'external',
  url: string,                    // Cloudinary HTTPS URL (uploaded) or external URL
  filename: string,               // Original filename or alt text
  mimeType: string,               // e.g., "image/png"
  sizeBytes: number,              // File size in bytes
  uploadedAt: string,             // ISO 8601 timestamp
  cloudinaryPublicId?: string     // Cloudinary ID for deletion (uploaded only)
}
```

**Ticket Field**:
- `attachments`: JSON array of TicketAttachment objects (nullable, defaults to empty array)
- Stored in PostgreSQL JSONB column for querying capabilities
- Maximum 5 attachments enforced at API level

**Cloudinary Folder Structure**:
- Pattern: `ai-board/tickets/{ticketId}/{filename}`
- Example: `ai-board/tickets/915/screenshot-bug.png`
- Unique filenames: Cloudinary auto-generates unique names on conflict
- Organization: All ticket images grouped by ticket ID

**API Endpoints**:
- `GET /api/projects/{projectId}/tickets/{id}/images`: Fetch attachments metadata
- `POST /api/projects/{projectId}/tickets/{id}/images`: Upload new image
- `PUT /api/projects/{projectId}/tickets/{id}/images/{index}`: Replace image at index
- `DELETE /api/projects/{projectId}/tickets/{id}/images/{index}`: Delete image at index

**Validation Rules**:
- Max 5 attachments per ticket
- Supported MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Max file size: 10MB (10485760 bytes)
- Stage restrictions: INBOX only for CRUD operations (upload, replace, delete)
- Version control: Required for all mutating operations (POST, PUT, DELETE)

**Environment Configuration**:
```bash
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

---

## Current State Summary

### Available Features

**Drag-and-Drop**:
- ✅ Visual drag with ghost/preview
- ✅ Sequential stage progression enforcement
- ✅ Smooth animations
- ✅ Touch device support
- ✅ Optimistic updates with rollback
- ✅ <100ms latency
- ✅ Concurrent update protection

**Detail Viewer**:
- ✅ Tabbed modal interface (Details, Comments, Files)
- ✅ Tab navigation with keyboard shortcuts
- ✅ Details tab: Full ticket information with editing
- ✅ Comments tab: Threaded comments with real-time updates
- ✅ Files tab: Image gallery with management
- ✅ Comment count badge on tab header
- ✅ Clear typography and hierarchy
- ✅ Multiple modal dismissal methods
- ✅ Responsive (full-screen mobile, centered desktop)
- ✅ Dark theme styling

**Ticket Comments**:
- ✅ Create comments (1-2000 characters)
- ✅ Markdown rendering with HTML escaping
- ✅ Author information (name, avatar/initials, timestamp)
- ✅ Reverse chronological order (newest first)
- ✅ Delete own comments with confirmation
- ✅ Real-time updates via polling (10-second interval)
- ✅ Comment count badge updates automatically
- ✅ Character counter with overflow indication
- ✅ Cmd/Ctrl+Enter submit shortcut
- ✅ Optimistic updates with rollback
- ✅ Authorization enforcement (project owners, author-only deletion)

**User Mentions**:
- ✅ @ symbol autocomplete in comment textarea
- ✅ Real-time filtering by name and email (case-insensitive)
- ✅ Keyboard navigation (arrow keys, Enter, ESC)
- ✅ Mouse click selection
- ✅ Visual chip rendering with hover tooltips
- ✅ Multiple mentions per comment
- ✅ Auto-updating user names (shows current name)
- ✅ Deleted user handling ("[Removed User]" display)
- ✅ Mention persistence after save and reload
- ✅ Project member filtering (owner + members only)

**Inline Editing**:
- ✅ Click-to-edit title and description
- ✅ Real-time validation
- ✅ Character counters and warnings
- ✅ Optimistic updates with rollback
- ✅ Concurrent edit protection
- ✅ Success/error notifications

**Workflow Type Tracking**:
- ✅ Automatic detection (INBOX → BUILD = QUICK, other paths = FULL)
- ✅ ⚡ Quick badge on ticket cards
- ✅ Amber styling (light/dark theme support)
- ✅ Badge positioned left of model badge
- ✅ Persistent across stage transitions
- ✅ Atomic transaction with Job creation
- ✅ Immutable after initial setting

**Image Attachments**:
- ✅ Upload images (max 5 per ticket, 10MB each)
- ✅ Supported formats: JPEG, PNG, GIF, WebP
- ✅ Cloudinary CDN storage with public URLs
- ✅ Image gallery with lightbox viewer
- ✅ Replace and delete operations
- ✅ Stage-based access control (SPECIFY/PLAN editable)
- ✅ Image count badge on ticket cards
- ✅ Version-based concurrent edit protection
- ✅ Claude workflow integration (images accessible in prompts)
- ✅ Automatic Cloudinary cleanup on delete/replace

### User Workflows

**Moving a Ticket**:
1. User clicks and holds ticket card
2. Ticket shows ghost/preview while dragging
3. Valid next stage highlights
4. User releases over next stage
5. Ticket moves immediately (optimistic)
6. Database confirms update

**Viewing Ticket Details**:
1. User clicks ticket card
2. Modal opens with tabbed interface (Details tab active)
3. User reviews title, description, dates, stage in Details tab
4. User can switch to Comments or Files tabs
5. User closes modal (button/ESC/click-outside)

**Editing a Ticket**:
1. User clicks ticket to open detail modal
2. User clicks title or description to edit in Details tab
3. Field becomes editable with focus
4. User makes changes
5. User saves (Enter/click-outside for title, save button for description)
6. Changes save immediately with visual confirmation
7. Board updates to reflect changes

**Adding a Comment**:
1. User opens ticket detail modal
2. User navigates to Comments tab (click or Cmd/Ctrl+2)
3. Textarea auto-focuses on first visit
4. User types comment (markdown supported)
5. Character counter displays current/max (e.g., "150 / 2000")
6. User submits (click Submit or press Cmd/Ctrl+Enter)
7. Comment appears immediately at top of list (optimistic)
8. Form clears automatically
9. Comment count badge updates on tab header

**Viewing Comments**:
1. User opens ticket detail modal
2. User sees comment count badge on Comments tab header (e.g., "Comments (5)")
3. User navigates to Comments tab
4. Comments display in reverse chronological order (newest first)
5. Each comment shows author name, avatar/initials, timestamp
6. Markdown content renders with formatting (bold, links, code blocks)
7. User scrolls through comment list
8. New comments from other users appear automatically within 10 seconds

**Deleting a Comment**:
1. User hovers over their own comment
2. Delete button (trash icon) appears
3. User clicks delete button
4. Confirmation dialog appears
5. User confirms deletion
6. Comment removed immediately from list (optimistic)
7. Comment count badge decrements automatically
8. If deletion fails, comment reappears with error notification

**Managing Ticket Images**:
1. User clicks ticket to open detail modal
2. User views image count badge on ticket card (if images exist)
3. User clicks image badge or opens image gallery tab in modal
4. **Upload**: User clicks upload button → selects image → uploads to Cloudinary → image appears in gallery
5. **Replace**: User clicks replace icon → selects new image → old deleted from Cloudinary → new uploaded → replaces at same position
6. **Delete**: User clicks delete icon → confirms deletion → image removed from gallery and Cloudinary
7. **View**: User clicks image thumbnail → lightbox opens → navigates with prev/next controls
8. Gallery updates immediately with visual confirmation

**Mentioning Users in Comments**:
1. User opens ticket detail modal and navigates to Comments tab
2. User clicks in comment textarea and types @
3. Autocomplete dropdown appears showing all project members
4. User types additional letters (e.g., "ali") to filter dropdown
5. Dropdown filters to matching users (e.g., "Alice Smith")
6. **Mouse selection**: User clicks on desired user from dropdown
7. **Keyboard selection**: User presses down arrow to highlight user, then presses Enter
8. Mention inserted as `@[Alice Smith](user-alice)` syntax
9. User continues typing rest of comment text
10. User submits comment (click Submit or Cmd/Ctrl+Enter)
11. Comment displays with mention rendered as styled chip
12. Other users viewing comment see "Alice Smith" in chip format
13. Hovering over chip shows tooltip with full name and email

### Business Rules

**Movement**:
- Sequential stage progression only (one stage forward)
- No skipping stages
- No backwards movement
- Any authenticated user can move any ticket
- First-write-wins for concurrent moves
- Offline: drag-and-drop disabled
- **Job Completion Validation** (updated 2025-10-23):
  - Automated stages (SPECIFY, PLAN, BUILD) require completed **workflow job** before next transition
  - System validates most recent workflow job (excludes AI-BOARD jobs with `command NOT LIKE 'comment-%'`)
  - AI-BOARD jobs do NOT block transitions (run in parallel, assistance only)
  - Transitions blocked when workflow job status is PENDING, RUNNING, FAILED, or CANCELLED
  - Transitions allowed when workflow job status is COMPLETED
  - Manual stages (VERIFY, SHIP) and initial transition (INBOX → SPECIFY) bypass validation
  - Drag-and-drop UI blocked when workflow job not COMPLETED (visual feedback with disabled cursor)
  - Error responses include job status, command, and suggested actions

**Editing**:
- Title: 1-100 characters
- Description: 1-1000 characters
- Both required (no empty values)
- Allowed characters: letters (a-z, A-Z), numbers (0-9), spaces, and special characters (`. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`)
- Rejects emojis, control characters, and other Unicode characters outside allowed set
- Title and description use identical character validation rules
- Version-based conflict detection prevents lost updates
- Optimistic updates with rollback on failure

**Workflow Type** (added 2025-01-16):
- Automatically set during first BUILD transition
- INBOX → BUILD sets `workflowType=QUICK` (quick-implementation path)
- All other paths maintain `workflowType=FULL` (default)
- Immutable after initial setting (application-level enforcement)
- Badge displayed only for QUICK workflow type
- Badge persists through all stage transitions (BUILD → VERIFY → SHIP)
- Atomic transaction with Job creation ensures data consistency

**Image Attachments** (added 2025-01-21):
- Maximum 5 images per ticket (10MB each)
- Supported formats: JPEG, PNG, GIF, WebP only
- Editable only in SPECIFY and PLAN stages
- Read-only in all other stages (INBOX, BUILD, VERIFY, SHIP)
- Cloudinary CDN storage with public HTTPS URLs
- Images accessible to Claude in GitHub Actions workflows via public URLs
- Automatic cleanup: Cloudinary images deleted when replaced or removed
- Version-based conflict detection prevents concurrent edit conflicts
- Fail-safe deletion: Database updates proceed even if Cloudinary delete fails

**Ticket Comments** (added 2025-01-22):
- Content length: 1-2000 characters (enforced server-side)
- Markdown supported: Bold, italic, links, code blocks, lists, headings
- HTML escaping: react-markdown prevents XSS attacks (default escaping enabled)
- Authorization: Project owners can view/create, only authors can delete own comments
- Real-time updates: 10-second polling interval, automatic display of new comments
- Cascade delete: All comments deleted when ticket deleted (foreign key constraint)
- Comment ordering: Reverse chronological (newest first) via `createdAt DESC`
- Optimistic updates: Immediate UI changes with rollback on failure
- Performance: <2s for create/delete operations, <500ms for 100 comments rendering

**User Mentions in Comments** (added 2025-10-23):
- Mention trigger: Type @ character in comment textarea to open autocomplete
- User filtering: Real-time case-insensitive search on project members (name and email)
- Selection methods: Click on user or use arrow keys + Enter for keyboard navigation
- Visual formatting: Mentioned users rendered as styled chips with hover tooltips
- Display behavior: Shows current user name (auto-updates when user changes name)
- Deleted user handling: Displays "[Removed User]" when mentioned user removed from project
- Multi-user support: Multiple mentions allowed per comment, autocomplete reopens on subsequent @
- Keyboard controls: ESC to close autocomplete, arrow keys for navigation, Enter to select
- Authorization: Only project members appear in autocomplete dropdown
- Performance: <100ms autocomplete filtering response time for up to 100 project members

**AI-BOARD Assistant** (added 2025-10-23):
- System user: AI-BOARD automatically added as project member when projects created
- Mention availability: AI-BOARD available for mention in SPECIFY, PLAN, BUILD, VERIFY stages only
- Availability validation: Grey-out with tooltip when unavailable (invalid stage or job running)
- Job creation: @ai-board mention creates Job and dispatches GitHub workflow
- Workflow execution: Claude updates spec.md or plan.md based on user request
- Response posting: AI-BOARD posts comment with summary of changes via workflow
- Stage support: SPECIFY and PLAN fully implemented, BUILD/VERIFY return "not implemented" message
- Test tickets: Workflows skip Claude execution for [e2e] tickets (performance optimization)
- Concurrency protection: Only one AI-BOARD job allowed per ticket at a time

### Technical Details

**Drag-and-Drop**:
- @dnd-kit/core and @dnd-kit/sortable libraries
- Touch event support
- Optimistic UI with rollback
- Version field for concurrency

**Modal**:
- shadcn/ui Dialog component
- Radix UI primitives
- Responsive breakpoints

**Validation**:
- Zod schemas
- Real-time validation
- Client and server validation

**Tabbed Modal Interface**:
- shadcn/ui Tabs component (Radix UI primitives)
- Three tabs: Details, Comments, Files
- Keyboard navigation: Arrow keys + Cmd/Ctrl+[1-3] shortcuts
- Comment count badge on Comments tab header
- Responsive: Horizontally scrollable on mobile

**Ticket Comments**:
- Database: PostgreSQL Comment table with foreign keys to Ticket and User
- Indexes: Composite (ticketId, createdAt) for sorting, (userId) for author filtering
- Cascade delete: ON DELETE CASCADE for both ticketId and userId
- Markdown: react-markdown v9.0.1 with HTML escaping
- Date formatting: date-fns for relative timestamps (e.g., "2 hours ago")
- TanStack Query v5 for data fetching, mutations, and polling
- React hooks: useComments, useCreateComment, useDeleteComment
- API: RESTful endpoints (GET, POST, DELETE)
- Validation: Zod schemas for content length (1-2000 characters)
- Authorization: Session-based (NextAuth.js), project ownership + author validation
- Real-time: Client-side polling (10-second interval) with deduplication

**User Mentions**:
- Autocomplete: Custom React hook (useMentionAutocomplete) with state management
- User data: Fetched from ProjectMember join table via TanStack Query
- Filtering: Client-side case-insensitive search on name and email fields
- Keyboard navigation: Custom useEffect hooks for arrow keys, Enter, ESC
- Mention syntax: Markdown format `@[Display Name](userId)` stored in comment content
- Rendering: Custom react-markdown component (MentionRenderer) converts syntax to chips
- User lookup: Real-time fetch from User table using user IDs extracted from mentions
- Tooltip: shadcn/ui Tooltip component with Radix UI primitives
- Performance: Memoized filtering function with useMemo for <100ms response
- API: GET /api/projects/{projectId}/members endpoint for autocomplete data

**Image Attachments**:
- Cloudinary SDK v2 (official Node.js SDK)
- TanStack Query v5 for image data fetching and mutation
- React hooks: useTicketImages, useUploadImage, useReplaceImage, useDeleteImage
- Components: ImageGallery (shadcn/ui Dialog + Badge components)
- Storage: Cloudinary CDN with folder structure `ai-board/tickets/{ticketId}/`
- API: RESTful endpoints with multipart/form-data for file uploads
- Validation: Zod schemas for file type, size, and stage permissions
- Concurrency: Version field included in all mutating operations
