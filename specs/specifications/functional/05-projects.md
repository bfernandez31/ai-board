# Projects - Functional Specification

## Purpose

Projects organize tickets into separate workspaces, each with its own Kanban board, settings, and team members. Users can manage multiple projects simultaneously and configure project-specific automation policies.

## Project Structure

### Project Information

Each project contains:

- **Name**: Project identifier and title
- **Key**: Unique 3-character identifier (e.g., "ABC", "DEF")
  - Uppercase alphanumeric format
  - Generated from project name or provided by user
  - Used as prefix for all ticket keys in the project
  - Immutable after project creation
- **Description**: Brief explanation of project purpose (stored but not displayed on cards)
- **Deployment URL**: Optional URL for deployed project (with quick-copy functionality)
- **GitHub Repository**: Required GitHub owner and repository name
  - **GitHub Owner**: Organization or user name (e.g., "bfernandez31")
  - **GitHub Repo**: Repository name (e.g., "ai-board", "my-project")
  - Used for workflow automation and code management
  - Workflows execute on external project repositories
- **Default Clarification Policy**: How AI resolves ambiguities during specification
- **Creation Timestamp**: When project was created
- **Last Updated**: Most recent activity across all tickets

### Project-Ticket Relationship

- Each project contains multiple tickets
- Each ticket belongs to exactly one project
- Tickets cannot move between projects
- Deleting a project removes all its tickets

## Project List View

### Viewing All Projects

Users access projects through a dedicated projects list page:

**Display Information**:
- Project name
- Deployment URL (if configured, with copy-to-clipboard functionality)
- GitHub repository link (if configured, displayed as "owner/repo")
- Latest shipped ticket information:
  - Ticket key (bold, e.g., "ABC-123") followed by ticket title with checkmark icon
  - Full text truncated with ellipsis if too long
  - Tooltip on hover shows complete "ticketKey + title" text
  - Metadata displayed below ticket title:
    - Relative timestamp ("Shipped 2h ago")
    - Total ticket count across all stages ("· 5 total")
  - "No tickets shipped yet" message when no shipped tickets exist

**Visual Design**:
- Modern and clean interface
- Scrollable container for many projects (50+)
- No pagination - all projects visible
- Compact card layout with clear information hierarchy

**Interaction**:
- Hover over project shows scale/transform effect
- Cursor changes to pointer indicating clickability
- Click project navigates to project board
- Click deployment URL opens in current tab (does not trigger card navigation)
- Click GitHub link opens repository in new tab (does not trigger card navigation)
- Click copy icon copies deployment URL to clipboard without triggering navigation
- Visual feedback on successful copy action (icon change or tooltip)

**Smart Display**:
- Deployment URL section hidden when not configured (no empty placeholder)
- GitHub link section hidden when not configured
- Full ticket title visible via tooltip on hover for truncated titles
- Relative timestamps update on page refresh

### Empty State

When no projects exist:
- Message indicates no projects are available
- Call-to-action encourages creating first project
- Clear path to project creation

### Navigation

**To Project Board**:
- Click any project card (except interactive elements)
- Redirects to project's Kanban board
- URL format: `/projects/{projectId}/board`

**To Ticket Details**:
- Access tickets via clean, human-readable URLs
- URL format: `/browse/{TICKET_KEY}` (e.g., `/browse/ABC-123`)
- Ticket keys clearly indicate which project they belong to
- URLs are stable and shareable (bookmarks, external links)

**Action Buttons**:
- "Import Project" button (with icon)
- "Create Project" button (with icon)
- Buttons visible but functionality varies by implementation

**Responsive Layout**:
- **Desktop** (≥640px): Page header displays title and action buttons in a horizontal row
  - Title aligned left
  - Buttons aligned right
  - All elements share same horizontal line
- **Mobile** (<640px): Page header stacks vertically
  - Title appears first (full width)
  - Action buttons stack below title
  - Buttons arrange vertically for easy thumb access
  - Maintains consistent spacing and readability

**Project Card Grid**:
- **Desktop** (≥1024px): 3-column grid layout (grid-cols-3)
- **Tablet** (640px - 1023px): 2-column grid layout (grid-cols-2)
- **Mobile** (<640px): 1-column layout (grid-cols-1, full width cards)
- Cards maintain consistent spacing and visual hierarchy across all breakpoints
- Scrollable container supports 50+ projects without performance degradation

**Text Overflow Handling**:
- Long ticket titles truncate with ellipsis to prevent card overflow
- Tooltip displays full ticket title on hover (format: "ticketKey + title")
- GitHub repository links displayed as "owner/repo" format
- Deployment URLs show hostname only (e.g., "example.vercel.app")
- All text content uses `min-w-0` and `truncate` utilities to prevent horizontal scroll
- Cards maintain fixed width boundaries on mobile viewports (375px minimum)

