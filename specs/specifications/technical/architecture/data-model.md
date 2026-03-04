# Data Model Reference

## Prisma Schema Overview

Complete database schema with relationships, constraints, and indexes.

## Core Models

### User

User accounts with authentication and project ownership.

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  projects      Project[]
  comments      Comment[]
  accounts      Account[]
  sessions      Session[]
  projectMembers ProjectMember[]
}
```

**Purpose**: Authentication and project ownership

**Fields**:
- `id`: Unique identifier (CUID format)
- `email`: Unique email address (authentication identifier)
- `name`: Display name (nullable, from OAuth provider)
- `emailVerified`: Email verification timestamp (from OAuth)
- `createdAt`: Account creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- One-to-many: Projects, Comments, Accounts, Sessions, ProjectMembers, Notifications (as recipient and actor), PushSubscriptions

**Constraints**:
- Unique email address
- Cascade delete: Comments, ProjectMembers, Notifications

**Business Rules**:
- Every project must have a user (required userId)
- Email uniquely identifies users across system
- Mock authentication uses `test@e2e.local` in development
- Users can have multiple push subscriptions (different browsers/devices)

### Project

Projects represent GitHub repositories with workflow automation.

```prisma
model Project {
  id                   Int                  @id @default(autoincrement())
  name                 String
  key                  String               @unique @db.VarChar(6)
  description          String?
  deploymentUrl        String?
  githubOwner          String
  githubRepo           String
  userId               String
  clarificationPolicy  ClarificationPolicy  @default(AUTO)
  defaultAgent         Agent                @default(CLAUDE)
  activeCleanupJobId   Int?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  user                 User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  tickets              Ticket[]
  jobs                 Job[]
  projectMembers       ProjectMember[]

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
  @@index([userId])
  @@index([key])
  @@index([activeCleanupJobId])
}
```

**Purpose**: Multi-project organization with GitHub repository integration

**Fields**:
- `id`: Auto-incrementing unique identifier
- `name`: Human-readable project name
- `key`: Unique 3-character identifier (uppercase alphanumeric, e.g., "ABC")
  - Used as prefix for all ticket keys (e.g., "ABC-123")
  - Generated from project name or provided by user
  - Unique constraint enforced across all projects
  - Immutable after creation
- `description`: Optional project details (not displayed on project cards)
- `deploymentUrl`: Optional deployment URL (displayed on cards with copy-to-clipboard functionality)
- `githubOwner`: GitHub repository owner (user or organization)
- `githubRepo`: GitHub repository name
- `userId`: Owner of the project (required foreign key)
- `clarificationPolicy`: Default policy for spec generation (enum, default: AUTO)
- `defaultAgent`: Default AI agent for all tickets in the project (enum, default: CLAUDE)
- `activeCleanupJobId`: Reference to currently active cleanup job (nullable)
  - Used for project-level transition locking during cleanup
  - Set when cleanup workflow triggered
  - Cleared when cleanup job reaches terminal state (COMPLETED/FAILED/CANCELLED)
  - Index for efficient lock status queries
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to User (required, cascade delete)
- One-to-many: Tickets, Jobs, ProjectMembers

**Constraints**:
- Unique key (project identifier for ticket prefixes)
- Unique (githubOwner, githubRepo) - one project per repository
- Index on (githubOwner, githubRepo) for efficient lookups
- Index on userId for authorization queries
- Index on key for ticket lookup by key
- NOT NULL userId (every project must have owner)

**Business Rules**:
- Cannot have duplicate project keys across system
- Cannot have duplicate projects for same repository
- Deleting project deletes all tickets and jobs (cascade)
- User can only access their own projects
- Default clarification policy AUTO (context-aware)
- Default agent CLAUDE (backward-compatible; existing projects automatically get CLAUDE)
- Deployment URL displayed on project cards when configured (hidden when null)
- Project description stored but not displayed on list view cards
- Project key generation: derived from first 3 characters of name (uppercase), padded/disambiguated if needed

### Ticket

Tickets track work items through six workflow stages.

```prisma
model Ticket {
  id                   Int                  @id @default(autoincrement())
  ticketNumber         Int
  ticketKey            String               @unique @db.VarChar(20)
  title                String               @db.VarChar(100)
  description          String               @db.Text
  stage                Stage                @default(INBOX)
  projectId            Int
  branch               String?              @db.VarChar(200)
  workflowType         WorkflowType         @default(FULL)
  clarificationPolicy  ClarificationPolicy?
  agent                Agent?
  attachments          Json?
  version              Int                  @default(1)
  closedAt             DateTime?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  project              Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  jobs                 Job[]
  comments             Comment[]

  @@unique([projectId, ticketNumber])
  @@index([projectId])
  @@index([projectId, stage])
  @@index([projectId, workflowType])
  @@index([ticketKey])
}
```

**Purpose**: Work item tracking with kanban workflow

**Fields**:
- `id`: Auto-incrementing unique identifier (internal use only, not user-facing)
- `ticketNumber`: Sequential number within project (1, 2, 3, ...)
  - Starts from 1 for each project
  - Increments independently per project
  - Used to form ticketKey
- `ticketKey`: Human-readable unique identifier (e.g., "ABC-123")
  - Format: {PROJECT_KEY}-{TICKET_NUMBER}
  - Denormalized field for performance
  - Unique constraint across all tickets
  - Used in URLs, UI displays, and API lookups
- `title`: Short description (max 100 characters)
- `description`: Detailed description (max 10000 characters, all UTF-8 allowed)
- `stage`: Current workflow stage (enum: INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP, CLOSED)
- `projectId`: Parent project (required foreign key)
- `branch`: Git branch name (max 200 chars, nullable, set by workflow)
- `workflowType`: Workflow path used (enum: FULL, QUICK, default: FULL)
- `clarificationPolicy`: Optional policy override (nullable, inherits from project when null)
- `agent`: Optional AI agent override (nullable, inherits from project `defaultAgent` when null)
- `attachments`: Image attachments (JSON array of TicketAttachment objects)
- `previewUrl`: Vercel preview deployment URL (max 500 chars, nullable, HTTPS-only, Vercel domain pattern)
  - Set when manual deployment triggered from VERIFY stage
  - Clickable icon appears on ticket card when URL is set
  - Only one ticket per project can have preview URL at a time
  - Cleared when new deployment initiated (single-preview enforcement)
  - Cleared when ticket rolls back from VERIFY to PLAN (preview becomes invalid)
- `version`: Optimistic concurrency control (incremented on each update)
- `closedAt`: Timestamp when ticket was closed (nullable, set when stage transitions to CLOSED)
- `createdAt`: Creation timestamp (set once on creation)
- `updatedAt`: Last modification timestamp (automatically updated by Prisma on any field change via `@updatedAt` directive)

**Relationships**:
- Belongs to Project (required, cascade delete)
- One-to-many: Jobs, Comments

**Constraints**:
- Unique ticketKey across all tickets
- Unique (projectId, ticketNumber) within project
- Index on projectId for filtering
- Composite index (projectId, stage) for board queries
- Composite index (projectId, workflowType) for filtering
- Index on ticketKey for lookup by key

**Validation Rules**:
- Title: 1-100 characters, alphanumeric + basic punctuation, no emojis
- Description: 1-10000 characters, all UTF-8 characters allowed (including emojis, Chinese, Arabic, etc.)
- Branch: Max 200 characters
- Attachments: Max 5 images, 10MB each, formats: JPEG/PNG/GIF/WebP
- Stage: Sequential progression only (no skipping or backwards)

**Business Rules**:
- New tickets always created in INBOX stage
- Ticket number assigned using thread-safe PostgreSQL sequence per project
- Ticket key generated from project key + ticket number (e.g., "ABC-123")
- Internal ID used for foreign keys, not exposed to users
- Sequential stage progression (INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP or CLOSED)
- Branch created by workflow during SPECIFY transition
- workflowType set during first BUILD transition (immutable thereafter)
- Description editable only in INBOX stage (frozen after SPECIFY)
- Clarification policy overrides project default when set
- Agent overrides project default when set; null means inherit from project `defaultAgent`
- Effective agent resolved at dispatch time via `resolveEffectiveAgent(ticket.agent, project.defaultAgent)`
- Ticket lookup supports both internal ID (backward compatibility) and ticket key (user-facing)
- **Deletion**:
  - Tickets can be deleted from INBOX, SPECIFY, PLAN, BUILD, VERIFY stages (not SHIP or CLOSED)
  - Deletion blocked when ticket has PENDING or RUNNING jobs
  - Deletion is transactional: GitHub cleanup (PRs, branch) must succeed before database deletion
  - On success: Ticket, Jobs, Comments cascade deleted from database
  - On failure: Ticket remains unchanged (no partial deletion)
- **Closing**:
  - Tickets can be closed from VERIFY stage (transition to CLOSED)
  - Closing blocked when ticket has PENDING or RUNNING jobs
  - Closing blocked during project cleanup (HTTP 423 Locked)
  - Closes all open GitHub PRs for ticket branch with explanatory comment
  - Preserves Git branch (not deleted)
  - Sets closedAt timestamp automatically
  - CLOSED tickets excluded from board display but included in search results
  - CLOSED is terminal state (no outbound transitions)

### Job

Jobs track GitHub Actions workflow executions.

```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  projectId   Int
  command     String    @db.VarChar(50)
  status      JobStatus @default(PENDING)
  branch      String?   @db.VarChar(200)
  commitSha   String?   @db.VarChar(40)
  logs        String?   @db.Text
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Claude telemetry metrics (aggregated from all API calls in the job)
  inputTokens         Int?      // Total input tokens consumed
  outputTokens        Int?      // Total output tokens generated
  cacheReadTokens     Int?      // Total cache read tokens
  cacheCreationTokens Int?      // Total cache creation tokens
  costUsd             Float?    // Total cost in USD
  durationMs          Int?      // Total Claude API duration in milliseconds
  model               String?   @db.VarChar(50)  // Primary model used
  toolsUsed           String[]  @default([])     // List of tools used (Edit, Write, Bash, etc.)

  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@index([projectId])
  @@index([ticketId, status, startedAt])
  @@index([status])
}
```

**Purpose**: Workflow execution tracking and status monitoring

**Fields**:
- `id`: Auto-incrementing unique identifier
- `ticketId`: Associated ticket (required foreign key)
- `projectId`: Parent project (required foreign key, for polling queries)
- `command`: Spec-kit command executed (specify|plan|implement|verify|quick-impl|clean|deploy-preview|rollback-reset|comment-specify|comment-plan|comment-build|comment-verify, max 50 chars)
- `status`: Current execution state (enum: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- `branch`: Git branch name (max 200 chars, nullable)
- `commitSha`: Git commit hash (max 40 chars, nullable)
- `logs`: Complete execution logs (text, unlimited)
- `startedAt`: Execution start timestamp (set on creation)
- `completedAt`: Execution completion timestamp (nullable, set on terminal state)
- `createdAt`: Record creation timestamp
- `updatedAt`: Last modification timestamp
- `inputTokens`: Total input tokens consumed by Claude API calls (nullable)
- `outputTokens`: Total output tokens generated by Claude (nullable)
- `cacheReadTokens`: Total cache read tokens (nullable)
- `cacheCreationTokens`: Total cache creation tokens (nullable)
- `costUsd`: Total cost in USD for Claude API calls (nullable, float)
- `durationMs`: Total duration of Claude API calls in milliseconds (nullable)
- `model`: Primary Claude model used (max 50 chars, nullable)
- `toolsUsed`: Array of Claude tools used during execution (default: empty array)

**Relationships**:
- Belongs to Ticket (required, cascade delete)
- Belongs to Project (required, cascade delete)

**Constraints**:
- Index on ticketId for job history queries
- Index on projectId for polling all project jobs
- Composite index (ticketId, status, startedAt) for job completion validation
- Index on status for filtering running jobs

**State Machine**:
```
PENDING → RUNNING → COMPLETED
                  → FAILED
                  → CANCELLED

