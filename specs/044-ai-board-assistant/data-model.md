# Data Model: AI-BOARD Assistant

**Branch**: `044-ai-board-assistant` | **Date**: 2025-10-23
**Purpose**: Define entity relationships, validation rules, and state transitions

## Entity Overview

This feature leverages existing database schema without migrations. All entities use existing Prisma models:
- **User**: AI-BOARD system user
- **ProjectMember**: Auto-membership for AI-BOARD
- **Job**: Workflow tracking with new command formats
- **Comment**: Standard comments with AI-BOARD authorship

**No Schema Changes Required** - Feature uses existing models and relationships.

---

## Entity: AI-BOARD User

**Model**: `User` (existing)

**Purpose**: System user representing AI assistant for mention-based collaboration

### Fields
- `id` (String, PK): Generated user ID (UUID format)
- `email` (String, Unique, NOT NULL): `"ai-board@system.local"` (fixed identifier)
- `name` (String, NULLABLE): `"AI-BOARD Assistant"` (display name)
- `emailVerified` (DateTime, NULLABLE): Set to current timestamp (verified system user)
- `createdAt` (DateTime, NOT NULL): User creation timestamp
- `updatedAt` (DateTime, NOT NULL): Last modification timestamp

### Constraints
- **Unique Email**: Enforced by Prisma schema unique constraint
- **Prevent UI Deletion**: Application-level constraint (not database-level)
  - No DELETE endpoint for users
  - Seed script upserts to prevent accidental deletion

### Validation Rules
- Email MUST match pattern `ai-board@system.local` exactly
- Name MUST NOT be empty if set
- User MUST exist before project creation (enforced by seed script order)

### Relationships
- **ProjectMember** (One-to-Many): AI-BOARD can be member of multiple projects
- **Comment** (One-to-Many): AI-BOARD can author multiple comments

### Lifecycle
```
[Not Exists] --seed-script--> [Created]
                                   |
                                   v
                            [Active System User]
                            (persists indefinitely)
```

### Implementation Notes
- Created via `prisma/seed.ts` upsert pattern (idempotent)
- Retrieved via `getAIBoardUserId()` utility with in-memory caching
- Never deleted (application enforces this, no UI exposure)

---

## Entity: AI-BOARD ProjectMember

**Model**: `ProjectMember` (existing)

**Purpose**: Automatic membership for AI-BOARD in all projects

### Fields
- `id` (Int, PK, Auto-increment): Membership record ID
- `projectId` (Int, FK → Project.id, NOT NULL): Project being joined
- `userId` (String, FK → User.id, NOT NULL): AI-BOARD user ID
- `role` (String, NOT NULL, DEFAULT "member"): Always `"member"` for AI-BOARD
- `createdAt` (DateTime, NOT NULL): Membership creation timestamp

### Constraints
- **Unique Project-User**: `@@unique([projectId, userId])` prevents duplicate memberships
- **Foreign Key**: `projectId` references `Project.id` (CASCADE DELETE)
- **Foreign Key**: `userId` references `User.id` (CASCADE DELETE)

### Validation Rules
- `role` MUST be `"member"` for AI-BOARD (no admin/owner role)
- `projectId` MUST exist before membership creation
- `userId` MUST be AI-BOARD user ID (validated in creation logic)

### Relationships
- **Project** (Many-to-One): Belongs to single project
- **User** (Many-to-One): References AI-BOARD user

### State Transitions
```
[Project Created] --auto-add--> [ProjectMember Created]
                                         |
                                         v
                                  [Active Membership]
                                  (until project deleted)
```

### Auto-Membership Logic
```
ON Project.create:
  1. Begin transaction
  2. Create Project record
  3. Fetch AI-BOARD user ID (cached)
  4. Create ProjectMember record
  5. Commit transaction (or rollback on failure)
```

### Implementation Notes
- Created atomically with project in Prisma transaction
- No manual creation/deletion via API
- Queried when building mention suggestion lists

---

## Entity: Job (AI-BOARD Commands)

**Model**: `Job` (existing)

**Purpose**: Track AI-BOARD workflow execution status

