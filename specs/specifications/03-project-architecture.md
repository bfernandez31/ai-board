# Project Architecture

## Overview

This domain covers multi-project support and project-scoped operations. The system organizes tickets by project, each connected to a GitHub repository for workflow automation.

**Current Capabilities**:
- Multi-project organization
- Project-scoped kanban boards
- GitHub repository integration per project
- Project-scoped URLs and APIs

---

## Project Organization

**Purpose**: Users need to organize tickets by project, with each project representing a distinct GitHub repository. This enables multiple teams or products to use the same AI Board instance while maintaining data isolation.

### What It Does

The system organizes all tickets within projects:

**Project Structure**:
- Each project represents one GitHub repository
- Every ticket belongs to exactly one project
- Projects have name, description, and GitHub connection details
- Tickets cannot exist without a project

**GitHub Integration**:
- Each project maps to a GitHub repository (owner + repo name)
- Workflow automation targets the correct repository per project
- One project per repository (enforced by unique constraint)

**Data Isolation**:
- Tickets from different projects never intermix
- Board displays only current project's tickets
- APIs validate project context before operations

### Requirements

**Project Model**:
- Name: Human-readable project identifier
- Description: Optional project details (nullable)
- GitHub Owner: Repository owner (user or organization)
- GitHub Repo: Repository name
- Created and updated timestamps

**Relationships**:
- Project → Tickets (one-to-many)
- Unique constraint on (githubOwner, githubRepo) prevents duplicate repository connections
- Index on (githubOwner, githubRepo) for efficient lookups

**Default Project**:
- System creates default project during initialization
- Uses environment variables for GitHub details
- Idempotent seed operations (safe to run multiple times)

### Data Model

**Project Entity**:
- `id`: Unique identifier (integer)
- `name`: Project title
- `description`: Optional details (text, nullable)
- `githubOwner`: GitHub repository owner
- `githubRepo`: GitHub repository name
- `clarificationPolicy`: Default clarification policy for all tickets (enum: AUTO/CONSERVATIVE/PRAGMATIC/INTERACTIVE, NOT NULL, default: AUTO)
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp
- **Unique**: (githubOwner, githubRepo)
- **Index**: (githubOwner, githubRepo)

**Ticket Relationship**:
- `projectId`: Required foreign key to Project.id
- **Index**: projectId for query performance
- **Cascade Delete**: Deleting project removes all its tickets

---

## Project-Scoped Operations

**Purpose**: All ticket operations must occur within a project context. URLs and APIs explicitly include project identifiers to prevent cross-project data access and make the architecture clear.

### What It Does

The system enforces project context in all operations:

**URL Structure**:
- **Root**: `/` redirects to `/projects/1/board` (default project)
- **Board**: `/projects/{projectId}/board`
- **All Routes**: Include project ID in path

**API Structure**:
- **Tickets**: `/api/projects/{projectId}/tickets`
- **Single Ticket**: `/api/projects/{projectId}/tickets/{id}`
- **All Endpoints**: Project-scoped with validation

**Validation & Security**:
- Project existence checked before any operation
- Ticket ownership validated (ticket.projectId must match URL projectId)
- Cross-project access blocked with 403 errors
- Invalid project IDs return 404 errors

**Automatic Project Assignment**:
- New tickets automatically assigned to current project from URL
- No project selector needed (derived from context)
- Project context maintained throughout all operations

### Requirements

**URL Structure**:
- Board pages include project ID: `/projects/{projectId}/board`
- Root URL redirects to default project board
- All routes explicitly project-scoped

**API Validation**:
- Verify project exists before processing requests
- Verify ticket belongs to specified project
- Return 404 for non-existent projects
- Return 403 for cross-project access attempts
- Return 404 for invalid project IDs

**Data Operations**:
- All ticket queries filtered by project ID
- New tickets automatically assigned to current project
- Ticket updates validated against project context
- Project context never requires re-specification

**Error Responses**:
- 404: Project not found or invalid project ID
- 403: Ticket doesn't belong to specified project

### Data Model

**URL Pattern**:
```
/projects/{projectId}/board
/api/projects/{projectId}/tickets
/api/projects/{projectId}/tickets/{id}
```

**Validation Flow**:
1. Extract projectId from URL
2. Verify project exists
3. For ticket operations: verify ticket.projectId == URL projectId
4. Proceed with operation or return error

---

## Current State Summary

### Available Features

**Project Management**:
- ✅ Multi-project organization
- ✅ GitHub repository integration per project
- ✅ Unique repository constraint (one project per repo)
- ✅ Default project auto-creation
- ✅ Idempotent seed operations

**Data Isolation**:
- ✅ Project-scoped URLs
- ✅ Project-scoped APIs
- ✅ Cross-project access protection
- ✅ Automatic project assignment for new tickets
- ✅ Cascade delete (project deletion removes all tickets)

**Validation**:
- ✅ Project existence verification
- ✅ Ticket ownership validation
- ✅ Appropriate error codes (403, 404)

### User Workflows

**Accessing a Project Board**:
1. User navigates to `/` (root URL)
2. System redirects to `/projects/1/board` (default project)
3. User sees kanban board for project 1
4. All tickets belong to project 1

**Creating a Ticket**:
1. User on `/projects/3/board`
2. User clicks "+ New Ticket"
3. User enters title and description
4. System automatically assigns projectId=3
5. Ticket appears in project 3's board

**Cross-Project Protection**:
1. User attempts to access ticket #42 via `/projects/2/tickets/42`
2. Ticket #42 actually belongs to project 3
3. System returns 403 Forbidden error
4. Access denied (data isolation enforced)

### Business Rules

**Project**:
- Every ticket must belong to a project
- Each project maps to one GitHub repository
- Cannot have duplicate projects for same repository
- Deleting project deletes all its tickets

**Operations**:
- All routes and APIs are project-scoped
- Project context explicit in URLs
- New tickets inherit project from URL context
- Cross-project access blocked

**Default Behavior**:
- Root URL redirects to project 1
- MVP operates with single default project
- Project ID 1 is assumed default

### Technical Details

**Database**:
- PostgreSQL via Prisma ORM
- Foreign key: Ticket.projectId → Project.id
- Cascade delete behavior
- Unique constraint and index on (githubOwner, githubRepo)

**URL Routing**:
- Next.js 15 App Router
- Dynamic route segments: `[projectId]`
- Server-side validation of project context

**Initialization**:
- Seed creates default project with environment variables
- `GITHUB_OWNER` and `GITHUB_REPO` for default project
- Idempotent: safe to run seeds multiple times