Terminal states: COMPLETED, FAILED, CANCELLED (no further transitions except idempotent)
```

**Business Rules**:
- Created when workflow dispatched (status: PENDING)
- Status updated by workflow via API (Bearer token auth)
- Terminal states cannot transition to other states
- Idempotent updates allowed (same status returns 200)
- Most recent job (by startedAt) used for transition validation
- Jobs retained indefinitely for audit trail, except:
  - Deleted when VERIFY to PLAN rollback occurs (job record removed as part of rollback)
- AI-BOARD jobs (command like 'comment-%') don't block transitions or count toward rollback validation

**Telemetry Data Usage**:
- Telemetry fields aggregated and displayed in ticket Stats tab
- Stats tab visibility: only shown when ticket has ≥1 job
- Aggregated metrics calculated from all jobs on a ticket:
  - Total cost: sum of all `costUsd` values
  - Total duration: sum of all `durationMs` values
  - Total tokens: sum of `inputTokens` + `outputTokens`
  - Cache efficiency: `cacheReadTokens / (inputTokens + cacheReadTokens) * 100`
- Tools usage aggregated from `toolsUsed` arrays across all jobs
- Null telemetry values treated as 0 for aggregation
- Real-time updates via existing 2-second job polling mechanism

### Comment

Comments enable ticket collaboration with markdown support.

```prisma
model Comment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  userId    String
  content   String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
  @@index([userId])
}
```

**Purpose**: Ticket discussion and collaboration

**Fields**:
- `id`: Auto-incrementing unique identifier
- `ticketId`: Parent ticket (required foreign key)
- `userId`: Comment author (required foreign key)
- `content`: Markdown-formatted content (1-2000 characters)
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to Ticket (required, cascade delete)
- Belongs to User (required, cascade delete)

**Constraints**:
- Composite index (ticketId, createdAt) for efficient sorting
- Index on userId for author filtering

**Features**:
- Markdown rendering with HTML escaping (XSS protection)
- User mentions via `@[Name](userId)` syntax
- Real-time updates via 10-second client polling
- Author-only deletion with optimistic UI updates

**Business Rules**:
- Content: 1-2000 characters (enforced server-side)
- Only project owners can create comments
- Only comment authors can delete their own comments
- Cascade delete when ticket or user deleted
- Displayed in reverse chronological order (newest first)

### Notification

Notifications track @mentions in comments for real-time collaboration alerts.

```prisma
model Notification {
  id          Int       @id @default(autoincrement())
  recipientId String    // User receiving the notification
  actorId     String    // User who created the mention
  commentId   Int       // Source comment
  ticketId    Int       // Source ticket (for navigation)
  read        Boolean   @default(false)
  readAt      DateTime?
  createdAt   DateTime  @default(now())
  deletedAt   DateTime? // Soft delete for 30-day retention policy

  recipient User    @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor     User    @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)
  comment   Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  ticket    Ticket  @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([recipientId, read, createdAt])
  @@index([recipientId, deletedAt])
  @@index([commentId])
}
```

**Purpose**: Real-time mention notifications for collaboration

**Fields**:
- `id`: Auto-incrementing unique identifier
- `recipientId`: User who was mentioned (required foreign key)
- `actorId`: User who posted the comment with mention (required foreign key)
- `commentId`: Source comment containing the mention (required foreign key)
- `ticketId`: Parent ticket for navigation (required foreign key)
- `read`: Boolean indicating if notification has been viewed (default: false)
- `readAt`: Timestamp when notification was marked as read (nullable)
- `createdAt`: Notification creation timestamp
- `deletedAt`: Soft delete timestamp for 30-day retention (nullable)

**Relationships**:
- Belongs to User (recipient, required, cascade delete)
- References User (actor, required, cascade delete)
- Belongs to Comment (required, cascade delete)
- Belongs to Ticket (required, cascade delete)

**Constraints**:
- Composite index (recipientId, read, createdAt) for efficient unread notification queries
- Composite index (recipientId, deletedAt) for soft-delete filtering
- Index on commentId for notification lookup by comment

**Features**:
- Automatic creation when @mentions detected in comments
- Soft delete with 30-day retention (deletedAt field)
- Read status tracking with timestamp
- Polling-based updates (15-second interval)
- Optimistic UI updates for mark-as-read actions

**Business Rules**:
- Created when comment contains @mention of project member
- No notification created for self-mentions (including AI-BOARD self-mentions)
- No notification created for non-project members
- AI-BOARD comments create notifications for mentioned users (AI-BOARD as actor)
- Notification creation is non-blocking (errors logged but don't fail operations)
- Notifications retained for 30 days before deletion
- Deleted comments cascade delete notifications
- Deleted users cascade delete their received and created notifications
- Unread notifications count towards bell badge
- Read notifications remain visible in dropdown until deleted
- Push notifications sent to project owners when mentioned (if subscriptions enabled)

### PushSubscription

Browser push notification subscriptions for project owners to receive alerts outside the application.

```prisma
model PushSubscription {
  id             Int       @id @default(autoincrement())
  userId         String
  endpoint       String    @unique @db.VarChar(500)
  p256dh         String    @db.VarChar(100)
  auth           String    @db.VarChar(50)
  expirationTime DateTime?
  userAgent      String?   @db.VarChar(200)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([endpoint])
}
```

**Purpose**: Enable browser push notifications for job completion and @mentions when browser tab is not active

**Fields**:
- `id`: Auto-incrementing unique identifier
- `userId`: Owner of the subscription (required foreign key)
- `endpoint`: Web Push endpoint URL (unique, provided by browser)
- `p256dh`: Public key for message encryption (required by Web Push spec)
- `auth`: Authentication secret for message encryption (required by Web Push spec)
- `expirationTime`: Optional subscription expiration timestamp
- `userAgent`: Browser/device identifier for subscription management (optional)
- `createdAt`: Subscription creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to User (required, cascade delete)

**Constraints**:
- Unique endpoint URL (prevents duplicate subscriptions)
- Index on userId for efficient subscription lookup
- Index on endpoint for subscription validation
- Cascade delete when user is deleted

**Features**:
- Web Push API integration with VAPID authentication
- Automatic cleanup of invalid subscriptions (410/404 responses)
- Multiple subscriptions per user (different browsers/devices)
- Service worker-based notification delivery

**Business Rules**:
- Only project owners receive push notifications (not all project members)
- Subscriptions store Web Push API encryption keys (p256dh, auth) per spec requirements
- Invalid subscriptions fail silently and are removed during next send attempt
- VAPID keys configured server-side for push authentication
- Notifications sent for job completion (COMPLETED, FAILED, CANCELLED) and @mentions
- Clicking notification opens/focuses ai-board tab and navigates to relevant ticket
- Subscriptions automatically upserted (endpoint is unique key)
- Graceful degradation when browser doesn't support push notifications

### ProjectMember

Project collaboration with many-to-many user-project relationship.

```prisma
model ProjectMember {
  id        Int      @id @default(autoincrement())
  projectId Int
  userId    String
  role      String   @default("member")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
}
```

**Purpose**: Multi-user project collaboration

**Fields**:
- `id`: Auto-incrementing unique identifier
- `projectId`: Parent project (required foreign key)
- `userId`: Collaborating user (required foreign key)
- `role`: Membership role (default: "member")
- `createdAt`: Membership creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to Project (required, cascade delete)
- Belongs to User (required, cascade delete)

**Constraints**:
- Unique (projectId, userId) - one membership per user per project
- Index on projectId for listing project members
- Index on userId for listing user's projects

**Business Rules**:
- AI-BOARD system user automatically added as member on project creation
- Project owner has implicit access (doesn't require ProjectMember entry)
- Members have full read-write access to tickets (create, update, comment, transition)
- Members cannot delete projects or manage other members (owner-only actions)
- Role field exists but not currently used for authorization (all members have equal access)
- Authorization pattern: Check ownership first (performance), then membership (database join)

## Enums

### Stage

Workflow stages for tickets.

```prisma
enum Stage {
  INBOX   // Initial stage for new tickets
  SPECIFY // Specification generation
  PLAN    // Planning and task breakdown
  BUILD   // Implementation
  VERIFY  // Review and testing
  SHIP    // Completed and deployed
  CLOSED  // Closed without shipping (terminal)
}
```

**Transitions**:
- Sequential progression only (one stage forward)
- Limited rollback: BUILD → INBOX (quick-impl failed), VERIFY → PLAN (full workflow re-implementation)
- Alternative resolution: VERIFY → CLOSED (close without shipping)
- No skipping stages
- Initial: INBOX
- Terminal: SHIP, CLOSED

### JobStatus

Workflow execution states.

```prisma
enum JobStatus {
  PENDING   // Created, not yet started
  RUNNING   // Currently executing
  COMPLETED // Finished successfully
  FAILED    // Encountered error
  CANCELLED // Manually terminated
}
```

**State Machine**:
- PENDING → RUNNING
- RUNNING → COMPLETED | FAILED | CANCELLED
- Terminal states: COMPLETED, FAILED, CANCELLED

### WorkflowType

Workflow path tracking.

```prisma
enum WorkflowType {
  FULL  // Standard workflow (INBOX → SPECIFY → PLAN → BUILD)
  QUICK // Quick-implementation (INBOX → BUILD)
  CLEAN // Cleanup workflow (triggered → BUILD)
}
```

**Usage**:
- Set during first BUILD transition
- Immutable after initial setting
- Determines visual badge (⚡ Quick, ✨ Clean with sparkles icon)
- CLEAN type created via project menu "Clean Project" action
- CLEAN tickets bypass INBOX, SPECIFY, PLAN stages

### ClarificationPolicy

Spec generation decision-making strategy.

```prisma
enum ClarificationPolicy {
  AUTO          // Context-aware (system default)
  CONSERVATIVE  // Security & quality first
  PRAGMATIC     // Speed & simplicity first
  INTERACTIVE   // Manual clarification (future)
}
```

**Hierarchy**:
- Ticket policy overrides project policy
- Project policy overrides system default (AUTO)
- Null ticket policy means inherit from project

### Agent

AI agent that executes workflow automation for a ticket or project.

```prisma
enum Agent {
  CLAUDE  // Anthropic Claude (default)
  CODEX   // OpenAI Codex
}
```

**Hierarchy**:
- Ticket `agent` overrides project `defaultAgent`
- Null ticket `agent` means inherit from project `defaultAgent`
- New projects default to `CLAUDE`

**Resolution**:
```typescript
// app/lib/utils/agent-resolution.ts
import type { Agent } from '@prisma/client';

