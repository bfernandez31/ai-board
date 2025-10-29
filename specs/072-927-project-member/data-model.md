# Data Model: Project Member Authorization

**Feature**: Project Member Authorization
**Branch**: `072-927-project-member`
**Date**: 2025-10-29

## Overview

This document describes the data model changes and relationships for project member authorization. **No database migration is required** - the ProjectMember schema already exists. This document clarifies how existing entities interact during authorization.

## Entity Relationship Diagram

```
┌─────────────────┐
│      User       │
│                 │
│ - id: String    │
│ - email: String │
│ - name: String? │
└────┬────────┬───┘
     │        │
     │        │ memberships (ProjectMember[])
     │        │
     │        ▼
     │   ┌─────────────────────┐
     │   │  ProjectMember      │
     │   │                     │
     │   │ - id: Int           │
     │   │ - projectId: Int ◄──┼─────┐
     │   │ - userId: String    │     │
     │   │ - role: String      │     │
     │   │   (default: "member"│     │
     │   │    unused in v1)    │     │
     │   └─────────────────────┘     │
     │                               │
     │ projects (owner)              │ members
     │                               │
     ▼                               │
┌─────────────────────┐             │
│      Project        │◄────────────┘
│                     │
│ - id: Int           │
│ - name: String      │
│ - userId: String    │ (owner)
│ - githubOwner: Str  │
│ - githubRepo: String│
└──────┬──────────────┘
       │
       │ tickets
       │
       ▼
┌─────────────────────┐
│      Ticket         │
│                     │
│ - id: Int           │
│ - title: String     │
│ - projectId: Int    │
│ - stage: Stage      │
│ - branch: String?   │
└─────────────────────┘
```

## Entities

### User (No Changes)

Represents an authenticated user who can own projects or be a member of projects.

**Attributes**:
- `id` (String, PK): Unique identifier from NextAuth
- `email` (String, unique, indexed): User email address
- `name` (String?, nullable): Display name
- `emailVerified` (DateTime?, nullable): Email verification timestamp
- `createdAt` (DateTime): Account creation timestamp
- `updatedAt` (DateTime): Last modification timestamp

**Relationships**:
- `projects` (Project[]): Projects owned by this user (Project.userId)
- `memberships` (ProjectMember[]): Projects where user is a member (ProjectMember.userId)
- `sessions` (Session[]): Active NextAuth sessions
- `accounts` (Account[]): OAuth provider accounts
- `comments` (Comment[]): Comments authored by user

**Indexes**:
- `@@index([email])` - Fast lookup by email

**Authorization Role**:
- Session contains `user.id` for authorization checks
- User can access project if: `project.userId === user.id` OR `project.members.some(m => m.userId === user.id)`

---

### ProjectMember (No Changes - Already Exists)

Represents a user's membership in a project. Grants non-owner users access to project resources.

**Attributes**:
- `id` (Int, PK, autoincrement): Primary key
- `projectId` (Int, FK → Project.id): Project this membership belongs to
- `userId` (String, FK → User.id): User who is a member
- `role` (String, default "member", max 20 chars): Role name (currently unused for authorization)
- `createdAt` (DateTime): Membership creation timestamp

**Relationships**:
- `project` (Project): The project this membership belongs to
  - Foreign key: `projectId → Project.id`
  - Delete cascade: Deleting project removes all memberships
- `user` (User): The user who is a member
  - Foreign key: `userId → User.id`
  - Delete cascade: Deleting user removes all memberships

**Constraints**:
- `@@unique([projectId, userId])` - One membership per user per project
- `onDelete: Cascade` - Orphaned memberships auto-deleted

**Indexes**:
- `@@index([projectId])` - Fast lookup of members by project
- `@@index([userId])` - Fast lookup of projects by user

**Authorization Role**:
- Existence of ProjectMember record grants access to project
- `role` field exists but is **not used** for authorization in this iteration (future enhancement)
- All members have equal read-write access within a project

**Note**: The `role` field was designed for future RBAC but is not implemented yet. Current authorization is binary: owner or member.

---

### Project (No Schema Changes)

Represents a collaborative workspace with tickets.

**Attributes** (authorization-relevant):
- `id` (Int, PK, autoincrement): Primary key
- `name` (String, max 100 chars): Project name
- `userId` (String, FK → User.id): Owner of the project
- `githubOwner` (String): GitHub repository owner
- `githubRepo` (String): GitHub repository name
- `clarificationPolicy` (ClarificationPolicy enum, default AUTO): Spec generation policy
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last modification timestamp

