# Data Model: Drag and Drop Ticket to Trash

**Feature Branch**: `084-1500-drag-and`
**Created**: 2025-11-04

## Overview

This feature does NOT introduce new database entities or schema changes. It operates on existing `Ticket`, `Job`, `Project`, and `ProjectMember` entities using standard deletion operations with cascading foreign key constraints.

---

## Existing Entities (No Changes)

### Ticket

**Purpose**: Primary entity being deleted through trash zone interaction.

**Relevant Fields**:
- `id` (Int, PK): Unique identifier
- `ticketKey` (String, UNIQUE): Human-readable key (e.g., "ABC-123")
- `projectId` (Int, FK → Project): Project ownership
- `stage` (Stage enum): Current workflow stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- `branch` (String?, nullable): Associated Git branch name (nullable, max 200 chars)
- `previewUrl` (String?, nullable): Active preview deployment URL (orphaned after deletion)
- `title` (String): Ticket title
- `description` (String): Ticket description
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last modification timestamp

**Relationships**:
- Ticket → Project (many-to-one, required)
- Ticket → Job[] (one-to-many, cascade delete)
- Ticket → Comment[] (one-to-many, cascade delete)

**Validation Rules** (for deletion):
- Cannot delete if `stage === 'SHIP'` (business rule)
- Cannot delete if any related Job has `status IN ('PENDING', 'RUNNING')` (concurrency protection)
- Authorization: User must be project owner or member (via `verifyTicketAccess()`)

**Deletion Behavior**:
- Permanent deletion (NOT soft delete)
- Cascade deletes all related Jobs and Comments via foreign key constraints
- Branch and PR cleanup occurs BEFORE database deletion (transactional)

---

### Job

**Purpose**: Tracks workflow execution status; prevents deletion when jobs are active.

**Relevant Fields**:
- `id` (Int, PK): Unique identifier
- `ticketId` (Int, FK → Ticket): Associated ticket
- `projectId` (Int, FK → Project): Associated project
- `status` (JobStatus enum): PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- `command` (String): Command that created the job (e.g., "specify", "plan", "implement")
- `createdAt` (DateTime): Job creation timestamp

**Validation Rules** (for deletion eligibility):
- Active job check: `WHERE ticketId = ? AND status IN ('PENDING', 'RUNNING')`
- If active jobs exist → Block deletion, show error message

**Deletion Behavior**:
- Jobs cascade-deleted when parent Ticket is deleted (FK constraint)
- No orphaned jobs remain after ticket deletion

---

### Project

**Purpose**: Contains GitHub repository information needed for branch/PR deletion.

**Relevant Fields**:
- `id` (Int, PK): Unique identifier
- `githubOwner` (String): GitHub repository owner (e.g., "bfernandez31")
- `githubRepo` (String): GitHub repository name (e.g., "ai-board")
- `userId` (String, FK → User): Project owner

**Usage**:
- `githubOwner` + `githubRepo` used to construct GitHub API calls (via Octokit)
- Authorization: User must be owner or member (checked via `verifyTicketAccess()`)

---

### ProjectMember

**Purpose**: Authorizes project members to delete tickets (in addition to owner).

**Relevant Fields**:
- `projectId` (Int, FK → Project)
- `userId` (String, FK → User)

**Authorization Pattern**:
```typescript
// verifyTicketAccess() checks ownership OR membership
const ticket = await prisma.ticket.findFirst({
  where: {
    id: ticketId,
    project: {
      OR: [
        { userId: session.user.id },                     // Owner
        { members: { some: { userId: session.user.id } } } // Member
      ]
    }
  },
  include: { project: true }
});
```

---

## State Transitions

### Ticket Deletion Flow

```
[ANY STAGE except SHIP]
  ↓
User drags ticket to trash zone
  ↓
Validation checks:
  - ticket.stage !== 'SHIP' ✓
  - No Jobs with status IN ('PENDING', 'RUNNING') ✓
  - User is project owner OR member ✓
  ↓
Show confirmation modal (stage-specific message)
  ↓
User confirms deletion
  ↓
GitHub cleanup (if ticket.branch exists):
  1. Close all PRs where head === ticket.branch
  2. Delete branch (refs/heads/{branch})
  ↓
Database deletion (transactional):
  - DELETE FROM Ticket WHERE id = ? (cascade to Jobs, Comments)
  ↓
[DELETED] - No longer exists in database
```