export function resolveEffectiveAgent(
  ticketAgent: Agent | null,
  projectDefaultAgent: Agent
): Agent {
  return ticketAgent ?? projectDefaultAgent;
}
```

## Relationships Diagram

```
User
├── projects (one-to-many) → Project
│   ├── tickets (one-to-many) → Ticket
│   │   ├── jobs (one-to-many) → Job
│   │   ├── comments (one-to-many) → Comment
│   │   │   └── notifications (one-to-many) → Notification
│   │   └── notifications (one-to-many) → Notification
│   ├── jobs (one-to-many) → Job
│   └── projectMembers (one-to-many) → ProjectMember
├── comments (one-to-many) → Comment
├── projectMembers (one-to-many) → ProjectMember
├── receivedNotifications (one-to-many) → Notification (as recipient)
├── createdNotifications (one-to-many) → Notification (as actor)
└── accounts/sessions (one-to-many) → NextAuth tables
```

## Indexes Strategy

### Performance Indexes

**Project Filtering**:
- `Project(userId)` - User's projects query
- `Project(githubOwner, githubRepo)` - Repository lookup

**Ticket Queries**:
- `Ticket(projectId)` - Project's tickets
- `Ticket(projectId, stage)` - Board view filtering
- `Ticket(projectId, workflowType)` - Workflow type filtering

**Job Queries**:
- `Job(ticketId, status, startedAt)` - Job completion validation
- `Job(projectId)` - Project job polling
- `Job(ticketId)` - Job history per ticket
- `Job(status)` - Running jobs query

**Comment Queries**:
- `Comment(ticketId, createdAt)` - Chronological sorting
- `Comment(userId)` - Author filtering

**Notification Queries**:
- `Notification(recipientId, read, createdAt)` - Unread notification sorting
- `Notification(recipientId, deletedAt)` - Active notifications (soft-delete filtering)
- `Notification(commentId)` - Notification lookup by source comment

**Collaboration**:
- `ProjectMember(projectId)` - Project members list
- `ProjectMember(userId)` - User's projects
- `ProjectMember(projectId, userId)` - Unique constraint + lookup

### Composite Indexes

Used for multi-column queries with optimal performance:

- `Job(ticketId, status, startedAt)`: Efficient job completion validation
- `Ticket(projectId, stage)`: Board view with stage filtering
- `Ticket(projectId, workflowType)`: Workflow type filtering per project
- `Comment(ticketId, createdAt)`: Comment timeline sorting
- `ProjectMember(projectId, userId)`: Unique membership constraint
- `Notification(recipientId, read, createdAt)`: Unread notification queries with sorting
- `Notification(recipientId, deletedAt)`: Active notification filtering (soft delete)

## TypeScript Types

### Search Types

```typescript
interface SearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: Stage;
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
}
```

**Purpose**: Ticket search functionality in header

**Usage**:
- Used by `/api/projects/:projectId/tickets/search` endpoint
- Consumed by `useTicketSearch` hook and `TicketSearch` component
- Results limited to essential fields for performance

**Fields**:
- `id`: Ticket ID for modal navigation
- `ticketKey`: Human-readable identifier (e.g., "ABC-42")
- `title`: Ticket title for display
- `stage`: Current workflow stage
- `totalCount`: Number of results (capped at API limit)

**Validation**:
- Query must be minimum 2 characters
- Limit defaults to 10, maximum 50
- Results ordered by relevance (key > title > description)

## Data Types

### JSON Fields

**Ticket.attachments**:
```typescript
interface TicketAttachment {
  type: 'uploaded' | 'external';
  url: string;                   // Cloudinary HTTPS URL
  filename: string;              // Original filename
  mimeType: string;              // image/jpeg, image/png, etc.
  sizeBytes: number;             // File size
  uploadedAt: string;            // ISO 8601 timestamp
  cloudinaryPublicId?: string;   // For deletion
}