## Project Settings

### Settings Page Navigation

**Access**:
- Settings page accessible from project menu or direct URL `/projects/{projectId}/settings`
- Available to project owners and members

**Page Layout**:
- Header displays "Project Settings" title with project name
- "Back to Board" button in top-right corner of settings header
- Button displays left arrow icon with "Back to Board" text
- Navigates to `/projects/{projectId}/board`
- Outline variant styling for secondary action appearance

### Constitution Management

Projects include a constitution document that defines development guidelines, testing requirements, and governance rules:

**Purpose**:
- Documents project-specific principles and standards
- Provides AI agents with project context and rules
- Maintains consistency across all tickets
- Enables team alignment on development practices

**Constitution Location**:
- Stored at `.specify/memory/constitution.md` in project repository
- Markdown format for human and AI readability
- Version-controlled alongside project code

**Viewing Constitution**:
- Accessible via "Constitution" button in project settings
- Opens modal viewer with markdown rendering
- Supports all standard markdown elements (headers, code blocks, tables, lists)
- Same rendering quality as ticket documentation viewer

**Editing Constitution**:
- Edit mode with raw markdown textarea
- Save commits changes to repository with descriptive message
- Unsaved changes warning prevents accidental data loss
- Markdown syntax validation before save
- Available to project owners and members

**Constitution History**:
- View chronological commit history
- See author, date, and commit message for each change
- Diff view shows additions (green) and deletions (red)
- Provides transparency and audit trail for governance changes

**Access Control**:
- View and edit permissions follow project access model
- Available to project owners and members
- Uses same authorization as other project settings

**Error Handling**:
- Clear message when constitution file doesn't exist
- User-friendly errors for network or API issues
- Preserves unsaved edits on save failure for retry

### Clarification Policy Configuration

Projects have a configurable default clarification policy:

**Purpose**:
- Determines how AI resolves ambiguities during specification generation
- Applies to all new tickets unless overridden
- Reduces need for ticket-level configuration

**Available Policies**:

1. **AUTO (🤖 Context-Aware)**:
   - Analyzes feature description for keywords
   - Chooses CONSERVATIVE for sensitive features
   - Chooses PRAGMATIC for internal tools
   - Documents detection in generated specifications

2. **CONSERVATIVE (🛡️ Security-First)**:
   - Prioritizes security and long-term quality
   - Strict validation and error handling
   - Suitable for customer-facing features
   - Appropriate for financial or compliance features

3. **PRAGMATIC (⚡ Speed-First)**:
   - Prioritizes simplicity and fast delivery
   - Permissive validation with smart defaults
   - Suitable for internal tools
   - Appropriate for prototypes and MVPs

**Configuration**:
- Accessible from project settings page
- Dropdown select with policy options
- Help text explains each policy philosophy
- Changes apply to future tickets only (no retroactive effect)

**Default Behavior**:
- New projects default to AUTO policy
- Provides reasonable defaults without configuration
- Users can change at any time

## User-Project Relationship

### Project Ownership

- Every project has one owner (the user who created it)
- User ID is required when creating projects
- Owner has full administrative access to the project

### Project Membership

**Member Access**:
- Projects can have multiple members (collaborators)
- Members can access the project board and all tickets
- Members have read-write access (create, update, comment on tickets)
- Members can transition tickets through workflow stages
- Members cannot delete projects or manage other members (owner-only)

**Access Control**:
- Users can access projects they own OR projects they are members of
- Authorization checks validate "owner OR member" relationship
- Cross-user access (neither owner nor member) returns permission error
- Project ownership check is performed first for performance optimization

**Ticket Access**:
- Project members can view/modify all tickets in the project
- Ticket operations require project ownership OR membership
- Authorization validated on every request
- No per-ticket permission differences between owner and members

### AI-BOARD Membership

**Automatic Membership**:
- AI-BOARD user automatically added to all new projects
- Added as standard "member" role
- Enables @ai-board mentions in all tickets
- Created atomically with project (transaction integrity)

**Member Role**:
- AI-BOARD has same permissions as regular members
- Can be mentioned in comments
- Posts comments as responses to mentions
- Does not have admin or owner privileges

## Project Persistence

### Data Storage

All project data persists automatically:
- Project settings save immediately on change
- Ticket count updates as tickets are created/deleted
- Last updated timestamp updates on any activity

### Data Integrity

**Referential Integrity**:
- Projects must have a valid user ID (owner)
- Tickets must reference existing project ID
- Foreign key constraints enforce relationships

**Cascade Behavior**:
- Deleting project removes all associated tickets
- Deleting project removes all ticket comments
- Deleting user removes all their projects

## Multi-Project Workflows

### Context Switching

Users working across multiple projects:
- Navigate between projects via project list
- Each project maintains separate board state
- Tickets isolated within projects
- No cross-project ticket visibility

