# Next Features - /specify Prompts

Generated: 2025-10-02
Based on: vision/overview.md analysis

---

## Priority 1: Foundation Features

### 006-add-ticket-editing

```
/specify

Add inline ticket editing with Trello-style UX.

WHAT:
Allow users to edit ticket title and description directly from the detail modal using inline editing patterns.

WHY:
Users need to update ticket information as requirements evolve. Inline editing provides a fast, familiar experience similar to Trello.

REQUIREMENTS:

TITLE EDITING (Inline):
- Click title → becomes editable input
- Auto-focus on input field
- Enter key → save changes
- Click outside → save changes
- ESC key → cancel changes
- Min 1 char, max 100 chars
- Inline validation errors
- Saving indicator
- Success feedback

DESCRIPTION EDITING (Editor Panel):
- "Edit Description" button
- Opens markdown editor
- Live preview panel (side-by-side desktop, toggle mobile)
- Save/Cancel buttons
- Max 1000 chars
- Character counter
- ESC key → cancel
- Warning on unsaved changes

ERROR HANDLING:
- Show friendly error messages
- Retain changes on failure
- Allow retry
- Rollback on failure

UPDATES:
- Update timestamp on save
- Refresh board view
- Optimistic UI updates

ACCEPTANCE CRITERIA:
- Click title → editable immediately
- Enter/blur → saves title
- ESC → cancels changes
- Validation prevents invalid saves
- Edit Description → editor opens
- Markdown preview works
- Save → persists to database
- Board updates after save
- Errors handled gracefully

NON-GOALS:
- No stage editing (use drag-drop)
- No delete functionality
- No version history
- No collaborative editing
- No rich text WYSIWYG
```

---

### 007-add-ticket-deletion

```
/specify

Add ticket deletion with confirmation dialog.

WHAT:
Allow users to permanently delete tickets from the detail modal with a confirmation step.

WHY:
Users need to remove outdated, duplicate, or cancelled tickets to keep the board clean.

REQUIREMENTS:

DELETION:
- "Delete" button in ticket detail modal
- Red/destructive styling
- Opens confirmation dialog
- Shows ticket title in confirmation
- Clear warning message
- "Cannot be undone" notice
- Confirm/Cancel buttons

CONFIRMATION DIALOG:
- Modal overlay
- Ticket title displayed
- Warning text
- Confirm button (red/destructive)
- Cancel button (default)
- ESC key → cancel
- Click outside → cancel

DELETION FLOW:
- Confirm → delete from database
- Close detail modal
- Remove from board view
- Show success toast
- Update stage counts

ACCEPTANCE CRITERIA:
- Delete button visible in modal
- Click Delete → confirmation appears
- Cancel → keeps ticket
- Confirm → deletes permanently
- Deleted ticket removed from board
- Stage counts update
- Success feedback shown
- Modal closes automatically

NON-GOALS:
- No soft delete/archive
- No bulk deletion
- No undo functionality
- No trash/recycle bin
- No audit trail
```

---

### 008-add-stage-indicators

```
/specify

Add ticket count badges and health indicators to stage columns.

WHAT:
Display ticket counts per stage and visual warning indicators when stages have too many tickets.

WHY:
Users need quick overview of work distribution and to spot potential bottlenecks across stages.

REQUIREMENTS:

STAGE HEADERS:
- Show total ticket count badge
- Display next to stage name
- Update counts in real-time

COUNT UPDATES:
- On ticket drag-drop
- On ticket creation
- On ticket deletion
- Smooth animations

VISUAL INDICATORS:
- Normal state (default color)
- Warning state (amber/yellow)
- Empty state (muted/gray)

WARNING THRESHOLDS:
- INBOX: >10 tickets → warning
- PLAN: >8 tickets → warning
- BUILD: >6 tickets → warning
- VERIFY: >8 tickets → warning
- SHIP: informational only

DISPLAY:
- Badge with count number
- Color based on threshold
- Tooltip explaining threshold
- Responsive on all devices

ACCEPTANCE CRITERIA:
- Counts display correctly
- Counts update on drag-drop
- Counts update on create/delete
- Warning colors show at thresholds
- Tooltips explain warnings
- Animations smooth
- Mobile responsive

NON-GOALS:
- No customizable thresholds
- No advanced analytics
- No historical trends
- No charts/graphs
- No per-user limits
```

---

## Priority 2: Spec Management

### 009-add-spec-field