**Relationships**:
- `user` (User): Owner of the project
  - Foreign key: `userId → User.id`
  - Delete cascade: Deleting owner deletes project
- `members` (ProjectMember[]): Non-owner users with access
  - Relation: `ProjectMember.projectId → Project.id`
- `tickets` (Ticket[]): Tickets in this project

**Indexes**:
- `@@index([userId])` - Fast lookup of projects by owner
- `@@index([githubOwner, githubRepo])` - Fast lookup by GitHub repo
- `@@unique([githubOwner, githubRepo])` - One project per GitHub repo

**Authorization Logic**:
```typescript
// Prisma query for "owner OR member" access
const project = await prisma.project.findFirst({
  where: {
    id: projectId,
    OR: [
      { userId: sessionUserId },                    // Owner access
      { members: { some: { userId: sessionUserId } } } // Member access
    ]
  }
});
```

**Owner-Only Actions**:
- Delete project (`DELETE /api/projects/:id` - not yet implemented)
- Add/remove members (`POST/DELETE /api/projects/:id/members`)
- Update project settings (name, GitHub repo, clarification policy)

**Owner OR Member Actions**:
- View project board (`GET /projects/:id/board`)
- List tickets (`GET /api/projects/:id/tickets`)
- Create tickets (`POST /api/projects/:id/tickets`)
- Update tickets (`PATCH /api/projects/:id/tickets/:ticketId`)
- Delete tickets (`DELETE /api/projects/:id/tickets/:ticketId`)
- Transition ticket stages (`POST /api/projects/:id/tickets/:ticketId/transition`)
- Add comments (`POST /api/projects/:id/tickets/:ticketId/comments`)
- Upload images (`POST /api/projects/:id/tickets/:ticketId/images`)
- View job status (`GET /api/projects/:id/jobs/status`)

---

### Ticket (No Schema Changes)

Represents a work item within a project. Access inherited from parent project.

**Attributes** (authorization-relevant):
- `id` (Int, PK, autoincrement): Primary key
- `title` (String, max 100 chars): Ticket title
- `description` (String, max 2500 chars): Ticket description
- `stage` (Stage enum): Workflow stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- `projectId` (Int, FK → Project.id): Parent project
- `branch` (String?, max 200 chars, nullable): Git branch name
- `workflowType` (WorkflowType enum, default FULL): FULL or QUICK workflow
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last modification timestamp

**Relationships**:
- `project` (Project): Parent project
  - Foreign key: `projectId → Project.id`
  - Delete cascade: Deleting project deletes tickets
- `comments` (Comment[]): Comments on this ticket
- `jobs` (Job[]): Workflow jobs for this ticket

**Indexes**:
- `@@index([projectId])` - Fast lookup of tickets by project
- `@@index([stage])` - Fast lookup by workflow stage
- `@@index([projectId, workflowType])` - Composite index for filtered queries

**Authorization Logic**:
```typescript
// Prisma query for ticket access via project membership
const ticket = await prisma.ticket.findFirst({
  where: {
    id: ticketId,
    project: {
      OR: [
        { userId: sessionUserId },                    // Owner access
        { members: { some: { userId: sessionUserId } } } // Member access
      ]
    }
  }
});
```

**Authorization Inheritance**:
- Ticket authorization is **project-scoped** (not ticket-scoped)
- If user has access to project, user has access to all tickets in project
- No per-ticket permission checks needed

---

### Comment (No Schema Changes)

Represents a comment on a ticket. Access inherited from parent project via ticket.

**Attributes** (authorization-relevant):
- `id` (Int, PK, autoincrement): Primary key
- `ticketId` (Int, FK → Ticket.id): Parent ticket
- `userId` (String, FK → User.id): Comment author
- `content` (String, max 2000 chars): Comment text (supports Markdown, mentions)
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last modification timestamp

**Relationships**:
- `ticket` (Ticket): Parent ticket
  - Foreign key: `ticketId → Ticket.id`
  - Delete cascade: Deleting ticket deletes comments
- `user` (User): Comment author
  - Foreign key: `userId → User.id`
  - Delete cascade: Deleting user deletes their comments

**Indexes**:
- `@@index([ticketId, createdAt])` - Fast lookup of comments by ticket (chronological)
- `@@index([userId])` - Fast lookup of comments by author