### Project-Level Policies

Settings configured at project level:
- Clarification policy applies to all project tickets
- Individual tickets can override project settings
- Policy inheritance provides consistent defaults

### Activity Tracking

Projects track activity across all tickets:
- Last updated reflects most recent ticket change
- Ticket count shows total across all stages
- Activity visible in project list view

## Project Actions

### Clean Project

Users can trigger automated cleanup of technical debt accumulated from shipped features:

**Menu Access**:
- Project menu contains "Clean Project" option (Sparkles icon)
- Available to project owners and members

**Cleanup Prerequisites**:
- At least one ticket shipped since last cleanup
- No cleanup currently in progress
- System validates prerequisites before allowing trigger

**Cleanup Behavior**:
- Creates cleanup ticket directly in BUILD stage
- Ticket title format: "Clean YYYY-MM-DD"
- Ticket workflowType set to CLEAN
- Applies project-level transition lock

**Transition Lock During Cleanup**:
- All ticket stage transitions blocked during cleanup
- Content updates still allowed (descriptions, comments, previews)
- Warning banner displayed at top of board
- Lock automatically released when cleanup completes

**Blocked Cleanup**:
- Already running: Shows error about active cleanup
- No changes: Shows last cleanup date and explains nothing to clean

For detailed cleanup workflow behavior, see [Automation - Cleanup Workflow](./04-automation.md#cleanup-workflow).

### Project Analytics

Users can access comprehensive analytics dashboard to visualize AI workflow metrics and track project performance:

**Menu Access**:
- Project menu contains "Analytics" option (with Chart icon)
- Available to project owners and members
- Navigates to `/projects/{projectId}/analytics`

**Dashboard Features**:
- **Overview Cards**: Display total cost, success rate, average job duration, and tickets shipped (current month)
  - Card titles displayed in white text for optimal contrast against dark background
- **Cost Over Time**: Area chart showing cost trends with selectable time ranges (7d, 30d, 90d, all time)
  - Chart title displayed in white text for improved readability
- **Cost by Stage**: Horizontal bar chart breaking down cost across SPECIFY, PLAN, BUILD, VERIFY stages
  - Chart title displayed in white text for improved readability
- **Token Usage**: Chart showing input tokens, output tokens, and cache tokens
  - Chart title displayed in white text for improved readability
- **Cache Efficiency**: Ring/donut chart displaying cache savings percentage
  - Chart title displayed in white text for improved readability
- **Top Tools**: Horizontal bar chart ranking most-used AI tools (Edit, Read, Bash, etc.)
  - Chart title displayed in white text for improved readability
- **Workflow Distribution**: Donut chart showing proportion of FULL, QUICK, and CLEAN workflows
  - Chart title displayed in white text for improved readability
- **Velocity**: Bar chart displaying tickets shipped per week
  - Chart title displayed in white text for improved readability

**Time Range Selection**:
- Preset options: 7 days, 30 days, 90 days, all time
- Default: 30-day view
- Charts auto-adjust granularity (daily for <30 days, weekly for ≥30 days)

**Empty States**:
- Friendly empty states with guidance when no job data exists
- Encourages users to create their first workflow

**Data Updates**:
- Polling-based refresh every 15 seconds
- Automatically reflects new job completions

**Access Control**:
- Only project owners and members can view analytics
- Analytics scoped to single project (no cross-project visibility)

**Navigation**:
- "Back to Board" button in analytics page header (top-right)
- Button displays left arrow icon with "Back to Board" text
- Navigates to `/projects/{projectId}/board`
- Outline variant styling for secondary action appearance

## External Repository Support

### Multi-Repository Architecture

AI-Board supports managing tickets for external GitHub repositories:

**Repository Configuration**:
- Each project linked to a specific GitHub repository
- GitHub owner and repository name required during project creation
- Workflows execute against the configured external repository
- AI-Board workflows centralized in ai-board repository

**Workflow Execution**:
- GitHub Actions workflows defined in ai-board repository
- Workflows checkout external project repository for operations
- Claude executes commands in context of external project
- Changes committed and pushed to external project branches

**Requirements**:
- External projects must contain required AI-Board configuration:
  - ai-board plugin (as git submodule) for Claude command definitions
  - `.specify/scripts/bash/` directory with automation scripts
  - Test configuration files (if workflows use tests)
- GitHub Personal Access Token (PAT) with repo access
- PAT configured as `GH_PAT` secret in ai-board repository

**Workflow Authentication**:
- AI-Board uses GitHub PAT to access external repositories
- PAT must have `repo` scope for full repository access
- Same PAT used for all external projects (centralized secrets)

**Benefits**:
- Centralized workflow management in ai-board
- No need to configure workflows in each project
- Consistent automation across all managed projects
- Easy onboarding of new projects