**Rollback Scenario** (GitHub API failure):
```
[STAGE: VERIFY] (example)
  ↓
User confirms deletion
  ↓
GitHub cleanup attempt
  ↓
ERROR: GitHub API fails (rate limit, network, permissions)
  ↓
Database deletion SKIPPED (ticket remains unchanged)
  ↓
[STAGE: VERIFY] - Returns to original state
  ↓
User sees error message: "Failed to delete GitHub artifacts. Please try again."
```

---

## Database Queries

### Pre-Deletion Validation

**Check SHIP stage**:
```sql
SELECT stage FROM Ticket WHERE id = ?;
-- If stage = 'SHIP' → reject deletion (400 error)
```

**Check active jobs**:
```sql
SELECT id FROM Job
WHERE ticketId = ?
  AND status IN ('PENDING', 'RUNNING')
LIMIT 1;
-- If any rows returned → reject deletion (400 error)
```

**Authorization check** (via Prisma):
```typescript
const ticket = await prisma.ticket.findFirst({
  where: {
    id: ticketId,
    projectId: projectId,
    project: {
      OR: [
        { userId: session.user.id },                     // Owner
        { members: { some: { userId: session.user.id } } } // Member
      ]
    }
  },
  include: {
    project: {
      select: {
        githubOwner: true,
        githubRepo: true,
      }
    },
    jobs: {
      where: { status: { in: ['PENDING', 'RUNNING'] } },
      take: 1,
    }
  }
});

if (!ticket) {
  // 403 Forbidden or 404 Not Found
}

if (ticket.jobs.length > 0) {
  // 400 Bad Request: "Cannot delete ticket while job is in progress"
}
```

### Deletion Operation

**Ticket deletion** (cascade via FK constraints):
```typescript
await prisma.ticket.delete({
  where: { id: ticketId }
});
// Automatically deletes:
// - All Jobs with ticketId = ticketId (FK: Job.ticketId → Ticket.id)
// - All Comments with ticketId = ticketId (FK: Comment.ticketId → Ticket.id)
```

**No manual cascade needed** - Prisma handles via schema:
```prisma
model Job {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  // ... other fields
}

model Comment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  // ... other fields
}
```

---

## External Data (GitHub)

### Git Branch

**Location**: GitHub repository (`project.githubOwner/project.githubRepo`)
**Identifier**: `ticket.branch` (e.g., "084-feature-name")
**Deletion Method**: Octokit REST API (`git.deleteRef`)

**API Call**:
```typescript
await octokit.rest.git.deleteRef({
  owner: project.githubOwner,
  repo: project.githubRepo,
  ref: `heads/${ticket.branch}`, // refs/heads/ prefix required
});
```

**Error Handling**:
- 404 (Not Found): Branch already deleted → Acceptable (idempotent)
- 422 (Unprocessable): Branch protected → Show error, preserve ticket
- 403 (Forbidden): Insufficient permissions → Show error, preserve ticket

---

### Pull Requests

**Location**: GitHub repository (same as branch)
**Identifier**: PRs where `head === ticket.branch`
**Deletion Method**: Close PR (Octokit REST API `pulls.update`)

**Discovery Query**:
```typescript
const { data: prs } = await octokit.rest.pulls.list({
  owner: project.githubOwner,
  repo: project.githubRepo,
  head: `${project.githubOwner}:${ticket.branch}`,
  state: 'open', // Only close open PRs
});
```

**Closure Operation**:
```typescript
for (const pr of prs) {
  await octokit.rest.pulls.update({
    owner: project.githubOwner,
    repo: project.githubRepo,
    pull_number: pr.number,
    state: 'closed', // Close (not merge)
  });
}
```

**Edge Cases**:
- Multiple PRs with same head branch: Close all (loop through `prs` array)
- No PRs found: Skip closure step (acceptable)
- PR already closed: List query filters `state: 'open'`, so already-closed PRs not affected

---

## Workflow Artifacts (File System)