### Fields
- `id` (Int, PK, Auto-increment): Job record ID
- `ticketId` (Int, FK → Ticket.id, NOT NULL): Ticket being processed
- `command` (String(50), NOT NULL): AI-BOARD command format `"comment-{stage}"`
- `status` (JobStatus enum, NOT NULL, DEFAULT PENDING): Current execution state
- `branch` (String(200), NULLABLE): Git branch (copied from ticket)
- `startedAt` (DateTime, NOT NULL, DEFAULT now()): Job creation time
- `completedAt` (DateTime, NULLABLE): Job completion/failure time
- `projectId` (Int, FK → Project.id, NOT NULL): Project context (for querying)
- `updatedAt` (DateTime, NOT NULL): Last status update

### AI-BOARD Command Formats
- `"comment-specify"`: SPECIFY stage request
- `"comment-plan"`: PLAN stage request
- `"comment-build"`: BUILD stage request (returns "not implemented")
- `"comment-verify"`: VERIFY stage request (returns "not implemented")

### Validation Rules
- Command MUST match pattern `^comment-(specify|plan|build|verify)$` (50 char limit)
- Ticket MUST NOT have existing job with status IN (PENDING, RUNNING) when creating
- Status transitions MUST follow state machine (see below)

### State Machine
```
[PENDING] --workflow-start--> [RUNNING]
   |                              |
   |                              +--success--> [COMPLETED]
   |                              |
   |                              +--failure--> [FAILED]
   |
   +--cancel--> [CANCELLED]

Terminal States: COMPLETED, FAILED, CANCELLED (no further transitions)
```

### Relationships
- **Ticket** (Many-to-One): Belongs to single ticket
- **Project** (Many-to-One): Belongs to single project (for efficient querying)

### Availability Logic
```
AI-BOARD Available = (
  Ticket.stage IN (SPECIFY, PLAN, BUILD, VERIFY) AND
  NOT EXISTS (Job WHERE ticketId = Ticket.id AND status IN (PENDING, RUNNING))
)
```

### Implementation Notes
- Created in Prisma transaction with concurrent job check
- Updated by GitHub workflow via PATCH /api/jobs/:id/status
- Queried for real-time job status polling (2-second interval)

---

## Entity: AI-BOARD Comment

**Model**: `Comment` (existing)

**Purpose**: AI response comments posted by workflow

### Fields
- `id` (Int, PK, Auto-increment): Comment record ID
- `ticketId` (Int, FK → Ticket.id, NOT NULL): Ticket being commented on
- `userId` (String, FK → User.id, NOT NULL): AI-BOARD user ID (not session user)
- `content` (String(2000), NOT NULL): Comment text with mention of requester
- `createdAt` (DateTime, NOT NULL): Comment creation time
- `updatedAt` (DateTime, NOT NULL): Last modification time

### Content Format
- Mentions original requester: `@[userId:displayName] {AI response message}`
- Standard markdown formatting supported
- Max length 2000 characters (existing constraint)

### Validation Rules
- Content MUST NOT exceed 2000 characters
- Content MUST pass existing mention format validation
- userId MUST be AI-BOARD user ID (validated at endpoint)
- Mentioned users MUST be project members (existing validation)

### Relationships
- **Ticket** (Many-to-One): Belongs to single ticket
- **User** (Many-to-One): Authored by AI-BOARD user

### Creation Flow
```
[Workflow Completes] --API-call--> [POST /api/.../comments/ai-board]
                                              |
                                              v
                                    [Comment Created with userId=AI-BOARD]
                                              |
                                              v
                                    [Real-time polling detects new comment]
```

### Implementation Notes
- Created via special endpoint (workflow authentication)
- Standard Comment model, no special fields needed
- Rendered by existing Comment component (no UI changes)

---

## Relationships Diagram

```
┌─────────────────┐
│  User           │
│  (AI-BOARD)     │
└────────┬────────┘
         │
         ├───────────────────┐
         │                   │
         v                   v
┌────────────────┐   ┌──────────────┐
│ ProjectMember  │   │  Comment     │
│ (auto-created) │   │  (authored)  │
└────┬───────────┘   └──────┬───────┘
     │                      │
     │                      │
     v                      v
┌─────────────────┐   ┌──────────────┐
│  Project        │   │  Ticket      │
└─────────────────┘   └──────┬───────┘
                             │
                             v
                      ┌──────────────┐
                      │  Job         │
                      │  (tracking)  │
                      └──────────────┘
```