```
/specify

Add specification field to tickets for storing markdown documentation.

WHAT:
Add a spec field to the ticket data model that can store markdown specification text.

WHY:
Tickets need to store detailed specifications as foundation for future spec-kit/Claude integration.

REQUIREMENTS:

DATA MODEL:
- Add spec field (text, nullable)
- Add specUpdatedAt timestamp
- Existing tickets default to null

UI DISPLAY:
- New "Spec" tab in ticket detail modal
- Tab navigation (Details / Spec)
- Display formatted markdown
- "No spec yet" empty state
- Proper markdown rendering
- Code syntax highlighting
- Dark theme compatible

MARKDOWN SUPPORT:
- Headings
- Lists (ordered/unordered)
- Code blocks
- Links
- Bold/italic
- Blockquotes

ACCEPTANCE CRITERIA:
- Field added to database
- Migration successful
- Existing tickets unaffected
- Spec tab visible in modal
- Markdown renders correctly
- Empty state shows properly
- Dark theme works
- Tab switching smooth

NON-GOALS:
- No spec editing yet
- No AI generation
- No version control
- No GitHub integration
- No collaborative editing
```

---

### 010-add-spec-editor

```
/specify

Add markdown editor for creating and editing ticket specifications.

WHAT:
Allow users to manually write and edit ticket specifications in markdown format with live preview.

WHY:
Users need to document requirements and specifications manually before AI integration is available.

REQUIREMENTS:

EDITOR:
- Markdown text area
- Syntax highlighting
- Line numbers
- Auto-indentation
- Tab key support

PREVIEW:
- Live markdown preview
- Side-by-side on desktop (≥768px)
- Tabbed toggle on mobile (<768px)
- Same markdown rendering as view mode

EDITING FLOW:
- "Edit Spec" button in Spec tab
- Switches to edit mode
- Save/Cancel buttons appear
- Auto-save draft to localStorage
- Restore draft on return
- Clear draft on successful save

VALIDATION:
- Max 10,000 characters
- Character counter
- Warning at 90% limit
- Prevent save when over limit
- Markdown syntax validation

UNSAVED CHANGES:
- Warning if closing modal
- Warning if switching tabs
- Confirmation dialog
- Option to save or discard

UPDATES:
- Update specUpdatedAt timestamp
- Show last updated date
- Success feedback on save

ACCEPTANCE CRITERIA:
- Edit button enters edit mode
- Syntax highlighting works
- Preview updates live
- Desktop: side-by-side layout
- Mobile: tabbed layout
- Save persists to database
- Draft saved locally
- Draft restored on return
- Warnings for unsaved changes
- Character limit enforced
- Responsive on all devices

NON-GOALS:
- No rich text WYSIWYG
- No collaborative editing
- No version history
- No AI assistance
- No templates
- No import/export
```

---

## Priority 3: Enhanced Board Experience

### 011-add-ticket-filtering

```
/specify

Add search and filter controls to quickly find tickets on the board.

WHAT:
Allow users to filter tickets by text search and stage selection.

WHY:
As the board grows, users need to quickly find specific tickets without scrolling through all stages.

REQUIREMENTS:

SEARCH:
- Search input in board header
- Filter by title/description text
- Case-insensitive matching
- Partial word matching
- Real-time filtering
- Clear button
- Search icon

STAGE FILTER:
- Multi-select dropdown
- "All stages" default
- Checkbox for each stage
- Apply multiple stages
- Show selected count
- Clear selection option

COMBINED FILTERS:
- Search AND stage filters work together
- Both must match for ticket to show

DISPLAY:
- Show filtered ticket count
- "No results" empty state
- Highlight matched text (optional)
- Preserve drag-drop with filters active
- Clear all filters button

URL STATE:
- Persist filters in URL query params
- Shareable filtered view
- Browser back/forward support
- Refresh preserves filters

PERFORMANCE:
- Instant filtering (no debounce needed)
- Smooth animations
- No layout shift

ACCEPTANCE CRITERIA:
- Search filters instantly
- Stage filter works correctly
- Combined filters work together
- Clear buttons reset filters
- URL updates with state
- Refresh preserves filters
- Count displays correctly
- Empty state shows when no results
- Drag-drop still works
- Mobile responsive

NON-GOALS:
- No advanced query syntax
- No saved filter presets
- No filter by date/user
- No full-text search engine
- No filter by tags/labels
```

---

