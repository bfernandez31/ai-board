# User Experience

## Overview

This domain covers user-facing experience features that provide real-time feedback, transparency into automated workflows, and efficient project navigation.

**Current Capabilities**:
- Real-time job status visualization on ticket cards
- Specification document viewer
- Branch link in ticket details for quick GitHub access
- Projects list page with navigation
- Application header with branding and placeholder navigation buttons

---

## Real-Time Job Status Display

**Purpose**: Users need to see the current state of automated workflow executions directly on ticket cards without manually checking GitHub Actions. This provides immediate visibility into specification generation, planning, and implementation progress.

### What It Does

The system displays job execution status directly on ticket cards with:

**Ticket Card Status Indicators**:
- **Job Status Badge**: Shows current workflow state (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- **Job Type Badge**: Distinguishes workflow jobs (gear icon, blue) from AI-BOARD jobs (message icon, purple)
- **Animated Indicator**: Writing quill/pen animation displays when job is RUNNING
- **Color-Coded Status**: Visual distinction between success (green), in-progress (blue), failure (red), and cancelled (gray)
- **Ticket Information**: Displays ticket ID, title, and SONNET badge

**Real-Time Updates**:
- Status changes appear automatically via client-side polling (2-second interval)
- Updates reflect in current browser tab
- No manual page refresh required
- Polling stops when all jobs reach terminal states (optimization)

**Status Display Logic**:
- Shows most recent active job (PENDING or RUNNING) if one exists
- If no active jobs, shows most recent terminal job (COMPLETED/FAILED/CANCELLED)
- Terminal statuses persist indefinitely until replaced by new job
- Tickets with no jobs display clean card without status indicator

### Requirements

**Display**:
- System displays current job status on tickets with active or recent jobs
- Job type indicator shows workflow jobs (gear icon, blue) vs. AI-BOARD jobs (message icon, purple)
- Clean, uncluttered card design focusing on ticket title and job status
- Distinct visual states for each status: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- FAILED status uses error red styling
- CANCELLED status uses neutral gray styling (distinguishes intentional stop from error)
- Job type visible without hover interaction (WCAG 2.1 AA compliant)

**Animation**:
- Smooth, continuous animation for RUNNING status (writing motion)
- Animations don't impact scrolling or interaction performance
- Subtle and professional visual design

**Real-Time**:
- Client-side polling at 2-second intervals
- Automatic updates without manual page refresh
- Polling starts when board component mounts
- Polling stops when board component unmounts or all jobs terminal
- API endpoint: GET `/api/projects/{projectId}/jobs/status`

**Data Handling**:
- Displays most recent active job (PENDING/RUNNING priority)
- Falls back to most recent terminal job if no active jobs
- Terminal statuses persist until new job starts
- Handles tickets with no jobs gracefully

### Data Model

**Ticket Card Display**:
- Ticket ID
- Ticket title
- SONNET badge
- Job status indicator (if applicable)

**Job Status Values**:
- `PENDING`: Queued for execution
- `RUNNING`: Currently executing (shows animation)
- `COMPLETED`: Finished successfully
- `FAILED`: Encountered error
- `CANCELLED`: Manually terminated

**Job Type Classification**:
- **Workflow Jobs**: Automated stage transitions (commands: specify, plan, tasks, implement, quick-impl)
  - Visual: Gear/cog icon with blue color (#2563eb)
  - Label: "Workflow"
  - ARIA: "Automated workflow job"
- **AI-BOARD Jobs**: User-initiated assistance (commands: comment-specify, comment-plan, comment-build, comment-verify)
  - Visual: Message/chat icon with purple color (#9333ea)
  - Label: "AI-BOARD"
  - ARIA: "AI-BOARD assistance job"

---

## Documentation Viewer

**Purpose**: Users need to view and edit generated documentation files (spec.md, plan.md, tasks.md) directly in the application without leaving the ticket context. This provides a complete documentation lifecycle including viewing, editing, and tracking changes with full git integration.

### What It Does

The system provides comprehensive documentation management with viewing, editing, and history tracking:

**Button Visibility**:
- **"Spec" button** appears when:
  - Ticket has assigned branch
  - At least one completed "specify" job exists
- **"Plan" button** appears when:
  - Ticket workflow type is FULL (not QUICK)
  - At least one completed "plan" job exists
- **"Tasks" button** appears when:
  - Ticket workflow type is FULL (not QUICK)
  - At least one completed "plan" job exists

**Branch Selection Logic**:
- **Active tickets** (INBOX → VERIFY): Fetch files from feature branch (`ticket.branch`)
- **Shipped tickets** (SHIP stage): Fetch files from main branch (canonical version)

**Documentation Display**:
- Modal dialog with full document content
- Markdown rendering with:
  - Headings (h1-h6) with proper hierarchy
  - Lists (ordered, unordered, nested)
  - Links, tables, blockquotes
  - Code blocks with syntax highlighting (VS Code Dark Plus theme)
  - Horizontal rules
- Dark theme styling (zinc color palette)
- Scrollable content for long documents (60vh)
- Ticket ID, title, and document type in header

**Edit Mode** (Stage-based permissions):
- **Spec editing**: Allowed only in SPECIFY stage
- **Plan/Tasks editing**: Allowed only in PLAN stage
- **Edit button**: Shows when user has permission for current document
- **Editor features**:
  - Full-height textarea (70vh) with markdown content
  - Save and Cancel buttons
  - Auto-resize textarea to content
  - Automatic git commit and push on save
  - Commit message: `docs: update {docType}.md for ticket #{ticketId}`
  - Co-authored by Claude attribution

**Commit History & Change Tracking**:
- **View History button**: Shows commit history for current document
- **Commit list** (scrollable, 25vh):
  - Chronological list of commits affecting the file
  - Author name and email
  - Commit message (first line)
  - Timestamp (formatted: "Oct 18, 2025, 2:30 PM")
  - Short SHA (first 7 characters)
  - Visual selection feedback (blue highlight)
  - Clickable to view diff
- **Diff viewer** (scrollable, remaining height):
  - File metadata: filename, +/- counts, status
  - Color-coded changes: additions (green bg), deletions (red bg)
  - Context lines in default color
  - Unified diff format with line markers (+/-)
  - Section headers (@@) in blue
  - Scrollable for large diffs

**Modal Controls**:
- Close button (X in header)
- ESC key closes modal
- Back button when viewing history (returns to document view)
- Edit button (when permitted)
- View History button (when not editing)
- Loading indicators for all async operations
- Error messages with retry options
- Success toast notifications on save

### Requirements

**Visibility**:
- Spec button: Ticket has `branch` AND completed "specify" job
- Plan/Tasks buttons: Workflow type FULL AND completed "plan" job
- Edit button: Stage permits editing (SPECIFY for spec, PLAN for plan/tasks)
- View History button: Document loaded and not in edit mode

**Content Retrieval**:
- File paths: `specs/{branch-name}/{docType}.md`
- Branch selection: Feature branch for active, main for SHIP stage
- GitHub API: `@octokit/rest` library
- Validates project ownership
- Error codes: 400 (validation), 403 (forbidden), 404 (not found), 500 (server)

**Edit Permissions**:
- Spec.md: Editable when `ticket.stage === 'SPECIFY'`
- Plan.md/Tasks.md: Editable when `ticket.stage === 'PLAN'`
- Permission check: `canEdit(ticketStage, docType)` function
- Edit button hidden when permission denied

**Edit Operations**:
- Component: DocumentationEditor with full-height textarea
- API: `POST /api/projects/{projectId}/docs/save`
  - Request: `{ content, ticketId, docType, version }`
  - Response: `{ success, commitSha, message }`
- Validation: Content must be valid UTF-8, non-empty
- Git operations:
  - Updates file: `specs/{branch}/docType}.md`
  - Commits with message: `docs: update {docType}.md for ticket #{ticketId}`
  - Pushes to remote feature branch
  - Returns commit SHA
- Success: Toast notification + viewer refresh
- Cancel: Discards changes, returns to read mode

**History & Diff**:
- History API: `GET /api/projects/{projectId}/docs/history?ticketId={id}&docType={type}`
  - Returns: Array of commits with author, message, timestamp, SHA, URL
  - GitHub: `octokit.repos.listCommits({ sha: branch, path: filePath })`
  - Filters: Only commits affecting specified file
- Diff API: `GET /api/projects/{projectId}/docs/diff?ticketId={id}&docType={type}&sha={sha}`
  - Returns: Commit SHA + array of file changes with patches
  - GitHub: `octokit.repos.getCommit({ ref: sha })`
  - Filters: Only specified documentation file

**Display**:
- Markdown: react-markdown with custom components
- Syntax highlighting: react-syntax-highlighter (vscDarkPlus)
- Theme: Zinc palette (950/900/800/700/600/500/400/300/200/100/50)
- Layout: Max-w-4xl, max-h-90vh (desktop); 90vw (mobile)
- Scroll areas: Independent scrolling for doc content, commit list, diff viewer
- Two-panel history: 25vh commit list (flex-shrink-0) + flex-1 diff (min-h-0)

**Data Handling**:
- TanStack Query for caching and state management
- Lazy loading: Only fetch when modal opens
- Cache invalidation on save
- Optimistic updates for edit operations
- Error boundaries for failed renders

### Data Model

**Documentation Files**:
- **Spec**: `specs/{branch-name}/spec.md` - Feature specification
- **Plan**: `specs/{branch-name}/plan.md` - Implementation plan
- **Tasks**: `specs/{branch-name}/tasks.md` - Task breakdown
- Branch: Feature branch (active tickets) or main (SHIP stage)

**DocumentType** (TypeScript enum):
```typescript
type DocumentType = 'spec' | 'plan' | 'tasks';
```

**Commit History Response**:
```typescript
{
  commits: Array<{
    sha: string;           // Full 40-char commit SHA
    author: {
      name: string;        // Author display name
      email: string;       // Author email
      date: string;        // ISO 8601 timestamp
    };
    message: string;       // Full commit message
    url: string;          // GitHub commit URL
  }>
}
```

**Diff Response**:
```typescript
{
  sha: string;             // Commit SHA
  files: Array<{
    filename: string;      // Full file path
    status: 'added' | 'modified' | 'removed';
    additions: number;     // Lines added count
    deletions: number;     // Lines deleted count
    patch?: string;        // Unified diff format (optional)
  }>
}
```

**Edit Permission Matrix**:
| Document | Editable Stage | Permission Check |
|----------|---------------|------------------|
| spec.md  | SPECIFY       | `stage === 'SPECIFY'` |
| plan.md  | PLAN          | `stage === 'PLAN'` |
| tasks.md | PLAN          | `stage === 'PLAN'` |

**Required Conditions**:
- Ticket must have `branch` field populated (non-null, non-empty)
- Appropriate completed job exists (specify for spec, plan for plan/tasks)
- Ticket belongs to current project (ownership validation)
- User has edit permissions based on ticket stage (for edit operations)


## Branch Link in Ticket Details

**Purpose**: Users need quick access to review branch changes in GitHub without manually constructing URLs. The branch link provides one-click navigation from ticket details to the GitHub compare view, showing all changes made in the branch.

### What It Does

The system displays a clickable branch link in the ticket detail modal:

**Link Display**:
- Appears in ticket detail header row alongside stage and policy badges
- Compact inline badge design with:
  - GitBranch icon (left)
  - Branch name (truncated at 150px for long names)
  - ExternalLink icon (right)
- Blue color scheme (#89b4fa) consistent with GitHub links
- Tooltip shows full branch name on hover

**Visibility Conditions**:
- Link displays when:
  - Ticket has `branch` field populated (non-empty)
  - Ticket stage is NOT "SHIP" (development/review stages only)
  - Project has `githubOwner` and `githubRepo` configured
- Link hidden when:
  - Branch is null or empty string
  - Ticket reaches SHIP stage (deployed)
  - GitHub configuration missing

**Navigation**:
- Opens in new browser tab (target="_blank")
- Security attributes: rel="noopener noreferrer" prevents Tabnabbing
- URL format: `https://github.com/{owner}/{repo}/compare/main...{branch}`
- Branch name properly URL-encoded for special characters

**URL Encoding**:
- Spaces encoded as `%20`
- Slashes encoded as `%2F`
- Hash symbols encoded as `%23`
- All special characters properly encoded via `encodeURIComponent()`

### Requirements

**Display**:
- Branch link appears in ticket detail modal header
- Positioned in compact header row with stage badge, policy badge, and edit policy button
- Compact inline badge design saves vertical space
- GitBranch and ExternalLink icons provide clear visual affordance
- Branch name truncates at 150px with CSS `truncate` class
- Blue color scheme (#89b4fa) distinguishes from other badges

**Visibility Logic**:
- System displays link when ticket.branch is non-empty string
- System hides link when ticket.branch is null or empty
- System hides link when ticket.stage equals "SHIP"
- System hides link when project.githubOwner or project.githubRepo missing
- All conditions must be met for link to display

**Navigation**:
- Link opens in new browser tab (target="_blank")
- Security attributes prevent Tabnabbing (rel="noopener noreferrer")
- URL follows pattern: `https://github.com/{owner}/{repo}/compare/main...{branch}`
- Compare view shows diff between main branch and feature branch
- Branch name URL-encoded to handle special characters

**URL Construction**:
- Uses project.githubOwner for repository owner
- Uses project.githubRepo for repository name
- Uses ticket.branch for branch name
- Applies `encodeURIComponent()` to branch name
- Assumes 'main' as base branch name (standard convention)

### Data Model

**Required Fields**:
- `ticket.branch`: String (nullable), stores Git branch name
- `project.githubOwner`: String, GitHub repository owner/organization
- `project.githubRepo`: String, GitHub repository name
- `ticket.stage`: Stage enum, determines visibility

**Visual Components**:
- GitBranch icon (lucide-react, 12x12px)
- Branch name text (max-width: 150px, truncated)
- ExternalLink icon (lucide-react, 12x12px)
- Blue badge background (#89b4fa/#b4befe hover)
- Border and padding (text-xs, px-2, py-0.5)

**URL Structure**:
```
https://github.com/{githubOwner}/{githubRepo}/compare/main...{encodedBranch}

Example:
https://github.com/bfernandez31/ai-board/compare/main...033-link-to-branch
```

---

## Projects List Page

**Purpose**: Users need a centralized view of all projects and easy navigation to specific project boards. This page serves as the application's project hub.

### What It Does

The system displays all projects in a clean, navigable list:

**Project Display**:
- Each project shows:
  - Project name
  - Project description
  - Last updated timestamp
  - Total ticket count
- Modern, clean interface design
- Hover effects (scale/transform, cursor change)
- Clickable to navigate to project board

**Navigation**:
- Click project → navigate to `/projects/{projectId}/board`
- Direct access to any project's kanban board

**Action Buttons** (UI placeholders):
- "Import Project" button with icon (non-functional placeholder)
- "Create Project" button with icon (non-functional placeholder)

**Empty State**:
- When no projects exist: displays message with call-to-action
- Encourages creating first project

**Large Lists**:
- All projects displayed in scrollable container
- No pagination (simple scrolling)

### Requirements

**Display**:
- Lists all existing projects
- Shows name, description, last updated, ticket count per project
- Modern and clean design aesthetic
- Visual hover feedback (scale/transform, pointer cursor)

**Navigation**:
- Click project navigates to project board URL
- URL format: `/projects/{projectId}/board`

**Action Buttons**:
- "Import Project" button visible with icon + text label
- "Create Project" button visible with icon + text label
- Both buttons non-functional (placeholders for future features)

**Empty State**:
- Message when no projects exist
- Call-to-action for Create Project button

**Large Lists**:
- Scrollable container for many projects
- No pagination

### Data Model

**Project Information Displayed**:
- `name`: Project title/identifier
- `description`: Brief project details
- `updatedAt`: Last activity timestamp
- Ticket count: Total tickets in project (calculated)

**Navigation**:
- `id`: Used to generate board URL (`/projects/{id}/board`)

---

## Application Header

**Purpose**: Users need consistent site-wide navigation with branding and action buttons across all application pages. The header provides visual identity and placeholder navigation for future functionality.

### What It Does

The system displays a persistent header at the top of all pages:

**Header Layout**:
- **Left Side**: AI-BOARD logo and title
  - Logo from existing SVG file (29-final-clean.svg)
  - "AI-BOARD" text title next to logo
  - Visually harmonious with Catppuccin Mocha theme
- **Right Side**: Three action buttons (desktop)
  - "Log In" button
  - "Contact" button
  - "Sign Up" button
  - All styled with Catppuccin Mocha theme colors

**Responsive Behavior**:
- **Desktop**: All three buttons visible
- **Mobile**: Buttons collapse into hamburger menu
  - Hamburger icon displays on right side
  - Clicking reveals three action buttons

**Placeholder Functionality**:
- All three buttons are interactive (clickable)
- Clicking any button displays toast notification
- Toast message: "This feature is not yet implemented"
- No actual authentication or contact functionality

**Visual Design**:
- Fixed/sticky positioning (always visible when scrolling)
- Catppuccin Mocha color palette
  - Background: ctp-mantle or ctp-base
  - Text: ctp-text
  - Accents: primary-violet
- Vercel-inspired layout (logo left, actions right)
- Clean, modern aesthetic

### Requirements

**Display**:
- Header appears on all application pages (site-wide)
- Fixed positioning keeps header visible during scrolling
- Logo displays from 29-final-clean.svg file
- "AI-BOARD" title adjacent to logo
- Three action buttons on right: "Log In", "Contact", "Sign Up"

**Responsive**:
- Desktop: All buttons visible
- Mobile: Hamburger menu with collapsible button list

**Styling**:
- Catppuccin Mocha palette (from globals.css CSS variables)
- Logo visually harmonious with site theme
- Vercel-style layout (branding left, actions right)
- Modern, clean design

**Interaction**:
- All buttons are clickable and interactive
- Toast notification on button click
- Toast message: "This feature is not yet implemented"
- No functional implementation beyond toast

### Data Model

**Static Content**:
- Logo: `specs/vision/logo/29-final-clean.svg`
- Title: "AI-BOARD" (hardcoded)
- Button labels: "Log In", "Contact", "Sign Up" (hardcoded)
- Toast message: "This feature is not yet implemented" (hardcoded)

**No Backend Dependencies**:
- Stateless UI component
- No database queries
- No API endpoints

---

## Current State Summary

### Available Features

**Real-Time Status Visualization**:
- ✅ Client-side polling job status updates (2-second interval)
- ✅ Animated RUNNING indicators
- ✅ Color-coded status badges
- ✅ Job type distinction (workflow vs. AI-BOARD)
- ✅ Auto-updates across browser tabs
- ✅ WCAG 2.1 AA accessibility compliance

**Specification Access**:
- ✅ One-click specification viewing
- ✅ Markdown rendering with syntax highlighting
- ✅ Dark theme modal dialog
- ✅ Responsive mobile/desktop layout
- ✅ Project-scoped validation

**Branch Link**:
- ✅ One-click GitHub branch access from ticket details
- ✅ GitHub compare view (main...branch diff)
- ✅ Compact inline badge design in header row
- ✅ Stage-based visibility (hidden in SHIP)
- ✅ URL encoding for special characters
- ✅ Security attributes (noopener noreferrer)
- ✅ Branch name truncation at 150px

**Project Navigation**:
- ✅ Projects list with comprehensive information
- ✅ Click-to-navigate to project boards
- ✅ Modern, clean interface
- ✅ Placeholder buttons for future features
- ✅ Empty state messaging

**Application Header**:
- ✅ Site-wide persistent header
- ✅ AI-BOARD logo and branding
- ✅ Fixed/sticky positioning
- ✅ Three placeholder action buttons
- ✅ Responsive mobile hamburger menu
- ✅ Catppuccin Mocha theme styling
- ✅ Toast notifications for placeholders

**Job-Blocked Ticket Visual Feedback** (added 2025-10-15):
- ✅ Backend-specific error messages displayed in toast notifications
- ✅ Visual feedback during drag (opacity reduction + cursor change)
- ✅ Blocked column overlay with ban icon and explanatory text
- ✅ Automatic job status detection on drag start
- ✅ Applies to all columns when ticket has active job
- ✅ English messaging consistent with application language

### User Workflows

**Viewing Job Status**:
1. User views kanban board
2. Ticket cards display current job status and type automatically
3. User distinguishes workflow jobs (gear icon, blue) from AI-BOARD jobs (message icon, purple) at a glance
4. Status updates in real-time as workflows execute
5. User sees animation while specification is being drafted
6. Completion status persists on card

**Viewing Specifications**:
1. User clicks ticket with completed specify job
2. Ticket detail modal shows "View Specification" button
3. User clicks button
4. Specification displays in formatted modal
5. User reviews markdown content with syntax highlighting
6. User closes modal to return to ticket details

**Navigating Projects**:
1. User visits projects list page
2. User sees all projects with name, description, counts
3. User hovers over project (visual feedback)
4. User clicks project
5. System navigates to project's board

**Using Application Header**:
1. User visits any page in application
2. Header displays at top with logo and title
3. User sees "Log In", "Contact", "Sign Up" buttons (desktop)
4. User clicks any button
5. System displays toast: "This feature is not yet implemented"
6. User scrolls page (header remains fixed at top)
7. On mobile: user clicks hamburger menu to reveal buttons

**Dragging Job-Blocked Ticket**:
1. User attempts to drag ticket with active workflow job
2. System checks job status on drag start
3. All columns show reduced opacity and cursor changes to not-allowed
4. Columns display semi-transparent overlay with ban icon
5. Overlay shows "Workflow in progress" and "Wait for job completion" messages
6. User releases drag (ticket returns to origin)
7. User sees backend-specific error message in toast if drop attempted

### Business Rules

- Only most recent active or terminal job shown per ticket
- Job type determined by command prefix (comment-* = AI-BOARD, else workflow)
- Terminal job statuses persist until new job starts
- Specification button only for tickets with completed specify jobs
- All projects visible (no pagination or filtering)
- Import/Create buttons are placeholders (no functionality)
- Header action buttons are placeholders (no authentication/contact functionality)
- Header appears on all pages (site-wide)
- Header remains visible during scrolling (fixed positioning)
- Job-blocked tickets cannot be moved until workflow completes (visual feedback prevents confusion)
- Backend error messages displayed for failed transitions (user understands why operation failed)

### Technical Details

**Real-Time Updates**:
- Client-side polling at 2-second intervals
- TanStack Query for caching and state management
- Job type classification via command pattern matching
- Icons: lucide-react (Cog for workflow, MessageSquare for AI-BOARD)

**Content Retrieval**:
- GitHub API via Octokit
- File path: `specs/{branch-name}/spec.md`
- Project validation before access

**UI Components**:
- react-markdown for content rendering
- react-syntax-highlighter for code blocks
- shadcn/ui components (Dialog, ScrollArea, Button, Toast)
- Zinc color palette (dark theme)

**Header**:
- shadcn/ui Toast component (@radix-ui/react-toast)
- lucide-react for icons
- Catppuccin Mocha color palette
- Fixed positioning CSS
- Responsive hamburger menu (mobile)

---

## Job-Blocked Ticket Visual Feedback

**Purpose**: Users need clear visual indication when tickets cannot be moved due to active workflows. The system provides immediate feedback during drag operations to explain why drop zones are disabled and displays backend-specific error messages when transitions fail.

### What It Does

The system provides visual and textual feedback for job-blocked tickets:

**Error Message Improvements**:
- **Backend-specific messages**: Display actual error from API instead of generic fallback
- **Job validation errors**: Show specific reasons (workflow running, failed, cancelled)
- **User-friendly language**:
  - PENDING/RUNNING: "Cannot transition: workflow is still running"
  - FAILED: "Cannot transition: previous workflow failed. Please retry the workflow."
  - CANCELLED: "Cannot transition: workflow was cancelled. Please retry the workflow."
- **Toast notifications**: Error toasts display backend message with "Cannot move ticket" title

**Visual Feedback During Drag**:
- **Trigger**: When dragging ticket with active job (PENDING, RUNNING, FAILED, CANCELLED)
- **All columns disabled**: Every column shows blocked state during drag
- **Opacity reduction**: Columns appear with `opacity-50` to indicate unavailability
- **Cursor feedback**: `cursor-not-allowed` on all columns to prevent interaction
- **Automatic detection**: System checks job status on drag start

**Blocked Column Overlay** (when dragging job-blocked ticket):
- **Semi-transparent overlay**: `bg-black/60` with `backdrop-blur-sm` effect
- **Ban icon**: Large red prohibition icon (⊘) from lucide-react (`Ban` component)
  - Size: 64x64 pixels (`w-16 h-16`)
  - Color: `text-red-400`
  - Stroke width: 2.5 for visibility
- **Primary message**: "Workflow in progress" in `text-red-300` (semibold, small)
- **Secondary message**: "Wait for job completion" in `text-zinc-400` (extra small)
- **Positioning**: Absolute overlay covering entire column content
- **Z-index**: `z-50` to appear above all column content
- **Pointer events**: `pointer-events-none` to prevent interaction

**Workflow Integration**:
- State tracked in board component: `draggedTicketHasJob` boolean
- Job status checked via `getTicketJob` function during drag start
- Active job = PENDING, RUNNING, FAILED, or CANCELLED status
- Visual feedback applies to ALL columns when job active
- Feedback removed immediately on drag end

### Requirements

**Error Message Display**:
- Display backend error message from API response (500 status with `error.error` field)
- Show toast with "Cannot move ticket" title and backend message as description
- Use destructive variant (`variant: 'destructive'`) for error styling
- Preserve existing 500 error handling for other scenarios

**Drag Start Detection**:
- Check job status when user starts dragging ticket
- Set `draggedTicketHasJob` state to true if active job exists
- Query most recent job for ticket using `getTicketJob(ticketId)`
- Active job condition: `job && job.status !== 'COMPLETED'`

**Drop Zone Styling**:
- Apply `opacity-50 cursor-not-allowed` to all columns when `draggedTicketHasJob` is true
- Override other drop zone styles (blue/green highlighting for valid zones)
- Reset styling on drag end

**Blocked Overlay**:
- Display on all StageColumn components when `isBlockedByJob` prop is true
- Absolute positioning with `inset-0` to cover entire column
- Semi-transparent black background (`bg-black/60`) with backdrop blur
- Ban icon (lucide-react `Ban` component) centered with messages
- Messages centered vertically and horizontally in overlay
- English language (consistent with application)

**Component Integration**:
- Board component (`components/board/board.tsx`):
  - Track `draggedTicketHasJob` state
  - Check job status in `handleDragStart`
  - Pass `isBlockedByJob` prop to StageColumn components
  - Update `getDropZoneStyle` to disable zones when job active
- StageColumn component (`components/board/stage-column.tsx`):
  - Accept `isBlockedByJob` optional prop (boolean)
  - Import `Ban` icon from lucide-react
  - Render overlay when prop is true
  - Add `relative` class to column container for absolute positioning

**Performance**:
- Drag start check: <10ms (uses existing `getTicketJob` function)
- Visual update: Immediate (CSS state change)
- No additional API calls during drag

### Data Model

**Board State** (updated):
- `draggedTicketHasJob`: boolean (tracks if dragged ticket has active job)
- Set during `handleDragStart`, reset during `handleDragEnd`

**StageColumn Props** (updated):
- `isBlockedByJob?: boolean` (optional, indicates column should show blocked overlay)

**Job Status Detection**:
- Query: `getTicketJob(ticketId)` returns Job | null
- Active job: `job && job.status !== 'COMPLETED'`
- Status check: PENDING, RUNNING, FAILED, CANCELLED all considered "active"

**Visual Styling Classes**:
- Disabled zone: `opacity-50 cursor-not-allowed`
- Overlay: `absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 pointer-events-none`
- Ban icon: `w-16 h-16 text-red-400`
- Primary text: `text-red-300 font-semibold text-sm`
- Secondary text: `text-zinc-400 text-xs mt-1`

**Error Message Mapping**:
- PENDING/RUNNING: "Cannot transition: workflow is still running"
- FAILED: "Cannot transition: previous workflow failed. Please retry the workflow."
- CANCELLED: "Cannot transition: workflow was cancelled. Please retry the workflow."
- Generic 500: Existing fallback message

**Implementation Files**:
- `components/board/board.tsx`: State management, job detection, prop passing
- `components/board/stage-column.tsx`: Overlay rendering, Ban icon display
- `lib/workflows/transition.ts`: Backend error message generation

---
