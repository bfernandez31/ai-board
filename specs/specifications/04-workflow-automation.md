# Workflow Automation

## Overview

This domain covers GitHub Actions integration and automated spec-kit workflow execution. The system automatically generates specifications, plans, and implementations when tickets transition between workflow stages.

**Current Capabilities**:
- Job tracking for workflow executions
- GitHub Actions workflow integration
- Automatic workflow dispatch on stage transitions
- Job status updates from completed workflows
- Branch management per ticket

---

## Job Tracking

**Purpose**: Users need visibility into automated workflow executions. Job tracking provides execution history, status monitoring, and debugging logs for all spec-kit commands triggered by ticket transitions.

### What It Does

The system creates and tracks job records for each workflow execution:

**Job Lifecycle**:
1. User moves ticket to SPECIFY/PLAN/BUILD stage
2. System creates Job record (status: PENDING)
3. GitHub workflow starts (status updates to RUNNING)
4. Workflow completes (status updates to COMPLETED/FAILED/CANCELLED)
5. Job record persists indefinitely for audit trail

**Job Information**:
- **Associated Ticket**: Which ticket triggered the job
- **Command**: Which spec-kit command executed (specify, plan, task, implement, clarify)
- **Status**: Current execution state (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- **Git Metadata**: Branch name and commit SHA (nullable)
- **Logs**: Complete execution logs including error traces
- **Timestamps**: When started and when completed

**Query Capabilities**:
- Find all jobs for a ticket
- Find jobs by status
- Find jobs within time range
- Indexed for performance

**Data Retention**:
- All job records retained indefinitely
- Complete execution history per ticket
- No automatic cleanup or archival

### Requirements

**Job Creation**:
- Created when spec-kit command execution begins
- Records ticketId, command, status (PENDING), startedAt timestamp
- Git metadata (branch, commitSha) initially nullable

**Status Tracking**:
- Status lifecycle: PENDING → RUNNING → COMPLETED/FAILED/CANCELLED
- Terminal states: COMPLETED, FAILED, CANCELLED (no further transitions)
- Idempotent status updates (same status allowed)

**Logging**:
- Stores complete execution logs
- Unlimited length (compressed or external storage for very large logs)
- Includes error traces for debugging

**Timestamps**:
- startedAt: Set when job created
- completedAt: Set when reaching terminal state
- startedAt preserved when updating completion

**Git Metadata**:
- branch: Git branch name (max 200 chars, nullable)
- commitSha: Git commit hash (max 40 chars, nullable)
- Can be null if unavailable at creation time

**Data Lifecycle**:
- Cascade delete with ticket (jobs deleted when ticket deleted)
- Running jobs cancelled and marked as failed before deletion
- "ticket deleted" recorded in logs for cancelled jobs
- Unlimited retention (no automatic cleanup)

**Timeouts**:
- Configurable timeout per command type
- Jobs marked as failed when timeout exceeded
- Timeout recorded in logs

### Data Model

**Job Entity**:
- `id`: Unique identifier
- `ticketId`: Foreign key to Ticket (cascade delete)
- `command`: Spec-kit command name (specify|plan|task|implement|clarify, max 50 chars)
- `status`: JobStatus enum (PENDING|RUNNING|COMPLETED|FAILED|CANCELLED)
- `branch`: Git branch name (max 200 chars, nullable)
- `commitSha`: Git commit SHA (max 40 chars, nullable)
- `logs`: Execution logs (text, unlimited)
- `startedAt`: Execution start timestamp
- `completedAt`: Execution completion timestamp (nullable)
- **Indexes**: ticketId, status, startedAt

**JobStatus States**:
- `PENDING`: Job created, not yet started
- `RUNNING`: Currently executing
- `COMPLETED`: Finished successfully
- `FAILED`: Encountered error
- `CANCELLED`: Manually terminated

**State Machine**:
```
PENDING → RUNNING → COMPLETED
                  → FAILED
                  → CANCELLED

Terminal states cannot transition (except to themselves for idempotency)
```

---

## GitHub Workflow Integration

**Purpose**: The system needs to execute spec-kit commands in isolated, consistent environments without local setup requirements. GitHub Actions provides repeatable execution with proper tooling and authentication.

### What It Does

The system runs spec-kit commands via GitHub Actions workflow:

**Workflow Trigger**:
- Manual dispatch only (triggered by transition API)
- Accepts ticket details and command type as inputs
- Runs on ubuntu-latest environment

**Environment Setup**:
- Node.js 22.20.0
- Python 3.11
- Claude Code CLI (installed globally via npm)
- Git configuration (ai-board[bot] as author)
- Authentication (ANTHROPIC_API_KEY, GITHUB_TOKEN)

**Command Execution**:
- **specify**: `claude /speckit.specify` with ticket title and description
- **plan**: `claude /speckit.plan`
- **task**: `claude /speckit.tasks`
- **implement**: `claude /speckit.implement`
- **clarify**: `claude /speckit.clarify --answers clarifications.json`

**Git Operations**:
- Checkout repository on specified branch (or main for specify)
- Full Git history (fetch-depth 0)
- Stage all changes after execution
- Skip commit if no changes
- Commit with structured message: `feat(ticket-<id>): <command> - automated spec-kit execution`
- Push to origin branch

**Status Reporting**:
- Success: ✅ indicator with ticket ID and branch
- Failure: ❌ indicator with exit code 1
- All logs visible in GitHub Actions tab

**Timeouts**:
- 120-minute maximum execution time
- GitHub Actions cancels job if exceeded

### Requirements

**Workflow Configuration**:
- Manual workflow_dispatch trigger only
- Inputs: ticket_id, ticketTitle, ticketDescription, branch, command, job_id, answers_json (optional)
- Ubuntu-latest runner
- 120-minute timeout
- Environment variables: APP_URL, WORKFLOW_API_TOKEN

**Environment**:
- Node.js 22.20.0 setup
- Python 3.11 setup
- Claude Code CLI global installation
- Git user: ai-board[bot] <bot@ai-board.app>
- Claude authentication: ANTHROPIC_API_KEY secret

**Execution**:
- Checkout repository (specified branch or main)
- Full Git history (fetch-depth 0)
- Execute appropriate claude command based on input
- Error for unknown commands

**Git Operations**:
- Stage all changes
- Skip commit if no staged changes
- Commit message: `feat(ticket-<id>): <command> - automated spec-kit execution`
- Push using GITHUB_TOKEN
- ai-board[bot] as commit author

**Security**:
- ANTHROPIC_API_KEY for Claude API
- GITHUB_TOKEN for Git push
- WORKFLOW_API_TOKEN for API authentication
- No secret values in logs

**API Communication**:
- APP_URL variable for configurable API endpoint
- Bearer token authentication on all API calls
- Status updates via PATCH `/api/jobs/{id}/status`
- Branch updates via PATCH `/api/projects/{projectId}/tickets/{id}/branch`

### Data Model

**Workflow Inputs**:
- `ticket_id`: String (ticket identifier)
- `ticketTitle`: String (for specify command)
- `ticketDescription`: String (for specify command)
- `branch`: String (feature branch name)
- `command`: Choice (specify|plan|task|implement|clarify)
- `job_id`: String (job record identifier)
- `answers_json`: String (optional, for clarify command)

**Environment Variables**:
- `APP_URL`: Configurable API endpoint (GitHub repository variable)
- `WORKFLOW_API_TOKEN`: Bearer token for API authentication (GitHub secret)
- `ANTHROPIC_API_KEY`: Claude API key (GitHub secret)
- `SKIP_SPECKIT_EXECUTION`: Auto-set for [e2e] test tickets

**Workflow File**: `.github/workflows/speckit.yml`

**Execution Environment**:
- OS: ubuntu-latest
- Node: 22.20.0
- Python: 3.11
- Timeout: 120 minutes

---

## Automatic Workflow Dispatch

**Purpose**: Users shouldn't manually trigger workflows. The system automatically dispatches GitHub Actions workflows when tickets transition to automation-enabled stages (SPECIFY, PLAN, BUILD).

### What It Does

The system triggers workflows automatically during stage transitions:

**Transition Flow**:
1. User drags ticket to SPECIFY/PLAN/BUILD stage
2. System creates Job record (status: PENDING)
3. System dispatches GitHub Actions workflow
4. System updates ticket stage
5. Workflow executes in background
6. User sees real-time job status updates

**Stage-to-Command Mapping**:
- **INBOX → SPECIFY**: Dispatches "specify" command (`/speckit.specify`), generates branch name `feature/ticket-<id>`
- **SPECIFY → PLAN**: Dispatches "plan" command (`/speckit.plan`), uses existing branch
- **PLAN → BUILD**: Dispatches "implement" command (`/speckit.implement`), uses existing branch
- **BUILD → VERIFY**: No workflow (manual stage transition)
- **VERIFY → SHIP**: No workflow (manual stage transition)

**Branch Management**:
- SPECIFY command: System generates branch name `feature/ticket-<id>` and sets ticket.branch field
- PLAN/BUILD commands: Use existing ticket.branch value
- Job record created with branch field null (workflow updates it later)

**Workflow Dispatch Details**:
- Target: Project's GitHub repository (from ticket.project.githubOwner and githubRepo)
- Workflow file: speckit.yml on main branch
- Inputs: ticket_id, command, branch (+ title/description for specify only)

**Error Handling**:
- Octokit errors: 401 (auth), 403 (rate limit), 404 (workflow not found)
- All dispatch attempts logged
- Returns error to user if dispatch fails

### Requirements

**API Endpoint**:
- POST `/api/projects/{projectId}/tickets/{id}/transition`
- Accepts targetStage in request body
- POST requests only

**Validation**:
- projectId and ticketId must be valid numbers
- Project must exist
- Ticket must exist and belong to project
- 403 error for cross-project access attempts

**Stage Mapping**:
- SPECIFY → specify command
- PLAN → plan command
- BUILD → implement command
- VERIFY, SHIP → no workflow (stage update only)

**Job Creation**:
- Create Job with ticketId, command, status=PENDING, startedAt=now
- branch field null (workflow updates later)

**Branch Generation** (SPECIFY only):
- Generate: `feature/ticket-<id>`
- Set ticket.branch field
- Pass to workflow

**Workflow Dispatch**:
- Use ticket.project.githubOwner and githubRepo
- Target speckit.yml on main branch
- Pass ticket_id, command, branch
- Pass ticketTitle and ticketDescription ONLY for specify command

**Ticket Update**:
- Update ticket.stage to target stage
- Increment ticket.version (concurrency control)
- Return success with jobId

**Error Handling**:
- 400: Invalid ticket ID or malformed request
- 403: Ticket belongs to different project
- 404: Ticket not found
- 500: Octokit or database errors

**Logging**:
- Log all dispatch attempts
- Include ticket ID, command, branch

### Data Model

**API Request**:
```json
{
  "targetStage": "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP"
}
```

**API Response**:
```json
{
  "success": true,
  "jobId": 123,
  "message": "optional message"
}
```

**Workflow Dispatch Payload**:
- ticket_id: String
- command: String
- branch: String
- ticketTitle: String (specify only)
- ticketDescription: String (specify only)

---

## Job Status Updates

**Purpose**: Job records must reflect workflow execution results. When GitHub workflows complete, the system updates job status to show success, failure, or cancellation.

### What It Does

The system updates job status when workflows complete:

**Status Update Flow**:
1. GitHub workflow completes
2. Workflow calls status update API
3. System validates state transition
4. System updates job status and completedAt timestamp
5. User sees updated status in real-time

**Supported Transitions**:
- PENDING → RUNNING (workflow starts)
- RUNNING → COMPLETED (workflow succeeds)
- RUNNING → FAILED (workflow fails)
- RUNNING → CANCELLED (manually cancelled)

**Terminal State Handling**:
- COMPLETED, FAILED, CANCELLED cannot transition to other states
- Same-state requests are idempotent (return 200 without changes)

**Data Captured**:
- Workflow conclusion (success/failure/cancelled)
- Completion timestamp
- Preserves original startedAt timestamp

**Error Handling**:
- Errors logged only (no automatic retry)
- Invalid transitions rejected with 400 error

### Requirements

**API Endpoint**:
- PATCH `/api/jobs/{id}/status`
- Accepts status in request body
- Returns job id, status, completedAt
- Requires Bearer token authentication (WORKFLOW_API_TOKEN)

**Status Updates**:
- RUNNING → COMPLETED: Workflow finished successfully
- RUNNING → FAILED: Workflow encountered error
- RUNNING → CANCELLED: Workflow manually terminated
- PENDING → RUNNING: Workflow started execution

**Data Updates**:
- Update job status
- Set completedAt timestamp for terminal states
- Preserve startedAt timestamp
- Capture workflow conclusion

**State Machine**:
- Valid transitions enforced
- Terminal states cannot transition (except same-state)
- Invalid transitions return 400 error

**Idempotency**:
- Same status request returns 200
- No database changes for idempotent requests

**Error Handling**:
- 400: Invalid status or invalid transition
- 404: Job not found
- 500: Database errors
- Errors logged, no automatic retry

### Data Model

**API Request**:
```json
{
  "status": "COMPLETED" | "FAILED" | "CANCELLED"
}
```

**API Response**:
```json
{
  "id": 123,
  "status": "COMPLETED",
  "completedAt": "2025-10-11T10:30:00Z"
}
```

**State Transitions**:
```
PENDING → RUNNING
RUNNING → COMPLETED | FAILED | CANCELLED
COMPLETED → COMPLETED (idempotent)
FAILED → FAILED (idempotent)
CANCELLED → CANCELLED (idempotent)
```

---

## Real-Time Job Status Updates

**Purpose**: Users need to see job status changes as they happen without manually refreshing the page. The system uses client-side polling to periodically fetch job status updates and display them in real-time on the project board.

### What It Does

The system provides real-time visibility into workflow execution status:

**Polling Mechanism**:
- Client polls server at regular intervals for job status updates
- Board automatically displays status changes when jobs transition
- Polling continues while user views the board
- No server-side connection management required

**Update Flow**:
1. User views project board with active jobs
2. Client polls for job status updates every 2 seconds
3. Server returns current job statuses for all project jobs
4. Client updates UI when status changes detected
5. Client continues polling while board is visible

**Visual Feedback**:
- Job status badges update automatically (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED)
- Minimum display duration prevents status flickering
- Same real-time experience as previous SSE implementation

**Resource Management**:
- Polling stops when user navigates away from board
- No persistent server-side connections
- Compatible with serverless platforms (Vercel, AWS Lambda)

### Requirements

**Polling Configuration**:
- Configurable polling interval (default: 2 seconds)
- Start polling when board component mounts
- Stop polling when board component unmounts
- Continue polling in background tabs for real-time updates

**API Endpoint**:
- GET `/api/projects/{projectId}/jobs/status`
- Returns array of job status objects for project
- Minimal response size (only changed data)
- Authentication: User session (NextAuth.js)

**Client-Side State**:
- Track last known status for each job
- Detect status changes by comparing with previous poll
- Update UI only when changes detected
- Maintain polling interval timer

**Error Handling**:
- Network errors: Retry with exponential backoff
- Rate limiting: Respect 429 responses
- Authentication errors: Redirect to login
- Display error indicator if polling fails

**Optimization**:
- Polling stops when all jobs reach terminal states
- Polling resumes automatically when new jobs created
- Batch all job status queries per project
- Minimal data transfer (only job id, status, ticketId, updatedAt)

### Why Polling Instead of SSE?

**Serverless Platform Limitations**:
- Vercel serverless functions have execution time limits
- Connection persistence not guaranteed in serverless
- Cold starts interrupt SSE connections
- Horizontal scaling disconnects clients

**Polling Benefits**:
- No persistent connections required
- Works reliably on serverless platforms
- Simple error recovery (just poll again)
- No server-side subscriber state management

**Trade-offs**:
- Slight delay between status change and UI update (polling interval)
- More frequent server requests than SSE
- Client-side polling timer management required

### Data Model

**Poll Request**:
```
GET /api/projects/{projectId}/jobs/status
Authorization: Session cookie
```

**Poll Response**:
```json
{
  "jobs": [
    {
      "id": 123,
      "ticketId": 456,
      "status": "RUNNING",
      "updatedAt": "2025-10-19T10:30:00.000Z"
    },
    {
      "id": 124,
      "ticketId": 457,
      "status": "COMPLETED",
      "updatedAt": "2025-10-19T10:35:00.000Z"
    }
  ]
}
```

**Client Polling State**:
- `pollingInterval`: Timer ID for interval
- `lastKnownStatuses`: Map<jobId, status>
- `isPolling`: Boolean flag
- `errorCount`: Number of consecutive failures

**Polling Behavior**:
- Default interval: 2 seconds
- Automatically stops when all jobs reach terminal states (COMPLETED, FAILED, CANCELLED)
- Automatically resumes when new jobs are created via stage transitions
- Continues polling in background tabs for real-time updates

**Automatic Polling Resume**:
- When user transitions a ticket (drag-and-drop or quick-impl), system immediately checks for new jobs
- If new job detected, polling resumes automatically at 2-second interval
- No user intervention required to see job status updates
- Applies to all transition types (normal workflow and quick-impl)

---

## Workflow Authentication

**Purpose**: API endpoints called by GitHub Actions workflows must be protected from unauthorized access. The system validates workflow requests using Bearer token authentication to prevent external manipulation of job status and ticket data.

### What It Does

The system authenticates all workflow-initiated API calls:

**Authentication Flow**:
1. Workflow includes `Authorization: Bearer <token>` header
2. API endpoint validates token using constant-time comparison
3. System processes request if token valid
4. System returns 401 Unauthorized if token invalid or missing

**Protected Endpoints**:
- PATCH `/api/jobs/{id}/status` - Job status updates
- PATCH `/api/projects/{projectId}/tickets/{id}/branch` - Branch name updates

**Security Features**:
- **Constant-time comparison**: Prevents timing attack vulnerabilities
- **Bearer token scheme**: Industry-standard authentication pattern
- **Centralized validation**: Single authentication helper used by all endpoints
- **Clear error messages**: Distinguishes between missing token, invalid format, and incorrect token

**Token Management**:
- Stored as GitHub repository secret (WORKFLOW_API_TOKEN)
- Not logged or exposed in workflow output
- Reusable across all workflow API calls
- Independent of GitHub authentication

### Requirements

**Authentication Helper**:
- Location: `app/lib/workflow-auth.ts`
- Function: `validateWorkflowAuth(request: NextRequest)`
- Returns: `{ isValid: boolean, error?: string }`
- Uses constant-time string comparison for security

**Token Validation**:
- Checks Authorization header exists
- Validates Bearer scheme format
- Compares token using constant-time algorithm
- Returns specific error messages for debugging

**API Integration**:
- All workflow-callable endpoints must validate auth
- Validation happens before any business logic
- Returns 401 status for authentication failures
- Preserves existing error handling for other failures

**Environment Configuration**:
- `WORKFLOW_API_TOKEN`: Server environment variable
- Must be set in production environments
- Same token used across all workflow requests
- Token rotation requires updating GitHub secret and server environment

**Security Requirements**:
- Constant-time comparison prevents timing attacks
- Token never logged or included in error responses
- Failed auth attempts logged without exposing token
- Token validation independent of request content

### Data Model

**Authentication Request**:
```
Authorization: Bearer <WORKFLOW_API_TOKEN>
```

**Validation Result**:
```typescript
{
  isValid: boolean;
  error?: string; // Only present when isValid = false
}
```

**Error Messages**:
- "Workflow authentication not configured" - Server missing WORKFLOW_API_TOKEN
- "Missing Authorization header" - No Authorization header in request
- "Invalid Authorization header format" - Not "Bearer <token>" format
- "Invalid authentication token" - Token doesn't match expected value

**Implementation Details**:
- Helper: `app/lib/workflow-auth.ts`
- Used by: `app/api/jobs/[id]/status/route.ts`
- Used by: `app/api/projects/[projectId]/tickets/[id]/branch/route.ts`

---

## Job Completion Validation

**Purpose**: The system must prevent ticket transitions when automated workflows are incomplete to maintain workflow integrity and prevent premature progression through stages.

### What It Does

The system validates job completion status before allowing stage transitions:

**Validation Flow**:
1. User attempts to move ticket from SPECIFY, PLAN, or BUILD stage
2. System performs sequential validation (existing)
3. System validates job completion status (new)
4. System blocks transition if job not completed
5. System allows transition if job completed

**Validation Rules**:
- **Automated Stages**: SPECIFY, PLAN, BUILD require completed workflow job
- **Manual Stages**: VERIFY, SHIP bypass validation (no jobs created)
- **Initial Transition**: INBOX → SPECIFY bypasses validation (no prior job)
- **Job Selection**: Most recent job by `startedAt DESC` when multiple exist

**Blocking Conditions**:
- **PENDING**: Workflow created but not started yet
- **RUNNING**: Workflow currently executing
- **FAILED**: Workflow encountered error
- **CANCELLED**: Workflow manually terminated

**Allowing Conditions**:
- **COMPLETED**: Workflow finished successfully
- System creates new job for next stage after validation passes

**Error Response**:
```json
{
  "error": "Cannot transition",
  "message": "Cannot transition: workflow is still running",
  "code": "JOB_NOT_COMPLETED",
  "details": {
    "currentStage": "SPECIFY",
    "targetStage": "PLAN",
    "jobStatus": "PENDING",
    "jobCommand": "specify"
  }
}
```

**User-Friendly Error Messages**:
- PENDING/RUNNING: "Cannot transition: workflow is still running"
- FAILED: "Cannot transition: previous workflow failed. Please retry the workflow."
- CANCELLED: "Cannot transition: workflow was cancelled. Please retry the workflow."

**Retry Workflow Support**:
- Users can retry failed/cancelled workflows by triggering same transition again
- System validates against most recent job (by `startedAt DESC`)
- Historical jobs preserved for audit trail but don't affect validation

### Requirements

**Stage Validation**:
- SPECIFY → PLAN: Requires specify job COMPLETED
- PLAN → BUILD: Requires plan job COMPLETED
- BUILD → VERIFY: Requires implement job COMPLETED
- VERIFY → SHIP: No validation (manual stage)
- INBOX → SPECIFY: No validation (first transition)

**Job Query**:
- Query: `prisma.job.findFirst({ where: { ticketId }, orderBy: { startedAt: 'desc' } })`
- Performance: <50ms using composite index [ticketId, status, startedAt]
- Returns: Most recent job with id, status, command, startedAt

**Validation Logic**:
- Location: `lib/workflows/transition.ts`
- Functions:
  - `shouldValidateJobCompletion(stage)`: Determines if stage requires validation
  - `getJobValidationErrorMessage(status)`: Maps status to user-friendly message
  - `validateJobCompletion(ticket, targetStage)`: Performs validation check
- Integration: Called after sequential validation, before workflow dispatch

**Error Handling**:
- Status code: 400 Bad Request for validation failures
- Error codes: `JOB_NOT_COMPLETED`, `MISSING_JOB`
- Details object: Includes currentStage, targetStage, jobStatus, jobCommand
- Location: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`

**Data Integrity**:
- Missing job when expected: Return `MISSING_JOB` error (data integrity issue)
- Race conditions: Acceptable with PostgreSQL read-committed isolation
- Concurrent updates: Version-based conflict detection prevents lost updates

**Performance**:
- Query uses existing composite index [ticketId, status, startedAt]
- Expected performance: <10ms for indexed query
- Target overhead: <50ms additional latency per transition request

### Data Model

**TransitionResult Interface** (updated):
```typescript
export interface TransitionResult {
  success: boolean;
  jobId?: number;
  branchName?: string;
  error?: string;
  errorCode?: 'INVALID_TRANSITION' | 'GITHUB_ERROR' | 'JOB_NOT_COMPLETED' | 'MISSING_JOB';
  details?: {
    currentStage?: Stage;
    targetStage?: Stage;
    jobStatus?: JobStatus;
    jobCommand?: string;
  };
}
```

**Validation Error Codes**:
- `JOB_NOT_COMPLETED`: Job exists but status is not COMPLETED (PENDING, RUNNING, FAILED, CANCELLED)
- `MISSING_JOB`: Expected job for automated stage but none found (data integrity issue)

**Stage-to-Command Mapping**:
- SPECIFY stage validates "specify" command
- PLAN stage validates "plan" command
- BUILD stage validates "implement" command

**Job Selection Logic**:
- When multiple jobs exist: SELECT * FROM jobs WHERE ticketId = ? ORDER BY startedAt DESC LIMIT 1
- Supports retry workflows: Most recent job represents latest attempt
- Historical jobs: Preserved for audit trail, don't affect validation

---

## Current State Summary

### Available Features

**Job Tracking**:
- ✅ Complete execution history per ticket
- ✅ Status tracking (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED)
- ✅ Unlimited log storage
- ✅ Git metadata tracking (branch, commitSha)
- ✅ Query by ticket, status, or time range
- ✅ Indefinite retention (no cleanup)

**GitHub Workflow**:
- ✅ Manual dispatch workflow (speckit.yml)
- ✅ 5 spec-kit commands (specify, plan, task, implement, clarify)
- ✅ Proper environment setup (Node 22.20.0, Python 3.11)
- ✅ Git automation (commit and push)
- ✅ 120-minute timeout
- ✅ ai-board[bot] commit authorship

**Automatic Dispatch**:
- ✅ Auto-trigger on SPECIFY/PLAN/BUILD transitions
- ✅ Stage-to-command mapping
- ✅ Branch name generation (feature/ticket-<id>)
- ✅ Job creation with status tracking
- ✅ Error handling (auth, rate limits, missing workflow)

**Status Updates**:
- ✅ Workflow completion callbacks
- ✅ State machine enforcement
- ✅ Idempotent updates
- ✅ Terminal state protection

**Real-Time Updates**:
- ✅ Client-side polling for job status
- ✅ Automatic UI updates on status changes
- ✅ Serverless platform compatibility
- ✅ Resource-efficient polling (stops when not viewing board)
- ✅ Error handling with exponential backoff

**Workflow Authentication**:
- ✅ Bearer token authentication
- ✅ Constant-time comparison security
- ✅ Protected job status endpoint
- ✅ Protected branch update endpoint
- ✅ Centralized validation helper

**Job Completion Validation** (added 2025-10-15):
- ✅ Stage transition validation for automated stages (SPECIFY, PLAN, BUILD)
- ✅ Job status validation (blocks PENDING, RUNNING, FAILED, CANCELLED)
- ✅ Most recent job selection for retry workflow support
- ✅ Manual stage bypass (VERIFY, SHIP)
- ✅ User-friendly error messages with job context
- ✅ Performance optimized (<50ms query using composite index)
- ✅ Two new error codes: JOB_NOT_COMPLETED, MISSING_JOB

**Quick Implementation Workflow** (added 2025-01-15):
- ✅ Direct INBOX → BUILD transition bypassing SPECIFY and PLAN
- ✅ Warning modal with benefits/trade-offs explanation
- ✅ Visual feedback: green BUILD zone, blue SPECIFY zone, grayed invalid zones
- ✅ Lightning bolt (⚡) badge on BUILD column during INBOX drag
- ✅ Persistent ⚡ Quick badge on ticket cards (added 2025-01-16)
- ✅ Automatic `workflowType=QUICK` setting with atomic transaction (added 2025-01-16)
- ✅ Separate workflow file (quick-impl.yml) with minimal spec creation
- ✅ Same branch naming and job tracking as full workflow
- ✅ Mode detection: INBOX → BUILD triggers quick-impl, preserves normal workflow
- ✅ Error handling with user-friendly messages

### User Workflows

**Triggering Specification Generation**:
1. User drags ticket to SPECIFY stage
2. System creates Job (status: PENDING)
3. System generates branch: `feature/ticket-123`
4. System dispatches GitHub workflow
5. Workflow runs `/speckit.specify` command
6. Workflow commits spec.md to branch
7. Workflow updates Job status to COMPLETED
8. User sees completion status on ticket card

**Viewing Job History**:
1. User opens ticket detail modal
2. System displays all jobs for ticket
3. User sees execution history with statuses
4. User can identify which commands ran and when

### Business Rules

**Job Lifecycle**:
- Jobs created for SPECIFY, PLAN, BUILD transitions
- No jobs for VERIFY, SHIP transitions
- Status follows PENDING → RUNNING → terminal state
- Terminal states: COMPLETED, FAILED, CANCELLED
- All jobs retained indefinitely

**Job Completion Validation** (added 2025-10-15):
- SPECIFY, PLAN, BUILD stages require completed job before next transition
- System validates most recent job (by `startedAt DESC`) for retry workflow support
- Transitions blocked when job status is PENDING, RUNNING, FAILED, or CANCELLED
- Transitions allowed when job status is COMPLETED
- Manual stages (VERIFY, SHIP) and initial transition (INBOX → SPECIFY) bypass validation
- Error responses include job status, command, and suggested actions for failed/cancelled jobs
- Missing jobs for automated stages return MISSING_JOB error (data integrity issue)

**Quick Implementation Workflow** (added 2025-01-15):
- INBOX → BUILD direct transition triggers quick-impl mode
- Warning modal displays before execution (no "don't show again")
- Visual feedback distinguishes quick-impl (green) from normal (blue) workflow
- Persistent ⚡ Quick badge on ticket cards throughout lifecycle (added 2025-01-16)
- Automatic `workflowType=QUICK` setting in atomic transaction (added 2025-01-16)
- Separate quick-impl.yml workflow file with minimal spec generation
- Job command="quick-impl" tracked same as other commands
- Same branch naming pattern (`{num}-{description}`) as full workflow
- Bypasses job completion validation (no prior job exists)

**Branch Management**:
- SPECIFY generates: `feature/ticket-<id>`
- PLAN and BUILD use existing branch
- Branch field nullable initially (workflow populates)

**Workflow Dispatch**:
- Only SPECIFY command receives title/description
- All commands receive ticket_id, command, branch
- Targets project's GitHub repository
- Uses speckit.yml on main branch

**Status Updates**:
- First-write-wins for concurrent updates
- Invalid transitions rejected
- Same-state requests are idempotent
- Errors logged without retry

### Technical Details

**Job Storage**:
- PostgreSQL via Prisma
- Indexes: ticketId, status, startedAt
- Cascade delete with ticket
- Large logs: compression or external storage

**GitHub Integration**:
- Octokit (@octokit/rest) for API calls
- Workflow file: `.github/workflows/speckit.yml`
- Secrets: ANTHROPIC_API_KEY, GITHUB_TOKEN, WORKFLOW_API_TOKEN
- Variables: APP_URL (configurable API endpoint)
- Environment: ubuntu-latest

**State Machine**:
- Implementation: `app/lib/job-state-machine.ts`
- Validation: `canTransition(from, to)`
- Error: `InvalidTransitionError`

---

## Quick Implementation Workflow

**Purpose**: Users need to fast-track simple fixes and minor changes without creating formal specifications and plans. The quick-impl workflow allows tickets to jump directly from INBOX to BUILD, bypassing SPECIFY and PLAN stages for speed while maintaining job tracking and validation.

### What It Does

The system provides an express workflow for simple tasks:

**Quick-Impl Transition**:
- Direct transition from INBOX → BUILD (bypassing SPECIFY and PLAN)
- Warning modal explains trade-offs before execution
- Same branch management and job tracking as full workflow
- Optimized for: typo fixes, minor UI tweaks, obvious bugs

**Modal Confirmation**:
- **Required confirmation**: Modal displays every time (no "don't show again")
- **Benefits explained**: Faster implementation, ideal for simple fixes
- **Trade-offs highlighted**: No formal spec, limited planning, may need more iterations
- **Action buttons**: "Cancel" (reverts to INBOX) or "Proceed" (executes quick-impl)
- **Performance requirement**: Modal appears within 100ms of drop event

**Visual Feedback During Drag**:
- **Blue drop zone**: SPECIFY column shows blue border (`border-blue-400`) for normal workflow
- **Green drop zone**: BUILD column shows green border (`border-green-400`) for quick-impl
- **Quick-impl badge**: BUILD column displays lightning bolt (⚡) and "Quick Implementation" text
- **Invalid zones grayed**: PLAN/VERIFY/SHIP show reduced opacity (`opacity-50`) and prohibited icon (🚫)
- **Cursor feedback**: `not-allowed` cursor on invalid drop zones

**Workflow Execution**:
- Creates Job with `command="quick-impl"` and `status=PENDING`
- Dispatches `.github/workflows/quick-impl.yml` (separate workflow file)
- Workflow creates feature branch using `create-new-feature.sh --mode=quick-impl`
- Executes `/quick-impl` Claude command (bypasses specification generation)
- Updates ticket branch field after branch creation
- Updates job status on completion (COMPLETED/FAILED/CANCELLED)

**Workflow Type Tracking** (added 2025-01-16):
- System automatically sets `workflowType=QUICK` during INBOX → BUILD transition
- Field updated atomically in same transaction as Job creation
- Persistent ⚡ Quick badge appears on ticket card (positioned left of model badge)
- Badge visible throughout ticket lifecycle (BUILD → VERIFY → SHIP)
- Amber color scheme distinguishes quick-impl from full workflow tickets
- Field immutable after initial setting (application-level enforcement)

**Script Behavior**:
- `create-new-feature.sh --mode=quick-impl`: Creates minimal spec.md with only title and description
- `create-new-feature.sh --mode=specify`: Creates full spec template (default)
- Branch naming: Same `{num}-{description}` pattern as full workflow

**Error Handling**:
- Workflow dispatch failures: User-friendly error suggesting full workflow alternative
- Transition API failures: Rollback to INBOX with error toast
- Job status update failures: Warning to manually refresh page
- Workflow execution failures: Job status set to FAILED with link to GitHub Actions logs

### Requirements

**Drag-and-Drop**:
- Allow INBOX → BUILD direct transition
- Detect quick-impl mode when `currentStage === INBOX && targetStage === BUILD`
- Preserve existing stage transitions (no regression)
- Prevent invalid transitions (INBOX → PLAN/VERIFY/SHIP)

**Visual Feedback**:
- Blue dashed border + blue background on SPECIFY during INBOX drag
- Green dashed border + green background on BUILD during INBOX drag
- Lightning bolt emoji (⚡) + "Quick Implementation" badge on BUILD
- Prohibited emoji (🚫) + 50% opacity on PLAN/VERIFY/SHIP
- `not-allowed` cursor on invalid zones

**Warning Modal**:
- Display before API call (100ms performance target)
- Show benefits (speed, simple fixes) and trade-offs (no spec, limited planning)
- Provide "Cancel" (no API call) and "Proceed" (execute) buttons
- Amber styling (`bg-amber-600`) for warning emphasis
- Test ID: `quick-impl-modal` for E2E testing

**API Integration**:
- **Endpoint**: POST `/api/projects/{projectId}/tickets/{id}/transition`
- **Detection**: `currentStage === INBOX && targetStage === BUILD` triggers quick-impl
- **Validation**: Skip job completion validation (no prior job exists)
- **Job Creation**: Create Job with `command="quick-impl"`, `status=PENDING`
- **Workflow Dispatch**: Dispatch `quick-impl.yml` instead of `speckit.yml`
- **Concurrency**: Maintain optimistic concurrency control (version field)

**Workflow File** (`.github/workflows/quick-impl.yml`):
- Same environment setup as speckit.yml (Node 22.20.0, Python 3.11, Claude Code CLI)
- Checkout main branch initially (branch created by script)
- Execute `create-new-feature.sh --mode=quick-impl`
- Run `/quick-impl` command with ticket context
- Commit and push changes to created branch
- Update ticket branch via API
- Update job status via API

**Script Modification** (`create-new-feature.sh`):
- Accept `--mode` parameter (values: "specify", "quick-impl")
- Quick-impl mode: Create minimal spec.md (title, description only)
- Specify mode: Create full spec template (existing behavior)
- Branch naming: Consistent `{num}-{description}` pattern

### Requirements

**Stage Validation**:
- INBOX → SPECIFY: Normal workflow (specify command)
- INBOX → BUILD: Quick-impl workflow (quick-impl command)
- SPECIFY → PLAN: Normal workflow (plan command)
- PLAN → BUILD: Normal workflow (implement command)
- BUILD → VERIFY: Manual transition (no workflow)
- VERIFY → SHIP: Manual transition (no workflow)

**Job Validation**:
- Quick-impl bypasses job completion validation (no prior job)
- Full workflow still validates job completion at each stage

**Modal State Management**:
- Store drop intent (ticket, target stage) when modal opens
- Execute API call only after confirmation
- Rollback optimistic update if API fails
- Prevent multiple API calls (disable button during execution)

**Error Messages**:
- Workflow dispatch fail: "Quick implementation failed. Try using the full workflow (INBOX → SPECIFY → PLAN → BUILD)."
- Network error: "Failed to start workflow. Check your connection and try again."
- Job validation error: Should not occur for INBOX → BUILD (no prior job)

### Data Model

**Job Entity** (updated):
- `command`: Spec-kit command (specify|plan|task|implement|clarify|**quick-impl**, max 50 chars)
- Quick-impl jobs tracked same as other jobs

**Quick-Impl Modal State**:
- `isOpen`: Boolean (modal visibility)
- `pendingTicket`: TicketWithVersion | null (ticket to transition)
- `pendingTarget`: Stage | null (target stage, always BUILD for quick-impl)

**API Request** (unchanged):
```json
{
  "targetStage": "BUILD"
}
```

**API Response** (unchanged):
```json
{
  "success": true,
  "jobId": 123,
  "message": "optional message"
}
```

**Workflow Detection**:
- Normal: `currentStage !== INBOX || targetStage !== BUILD` → dispatch speckit.yml
- Quick-impl: `currentStage === INBOX && targetStage === BUILD` → dispatch quick-impl.yml

**Branch Naming**:
- Format: `{num}-{description}` (e.g., `031-quick-implementation`)
- Same pattern as full workflow for consistency

---

## Quick Workflow Rollback

**Purpose**: Users need to recover from failed or cancelled quick-impl workflows without losing the ability to restart with a different approach. The rollback feature allows tickets in BUILD stage to return to INBOX stage when automated workflows fail, enabling users to choose either workflow path for recovery.

### What It Does

The system provides rollback capability for failed workflows:

**Rollback Transition**:
- Allows BUILD → INBOX transition when most recent workflow job has FAILED or CANCELLED status
- Resets ticket state for fresh start while preserving debugging information
- Blocks rollback when workflow is PENDING, RUNNING, or COMPLETED
- Provides visual feedback during drag operations to indicate rollback eligibility

**State Management During Rollback**:
- **workflowType**: Reset from QUICK to FULL (allows choosing either workflow path)
- **stage**: Updated from BUILD to INBOX
- **branch**: Preserved (not reset to null, useful for debugging)
- **Job history**: All job records preserved for audit trail and debugging

**Rollback Flow**:
1. User drags ticket from BUILD to INBOX (failed quick-impl scenario)
2. System validates most recent workflow job status
3. If FAILED/CANCELLED: Transition allowed, workflowType reset to FULL
4. If PENDING/RUNNING/COMPLETED: Transition blocked with error message
5. User can proceed with either workflow path after rollback

**Visual Feedback**:
- Amber/warning color indicator on INBOX column when dragging failed BUILD ticket
- Disabled/invalid indicator when job is RUNNING or COMPLETED
- Clear error messages explaining why rollback is blocked

**Job Validation**:
- System checks most recent job by `startedAt DESC` timestamp
- Distinguishes workflow jobs (specify, plan, implement, quick-impl) from AI-BOARD jobs (comment-*)
- Only workflow job status affects rollback eligibility

### Requirements

**Rollback Eligibility**:
- Allow BUILD → INBOX when most recent workflow job status is FAILED or CANCELLED
- Block rollback when job status is PENDING, RUNNING, or COMPLETED
- Query most recent job: `prisma.job.findFirst({ where: { ticketId, command: { notIn: ['comment-specify', 'comment-plan', 'comment-build', 'comment-verify'] } }, orderBy: { startedAt: 'desc' } })`

**State Reset**:
- Reset `workflowType` from QUICK to FULL atomically with stage transition
- Preserve `branch` field value (do not set to null)
- Update `stage` from BUILD to INBOX
- Preserve all Job records (no deletion)

**Visual Feedback**:
- Amber dashed border (`border-amber-500`) on INBOX column during BUILD ticket drag with FAILED/CANCELLED job
- Red disabled indicator on INBOX column when job is RUNNING
- Gray disabled indicator when job is COMPLETED
- `not-allowed` cursor on invalid drop zones
- Performance target: Visual feedback appears within 100ms of drag start

**API Validation**:
- Endpoint: POST `/api/projects/{projectId}/tickets/{id}/transition`
- Rollback detection: `currentStage === BUILD && targetStage === INBOX`
- Validation logic: Check most recent workflow job status before transition
- Return 400 error with clear message when rollback blocked

**Error Messages**:
- PENDING/RUNNING: "Cannot rollback: workflow is still running"
- COMPLETED: "Cannot rollback: workflow completed successfully"
- No workflow job found: "Cannot rollback: no workflow job found" (data integrity issue)

**Post-Rollback Transitions**:
- INBOX → SPECIFY: Allowed (normal workflow)
- INBOX → BUILD: Allowed (retry quick-impl)
- Both transitions create new Job records
- Historical job records remain accessible

### Data Model

**Rollback Validation Query**:
```typescript
const mostRecentWorkflowJob = await prisma.job.findFirst({
  where: {
    ticketId,
    command: {
      notIn: ['comment-specify', 'comment-plan', 'comment-build', 'comment-verify']
    }
  },
  orderBy: { startedAt: 'desc' }
});
```

**Rollback Transition**:
```typescript
await prisma.ticket.update({
  where: { id: ticketId },
  data: {
    stage: 'INBOX',
    workflowType: 'FULL',
    // branch preserved (not updated)
    version: { increment: 1 }
  }
});
```

**Error Response**:
```json
{
  "error": "Cannot rollback",
  "message": "Cannot rollback: workflow is still running",
  "code": "ROLLBACK_NOT_ALLOWED",
  "details": {
    "currentStage": "BUILD",
    "targetStage": "INBOX",
    "jobStatus": "RUNNING",
    "jobCommand": "quick-impl"
  }
}
```

**Rollback Eligibility States**:
- ✅ FAILED: Rollback allowed
- ✅ CANCELLED: Rollback allowed
- ❌ PENDING: Rollback blocked
- ❌ RUNNING: Rollback blocked
- ❌ COMPLETED: Rollback blocked

**Visual Feedback States**:
- FAILED/CANCELLED job: Amber border (`border-amber-500 bg-amber-500/10`)
- RUNNING job: Red disabled (`border-red-500 opacity-50`)
- COMPLETED job: Gray disabled (`opacity-50 cursor-not-allowed`)
- No valid job: Invalid transition (blocked at API level)

---