**Key Relationships**:
1. User (AI-BOARD) → ProjectMember (auto-added on project create)
2. ProjectMember → Project (AI-BOARD member of all projects)
3. User (AI-BOARD) → Comment (authors response comments)
4. Comment → Ticket (posted on specific ticket)
5. Job → Ticket (tracks workflow for ticket)
6. Job → Project (efficient querying for project jobs)

---

## Query Patterns

### Check AI-BOARD Availability
```typescript
const runningJob = await prisma.job.findFirst({
  where: {
    ticketId,
    status: { in: ['PENDING', 'RUNNING'] },
  },
});

const isAvailable = !runningJob &&
                   ['SPECIFY', 'PLAN', 'BUILD', 'VERIFY'].includes(ticket.stage);
```

### Get AI-BOARD User ID (Cached)
```typescript
let cachedId: string | null = null;

async function getAIBoardUserId(): Promise<string> {
  if (cachedId) return cachedId;

  const user = await prisma.user.findUnique({
    where: { email: 'ai-board@system.local' },
    select: { id: true },
  });

  if (!user) throw new Error('AI-BOARD user not found');
  cachedId = user.id;
  return user.id;
}
```

### Create Project with AI-BOARD Membership
```typescript
const project = await prisma.$transaction(async (tx) => {
  const newProject = await tx.project.create({ data: {...} });

  await tx.projectMember.create({
    data: {
      projectId: newProject.id,
      userId: await getAIBoardUserId(),
      role: 'member',
    },
  });

  return newProject;
});
```

### Create Job with Concurrency Check
```typescript
const job = await prisma.$transaction(async (tx) => {
  const existing = await tx.job.findFirst({
    where: {
      ticketId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
  });

  if (existing) {
    throw new Error('AI-BOARD already processing this ticket');
  }

  return await tx.job.create({
    data: {
      ticketId,
      projectId,
      command: `comment-${stage}`,
      status: 'PENDING',
      branch: ticket.branch,
    },
  });
});
```

---

## Migration Strategy

**No Database Migrations Required**

This feature uses existing schema without modifications:
- `User` table: Standard user record for AI-BOARD
- `ProjectMember` table: Standard membership record
- `Job` table: New command formats fit within varchar(50) constraint
- `Comment` table: Standard comment records

**Only Required Change**: Seed script update to create AI-BOARD user

```typescript
// In prisma/seed.ts (addition)
const aiBoardUser = await prisma.user.upsert({
  where: { email: 'ai-board@system.local' },
  update: {},
  create: {
    id: 'ai-board-system-user', // Or let Prisma generate
    email: 'ai-board@system.local',
    name: 'AI-BOARD Assistant',
    emailVerified: new Date(),
    updatedAt: new Date(),
  },
});
```

---

## Data Integrity

### Cascade Delete Behavior
- **Project Deleted** → ProjectMember deleted (AI-BOARD membership removed)
- **Project Deleted** → Job deleted (workflow tracking removed)
- **Project Deleted** → Ticket deleted → Comment deleted (AI-BOARD comments removed)
- **Ticket Deleted** → Job deleted (workflow tracking removed)
- **Ticket Deleted** → Comment deleted (AI-BOARD comments removed)

### Transaction Guarantees
- **Project Creation**: Project + AI-BOARD membership atomic (rollback on failure)
- **Job Creation**: Availability check + job creation atomic (prevents race conditions)
- **Comment Creation**: Standard single-record transaction (Prisma default)

### Indexing
- `Job.projectId` indexed (existing) - Fast project-wide job queries
- `Job.ticketId` indexed (existing) - Fast ticket job lookups
- `Job.status` indexed (existing) - Fast status filtering
- `ProjectMember.projectId` indexed (existing) - Fast project member queries
- `Comment.ticketId` indexed (existing) - Fast ticket comment queries

No additional indexes required.

---

## Summary

**Entities**: 4 entities (all existing models, no new tables)
**Relationships**: 6 key relationships (all existing patterns)
**State Machines**: 1 state machine (Job status transitions)
**Transactions**: 2 transaction patterns (project creation, job creation)
**Migrations**: 0 migrations required (uses existing schema)

**Ready for Phase 1**: Contract generation (OpenAPI specs)
