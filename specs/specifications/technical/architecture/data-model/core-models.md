# Core Models

## Core Models

### User

User accounts with authentication and project ownership.

```prisma
model User {
  id                    String                @id
  name                  String?
  email                 String                @unique
  emailVerified         DateTime?
  image                 String?
  stripeCustomerId      String?               @unique @db.VarChar(255)
  createdAt             DateTime              @default(now())
  updatedAt             DateTime
  accounts              Account[]
  comments              Comment[]
  projects              Project[]
  sessions              Session[]
  memberships           ProjectMember[]
  notificationsReceived Notification[]        @relation("NotificationRecipient")
  notificationsCreated  Notification[]        @relation("NotificationActor")
  pushSubscriptions     PushSubscription[]
  personalAccessTokens  PersonalAccessToken[]
  subscription          Subscription?

  @@index([email])
}
```

**Purpose**: Authentication and project ownership

**Fields**:
- `id`: Unique identifier (CUID format)
- `email`: Unique email address (authentication identifier)
- `name`: Display name (nullable, from OAuth provider)
- `emailVerified`: Email verification timestamp (from OAuth)
- `image`: Profile image URL (nullable, from OAuth provider)
- `createdAt`: Account creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- One-to-many: Projects, Comments, Accounts, Sessions, ProjectMembers (as memberships), Notifications (as recipient and actor), PushSubscriptions, PersonalAccessTokens

**Constraints**:
- Unique email address
- Cascade delete: Comments, ProjectMembers, Notifications