type Attachments = TicketAttachment[];  // Max 5 items
```

### String Length Constraints

| Field | Max Length | Database Type |
|-------|------------|---------------|
| Ticket.title | 100 | VARCHAR(100) |
| Ticket.description | 10000 | TEXT |
| Ticket.branch | 200 | VARCHAR(200) |
| Job.command | 50 | VARCHAR(50) |
| Job.branch | 200 | VARCHAR(200) |
| Job.commitSha | 40 | VARCHAR(40) |
| Job.logs | Unlimited | TEXT |
| Job.model | 50 | VARCHAR(50) |
| Comment.content | 2000 | TEXT |

### Character Validation

**Ticket.title**:
- Allowed: letters (a-z, A-Z), numbers (0-9), spaces, basic punctuation (`. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`)
- Rejected: Emojis, extended Unicode

**Ticket.description**:
- Allowed: All UTF-8 characters (including emojis, Chinese, Arabic, Japanese, etc.)
- No restrictions on character sets

**Comment.content**:
- Allowed: All printable UTF-8 characters
- Markdown formatting supported

## Migration Strategy

### Version Control
- All schema changes tracked in `prisma/migrations/`
- Migration naming: `{timestamp}_{description}/migration.sql`
- Applied via `npx prisma migrate deploy` in workflows

### Backward Compatibility
- Additive changes preferred (new columns nullable or with defaults)
- Enum additions supported (no removals)
- Indexes added without downtime (PostgreSQL supports concurrent index creation)

### Test Data
- Seed script: `prisma/seed.ts`
- Reserved projects: 1-2 for tests, 3 for development
- Test user: `test@e2e.local` (never deleted)