**Location**: `specs/{branch-name}/` directory in repository
**Contents**:
- `spec.md`: Feature specification (SPECIFY stage)
- `plan.md`: Implementation plan (PLAN stage)
- `tasks.md`: Task breakdown (PLAN stage)
- `research.md`: Research documentation (PLAN stage)
- `data-model.md`: Data model documentation (PLAN stage)
- `quickstart.md`: Developer quickstart guide (PLAN stage)
- `contracts/`: API contracts (PLAN stage)
- `assets/`: Images, diagrams (various stages)

**Deletion Behavior**:
- Artifacts deleted automatically when branch is deleted (files live in branch)
- No separate API call needed (GitHub deletes branch + all files)

**Orphaned Artifacts**:
- If branch deletion fails but ticket is NOT deleted (transaction integrity), artifacts remain on GitHub
- User can retry deletion, or manually delete branch via GitHub UI

---

## Performance Considerations

### Database Queries

**Authorization query** (single roundtrip):
```typescript
const ticket = await prisma.ticket.findFirst({
  where: { /* conditions */ },
  include: {
    project: true,
    jobs: { where: { status: { in: ['PENDING', 'RUNNING'] } } }
  }
});
```
- **Performance**: <50ms p95 (indexed queries on `id`, `projectId`, `userId`)
- **Optimization**: Single query includes all needed data (project, jobs)

**Deletion query** (single roundtrip):
```typescript
await prisma.ticket.delete({ where: { id: ticketId } });
```
- **Performance**: <100ms p95 (includes cascade to Jobs, Comments)
- **Optimization**: Database handles cascade via FK constraints (no N+1 queries)

### GitHub API Calls

**PR discovery + closure** (sequential):
- List PRs: 1 API call (filtered by `head` branch)
- Close PRs: N API calls (one per PR, typically 1 PR per ticket)
- **Typical**: 2 API calls (1 list + 1 close) ≈ 2-3 seconds

**Branch deletion** (single call):
- Delete ref: 1 API call
- **Typical**: 1-2 seconds

**Total GitHub time**: ~5 seconds (sequential operations)

**Rate Limits**:
- Authenticated: 5000 req/hour = 1.4 req/second sustained
- Deletion uses ~2 requests per ticket (acceptable for typical usage)

---

## Security Model

### Authorization Hierarchy

1. **Session validation**: User must be authenticated (NextAuth.js)
2. **Project access**: User must be owner OR member of project
3. **Ticket ownership**: Ticket must belong to specified project
4. **Stage restriction**: SHIP stage tickets cannot be deleted (business rule)
5. **Concurrency protection**: Tickets with active jobs cannot be deleted

**Authorization Helper** (existing):
```typescript
import { verifyTicketAccess } from '@/lib/db/auth-helpers';

// Returns ticket if authorized, throws 403 if not
const ticket = await verifyTicketAccess(ticketId);
```

### GitHub Token Security

- **Storage**: Environment variable (`GITHUB_TOKEN`)
- **Scope**: `repo` (full repository access)
- **Usage**: Server-side only (Next.js API route)
- **Rotation**: Update in Vercel dashboard without code changes

### Audit Trail

**No audit log for deletions** (current implementation):
- Deletions are permanent (no `deletedAt` field)
- No audit table for tracking deleted tickets

**Recommendation for future**:
- Add `AuditLog` table to track deletions (user, timestamp, ticket details)
- Requires schema migration (NOT in scope for this feature)

---

## Summary

### Entities Modified
- **Ticket**: Deleted (via `prisma.ticket.delete()`)
- **Job**: Cascade deleted (FK constraint)
- **Comment**: Cascade deleted (FK constraint)

### Entities Read
- **Project**: Read `githubOwner`, `githubRepo` for GitHub API calls
- **ProjectMember**: Read for authorization (owner OR member)

### External Systems Modified
- **GitHub Branch**: Deleted via Octokit REST API
- **GitHub PRs**: Closed via Octokit REST API
- **Workflow Artifacts**: Deleted automatically when branch deleted

### No Schema Changes Required
- All operations use existing database schema
- No migrations needed
- No new tables or fields

This feature is a **read-delete operation** with **external system cleanup** (GitHub). Database schema remains unchanged.
