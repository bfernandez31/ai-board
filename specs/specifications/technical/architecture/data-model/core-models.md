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
  ticketsCreated        Ticket[]              @relation("TicketCreator")
  pushSubscriptions     PushSubscription[]
  personalAccessTokens  PersonalAccessToken[]
  subscription          Subscription?
  ticketAnalyses        TicketAnalysis[]

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
- One-to-many: Projects, Comments, Accounts, Sessions, ProjectMembers (as memberships), Notifications (as recipient and actor), Tickets (as creator), PushSubscriptions, PersonalAccessTokens

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
  codexSpecifyModel    String?              @db.VarChar(50)
  codexPlanModel       String?              @db.VarChar(50)
  codexImplementModel  String?              @db.VarChar(50)
  codexQuickImplModel  String?              @db.VarChar(50)
  codexVerifyModel     String?              @db.VarChar(50)
  tokenSaving          Boolean              @default(false)
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
  analyses             TicketAnalysis[]

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
- `specifyModel`: Claude model ID for SPECIFY jobs (max 50 chars, nullable — null resolves to global fallback `claude-opus-4-8`)
- `planModel`: Claude model ID for PLAN jobs (max 50 chars, nullable)
- `implementModel`: Claude model ID for IMPLEMENT jobs (max 50 chars, nullable)
- `quickImplModel`: Claude model ID for QUICK-IMPL jobs (max 50 chars, nullable)
- `verifyModel`: Claude model ID for VERIFY jobs (max 50 chars, nullable)
- `codexSpecifyModel`: Codex model ID for SPECIFY jobs (max 50 chars, nullable — null resolves to global fallback `gpt-5.5`)
- `codexPlanModel`: Codex model ID for PLAN jobs (max 50 chars, nullable)
- `codexImplementModel`: Codex model ID for IMPLEMENT jobs (max 50 chars, nullable)
- `codexQuickImplModel`: Codex model ID for QUICK-IMPL jobs (max 50 chars, nullable)
- `codexVerifyModel`: Codex model ID for VERIFY jobs (max 50 chars, nullable)
- `tokenSaving`: Whether token saving via RTK is enabled by default for Claude agent runs in this project (Boolean, default: false). Controlled by the project owner. When ON, Claude agent runs activate RTK output compression unless overridden at the ticket level.
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
- Per-stage Claude model fields (`specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`) are nullable; null resolves to the Claude global fallback `claude-opus-4-8`
- Per-stage Codex model fields (`codexSpecifyModel`, `codexPlanModel`, `codexImplementModel`, `codexQuickImplModel`, `codexVerifyModel`) are nullable; null resolves to the Codex global fallback `gpt-5.5`
- Claude and Codex column sets are independent: switching `defaultAgent` between Claude and Codex never reads from or writes to the other agent's columns (dormancy contract)
- New projects are seeded inside the creation transaction with both agents' smart defaults regardless of `defaultAgent`: Claude SPECIFY=`claude-opus-4-8`, PLAN=`claude-opus-4-8`, IMPLEMENT=`claude-sonnet-4-6`, QUICK-IMPL=`claude-sonnet-4-6`, VERIFY=`claude-sonnet-4-6`; Codex SPECIFY=`gpt-5.5`, PLAN=`gpt-5.5`, IMPLEMENT=`gpt-5.4`, QUICK-IMPL=`gpt-5.4-mini`, VERIFY=`gpt-5.4-mini`
- Pre-existing projects (null values) resolve to the active agent's global fallback on every stage
- Claude values must come from the whitelist (`claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`); Codex values must come from the whitelist (`gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2`); other values rejected with `INVALID_MODEL_ID`
- A stored value not present in its agent's current whitelist (e.g., deprecated by the provider) is treated as `null` by the resolver and falls through to the next layer — never throws
- Per-stage model configuration is only active when the effective agent matches the column set (Claude columns for Claude dispatches, Codex columns for Codex dispatches); Mistral/Gemini dispatches ignore both sets and the CLI uses its own default

### Ticket

Tickets track work items through six workflow stages.

