# Projects - Functional Specification

## Purpose

Projects organize tickets into separate workspaces, each with its own Kanban board, settings, and team members. Users can manage multiple projects simultaneously and configure project-specific automation policies.

## Project Structure

### Project Information

Each project contains:

- **Name**: Project identifier and title
- **Description**: Brief explanation of project purpose (stored but not displayed on cards)
- **Deployment URL**: Optional URL for deployed project (with quick-copy functionality)
- **GitHub Repository**: GitHub owner and repository name
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
  - Ticket title (truncated with ellipsis if too long)
  - Relative timestamp ("Shipped 2h ago")
  - Checkmark icon indicating completion
  - "No tickets shipped yet" message when no shipped tickets exist
- Total ticket count across all stages

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

**Action Buttons**:
- "Import Project" button (with icon)
- "Create Project" button (with icon)
- Buttons visible but functionality varies by implementation

## Project Settings

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