**Business Rules**:
- Every project must have a user (required userId)
- Email uniquely identifies users across system
- Preview credentials login reuses or creates `User` records by email and marks them verified
- Seeded test users such as `test@e2e.local` exist for automated validation, but runtime auth accepts them only through the explicit test override flow
- Users can have multiple push subscriptions (different browsers/devices)
- `stripeCustomerId` is set on first subscription checkout and is immutable thereafter
- Each user has at most one Subscription record (one-to-one)

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
  config               Json?
  configSyncedAt       DateTime?
  defaultBranch        String               @default("main")
  specifyModel         String?              @db.VarChar(50)
  planModel            String?              @db.VarChar(50)
  implementModel       String?              @db.VarChar(50)
  quickImplModel       String?              @db.VarChar(50)
  verifyModel          String?              @db.VarChar(50)
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  user                 User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  tickets              Ticket[]
  members              ProjectMember[]
  comparisonRecords    ComparisonRecord[]
  healthScans          HealthScan[]
  healthScore          HealthScore?
  setupJobs            ProjectSetupJob[]
  outcomes             TicketOutcome[]
  backfillProgress     BackfillProgress?

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
  @@index([userId])
  @@index([key])
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
- `config`: Parsed `.ai-board/config.yml` content stored as JSON (nullable — null means no config synced)
- `configSyncedAt`: Timestamp of the last successful config fetch from GitHub (nullable)
- `defaultBranch`: The repository's default branch name (default: `"main"`), auto-updated during config sync
- `specifyModel`: Claude model ID for SPECIFY jobs (max 50 chars, nullable — null resolves to global fallback `claude-opus-4-7`)
- `planModel`: Claude model ID for PLAN jobs (max 50 chars, nullable)
- `implementModel`: Claude model ID for IMPLEMENT jobs (max 50 chars, nullable)
- `quickImplModel`: Claude model ID for QUICK-IMPL jobs (max 50 chars, nullable)
- `verifyModel`: Claude model ID for VERIFY jobs (max 50 chars, nullable)
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to User (required, cascade delete)
- One-to-many: Tickets, ProjectMembers, ComparisonRecords, HealthScans, ProjectSetupJobs
- One-to-one (optional): HealthScore

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
- `config` is nullable; null means no config has been synced — workflows use backward-compatible defaults (PostgreSQL 16, Bun)
- `config` stores the parsed config without the `env` section (secrets excluded from DB)
- `configSyncedAt` drives staleness checks: config older than 1 hour is auto-refreshed before workflow dispatch
- Config sync fails explicitly rather than silently using stale data — dispatch is blocked if auto-refresh fails
- Per-stage model fields (`specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`) are nullable; null means the stage resolves to the global fallback (`claude-opus-4-7`)
- New projects are seeded with smart defaults: SPECIFY=`claude-opus-4-7`, PLAN=`claude-opus-4-7`, IMPLEMENT=`claude-sonnet-4-6`, QUICK-IMPL=`claude-sonnet-4-6`, VERIFY=`claude-sonnet-4-6` (set inside the project creation transaction)
- Pre-existing projects (null values) resolve to `claude-opus-4-7` on every stage — identical behavior to before the feature shipped
- Only values from the closed whitelist (`claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) are accepted on write; invalid values are rejected with `INVALID_MODEL_ID`
- Per-stage model configuration is only active when the effective agent is Claude; non-Claude dispatches ignore these fields entirely

### Ticket

Tickets track work items through six workflow stages.

```prisma
model Ticket {
  id                     Int                       @id @default(autoincrement())
  title                  String                    @db.VarChar(100)
  description            String                    @db.VarChar(10000)
  stage                  Stage                     @default(INBOX)
  version                Int                       @default(1)
  projectId              Int
  ticketNumber           Int
  ticketKey              String                    @unique @db.VarChar(20)
  branch                 String?                   @db.VarChar(200)
  previewUrl             String?                   @db.VarChar(500)
  autoMode               Boolean                   @default(false)
  workflowType           WorkflowType              @default(FULL)
  attachments            Json?                     @default("[]")
  createdAt              DateTime                  @default(now())
  updatedAt              DateTime                  @default(now()) @updatedAt
  clarificationPolicy    ClarificationPolicy?
  agent                  Agent?
  closedAt               DateTime?
  specifyModel           String?                   @db.VarChar(50)
  planModel              String?                   @db.VarChar(50)
  implementModel         String?                   @db.VarChar(50)
  quickImplModel         String?                   @db.VarChar(50)
  verifyModel            String?                   @db.VarChar(50)
  comments               Comment[]
  jobs                   Job[]
  notifications          Notification[]
  project                Project                   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sourceComparisons      ComparisonRecord[]        @relation("ComparisonSourceTicket")
  winnerComparisons      ComparisonRecord[]        @relation("ComparisonWinnerTicket")
  comparisonParticipants ComparisonParticipant[]
  decisionVerdicts       DecisionPointEvaluation[] @relation("DecisionVerdictTicket")
  outcome                TicketOutcome?

  @@unique([projectId, ticketNumber])
  @@index([projectId])
  @@index([stage])
  @@index([updatedAt])
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
- `autoMode`: When true on a FULL-workflow ticket in INBOX/SPECIFY/PLAN, successful workflow job completions automatically dispatch the next stage transition (SPECIFY → PLAN → BUILD). Auto-disengages on FAILED/CANCELLED jobs, on dispatch failures, and on VERIFY → PLAN rollback. Default: false
- `workflowType`: Workflow path used (enum: FULL, QUICK, CLEAN; default: FULL). CLEAN is historical only -- creation path removed; retained for existing tickets.
- `clarificationPolicy`: Optional policy override (nullable, inherits from project when null)
- `agent`: Optional AI agent override (nullable, inherits from project `defaultAgent` when null)
- `specifyModel`: Optional Claude model override for SPECIFY jobs (max 50 chars, nullable — null means inherit project default)
- `planModel`: Optional Claude model override for PLAN jobs (max 50 chars, nullable)
- `implementModel`: Optional Claude model override for IMPLEMENT jobs (max 50 chars, nullable)
- `quickImplModel`: Optional Claude model override for QUICK-IMPL jobs (max 50 chars, nullable)
- `verifyModel`: Optional Claude model override for VERIFY jobs (max 50 chars, nullable)
- `attachments`: Image attachments (JSON array of TicketAttachment objects, default: empty array)
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
- One-to-many: Jobs, Comments, Notifications, ComparisonParticipants, DecisionPointEvaluations (as verdict ticket)
- Referenced by: ComparisonRecord (as sourceTicket or winnerTicket)

**Constraints**:
- Unique ticketKey across all tickets
- Unique (projectId, ticketNumber) within project
- Index on projectId for filtering
- Index on stage for board queries
- Index on updatedAt for sorting
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
- Per-stage model overrides (`specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`) are nullable; null means inherit the project's value for that stage, which itself falls back to the global fallback `claude-opus-4-7`
- Stored per-stage overrides are preserved (not cleared) when the ticket's agent is switched to a non-Claude provider; they become active again if the agent is switched back to Claude
- Resolution at dispatch: `ticket.{stageModel}` → `project.{stageModel}` → `claude-opus-4-7` (only when effective agent is Claude)
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
  - Closes all open GitHub PRs for ticket branch with explanatory comment
  - Preserves Git branch (not deleted)
  - Sets closedAt timestamp automatically
  - CLOSED tickets excluded from board display but included in search results
  - CLOSED is terminal state (no outbound transitions)

### Job

Jobs track GitHub Actions workflow executions.

```prisma
model Job {
  id              Int       @id @default(autoincrement())
  ticketId        Int
  projectId       Int
  command         String    @db.VarChar(50)
  status          JobStatus @default(PENDING)
  branch          String?   @db.VarChar(200)
  commitSha       String?   @db.VarChar(40)
  logs            String?
  startedAt       DateTime  @default(now())
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime
  workflowRunId   BigInt?   // GitHub Actions workflow run ID (populated on first RUNNING callback)

  // Claude telemetry metrics (aggregated from all API calls in the job)
  inputTokens         Int?      // Total input tokens consumed
  outputTokens        Int?      // Total output tokens generated
  cacheReadTokens     Int?      // Total cache read tokens
  cacheCreationTokens Int?      // Total cache creation tokens
  costUsd             Float?    // Total cost in USD
  durationMs          Int?      // Total Claude API duration in milliseconds
  model               String?   @db.VarChar(50)  // Primary model used
  toolsUsed           String[]  @default([])     // List of tools used (Edit, Write, Bash, etc.)

  // Per-turn context-size metrics (derived from per-call OTLP events)
  peakContextTokens   Int?      // Maximum per-turn context tokens attended
  avgContextTokens    Int?      // Mean per-turn context tokens attended (rounded)
  turnCount           Int?      // Number of per-turn events successfully parsed

  // Quality score (FULL workflow verify jobs only)
  qualityScore        Int?      // Final weighted quality score (0-100)
  qualityScoreDetails String?   @db.Text  // JSON with dimension sub-scores and weights

  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  log         JobLog?

  @@index([ticketId])
  @@index([projectId])
  @@index([ticketId, status, startedAt])
  @@index([status])
  @@index([workflowRunId])
}
```

**Purpose**: Workflow execution tracking and status monitoring

**Fields**:
- `id`: Auto-incrementing unique identifier
- `ticketId`: Associated ticket (required foreign key)
- `projectId`: Parent project (required foreign key, for polling queries)
- `command`: Spec-kit command executed (specify|plan|implement|verify|ship|quick-impl|deploy-preview|rollback-reset|iterate|comment-specify|comment-plan|comment-build|comment-verify|comment-ship|health-scan, max 50 chars)
- `status`: Current execution state (enum: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- `branch`: Git branch name (max 200 chars, nullable)
- `commitSha`: Git commit hash (max 40 chars, nullable)
- `logs`: Legacy free-form log field (text, unlimited); retained for full-clone compatibility and not populated by the current agent log capture pipeline, which writes to the separate `JobLog` model
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
- `peakContextTokens`: Maximum per-turn context size observed during the job (nullable). Derived as `input_tokens + cache_read_tokens + cache_creation_tokens` for Claude turns, `input_token_count` for Codex turns, and the max cumulative snapshot for Gemini. Null for agents with no per-turn telemetry (Mistral) and for jobs that predate per-turn ingestion.
- `avgContextTokens`: Arithmetic mean of per-turn context size across parsed turns, rounded to integer (nullable). Null under the same conditions as `peakContextTokens`, plus null for Gemini (cumulative snapshots are not per-turn deltas).
- `turnCount`: Count of per-turn events successfully parsed during the job (nullable). Null under the same conditions as `avgContextTokens`.
- `workflowRunId`: GitHub Actions workflow run ID as BigInt (nullable, populated by the workflow's first RUNNING status callback; enables job cancellation via GitHub API)
- `qualityScore`: Final weighted code quality score 0-100 (nullable, FULL workflow verify jobs only)
- `qualityScoreDetails`: JSON string containing all five dimension sub-scores, weights, and computed final score (nullable, populated alongside `qualityScore`)

**Relationships**:
- Belongs to Ticket (required, cascade delete)
- Belongs to Project (required, cascade delete)

**Constraints**:
- Index on ticketId for job history queries
- Index on projectId for polling all project jobs
- Composite index (ticketId, status, startedAt) for job completion validation
- Index on status for filtering running jobs
- Index on workflowRunId for cancel lookups

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
  - Deleted when a rollback transition occurs (job record removed as part of rollback)
- AI-BOARD jobs (command like 'comment-%') don't block transitions or count toward rollback validation
- `workflowRunId` is set once (first-write-wins) when the workflow sends its first RUNNING callback; subsequent RUNNING callbacks with a run ID are ignored if already populated
- When a PENDING job is cancelled before `workflowRunId` is set, any subsequent RUNNING callback for that job receives a 409 response, signalling the workflow to self-abort
- Users can cancel RUNNING or PENDING jobs via `POST /api/jobs/:id/cancel` (session auth); cancellation calls the GitHub Actions API for RUNNING jobs or marks CANCELLED directly for PENDING jobs

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

**Per-Turn Context Metrics**:
- `peakContextTokens`, `avgContextTokens`, and `turnCount` are written by the OTLP processor in the same atomic `UPDATE` that writes the existing aggregated tokens — never split across multiple writes
- A `null` value is never replaced with another `null`: a batch with no parseable per-turn events leaves the prior values untouched
- A `0` is never stored as a stand-in for "unknown" — the contract is strictly "null when no per-turn telemetry was observed"
- No backfill is run on historical jobs; jobs that predate per-turn ingestion stay null
- Gemini jobs may populate `peakContextTokens` while leaving `avgContextTokens` and `turnCount` null, because Gemini emits cumulative snapshots rather than per-turn deltas
- Mistral jobs leave all three fields null (batch payload exposes no per-turn data)

**Quality Score Data**:
- `qualityScore` populated only when: `command = "verify"` and `status = "COMPLETED"` (all workflow types)
- `qualityScoreDetails` JSON structure:
  ```json
  {
    "dimensions": {
      "bugDetection": { "score": 90, "weight": 0.30 },
      "compliance": { "score": 80, "weight": 0.40 },
      "codeComments": { "score": 70, "weight": 0.20 },
      "historicalContext": { "score": 85, "weight": 0.10 },
      "specSync": { "score": 95, "weight": 0.00 }
    },
    "finalScore": 83
  }
  ```
- Score is read-only after computation; no update or delete endpoints exposed
- When multiple verify jobs exist (rollback-reset cycles), the UI scans completed verify jobs and displays the score from the latest job by `startedAt`
- The Stats tab always renders the summary score first; dimension rows are shown only when `qualityScoreDetails` contains one or more parsed dimensions and the user expands the disclosure
- If `qualityScore` exists but `qualityScoreDetails` is absent or cannot be parsed, the UI still shows the overall score and threshold label without the expandable breakdown

### JobLog

Captured agent execution transcript summary for a terminated job.

```prisma
model JobLog {
  id             Int           @id @default(autoincrement())
  jobId          Int           @unique
  captureStatus  CaptureStatus
  preview        String        @db.VarChar(320)
  schemaVersion  Int           @default(1)
  eventCount     Int           @default(0)
  errorCount     Int           @default(0)
  artifactKey    String?       @db.VarChar(300)
  artifactSize   Int?
  capturedAt     DateTime      @default(now())
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  job Job @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([captureStatus, createdAt])
  @@index([createdAt])
}
```

**Purpose**: Store the glanceable summary and external artifact reference for an agent run, so project members can diagnose workflow failures from the ai-board UI without GitHub Actions access.

**Fields**:
- `id`: Auto-incrementing primary key
- `jobId`: Parent job (unique — one log per job)
- `captureStatus`: `CAPTURED`, `UNAVAILABLE`, or `PRUNED` (see `CaptureStatus` enum)
- `preview`: Inline timeline preview text — stored with a 320-char column to leave unicode slack over the 280-char effective cap
- `schemaVersion`: Version of the normalized event stream format carried by the artifact (currently `1`)
- `eventCount`: Number of normalized events in the artifact
- `errorCount`: Number of `error` events in the artifact (≤ `eventCount`)
- `artifactKey`: Vercel Blob pathname (`logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`); null when `captureStatus !== CAPTURED`
- `artifactSize`: Size of the gzipped artifact in bytes; null when no artifact exists
- `capturedAt`: When capture completed on the runner
- `createdAt` / `updatedAt`: Row timestamps

**Relationships**:
- Belongs to Job (required, cascade delete)

**Constraints**:
- Unique `jobId` — exactly one log per job
- Composite index `(captureStatus, createdAt)` services the retention-prune scan
- Index on `createdAt` supports prune ordering

**Business Rules**:
- `POST /api/jobs/:id/logs` is an idempotent upsert keyed on `jobId`; a second submission replaces the first
- `preview` is re-run through the server-side redactor before persistence as defense-in-depth — the runner also redacts before upload
- `preview` is capped at 280 chars with trailing `…` truncation; the 320-char DB column absorbs unicode overhead
- `captureStatus = CAPTURED` requires both `artifactKey` and `artifactSize`; `UNAVAILABLE` forbids them
- Log capture is independent of `PATCH /api/jobs/:id/status` — a capture failure must never prevent the job's terminal status from being reported
- Telemetry fields on `Job` (`inputTokens`, `costUsd`, `toolsUsed`, `qualityScore`, …) are written by a separate pipeline and remain unaffected by log capture outcome
- Hard-deleted by retention pruning after 30 days (`LOG_RETENTION_DAYS`, configurable); no soft-delete column
- Prune order per record: delete Blob artifact first (404 treated as success), then delete Postgres row
- Access for read endpoints follows the parent ticket's ownership and membership rules via `verifyTicketAccess`
- Blob artifact pathname is never rendered client-side — reads are proxied through the authenticated API

### Comment

Comments enable ticket collaboration with markdown support.

```prisma
model Comment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  userId    String
  content       String         @db.VarChar(2000)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  notifications Notification[]

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
- User mentions via `@[userId:displayName]` syntax
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

  @@index([recipientId, createdAt])
  @@index([recipientId, read])
  @@index([createdAt])
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
- Composite index (recipientId, createdAt) for listing notifications for user
- Composite index (recipientId, read) for counting unread notifications
- Index on createdAt for cleanup job (30-day retention)

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

### Subscription

Tracks a user's active Stripe subscription and billing state.

```prisma
model Subscription {
  id                   Int                @id @default(autoincrement())
  userId               String             @unique
  stripeSubscriptionId String             @unique @db.VarChar(255)
  stripePriceId        String             @db.VarChar(255)
  plan                 SubscriptionPlan   @default(FREE)
  status               SubscriptionStatus @default(ACTIVE)
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  trialStart           DateTime?
  trialEnd             DateTime?
  cancelAt             DateTime?
  canceledAt           DateTime?
  gracePeriodEndsAt    DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([stripeSubscriptionId])
  @@index([status])
  @@index([gracePeriodEndsAt])
}
```

**Purpose**: Persist subscription plan, status, and billing period for plan-based feature gating.

**Fields**:
- `userId`: One-to-one relationship with User (unique constraint)
- `stripeSubscriptionId`: Stripe subscription object ID (unique)
- `stripePriceId`: Stripe Price ID for the active plan
- `plan`: Current subscribed plan (`FREE`, `PRO`, `TEAM`)
- `status`: Stripe subscription status (`ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`, `INCOMPLETE`)
- `currentPeriodStart/End`: Active billing period dates
- `trialStart/End`: Trial period dates (nullable)
- `cancelAt`: Scheduled cancellation date from Stripe (nullable)
- `canceledAt`: Actual cancellation timestamp (nullable)
- `gracePeriodEndsAt`: 7 days after first payment failure; Free limits apply after this date

**Business Rules**:
- Created/updated by webhook handler (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`)
- Effective plan resolved at feature-gate time (see `getEffectivePlan` in `lib/billing/subscription.ts`)
- No subscription record → user treated as FREE plan
- PAST_DUE within grace period → subscribed plan limits remain active
- PAST_DUE after grace period expiry → FREE plan limits enforced
- CANCELED records are preserved (not deleted) for audit; `getEffectivePlan` returns `FREE`
- Cascade delete when user account deleted (only via account deletion, not subscription cancellation)

### StripeEvent

Idempotency log for processed Stripe webhook events.

```prisma
model StripeEvent {
  id          String   @id @db.VarChar(255)
  type        String   @db.VarChar(100)
  processedAt DateTime @default(now())

  @@index([type])
  @@index([processedAt])
}
```

**Purpose**: Prevent duplicate processing of retried or out-of-order webhook events.

**Fields**:
- `id`: Stripe event ID (e.g., `evt_...`) — used as primary key for O(1) lookup
- `type`: Stripe event type (e.g., `checkout.session.completed`)
- `processedAt`: When the event was first processed

**Business Rules**:
- Webhook handler checks for existing record before processing; duplicate events are silently ignored
- Records are never deleted (permanent audit log of processed events)

### VerificationToken

NextAuth.js email verification tokens.

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

**Purpose**: Email verification for authentication flows

**Fields**:
- `identifier`: Email or other identifier
- `token`: Unique verification token
- `expires`: Token expiration timestamp

**Constraints**:
- Unique token
- Unique (identifier, token) combination

### PersonalAccessToken

API tokens for programmatic access and workflow authentication.

```prisma
model PersonalAccessToken {
  id         Int       @id @default(autoincrement())
  userId     String
  name       String    @db.VarChar(100)
  hash       String    @db.VarChar(64)
  salt       String    @db.VarChar(32)
  preview    String    @db.VarChar(4)
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, hash])
  @@index([userId])
  @@index([preview])
}
```

**Purpose**: Secure API token management for programmatic access

**Fields**:
- `id`: Auto-incrementing unique identifier
- `userId`: Token owner (required foreign key)
- `name`: Human-readable token name (max 100 chars)
- `hash`: SHA-256 hash of the token (max 64 chars)
- `salt`: Random salt for token hashing (max 32 chars)
- `preview`: Last 4 characters of the token for identification (max 4 chars)
- `lastUsedAt`: Timestamp of last token usage (nullable)
- `createdAt`: Token creation timestamp

**Relationships**:
- Belongs to User (required, cascade delete)

**Constraints**:
- Unique (userId, hash) — prevents duplicate tokens per user
- Index on userId for efficient token lookup
- Index on preview for token identification

**Business Rules**:
- Tokens are hashed with salt before storage (plaintext never persisted)
- Token preview shown in UI for identification
- Last used timestamp updated on each API call
- Cascade delete when user is deleted

### UserCredential

Encrypted AI provider credentials for BYOK (Bring Your Own Key) workflow execution.

```prisma
model UserCredential {
  id                  Int                 @id @default(autoincrement())
  userId              String
  provider            CredentialProvider
  credentialType      CredentialType
  label               String              @db.VarChar(100)
  encryptedValue      String
  iv                  String              @db.VarChar(24)
  authTag             String              @db.VarChar(24)
  preview             String              @db.VarChar(4)
  readinessStatus     CredentialReadiness @default(PENDING_VERIFICATION)
  lastVerifiedAt      DateTime?
  verificationCode    String?             @db.VarChar(50)
  verificationMessage String?             @db.VarChar(500)
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId])
}
```

**Purpose**: Stores encrypted AI provider credentials so workflows can retrieve them securely at runtime. Each user may have at most one credential per provider.

**Fields**:
- `id`: Auto-incrementing primary key
- `userId`: Credential owner (required foreign key)
- `provider`: AI provider (enum: `CredentialProvider`)
- `credentialType`: Credential kind — `API_KEY` or `OAUTH_TOKEN`
- `label`: User-assigned display name (max 100 chars)
- `encryptedValue`: AES-256-GCM encrypted credential value
- `iv`: Base64-encoded 12-byte initialization vector (max 24 chars)
- `authTag`: Base64-encoded 16-byte GCM authentication tag (max 24 chars)
- `preview`: Last 4 characters of the credential for display (max 4 chars)
- `readinessStatus`: Current verification state (`CredentialReadiness` enum)
- `lastVerifiedAt`: Timestamp of last provider verification (nullable)
- `verificationCode`: Machine-readable verification result (e.g., `VALID`, `INVALID_KEY`, `EXPIRED`, `UNREACHABLE`)
- `verificationMessage`: User-facing remediation message (max 500 chars, nullable)
- `createdAt` / `updatedAt`: Timestamps

**Relationships**:
- Belongs to User (required, cascade delete)

**Constraints**:
- Unique `(userId, provider)` — one credential per provider per user
- Index on `userId` for credential list queries

**Business Rules**:
- Credentials encrypted with AES-256-GCM; master key stored in `CREDENTIAL_ENCRYPTION_KEY` env var
- Full credential value never returned to the client after initial submission
- Workflow dispatch blocked when the project owner has no credential for the target provider
- Team projects use the project owner's credential regardless of which member triggers the workflow
- Cascade delete when user is deleted

### TicketOutcome

Immutable per-ticket snapshot written exactly once when a ticket reaches the SHIP stage. Aggregates job telemetry, change-shape signals, structural domains, and semantic tags for analytics and prediction grounding.

```prisma
model TicketOutcome {
  id                       Int          @id @default(autoincrement())

  ticketId                 Int          @unique
  projectId                Int
  workflowType             WorkflowType
  shippedAt                DateTime
  capturedAt               DateTime     @default(now())
  ruleSetVersion           Int

  totalCostUsd             Float?
  totalDurationMs          Int?
  totalInputTokens         Int?
  totalOutputTokens        Int?
  totalThinkingTokens      Int?
  totalCacheReadTokens     Int?
  totalCacheCreationTokens Int?
  toolsUsed                String[]     @default([])

  pipelineJobCount         Int          @default(0)
  frictionJobCount         Int          @default(0)
  totalJobCount            Int          @default(0)
  jobCountByPrefix         Json         @default("{}")

  qualityScore             Int?

  filesTouched             String[]     @default([])
  linesAdded               Int?
  linesRemoved             Int?
  testCodeRatio            Float?

  domains                  String[]     @default([])
  domainFileCounts         Json         @default("{}")

  touchedDbSchema          Boolean      @default(false)
  touchedTests             Boolean      @default(false)
  touchedCi                Boolean      @default(false)

  frictionFree             Boolean      @default(false)

  partial                  Boolean      @default(false)
  partialReason            String?      @db.VarChar(40)

  ticket                   Ticket       @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project                  Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, shippedAt(sort: Desc)])
  @@index([projectId, frictionFree])
  @@index([projectId, partial])
  @@index([shippedAt])
}
```

**Purpose**: Append-only delivery record per shipped ticket — the canonical source for "what was delivered, at what cost, in what shape" without re-aggregating across jobs and commits.

**Fields**:
- `ticketId`: Parent ticket (unique — at most one outcome per ticket)
- `projectId`: Denormalized for project-scoped analytics queries
- `workflowType`: Snapshot of the ticket's workflow type at SHIP time (`FULL`, `QUICK`, or `CLEAN` for legacy rows)
- `shippedAt`: Moment the SHIP transition committed
- `capturedAt`: Moment this row was written (always `>= shippedAt`)
- `ruleSetVersion`: Pinned version of the classification, threshold, and stack-indicator rules used to derive this row
- `totalCostUsd`, `totalDurationMs`, `total{Input,Output,Thinking,CacheRead,CacheCreation}Tokens`: Sums across all jobs of the ticket; null only when every contributing job had a null value
- `toolsUsed`: Union of `Job.toolsUsed` across all jobs
- `pipelineJobCount` / `frictionJobCount` / `totalJobCount`: Job counts by classification (invariant: `pipelineJobCount + frictionJobCount === totalJobCount`)
- `jobCountByPrefix`: JSON map of command-prefix → count (e.g., `{ "specify": 1, "implement": 1, "iterate": 2 }`)
- `qualityScore`: `Job.qualityScore` from the latest COMPLETED verify job (nullable; null for QUICK tickets and verify-without-score cases)
- `filesTouched`: Sorted, deduplicated list of file paths in the ticket's branch merge contribution against the project's default branch (resolved via the merged PR's `merge_commit_sha`, or a branch-vs-default-branch compare fallback)
- `linesAdded` / `linesRemoved`: Sums of additions and deletions across the merge-diff file set
- `testCodeRatio`: `linesInTestPaths / max(linesAdded + linesRemoved, 1)`, where test paths come from `STACK_INDICATORS` for the project's language and testing framework
- `domains`: Unique top-level path segments touched (e.g., `["app", "lib", "tests"]`)
- `domainFileCounts`: JSON frequency map of segment → file count
- `touchedDbSchema` / `touchedTests` / `touchedCi`: Booleans derived from `STACK_INDICATORS` against the project's declared `services`, `testing.framework`, and `language`; missing stack coverage yields `false` (never errors)
- `frictionFree`: True iff `frictionJobCount === 0` AND `qualityScore !== null` AND `qualityScore >= 75`
- `partial`: True when change-shape data could not be derived (no jobs, ticket has no `branch`, no merged PR found for the branch, repository unreachable, or fetches exhausted retries)
- `partialReason`: One of `no_jobs`, `no_branch_reference`, `merge_not_found`, `repository_unreachable`, `fetch_failed_after_retry`; null when `partial = false`

**Relationships**:
- Belongs to Ticket (required, cascade delete)
- Belongs to Project (required, cascade delete) — denormalized for query convenience

**Constraints**:
- Unique `ticketId` enforces 1:1 with Ticket and protects against duplicate writes from concurrent live-capture and backfill paths (P2002 catch in `lib/outcomes/persist.ts` collapses races to a no-op)
- `(projectId, shippedAt DESC)` index serves the project list/analytics query
- `(projectId, frictionFree)` and `(projectId, partial)` indexes serve aggregate filters
- `(shippedAt)` index serves cross-project time-window queries

**Business Rules**:
- Written by `lib/outcomes/capture.ts` after the SHIP transition commits (fire-and-forget — capture failure does not block or revert SHIP)
- Immutable after creation: never updated, only deleted on cascade if the parent ticket is hard-deleted
- The first SHIP transition for a ticket is the outcome-defining one; rolled-back-then-re-shipped tickets do not get a new row
- Capture covers both FULL and QUICK workflows; QUICK rows have `qualityScore = null` and `frictionFree = false` by definition
- `partial = true` rows still populate job-level signals fully; only change-shape and domain fields are empty/null
- Rule-set version is captured per row so older rows remain interpretable under their original rules; outcomes are never recomputed when rules later change

### BackfillProgress

Per-project resume cursor for the historical outcome backfill workflow.

```prisma
model BackfillProgress {
  id                    Int            @id @default(autoincrement())
  projectId             Int            @unique
  status                BackfillStatus @default(IN_PROGRESS)
  lastProcessedTicketId Int?
  ticketsProcessed      Int            @default(0)
  ticketsWithPartial    Int            @default(0)
  startedAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt
  completedAt           DateTime?
  version               Int            @default(1)
  lastError             String?        @db.VarChar(2000)

  project               Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([status])
}
```

**Purpose**: Track progress and enable safe resume of the per-project historical outcome backfill across runner timeouts, network blips, and concurrent workflow dispatches.

**Fields**:
- `projectId`: Parent project (unique — one progress row per project across all runs)
- `status`: Current backfill state (`IN_PROGRESS`, `COMPLETED`, or `FAILED`)
- `lastProcessedTicketId`: Cursor — the most recently processed `Ticket.id`; the next chunk resumes by selecting tickets with `id < lastProcessedTicketId` (newest-first order)
- `ticketsProcessed`: Running count of tickets whose outcome was written by this or a prior run
- `ticketsWithPartial`: Running count of `partial = true` rows produced (operator-visible signal of repository reachability)
- `startedAt`: When the first run for this project began
- `completedAt`: Set when `status = COMPLETED`
- `version`: Optimistic-lock counter — every cursor advance uses `updateMany({ where: { projectId, version }, data: { ..., version: { increment: 1 } } })`; collisions cause the losing worker to exit cleanly
- `lastError`: Operator-visible error message; cleared on successful resume

**Relationships**:
- Belongs to Project (required, cascade delete)

**Constraints**:
- Unique `projectId`
- Index on `status` to scope retention or operator queries

**Business Rules**:
- Created by `POST /api/projects/:projectId/backfill-outcomes` and updated by the backfill runner (`scripts/backfill-outcomes.ts`)
- Enumeration is restricted to tickets in stage `SHIP` (matches the live capture path); tickets in stage `CLOSED` are never selected, fetched, or processed
- Re-dispatching against a `COMPLETED` row is a no-op (enumeration finds zero remaining tickets and returns to `COMPLETED`)
- Re-dispatching against a `FAILED` row resumes from `lastProcessedTicketId`
- Two concurrent dispatches collide on `version`; the losing worker exits cleanly and the unique constraint on `TicketOutcome.ticketId` prevents duplicate rows even if both happen to pick the same ticket simultaneously
- Idempotent against existing rows: tickets that already have a `TicketOutcome` are skipped during enumeration