**Authorization Logic**:
```typescript
// Comment access validated via ticket → project chain
const comment = await prisma.comment.findFirst({
  where: {
    id: commentId,
    ticket: {
      project: {
        OR: [
          { userId: sessionUserId },                    // Owner access
          { members: { some: { userId: sessionUserId } } } // Member access
        ]
      }
    }
  }
});
```

**Authorization Inheritance**:
- Comment authorization is **project-scoped** via ticket
- If user has access to project, user can read/write comments on all tickets
- Comment author field is informational only (not used for authorization)

---

### Job (No Schema Changes)

Represents a GitHub Actions workflow job. Access inherited from parent project via ticket.

**Attributes** (authorization-relevant):
- `id` (Int, PK, autoincrement): Primary key
- `ticketId` (Int, FK → Ticket.id): Parent ticket
- `projectId` (Int, FK → Project.id): Parent project (denormalized for query performance)
- `command` (String, max 50 chars): Workflow command (specify, plan, implement, etc.)
- `status` (JobStatus enum): PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- `branch` (String?, max 200 chars, nullable): Git branch name
- `startedAt` (DateTime): Job start timestamp
- `completedAt` (DateTime?, nullable): Job completion timestamp

**Relationships**:
- `ticket` (Ticket): Parent ticket
  - Foreign key: `ticketId → Ticket.id`
  - Delete cascade: Deleting ticket deletes jobs

**Indexes**:
- `@@index([projectId])` - Fast lookup of jobs by project (for polling)
- `@@index([ticketId])` - Fast lookup of jobs by ticket
- `@@index([status])` - Fast lookup by job status
- `@@index([ticketId, status, startedAt])` - Composite index for polling queries

**Authorization Logic**:
```typescript
// Job polling endpoint uses denormalized projectId for performance
const jobs = await prisma.job.findMany({
  where: {
    projectId,
    // Assumes project access already validated at route handler level
  }
});
```

**Authorization Inheritance**:
- Job authorization is **project-scoped** (via denormalized `projectId`)
- Route handler validates project access first, then queries jobs
- No per-job permission checks needed (performance optimization)

---

## Authorization Patterns

### Pattern 1: Project-Level Authorization

**Use Case**: Board page, project settings, member management

**Implementation**:
```typescript
// lib/db/auth-helpers.ts
export async function verifyProjectAccess(projectId: number) {
  const userId = await requireAuth();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },                            // Owner access
        { members: { some: { userId } } }      // Member access
      ]
    },
    select: {
      id: true,
      name: true,
      githubOwner: true,
      githubRepo: true,
      clarificationPolicy: true,
    }
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}
```