### 012-add-ticket-sorting

```
/specify

Add sorting options to organize tickets within each stage.

WHAT:
Allow users to sort tickets by date, title, or manual drag-drop order.

WHY:
Users need to prioritize and organize tickets within stages according to different criteria.

REQUIREMENTS:

SORT OPTIONS:
- Created date (newest first)
- Created date (oldest first)
- Updated date (newest first)
- Updated date (oldest first)
- Title (A-Z)
- Title (Z-A)
- Manual (custom order)

UI:
- Sort dropdown in board header
- Shows current sort option
- Icon indicator
- Applies to all stages
- Remember preference in localStorage

MANUAL SORTING:
- Add sortOrder field to tickets
- Save order on drag-drop
- Maintain order within stage
- Preserve across sessions

AUTOMATIC SORTING:
- Disable drag-drop when auto-sort active
- Show "Drag disabled" message
- Switch to Manual to enable drag

SORT PERSISTENCE:
- Save preference locally
- Apply on page load
- Respect preference across sessions

INTERACTIONS:
- Sort applies immediately
- Smooth animations
- No layout shift
- Works with filters

ACCEPTANCE CRITERIA:
- All sort options work correctly
- Dropdown shows current sort
- Manual sort saves order
- Auto-sort disables drag
- Preference persists
- Works with active filters
- Animations smooth
- Mobile responsive

NON-GOALS:
- No per-stage sorting
- No multi-column sort
- No custom sort formulas
- No sort by priority
- No sort groups/sections
```

---

## Priority 4: GitHub Preparation

### 013-add-project-model

```
/specify

Add Project entity to organize tickets and prepare for multi-repo support.

WHAT:
Create a Project data model and associate all tickets with a default project.

WHY:
The vision requires workspace/project organization and GitHub repo connections. This is the foundation.

REQUIREMENTS:

DATA MODEL:
- Create Project model
- Fields: id, name, description, createdAt, updatedAt
- Add projectId to Ticket (foreign key, required)
- Create default project for existing tickets

DEFAULT PROJECT:
- Name: "ai-board"
- Description: "Default project"
- Auto-created on migration
- All existing tickets assigned to it

PROJECT DISPLAY:
- Show project name in board header
- Display as non-interactive text
- Include project description (tooltip/subtitle)

TICKET ASSOCIATION:
- All new tickets use current project
- Cannot change project (not implemented yet)
- Cascade delete (delete project → delete tickets)

ACCEPTANCE CRITERIA:
- Project model created
- Migration creates default project
- All existing tickets have projectId
- New tickets auto-assigned
- Project name shows in header
- No breaking changes
- Foreign key constraints work

NON-GOALS:
- No project switching UI
- No project creation UI
- No multi-project views
- No project settings
- No GitHub integration yet
- No project permissions
```

---

### 014-add-github-url-field

```
/specify

Add GitHub repository and PR URL fields to projects and tickets.

WHAT:
Store optional GitHub repository URLs on projects and PR/branch URLs on tickets.

WHY:
Prepare data model for future GitHub integration by storing repo and PR references.

REQUIREMENTS:

PROJECT LEVEL:
- Add githubRepoUrl field (text, nullable)
- Display in future project settings
- Format: https://github.com/owner/repo

TICKET LEVEL:
- Add githubPrUrl field (text, nullable)
- Add githubBranch field (text, nullable)
- Display in ticket detail modal
- Clickable links when present

URL VALIDATION:
- Must start with https://
- Must contain github.com
- Valid URL format
- Optional (can be empty)

DISPLAY:
- Show GitHub icon with links
- "Open in GitHub" links
- Open in new tab
- Show branch name if present
- Hide section if no URLs

MANUAL EDITING:
- Not in this feature
- Fields exist but not editable yet
- Prepare for future GitHub integration

ACCEPTANCE CRITERIA:
- Fields added to models
- Migration successful
- Links display when present
- Links open in new tab
- Validation works
- Empty state handled
- GitHub icon shown
- Mobile responsive

NON-GOALS:
- No GitHub API integration
- No automatic PR creation
- No live status sync
- No authentication
- No URL editing UI yet
- No webhooks
```

---

## Notes

**Feature Sizing**: All features 1-6 hours each
**Dependencies**: Listed in order of recommended implementation
**Format**: Ready to paste into `/specify` command
**Vision Alignment**: Features 009-014 prepare for spec-kit/GitHub integration

