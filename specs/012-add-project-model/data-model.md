# Data Model: Project

**Feature**: 012-add-project-model
**Date**: 2025-10-04

## Entity Overview

The Project model represents a GitHub repository connection for organizing tickets and enabling workflow automation.

## Entity: Project

### Purpose
Organize tickets by GitHub repository and provide repository connection details for automated GitHub operations (branch creation, PR management, etc.).

### Fields

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| id | Int | Primary Key, Auto-increment | Unique project identifier |
| name | String(100) | Required | Human-readable project name |
| description | String(1000) | Required | Project description or purpose |
| githubOwner | String(100) | Required | GitHub repository owner (user or org) |
| githubRepo | String(100) | Required | GitHub repository name |
| createdAt | DateTime | Auto-generated | Project creation timestamp |
| updatedAt | DateTime | Auto-updated | Last modification timestamp |

### Relationships

| Relationship | Type | Target Entity | Constraint |
|--------------|------|---------------|------------|
| tickets | One-to-Many | Ticket | Cascade delete when project deleted |

### Constraints

1. **Unique Constraint**: `(githubOwner, githubRepo)`
   - Purpose: Prevent duplicate projects for the same GitHub repository
   - Enforcement: Database level
   - Error: Unique constraint violation if duplicate attempted

2. **Foreign Key**: `Ticket.projectId → Project.id`
   - Purpose: Ensure every ticket belongs to a valid project
   - Enforcement: Database level with cascade delete
   - Behavior: Deleting a project deletes all associated tickets

### Indexes

1. **Composite Index**: `[githubOwner, githubRepo]`
   - Purpose: Optimize queries for finding projects by repository
   - Performance: Enables <10ms lookups for project by repository
   - Use Cases: GitHub workflow integration, repository validation

2. **Auto Index**: `id` (primary key)
   - Purpose: Standard primary key index
   - Performance: O(log n) lookups by project ID

## Entity: Ticket (Modified)

### New Fields

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| projectId | Int | Required, Foreign Key | Links ticket to parent project |

### New Relationships

| Relationship | Type | Target Entity | Constraint |
|--------------|------|---------------|------------|
| project | Many-to-One | Project | Required, Cascade on delete |

### New Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| projectId | [projectId] | Optimize queries for tickets by project |

## Validation Rules

### Project Creation
- **name**: Required, 1-100 characters, non-empty
- **description**: Required, 1-1000 characters, non-empty
- **githubOwner**: Required, 1-100 characters, valid GitHub username/org format
- **githubRepo**: Required, 1-100 characters, valid GitHub repo name format
- **Uniqueness**: (githubOwner, githubRepo) combination must not exist

### Ticket Creation (Updated)
- **projectId**: Required, must reference existing Project.id
- **Existing validations**: All previous ticket validations remain

### Environment Configuration
- **GITHUB_OWNER**: Required for seed operation, must match githubOwner format
- **GITHUB_REPO**: Required for seed operation, must match githubRepo format

## State Transitions

### Project Lifecycle
1. **Created**: Project created via migration/seed or API (future)
2. **Active**: Project exists and has associated tickets
3. **Deleted**: Project and all tickets cascade-deleted

### Default Project
- Created during initial seed with `name="ai-board"`
- Uses `GITHUB_OWNER` and `GITHUB_REPO` from environment
- Idempotent: Only created if not already exists

## Data Access Patterns

### Common Queries

1. **Find Project by Repository**
   ```typescript
   // Optimized by composite index [githubOwner, githubRepo]
   await prisma.project.findUnique({
     where: {
       githubOwner_githubRepo: { githubOwner, githubRepo }
     }
   });
   ```

2. **Get Project with Tickets**
   ```typescript
   // Uses foreign key relation
   await prisma.project.findUnique({
     where: { id: projectId },
     include: { tickets: true }
   });
   ```

3. **Get All Projects**
   ```typescript
   await prisma.project.findMany({
     orderBy: { updatedAt: 'desc' }
   });
   ```

4. **Get Tickets for Project**
   ```typescript
   // Optimized by projectId index
   await prisma.ticket.findMany({
     where: { projectId: projectId }
   });
   ```

### Performance Characteristics
- **Project lookup by repo**: O(log n) with composite index
- **Ticket lookup by project**: O(log n) with projectId index
- **Project creation**: O(1) single INSERT
- **Project deletion**: O(m) where m = ticket count (cascade delete)

## Migration Strategy

### Migration Order
1. Create Project table with all fields and constraints
2. Add projectId column to Ticket table (nullable temporarily)
3. Create default project via seed
4. Backfill existing tickets with default projectId
5. Make Ticket.projectId required (non-nullable)
6. Add foreign key constraint and indexes

### Seed Operation
```typescript
// Idempotent seed logic
1. Check if project exists (githubOwner, githubRepo)
2. If exists: Log and skip creation
3. If not exists: Create with environment variables
4. Result: Exactly one default project
```

### Rollback Strategy
- Migration rollback removes Project table
- Foreign key cascade ensures referential integrity
- Tickets become orphaned (acceptable for rollback scenario)

## Data Integrity

### Referential Integrity
- Every ticket MUST have valid projectId (foreign key)
- Deleting project CASCADE deletes all tickets
- No orphaned tickets possible

### Constraint Enforcement
- Unique constraint prevents duplicate repositories
- Foreign key prevents invalid projectId values
- NOT NULL prevents missing required fields

### Audit Trail
- createdAt: Immutable creation timestamp
- updatedAt: Automatically updated on changes
- Enables tracking when projects added/modified

## Future Extensibility

### Planned Additions (Not in This Feature)
- **githubToken**: Encrypted GitHub API token (security concern)
- **settings**: JSON field for project-specific settings
- **archived**: Soft delete support for inactive projects
- **teamId**: Multi-tenant support with team ownership

### Compatibility Considerations
- Schema designed to support multiple projects
- Repository lookup optimized for future GitHub API integration
- Foreign key supports future project-level permissions
- Audit timestamps support future change tracking features