**Error Handling**:
- API routes: Catch error, return 403 Forbidden
- SSR pages: Catch error, return 404 Not Found (don't leak project existence)

---

### Pattern 2: Ticket-Level Authorization (via Project)

**Use Case**: Ticket CRUD, comments, images, timeline

**Implementation**:
```typescript
// lib/db/auth-helpers.ts
export async function verifyTicketAccess(ticketId: number) {
  const userId = await requireAuth();

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      project: {
        OR: [
          { userId },                          // Owner access
          { members: { some: { userId } } }    // Member access
        ]
      }
    }
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  return ticket;
}
```

**Performance Note**: Single query validates both ticket existence and project access. No N+1 queries.

---

### Pattern 3: Owner-Only Authorization

**Use Case**: Member management, project deletion, project settings updates

**Implementation**:
```typescript
// lib/db/auth-helpers.ts
export async function verifyProjectOwnership(projectId: number) {
  const userId = await requireAuth();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,  // Owner-only (no OR condition)
    }
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}
```

**Note**: This function remains unchanged. Used only for owner-exclusive actions.

---

## State Transitions

### ProjectMember Lifecycle

```
[User invited] → (NONE - future feature)
       ↓
[ProjectMember created] → role: "member", createdAt: now()
       ↓
[User gains access] → Can access board, tickets, comments
       ↓
[ProjectMember deleted] → User loses access immediately (onDelete: Cascade)
       ↓
[Session still valid] → Next request fails authorization (no cached membership)
```

**Note**: No invitation workflow yet. ProjectMember records are created directly (e.g., via API or database seed).

---

## Validation Rules

### ProjectMember Validation

**Database Constraints**:
- `projectId` must reference existing Project.id (foreign key)
- `userId` must reference existing User.id (foreign key)
- `(projectId, userId)` must be unique (one membership per user per project)
- `role` max length: 20 characters

**Application Validation** (for future member management API):
```typescript
const ProjectMemberCreateSchema = z.object({
  projectId: z.number().int().positive(),
  userId: z.string().min(1),
  role: z.string().max(20).default('member'),
});
```

**Business Rules**:
- Cannot add project owner as member (redundant)
- Cannot add duplicate membership (unique constraint)
- Cannot add member to non-existent project (foreign key constraint)

---

## Performance Considerations

### Query Optimization

**Problem**: Membership validation adds JOIN to every authorized query

**Solution**: Optimize query patterns for common cases

1. **Check ownership first** (most projects accessed by owner):
   ```typescript
   // Fast path: Owner check (no JOIN)
   const isOwner = await prisma.project.findFirst({
     where: { id: projectId, userId }
   });
   if (isOwner) return isOwner;

   // Slow path: Member check (requires JOIN)
   const isMember = await prisma.project.findFirst({
     where: { id: projectId, members: { some: { userId } } }
   });
   return isMember;
   ```

2. **Use OR condition** (single query, database optimizes):
   ```typescript
   // Single query - PostgreSQL query planner optimizes
   const project = await prisma.project.findFirst({
     where: {
       id: projectId,
       OR: [
         { userId },
         { members: { some: { userId } } }
       ]
     }
   });
   ```

**Benchmarking**: Add performance tests to ensure <100ms p95 target

### Index Usage

**Existing Indexes** (no migration needed):
- `ProjectMember.@@index([projectId])` - Used for `members.some({ userId })` queries
- `ProjectMember.@@index([userId])` - Used for user's project list
- `Project.@@index([userId])` - Used for owner queries

**Query Plan** (conceptual):
1. Check `Project.userId` index → fast owner lookup
2. If not owner, JOIN ProjectMember via `projectId` index
3. Filter ProjectMember by `userId` using index

**No Additional Indexes Required**: Existing indexes support efficient authorization queries

---

## Migration Plan

### Phase 1: No Database Migration

- ProjectMember schema already exists (from previous feature)
- All foreign keys, indexes, and constraints already in place
- No Prisma migration file needed

### Phase 2: Code Migration (Authorization Helpers)

1. Create new functions: `verifyProjectAccess()`, `verifyTicketAccess()`
2. Update 22 API routes to use new functions
3. Update 1 SSR page to use new function
4. Add deprecation comments to old functions
5. Remove old functions in future release (after confirming no usage)

### Phase 3: Test Data Migration

- Add ProjectMember records to test fixtures (`tests/helpers/db-setup.ts`)
- Create test user: `member@e2e.local`
- Add member to test projects (ID 1, 2)

---

## Rollback Plan

### If Feature Needs to Be Reverted

1. **Code Rollback**:
   - Revert API routes to use `verifyProjectOwnership()` and `verifyTicketOwnership()`
   - No database rollback needed (ProjectMember schema can remain)

2. **Data Cleanup** (optional):
   - ProjectMember records can remain in database (ignored by old code)
   - No need to delete memberships for rollback

3. **Test Cleanup**:
   - Disable member authorization tests (mark as `.skip()`)
   - Existing owner-only tests continue to pass

**No Breaking Changes**: Rollback is safe because ProjectMember schema already exists and old code ignores it.

---

## Future Enhancements (Out of Scope)

### Role-Based Access Control (RBAC)

**Current State**: ProjectMember.role field exists but is unused
**Future State**: Use role field for granular permissions

**Potential Roles**:
- `admin`: Full access (same as owner but cannot delete project)
- `member`: Read-write access (current implementation)
- `viewer`: Read-only access (future enhancement)

**Implementation Path**:
1. Define role enum in Prisma schema
2. Create permission matrix (role → actions)
3. Update authorization helpers to check role
4. Add role selection in member management UI

**Backward Compatibility**: Existing members default to `role: "member"` (current behavior)

### Invitation Workflow

**Current State**: ProjectMember records created directly (API or seed)
**Future State**: Invite users via email with acceptance flow

**Implementation Path**:
1. Create Invitation model (email, token, expiresAt)
2. Send invitation email with link
3. User accepts → create ProjectMember record
4. Add invitation management endpoints

---

## References

- Feature Specification: `specs/072-927-project-member/spec.md`
- Prisma Schema: `prisma/schema.prisma`
- Existing Auth Helpers: `lib/db/auth-helpers.ts`
- Constitution: `.specify/memory/constitution.md` (Principle V: Database Integrity)
