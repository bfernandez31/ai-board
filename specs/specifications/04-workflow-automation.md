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
2. Client polls for job status updates every N seconds
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
- Configurable polling interval (default: TBD)
- Start polling when board component mounts
- Stop polling when board component unmounts
- Handle visibility changes (optional: pause when tab inactive)

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
- Terminal state jobs excluded from polling
- Batch all job status queries per project
- Minimal data transfer (only job id and status)
- Debounce rapid status changes

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
[
  {
    "id": 123,
    "ticketId": 456,
    "status": "RUNNING"
  },
  {
    "id": 124,
    "ticketId": 457,
    "status": "COMPLETED"
  }
]
```

**Client Polling State**:
- `pollingInterval`: Timer ID for interval
- `lastKnownStatuses`: Map<jobId, status>
- `isPolling`: Boolean flag
- `errorCount`: Number of consecutive failures

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