```prisma
model Ticket {
  id                      Int                       @id @default(autoincrement())
  title                   String                    @db.VarChar(100)
  description             String                    @db.VarChar(10000)
  stage                   Stage                     @default(INBOX)
  version                 Int                       @default(1)
  projectId               Int
  ticketNumber            Int
  ticketKey               String                    @unique @db.VarChar(20)
  branch                  String?                   @db.VarChar(200)
  previewUrl              String?                   @db.VarChar(500)
  autoMode                Boolean                   @default(false)
  workflowType            WorkflowType              @default(FULL)
  attachments             Json?                     @default("[]")
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime                  @default(now()) @updatedAt
  clarificationPolicy     ClarificationPolicy?
  agent                   Agent?
  closedAt                DateTime?
  specifyModel            String?                   @db.VarChar(50)
  planModel               String?                   @db.VarChar(50)
  implementModel          String?                   @db.VarChar(50)
  quickImplModel          String?                   @db.VarChar(50)
  verifyModel             String?                   @db.VarChar(50)
  codexSpecifyModel       String?                   @db.VarChar(50)
  codexPlanModel          String?                   @db.VarChar(50)
  codexImplementModel     String?                   @db.VarChar(50)
  codexQuickImplModel     String?                   @db.VarChar(50)
  codexVerifyModel        String?                   @db.VarChar(50)
  tokenSaving             Boolean?
  creatorId               String?                   @db.VarChar(255)
  creator                 User?                     @relation("TicketCreator", fields: [creatorId], references: [id], onDelete: SetNull)
  comments                Comment[]
  jobs                    Job[]
  notifications           Notification[]            @relation("NotificationTicket")
  mergedIntoNotifications Notification[]            @relation("NotificationMergedInto")
  project                 Project                   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sourceComparisons       ComparisonRecord[]        @relation("ComparisonSourceTicket")
  winnerComparisons       ComparisonRecord[]        @relation("ComparisonWinnerTicket")
  comparisonParticipants  ComparisonParticipant[]
  decisionVerdicts        DecisionPointEvaluation[] @relation("DecisionVerdictTicket")
  outcome                 TicketOutcome?
  analyses                TicketAnalysis[]

  @@unique([projectId, ticketNumber])
  @@index([projectId])
  @@index([stage])
  @@index([updatedAt])
  @@index([projectId, workflowType])
  @@index([ticketKey])
  @@index([creatorId])
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
- `codexSpecifyModel`: Optional Codex model override for SPECIFY jobs (max 50 chars, nullable — null means inherit project default)
- `codexPlanModel`: Optional Codex model override for PLAN jobs (max 50 chars, nullable)
- `codexImplementModel`: Optional Codex model override for IMPLEMENT jobs (max 50 chars, nullable)
- `codexQuickImplModel`: Optional Codex model override for QUICK-IMPL jobs (max 50 chars, nullable)
- `codexVerifyModel`: Optional Codex model override for VERIFY jobs (max 50 chars, nullable)
- `tokenSaving`: Optional per-ticket token saving override (nullable Boolean). Three states: `true` (force ON), `false` (force OFF), or `null` (inherit from project default). Editable at any stage. Follows the same nullable inheritance pattern as `clarificationPolicy` and `agent`. Effective token saving resolved at dispatch time via `resolveEffectiveTokenSaving(ticket.tokenSaving, project.tokenSaving)`.
- `creatorId`: User who created the ticket (nullable foreign key to `User.id`, max 255 chars). Nullable because legacy rows have no recorded creator. Populated by every ticket-creation code path (manual create, duplicate, full clone, MCP `create_ticket`, inbox-analysis spawner). `onDelete: SetNull` so user deletion leaves the ticket intact while clearing attribution
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
- Belongs to User as `creator` (optional, set-null on delete)
- One-to-many: Jobs, Comments, Notifications (as source ticket, set-null on delete), Notifications (as merged-into ticket, set-null on delete), ComparisonParticipants, DecisionPointEvaluations (as verdict ticket)
- Referenced by: ComparisonRecord (as sourceTicket or winnerTicket)

**Constraints**:
- Unique ticketKey across all tickets
- Unique (projectId, ticketNumber) within project
- Index on projectId for filtering
- Index on stage for board queries
- Index on updatedAt for sorting
- Composite index (projectId, workflowType) for filtering
- Index on ticketKey for lookup by key
- Index on creatorId for resolving creator-addressed notifications during bulk delete/merge

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
- `creatorId` is populated at every creation path (manual create, duplicate, full-clone, MCP, inbox-analysis spawner) by forwarding the actor's `userId` from the API auth layer. Bulk merge preserves the base's `creatorId`; source tickets' creators receive a `TICKET_MERGED` notification before their tickets are hard-deleted
- Per-stage Claude model overrides (`specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`) are nullable; null means inherit the project's Claude value for that stage, which itself falls back to `claude-opus-4-8`
- Per-stage Codex model overrides (`codexSpecifyModel`, `codexPlanModel`, `codexImplementModel`, `codexQuickImplModel`, `codexVerifyModel`) are nullable; null means inherit the project's Codex value for that stage, which itself falls back to `gpt-5.5`
- Both column sets are preserved (not cleared) when the ticket's agent is switched; each set becomes active only when its matching agent is the effective agent
- Resolution at dispatch (per active agent): `ticket.{stageModel}` → `project.{stageModel}` → agent's global fallback (`claude-opus-4-8` for Claude, `gpt-5.5` for Codex); Mistral/Gemini dispatches do not emit a `model` input
- Token saving override (`tokenSaving`) is nullable; null means inherit the project's `tokenSaving` value. Effective token saving resolved at dispatch: `ticket.tokenSaving ?? project.tokenSaving ?? false`. Editable at any stage (not locked like policy/agent). Preserved when a ticket is copied (simple copy) or cloned (full clone).
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
- **Bulk operations (INBOX only)**:
  - Bulk delete, bulk merge, bulk change-agent, and bulk change-model accept 1–50 ticket ids per request (merge requires ≥ 2)
  - Every bulk operation runs in a single `prisma.$transaction` with a `WHERE stage = 'INBOX' AND projectId = ?` guard; partial mutations are impossible
  - Bulk delete and bulk merge enforce optimistic concurrency via an `expectedVersions` map keyed on ticket id; mismatches return 409 with `conflictingIds` and `currentVersions`
  - Bulk merge designates the smallest-id selected ticket as the surviving base, increments its `version` by 1, overwrites its `title`/`description`/`attachments` (attachments concatenated `[...base, ...sortedSources]`), and hard-deletes every source ticket; `agent`, all ten per-stage model overrides (5 Claude + 5 Codex), `autoMode`, `clarificationPolicy`, `workflowType`, `stage`, `branch`, `previewUrl`, `creatorId`, `ticketKey`, and `ticketNumber` on the base are preserved
  - Bulk change-model writes the chosen Claude model value to all five Claude per-stage override fields (`specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`) on every targeted ticket; Codex columns are untouched by this bulk action
  - Bulk delete and bulk merge create `TICKET_DELETED` / `TICKET_MERGED` `Notification` rows for every non-actor `creatorId` inside the same transaction, BEFORE the source ticket is removed; the `Notification.ticketId → SetNull` FK preserves the row after the cascade and `ticketKeySnapshot` keeps the human-readable identifier readable in the recipient's feed
  - Bulk change-agent and bulk change-model are silent — no notifications, no other field mutations

### Job

Jobs track GitHub Actions workflow executions.

```prisma
model Job {
  id              Int       @id @default(autoincrement())
  ticketId        Int?
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

  // Token saving status
  tokenSavingStatus   String?   @db.VarChar(20)  // active | inactive | fallback | n/a

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

  // Runtime versions captured by the runner at job start
  pluginVersion       String?   @db.VarChar(50)   // ai-board plugin version (.claude-plugin/plugin.json)
  agentCliVersion     String?   @db.VarChar(100)  // Agent CLI version (claude/codex/vibe/gemini --version)

  ticket      Ticket?   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  log         JobLog?
  insightsReport InsightsReport?

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
- `ticketId`: Associated ticket (nullable foreign key — null for application-wide jobs like `insights-analyze` that have no driving ticket)
- `projectId`: Parent project (required foreign key, for polling queries). For application-wide jobs (`insights-analyze`) the value is the ai-board host project so existing project-scoped log queries still resolve.
- `command`: Job command executed (specify|plan|implement|verify|ship|quick-impl|deploy-preview|rollback-reset|iterate|comment-specify|comment-plan|comment-build|comment-verify|comment-ship|health-scan|insights-analyze, max 50 chars)
- `status`: Current execution state (enum: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- `branch`: Git branch name (max 200 chars, nullable)
- `commitSha`: Git commit hash (max 40 chars, nullable)
- `logs`: Legacy free-form log field (text, unlimited); retained for full-clone compatibility and not populated by the current agent log capture pipeline, which writes to the separate `JobLog` model
- `startedAt`: Execution start timestamp (set on creation)
- `completedAt`: Execution completion timestamp (nullable, set on terminal state)
- `createdAt`: Record creation timestamp
- `updatedAt`: Last modification timestamp
- `tokenSavingStatus`: Records whether token saving (RTK compression) was active for this run (max 20 chars, nullable). Values: `"active"` (RTK installed and running), `"inactive"` (token saving effectively OFF), `"fallback"` (token saving ON but RTK failed; run proceeded without compression), `"n/a"` (non-Claude agent). Set by the workflow runner via the job status PATCH endpoint.
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
- `pluginVersion`: ai-board plugin version active at job start (max 50 chars, nullable). Sourced from `.claude-plugin/plugin.json`. Null for jobs predating runtime version capture or runs where the runner could not resolve the file.
- `agentCliVersion`: Underlying agent CLI version active at job start (max 100 chars, nullable). Captured by parsing the first line of `<cli> --version` (claude/codex/vibe/gemini); leading binary name and `v` prefix are stripped. Null for jobs predating runtime version capture or runs where the CLI did not report a version.

**Relationships**:
- Belongs to Ticket (optional, cascade delete) — null for `insights-analyze` jobs
- Belongs to Project (required, cascade delete)
- One-to-one with `InsightsReport` (this side null for every command except `insights-analyze`)

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
- `pluginVersion` and `agentCliVersion` are first-write-wins on RUNNING. The runner reports them once after CLI installation, which can land on the initial RUNNING PATCH or on a follow-up idempotent same-status PATCH; later transitions never overwrite a populated value
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
  rawArtifactKey  String?      @db.VarChar(300)
  rawArtifactSize Int?
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
- `rawArtifactKey`: Vercel Blob pathname (`raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`) for the redacted, gzipped native Claude Code session JSONL; populated only for Claude jobs that produced session data and whose raw upload succeeded; null otherwise (non-Claude jobs, no-session-data Claude jobs, or raw-upload failure)
- `rawArtifactSize`: Size of the gzipped raw artifact in bytes; paired with `rawArtifactKey` (both set or both null)
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
- `rawArtifactKey` and `rawArtifactSize` must be set together and only when `captureStatus = CAPTURED`; the raw artifact is gated to Claude-agent jobs and is independent of the normalized artifact's outcome only in the failure direction (raw upload failure leaves both fields null without affecting the normalized artifact)
- Log capture is independent of `PATCH /api/jobs/:id/status` — a capture failure must never prevent the job's terminal status from being reported
- Telemetry fields on `Job` (`inputTokens`, `costUsd`, `toolsUsed`, `qualityScore`, …) are written by a separate pipeline and remain unaffected by log capture outcome
- Retention pruning marks rows `PRUNED` after 30 days (`LOG_RETENTION_DAYS`, configurable) and clears both `artifactKey`/`artifactSize` and `rawArtifactKey`/`rawArtifactSize` so a "logs no longer retained" placeholder still renders
- Prune order per record: delete the normalized Blob object first, then the raw Blob object when present (each `404` treated as success); the row is only marked `PRUNED` after both deletes confirm
- Access for read endpoints follows the parent ticket's ownership and membership rules via `verifyTicketAccess`
- Blob artifact pathname is never rendered client-side — reads are proxied through the authenticated API

### InsightsReport

Metadata row for one Claude Code `/insights` analysis attempt produced by the admin Insights page.

```prisma
model InsightsReport {
  id            Int               @id @default(autoincrement())
  status        InsightsRunStatus @default(RUNNING)
  generatedAt   DateTime          @default(now())
  periodStart   DateTime
  periodEnd     DateTime
  sessionsCount Int?
  ticketsCount  Int?
  artifactKey   String?           @db.VarChar(300)
  artifactSize  Int?
  errorReason   String?           @db.VarChar(500)
  jobId         Int?              @unique
  job           Job?              @relation(fields: [jobId], references: [id], onDelete: SetNull)
  completedAt   DateTime?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@index([status, createdAt])
  @@index([generatedAt])
  @@index([periodEnd])
}
```

**Purpose**: Persist the metadata for each Insights run so the admin page can list past reports, render the latest, and reconcile orphaned runs. The HTML body is stored separately in Vercel Blob at `insights/reports/<id>.html` and is referenced by `artifactKey`.

**Fields**:
- `id`: Auto-incrementing primary key — also the report's identity in URL paths and the deterministic blob key
- `status`: Lifecycle state (`RUNNING`, `COMPLETED`, `FAILED`); always inserted as `RUNNING`
- `generatedAt`: Trigger timestamp — fixed at insert, used in the canonical metadata header
- `periodStart`: Half-open window start (inclusive). First-ever run: earliest Claude job's `startedAt`. Subsequent runs: previous COMPLETED row's `periodEnd`
- `periodEnd`: Half-open window end (exclusive). Equal to `generatedAt` at insert
- `sessionsCount`: Count of Claude Code sessions fed into `/insights` (populated only on COMPLETED, `>= 0`)
- `ticketsCount`: Count of distinct tickets the sessions belonged to (populated only on COMPLETED, `>= 0`)
- `artifactKey`: Blob key (`insights/reports/<id>.html`) — deterministic from `id`; stored explicitly so a future key-shape change does not break old rows. Populated only on COMPLETED
- `artifactSize`: HTML body size in bytes (populated only on COMPLETED, `> 0`)
- `errorReason`: Non-secret, operator-actionable failure reason (populated only on FAILED, ≤ 500 chars)
- `jobId`: Optional FK to the companion `Job` row (the `insights-analyze` job that drove the workflow). `onDelete: SetNull` so a pruned job does not cascade-delete the audit record
- `completedAt`: Terminal-state timestamp (set on either COMPLETED or FAILED)
- `createdAt` / `updatedAt`: Row timestamps

**Relationships**:
- Optional one-to-one with `Job` via `jobId` — the companion `Job` row has `command = 'insights-analyze'`, `ticketId = null`, and `projectId` set to the ai-board host project
- No relationship to `Project` or `Ticket` — reports are application-wide by design

**Constraints**:
- `@@index([status, createdAt])` services orphan reconciliation (find stale RUNNING rows) and the concurrency gate (`exists RUNNING`)
- `@@index([generatedAt])` services the list endpoint's `ORDER BY generatedAt DESC LIMIT 200`
- `@@index([periodEnd])` services `getLastCompletedRunEnd()` — `ORDER BY periodEnd DESC LIMIT 1 WHERE status='COMPLETED'`
- `jobId` is unique — one report per insights job

**State Machine**:
```
(insert) → RUNNING ──┬─► COMPLETED  (workflow PATCH success + output validation passes)
                     │
                     └─► FAILED     (workflow PATCH failure, validation failure,
                                     dispatch failure rollback, or reconciliation timeout)
```

Terminal states never transition further. Every transition uses the atomic conditional pattern:
```ts
await prisma.insightsReport.updateMany({
  where: { id, status: 'RUNNING' },
  data:  { status: '...', ... },
});
```
A late workflow callback for a row already auto-FAILED finds no row matching the guard; the update is a no-op (`count === 0`) and the terminal status is preserved.

**Business Rules**:
- Row is inserted in `RUNNING` BEFORE workflow dispatch so dispatch failures still leave an auditable record
- A FAILED run does **not** advance the previous-successful-run high-water mark — the next attempt re-covers the same window
- A COMPLETED row requires all of: `artifactKey`, `artifactSize`, `sessionsCount`, `ticketsCount`, `completedAt`
- A FAILED row requires a non-empty `errorReason` (examples: `"Workflow dispatch failed: 404 …"`, `"Insights output validation failed"`, `"Artifact upload rejected by storage"`, `"Run timed out — workflow did not report terminal status"`)
- `artifactKey`, when present, equals `buildInsightsReportKey(id)`; a mismatch is treated as a missing-blob (FR-024 placeholder) at serve time
- Orphan reconciliation auto-transitions any RUNNING row whose `createdAt < now() - INSIGHTS_RUN_TIMEOUT_MINUTES` (default 60 minutes) to FAILED with reason `"Run timed out — workflow did not report terminal status"`; this runs lazily on every list-endpoint and trigger-endpoint call
- Reports are read-only after creation — no edit, delete, annotate, or rename surface; retention is operator-managed at the storage layer

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

Notifications track @mentions in comments and bulk-action events (delete, merge) so the original creator of an affected ticket is informed when another project member acts on it.

```prisma
model Notification {
  id                 Int              @id @default(autoincrement())
  recipientId        String           // User receiving the notification
  actorId            String           // User who created the event
  commentId          Int?             // Source comment (null for non-MENTION types)
  ticketId           Int?             // Source ticket (null after source-ticket cascade)
  type               NotificationType @default(MENTION)
  mergedIntoTicketId Int?             // Surviving base ticket id when type = TICKET_MERGED
  ticketKeySnapshot  String?          @db.VarChar(20) // Human-readable key captured at notification time
  read               Boolean          @default(false)
  readAt             DateTime?
  createdAt          DateTime         @default(now())
  deletedAt          DateTime?        // Soft delete for 30-day retention policy

  recipient        User     @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor            User     @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)
  comment          Comment? @relation(fields: [commentId], references: [id], onDelete: Cascade)
  ticket           Ticket?  @relation("NotificationTicket", fields: [ticketId], references: [id], onDelete: SetNull)
  mergedIntoTicket Ticket?  @relation("NotificationMergedInto", fields: [mergedIntoTicketId], references: [id], onDelete: SetNull)

  @@index([recipientId, createdAt])
  @@index([recipientId, read])
  @@index([createdAt])
}
```

**Purpose**: Real-time alerts for collaboration events — mentions in comments and bulk-action events that affect tickets owned by another user.

**Fields**:
- `id`: Auto-incrementing unique identifier
- `recipientId`: User who receives the notification (required foreign key)
- `actorId`: User who performed the action (required foreign key)
- `commentId`: Source comment for `MENTION`; null for `TICKET_DELETED` and `TICKET_MERGED`
- `ticketId`: Source ticket id at notification creation; switches to NULL when the source ticket is hard-deleted (bulk delete / bulk merge source). `onDelete: SetNull` preserves the notification row after the cascade
- `type`: Discriminator — `MENTION | TICKET_DELETED | TICKET_MERGED`; defaults to `MENTION` so legacy mention rows are backward-compatible
- `mergedIntoTicketId`: For `TICKET_MERGED`, the id of the surviving base ticket; the recipient clicks the notification and lands on the base. `onDelete: SetNull` so a later delete of the base does not orphan the row
- `ticketKeySnapshot`: Human-readable ticket key captured at notification creation; populated for `TICKET_DELETED` and `TICKET_MERGED` so the recipient still sees "ABC-12 was deleted by Alice" after the FK becomes NULL
- `read`: Boolean indicating if notification has been viewed (default: false)
- `readAt`: Timestamp when notification was marked as read (nullable)
- `createdAt`: Notification creation timestamp
- `deletedAt`: Soft delete timestamp for 30-day retention (nullable)

**Relationships**:
- Belongs to User (recipient, required, cascade delete)
- References User (actor, required, cascade delete)
- Belongs to Comment (optional, cascade delete) — null for non-mention types
- Belongs to Ticket as `ticket` (optional, set-null on delete) — survives bulk delete/merge cascades
- Belongs to Ticket as `mergedIntoTicket` (optional, set-null on delete) — populated only for `TICKET_MERGED`

**Constraints**:
- Composite index (recipientId, createdAt) for listing notifications for user
- Composite index (recipientId, read) for counting unread notifications
- Index on createdAt for cleanup job (30-day retention)

**Features**:
- Automatic creation in three flows: @mention in a comment (`MENTION`), bulk delete of an INBOX ticket (`TICKET_DELETED`), bulk merge source-ticket absorption (`TICKET_MERGED`)
- Soft delete with 30-day retention (deletedAt field)
- Read status tracking with timestamp
- Polling-based updates (15-second interval)
- Optimistic UI updates for mark-as-read actions

**Business Rules**:
- `MENTION` rows are created when a comment contains an `@mention` of a project member; self-mentions and non-members never receive a row
- `TICKET_DELETED` and `TICKET_MERGED` rows are created inside the same `prisma.$transaction` as the bulk delete or merge, BEFORE the source ticket is removed; the `Notification.ticketId → SetNull` FK preserves the row after the cascade
- Bulk-action notifications are addressed to `Ticket.creatorId` when it is non-null AND differs from `actorId` (the actor); rows with `creatorId = null` generate no notification
- `TICKET_MERGED` rows always carry a populated `mergedIntoTicketId` pointing at the surviving base
- `ticketKeySnapshot` is captured at row creation and never updated — it is the durable human-readable identifier after the source ticket is gone
- Bulk change-agent and bulk change-model operations never generate notifications
- AI-BOARD comments create notifications for mentioned users (AI-BOARD as actor)
- Notification creation is non-blocking for the `MENTION` path (errors logged but don't fail comment creation); for `TICKET_DELETED` / `TICKET_MERGED` it runs inside the bulk-action transaction and a failure rolls the bulk operation back
- Notifications retained for 30 days before deletion
- Deleted comments cascade delete `MENTION` notifications; bulk-action rows are unaffected (`commentId` is null)
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

### WebhookOutcome

Outcome row per inbound provider-webhook delivery that passed the idempotency claim. Drives the Admin Home dashboard's `STRIPE_WEBHOOK_ERRORS` alert.

```prisma
model WebhookOutcome {
  id           Int                  @id @default(autoincrement())
  provider     String               @db.VarChar(50)
  eventId      String               @db.VarChar(255)
  eventType    String               @db.VarChar(100)
  status       WebhookOutcomeStatus
  errorMessage String?              @db.VarChar(1000)
  receivedAt   DateTime             @default(now())

  @@index([status, receivedAt])
  @@index([provider, receivedAt])
}
```

**Purpose**: Persistent record of whether each processed webhook delivery succeeded or failed, used as the data source for the Stripe-error alert and as a forensic trail for partial outages.

**Fields**:
- `provider`: `"stripe"` today; the column is generic so future providers can share the table without a migration
- `eventId`: Stripe event id (`evt_…`). NOT unique — a redelivery short-circuited at the `StripeEvent` claim never reaches this row, so a single event never produces two outcome rows under normal operation
- `eventType`: Stripe event type (e.g., `invoice.payment_failed`)
- `status`: `SUCCESS | FAILURE` per the `WebhookOutcomeStatus` enum
- `errorMessage`: Catch-block error truncated to 1000 chars; `null` when `status === 'SUCCESS'`
- `receivedAt`: Insert timestamp; the value the dashboard's 24-hour alert window is computed against

**Business Rules**:
- Write-once: rows are never updated. Status is decided at insert time.
- Inserted by `POST /api/webhooks/stripe` *after* the existing `StripeEvent` idempotency claim succeeds; never inserted on duplicate redeliveries.
- If the insert itself throws, the route logs and swallows so the original Stripe-facing 200/500 response is preserved.
- Not auto-pruned by this feature — alert window is 24 h; older rows are inert and can be pruned by a follow-up retention task.

### CronRun

Last-success heartbeat per critical cron, used by the Admin Home dashboard's stale-cron alert.

```prisma
model CronRun {
  id            Int          @id @default(autoincrement())
  cron          CriticalCron @unique
  lastSuccessAt DateTime
  updatedAt     DateTime     @updatedAt
}
```

**Purpose**: Records when each registered critical cron last completed successfully so the dashboard can detect staleness ( > 36 h ) without polling GitHub Actions APIs.

**Fields**:
- `cron`: `CriticalCron` enum value identifying the registered workflow. `@unique` enforces one row per cron.
- `lastSuccessAt`: Timestamp of the most recent successful heartbeat. Advanced monotonically by the heartbeat upsert.
- `updatedAt`: Bookkeeping.

**Business Rules**:
- One row per cron, created on first heartbeat (upsert keyed on `cron`); never deleted; no deletion path is exposed.
- Updated only by `POST /api/maintenance/cron-heartbeat`, which is the **last** step of each registered workflow. If the workflow's functional steps fail, the heartbeat step is skipped → `lastSuccessAt` does not advance → the dashboard alert eventually fires.
- A cron registered in the allowlist but without a `CronRun` row is treated as stale (the alert fires on the first scheduled tick after registration).

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
- `partial`: True when change-shape data could not be derived (no jobs, ticket has no `branch`, no merged PR found for the branch, repository unreachable, fetches exhausted retries, or the diff exceeded GitHub's 300-file response cap)
- `partialReason`: One of `no_jobs`, `no_branch_reference`, `merge_not_found`, `repository_unreachable`, `fetch_failed_after_retry`, `diff_truncated`; null when `partial = false`

**Relationships**:
- Belongs to Ticket (required, cascade delete)
- Belongs to Project (required, cascade delete) — denormalized for query convenience

**Constraints**:
- Unique `ticketId` enforces 1:1 with Ticket and protects against duplicate writes from concurrent live-capture invocations (P2002 catch in `lib/outcomes/persist.ts` collapses races to a no-op)
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

### TicketAnalysis

Append-only row created on every on-demand inbox analysis run. The latest row drives the analysis panel; older rows are retained indefinitely for audit and future calibration.

```prisma
model TicketAnalysis {
  id                  Int                   @id @default(autoincrement())

  ticketId            Int
  projectId           Int
  userId              String

  status              TicketAnalysisStatus  @default(running)
  startedAt           DateTime              @default(now())
  endedAt             DateTime?
  createdAt           DateTime              @default(now())

  ruleSetVersion      Int
  agent               Agent
  modelId             String?               @db.VarChar(50)

  titleSnapshot       String                @db.VarChar(100)
  descriptionSnapshot String                @db.VarChar(10000)

  stackSnapshot       Json
  anchorIdsAttempted  Int[]                 @default([])

  costUsd             Float?
  durationMs          Int?
  inputTokens         Int?
  outputTokens        Int?
  thinkingTokens      Int?
  cacheReadTokens     Int?

  coldStartReason     String?               @db.VarChar(40)
  errorReason         String?               @db.VarChar(40)
  errorMessage        String?               @db.VarChar(2000)

  output              Json?

  ticket              Ticket                @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project             Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user                User                  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt(sort: Desc)])
  @@index([userId, status, endedAt])
  @@index([projectId, createdAt(sort: Desc)])
  @@index([status, startedAt])
}
```

**Purpose**: Append-only audit trail of inbox ticket analyses, capturing the input snapshot, stack snapshot, anchor candidate set, panel output, and measured telemetry for each run. Powers the inbox analysis panel (including its stale indicator on the collapsed success row) and the per-user hourly rate limit.

**Fields**:
- `ticketId`: Parent ticket (cascade delete)
- `projectId`: Parent project, denormalised for project-scoped analytics queries (cascade delete)
- `userId`: User who triggered the run, captured at POST time and never re-derived (cascade delete)
- `status`: Lifecycle (`running`, `success`, `cold_start`, `failed`); rows are immutable once terminal
- `startedAt`: Set at insert time
- `endedAt`: Populated when status transitions to a terminal value; powers the rolling-hour rate-limit query
- `ruleSetVersion`: Stamped from the `ANALYSIS_RULE_SET_VERSION` constant at insert time so older rows remain interpretable under their original schema
- `agent` / `modelId`: Resolved from project config and ticket model overrides at insert time (frozen for audit)
- `titleSnapshot`: Frozen ticket title at run time (max 100 chars, matches `Ticket.title`)
- `descriptionSnapshot`: Frozen ticket description at run time (max 10000 chars, matches `Ticket.description`)
- `stackSnapshot`: JSON `StackContext` (language, framework, services, testing framework, e2e flag, agent CLI/model); read-only audit, not used for live re-prompting
- `anchorIdsAttempted`: Candidate anchor `Ticket.id` array (up to 50) computed by `selectAnchors()` at trigger time; persisted so the workflow's PATCH can enforce `output.anchors[*].ticketId ⊆ anchorIdsAttempted`
- `costUsd`, `durationMs`, `inputTokens`, `outputTokens`, `thinkingTokens`, `cacheReadTokens`: Telemetry filled when status transitions to `success` or `cold_start`; remain NULL on `failed` (the rate-limit query relies on this signal)
- `coldStartReason`: Enum-like string (`insufficient_comparable_history`); NULL unless `status = cold_start`
- `errorReason`: Enum-like string in `{scoping_pass_failed, grounded_pass_failed, dispatch_failed, timeout, invalid_model_output, credential_missing, other}`; NULL unless `status = failed`
- `errorMessage`: Free-form trace excerpt (max 2000 chars); NULL unless `status = failed`
- `output`: JSON payload conforming to `AnalysisOutputSchema` when `status = success`, to `ColdStartOutputSchema` (`{ scopeWarnings: ScopeWarning[] }`) when `status = cold_start`, and NULL when `status = running` or `status = failed`. The discriminator is implicit in `status` — the API serialiser inspects status before parsing the column

**Output payload shape** (`AnalysisOutputSchema`):
- `frictionRisk`: `'low' | 'medium' | 'high'`
- `qualityGateRange`: `{ lower: 0..100, upper: 0..100 }` with `lower <= upper`
- `recommendation`: `{ choice: 'QUICK' | 'FULL', confidence: 'low' | 'medium' | 'high', justification: 1..1000 chars }`
- `costRange`: `{ baselineLowerUsd, baselineUpperUsd, marginalFrictionLowerUsd, marginalFrictionUpperUsd }` with both lower bounds ≤ upper bounds
- `scopeWarnings`: `ScopeWarning[]` (max 5), each `{ category, message: 1..280 chars }` with category in `{ambiguity_core_requirement, multi_feature_bundling, missing_acceptance_criteria, missing_scope_boundary, other}`
- `anchors`: `AnchorCitation[]` (max 5), each `{ ticketId, ticketKey: /^[A-Z]{2,6}-\d+$/, frictionFree, qualityScore: 0..100 | null, overlapStrength: int >= 1 }`

**LLM output leniency** (normalize instead of reject — the payload is produced by a model in CI, and rejecting an otherwise-valid analysis strands the row in `running`):
- `justification` and `scopeWarnings[].message` beyond their max length are truncated server-side (ellipsis-terminated), not rejected
- Unknown `scopeWarnings[].category` values are normalized to `other`
- `overlapStrength` accepts the labels `low|medium|high` and coerces them to `1|2|3`; other non-integer values are rejected

**Stale-running reclaim** (lazy janitor): a row still `running` after 10 minutes (`STALE_RUNNING_ANALYSIS_MS`) means the workflow's terminal PATCH never landed. GET and POST on the analysis endpoint reclaim such rows (`status=failed`, `errorReason=timeout`, `endedAt=now`) before serving — POST would otherwise 409-block the ticket forever and the panel would poll indefinitely.

**Relationships**:
- Belongs to Ticket (required, cascade delete)
- Belongs to Project (required, cascade delete) — denormalized for query convenience
- Belongs to User (required, cascade delete)

**Constraints**:
- `[ticketId, createdAt DESC]` index serves the panel render query (`findFirst({ where: { ticketId }, orderBy: { createdAt: 'desc' } })`)
- `[userId, status, endedAt]` index serves the rolling-hour rate-limit query (`count({ where: { userId, status: { in: ['success', 'cold_start'] }, endedAt: { gt: oneHourAgo } } })`)
- `[projectId, createdAt DESC]` index serves future analytics aggregations
- `[status, startedAt]` index serves observability queries for orphaned `running` rows

**State Machine**:
```
              POST /analysis
                    │
                    ▼
                ┌────────┐
                │ running│  (workflow_dispatch fired)
                └───┬────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
   ┌───────┐  ┌───────────┐  ┌──────┐
   │success│  │cold_start │  │failed│
   └───────┘  └───────────┘  └──────┘
   (terminal — never UPDATE again)
```

**Business Rules**:
- INSERT only by `POST /api/projects/:projectId/tickets/:id/analysis`; row is born `running`
- The single allowed UPDATE is the `running → terminal` transition performed by `PATCH /analysis/:id/status` with the assertion `WHERE id = ? AND status = 'running'`. PATCH on a row already in a terminal state is idempotent (200, no DB write)
- Append-only: never modified after reaching a terminal status
- Failed runs do not consume the user's hourly budget — `costUsd` stays NULL on failures, and the rate-limit query only counts rows in `success` or `cold_start` status
- Two `running` rows for the same ticket are allowed to coexist (concurrent triggers from multiple tabs); the panel reads the latest row by `createdAt` order
- The `anchorIdsAttempted` array is the ground truth for validating the workflow PATCH — outcomes can change between trigger and completion, so re-querying at PATCH time is rejected as a design choice
- Older rows retain their original stack snapshot for audit; later project stack changes do not retroactively rewrite past analyses
- No automatic re-runs occur — every analysis run requires an explicit user action

### AnalysisCalibration

Immutable per-ticket snapshot pairing the latest successful `TicketAnalysis` row with the captured `TicketOutcome` row at outcome-capture time. Drives the project-owner-only calibration drift dashboard.

```prisma
model AnalysisCalibration {
  id Int @id @default(autoincrement())

  ticketId   Int      @unique
  projectId  Int
  analysisId Int      @unique
  outcomeId  Int      @unique

  ruleSetVersion Int
  capturedAt     DateTime @default(now())
  shippedAt      DateTime

  frictionPredictedRating String  @db.VarChar(8)
  frictionPredictedClean  Boolean
  frictionActualFree      Boolean
  frictionCell            String  @db.VarChar(2)

  qualityPredictedLower Int
  qualityPredictedUpper Int
  qualityActual         Int?
  qualityVerdict        String  @db.VarChar(4)

  costPredictedBaselineLowerUsd Float
  costPredictedBaselineUpperUsd Float
  costPredictedMarginalLowerUsd Float
  costPredictedMarginalUpperUsd Float
  costPredictedSummedLowerUsd   Float
  costPredictedSummedUpperUsd   Float
  costActualUsd                 Float?
  costVerdict                   String  @db.VarChar(4)

  recommendationPredicted       String  @db.VarChar(5)
  recommendationConfidence      String  @db.VarChar(6)
  workflowActual                WorkflowType
  recommendationMatched         Boolean
  recommendationFrictionAligned Boolean

  partial       Boolean @default(false)
  partialReason String? @db.VarChar(40)

  ticket   Ticket         @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project  Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  analysis TicketAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  outcome  TicketOutcome  @relation(fields: [outcomeId], references: [id], onDelete: Cascade)

  @@index([projectId, shippedAt(sort: Desc)])
  @@index([projectId, partial])
  @@index([projectId, frictionCell])
}
```

**Purpose**: Append-only calibration record per shipped+analyzed ticket — the canonical source for "how the predicted analysis (friction, quality range, cost range, recommendation) compared to the actual outcome" without re-deriving from the source `TicketAnalysis` and `TicketOutcome` rows on every read.

**Fields**:
- `ticketId`: Parent ticket (unique — at most one calibration row per ticket)
- `projectId`: Denormalized for the project-scoped dashboard query
- `analysisId`: Foreign key to the paired `TicketAnalysis` row whose `status = 'success'`
- `outcomeId`: Foreign key to the paired `TicketOutcome` row
- `ruleSetVersion`: Pinned `CALIBRATION_RULE_SET_VERSION` at write time so future rule-set changes can be detected on read
- `capturedAt`: Moment this row was written
- `shippedAt`: Denormalized from `TicketOutcome.shippedAt` for the dashboard's newest-first ordering
- Friction pairing:
  - `frictionPredictedRating`: Predicted three-class rating (`'low' | 'medium' | 'high'`) from the analysis output
  - `frictionPredictedClean`: Binarised flag (`true` iff `frictionPredictedRating === 'low'`)
  - `frictionActualFree`: Mirrored from `TicketOutcome.frictionFree`
  - `frictionCell`: Mutually exclusive confusion-matrix cell (`'TP' | 'TN' | 'FP' | 'FN'`) on the "predicted clean / actual frictionFree" positive class — derived at write time, validated by `superRefine`
- Quality pairing:
  - `qualityPredictedLower`, `qualityPredictedUpper`: Predicted bounds (0..100, inclusive; `lower <= upper`)
  - `qualityActual`: Nullable when QUICK / no verify-with-score
  - `qualityVerdict`: `'hit' | 'miss' | 'n_a'` — `n_a` when actual is null, `hit` when the actual is inside `[lower, upper]` inclusive, else `miss`
- Cost pairing:
  - `costPredictedBaselineLowerUsd`, `costPredictedBaselineUpperUsd`, `costPredictedMarginalLowerUsd`, `costPredictedMarginalUpperUsd`: Decomposed predicted components from the analysis output's `costRange`, preserved for future drill-down
  - `costPredictedSummedLowerUsd`, `costPredictedSummedUpperUsd`: Summed range matching the user-facing "expected cost" line; consistency with the decomposed components is validated on write
  - `costActualUsd`: Nullable when every contributing job had a null `costUsd`
  - `costVerdict`: `'hit' | 'miss' | 'n_a'` — same semantics as the quality verdict over the summed range
- Recommendation pairing:
  - `recommendationPredicted`: `'QUICK' | 'FULL'` (the analysis output's `recommendation.choice`)
  - `recommendationConfidence`: `'low' | 'medium' | 'high'` (the analysis output's `recommendation.confidence`)
  - `workflowActual`: Mirrored from `TicketOutcome.workflowType` (`FULL`, `QUICK`, or `CLEAN` for legacy rows)
  - `recommendationMatched`: `true` iff `recommendationPredicted === workflowActual`
  - `recommendationFrictionAligned`: `true` iff `(recommendationPredicted === 'QUICK' && frictionActualFree) || (recommendationPredicted === 'FULL' && !frictionActualFree)`
- Partial mirror:
  - `partial`: Snapshotted from `TicketOutcome.partial` at write time
  - `partialReason`: One of `no_jobs`, `no_branch_reference`, `merge_not_found`, `repository_unreachable`, `fetch_failed_after_retry`, `diff_truncated`; null when `partial = false`. Mirrors `TicketOutcome.partialReason` (single source of truth lives in `lib/outcomes/persist.ts`)

**Relationships**:
- Belongs to Ticket (required, cascade delete) — 1:1
- Belongs to Project (required, cascade delete) — denormalized
- Belongs to TicketAnalysis (required, cascade delete) — 1:1 with the paired success row
- Belongs to TicketOutcome (required, cascade delete) — 1:1 with the paired outcome row

**Constraints**:
- Unique `ticketId` enforces 1:1 with Ticket and protects against duplicate writes from re-tries; `lib/calibration/persist.ts` catches Prisma `P2002` and treats it as a no-op duplicate (mirrors the established `lib/outcomes/persist.ts` pattern)
- Unique `analysisId` and unique `outcomeId` are defensive — they guarantee no analysis row or outcome row can be paired twice, even via a future re-pair bug
- `(projectId, shippedAt DESC)` index serves the dashboard's 30-row window
- `(projectId, partial)` index serves the headline-rate denominators that exclude partials
- `(projectId, frictionCell)` index serves the confusion-matrix `groupBy` query

**Validation invariants** (enforced by `lib/calibration/persist.ts` Zod `superRefine` before any DB write):
- `frictionPredictedClean === (frictionPredictedRating === 'low')`
- `frictionCell` is the cell consistent with `frictionPredictedClean` and `frictionActualFree`
- `qualityPredictedLower <= qualityPredictedUpper`; `qualityVerdict` is consistent with `qualityActual` and the bounds
- Each cost component's lower ≤ upper; `costPredictedSummedLowerUsd === baselineLower + marginalLower` (and the same for upper); `costVerdict` is consistent with `costActualUsd` and the summed range
- `recommendationMatched === (recommendationPredicted === workflowActual)`
- `recommendationFrictionAligned` matches the spec rule above
- `partial === true ⇔ partialReason !== null`

**Business Rules**:
- Written by `lib/calibration/pair.ts` chained after `captureOutcomeOnShip` in `lib/tickets/transition.ts` — fire-and-forget, never blocks or alters SHIP or outcome capture
- Pairing selects the most recent `TicketAnalysis` row with `status = 'success'` for the ticket; analyses with status `cold_start`, `failed`, or `running` are skipped
- When a ticket has no `success` analysis at pairing time, no calibration row is written; the ticket still counts in adoption (via the `TicketAnalysis` count) but is excluded from drift metrics
- Append-only: rows are never updated after creation. The model has no `updatedAt` column on purpose — any update path would be a code smell. Re-pairing on outcome change is never performed (outcomes are immutable; calibration inherits that immutability)
- When the paired outcome is `partial = true`, the row is still created: cells whose computation requires fields the outcome was unable to capture are recorded as `'n_a'` with the `partialReason` snapshot; cells that can be computed from available telemetry populate normally
- Pairing failures (Zod superRefine, Prisma errors, missing analysis output) are logged with the `[calibration]` prefix and never propagate to SHIP or capture
- No backfill for historical shipped+analyzed tickets — the dashboard's "30 of N" caption naturally reflects the post-launch dataset

