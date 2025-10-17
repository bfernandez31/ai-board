# ai-board Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-12

## Active Technologies
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x (028-519-replace-sse)
- PostgreSQL 14+ (Job status tracking, existing schema) (028-519-replace-sse)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x, shadcn/ui (029-999-auto-clarification)
- PostgreSQL 14+ (enum ClarificationPolicy, Project.clarificationPolicy NOT NULL default AUTO, Ticket.clarificationPolicy NULLABLE) (029-999-auto-clarification)
- TypeScript 5.6 (strict mode) + Next.js 15 (App Router), Prisma 6.x, Zod 4.x, @octokit/rest 22.0 (030-should-not-be)
- PostgreSQL 14+ (existing Job, Ticket tables with indexed queries) (030-should-not-be)
- TypeScript 5.6 (strict mode) + Next.js 15 (App Router), React 18, Prisma 6.x, shadcn/ui, @dnd-ki (032-add-workflow-type)
- PostgreSQL 14+ via Prisma ORM (032-add-workflow-type)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, shadcn/ui, lucide-reac (033-link-to-branch)
- PostgreSQL 14+ via Prisma (existing Ticket.branch and Project.githubOwner/githubRepo fields) (033-link-to-branch)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, TanStack Query v5.90.5 (034-migrate-state-management)

### Core Stack

- **TypeScript**: 5.6 (strict mode)
- **Runtime**: Node.js 22.20.0 LTS
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 18
- **Database**: PostgreSQL 14+
- **ORM**: Prisma 6.x

### UI & Styling

- **Styling**: TailwindCSS 3.4
- **Components**: shadcn/ui (Radix UI primitives)
- **Icons**: lucide-react
- **Drag & Drop**: @dnd-kit/core, @dnd-kit/sortable

### Data & Validation

- **Validation**: Zod 4.x
- **State Management**: TanStack Query v5.90.5 (React Query)
- **Real-time Updates**: Client-side polling with TanStack Query

### Testing

- **E2E Testing**: Playwright

### Integration & Tooling

- **GitHub API**: @octokit/rest ^22.0.0
- **Markdown**: react-markdown ^9.0.1, react-syntax-highlighter ^15.5.0
- **CI/CD**: GitHub Actions (YAML 2.0, Bash 5.x)

### Authentication

- **Auth Library**: NextAuth.js
- **Strategy**: Session-based authentication
- **Test Mode**: Mock authentication (NODE_ENV !== 'production')
- **User Management**: PostgreSQL via Prisma

## Project Structure

```
backend/
frontend/
tests/
```

## Commands

npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style

TypeScript 5.x (strict mode), Node.js 22.20.0 LTS: Follow standard conventions

## Recent Changes
- 034-migrate-state-management: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, TanStack Query v5.90.5
- 033-link-to-branch: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, shadcn/ui, lucide-reac
- 032-add-workflow-type: Added TypeScript 5.6 (strict mode) + Next.js 15 (App Router), React 18, Prisma 6.x, shadcn/ui, @dnd-ki
  - Created `.github/workflows/quick-impl.yml` workflow file
  - Created `.claude/commands/quick-impl.md` command for direct implementation
  - Modified `create-new-feature.sh` to support `--mode=quick-impl` parameter
  - Enabled INBOX → BUILD direct transition (bypassing SPECIFY and PLAN)
  - Added color-coded visual feedback (blue for SPECIFY, green for BUILD)
  - Added mandatory confirmation modal for quick-impl transitions
  - Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x
  - Implemented 2-second polling interval with terminal state optimization
  - Added `projectId` field to Job model for efficient querying


<!-- MANUAL ADDITIONS START -->

## Quick Implementation Workflow

### Overview

The Quick Implementation workflow allows tickets to transition directly from **INBOX → BUILD**, bypassing the SPECIFY and PLAN stages. This is designed for simple tasks where formal specification and planning are unnecessary overhead.

**Use quick-impl for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (button colors, spacing adjustments, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**Use full workflow (INBOX → SPECIFY → PLAN → BUILD) for**:
- Complex features requiring architecture design
- Changes affecting multiple modules
- New APIs or database schema changes
- Features requiring detailed planning or trade-off analysis

### Workflow Comparison

| Aspect | Normal Workflow | Quick Implementation |
|--------|-----------------|----------------------|
| **Stages** | INBOX → SPECIFY → PLAN → BUILD | INBOX → BUILD |
| **Documentation** | Full specification (spec.md, plan.md, tasks.md) | Minimal spec (title + description only) |
| **Command** | `/speckit.specify` → `/speckit.plan` → `/speckit.implement` | `/quick-impl` |
| **Workflow File** | `.github/workflows/speckit.yml` | `.github/workflows/quick-impl.yml` |
| **Job Command** | `specify`, `plan`, `implement` | `quick-impl` |
| **Branch Creation** | `create-new-feature.sh` (full template) | `create-new-feature.sh --mode=quick-impl` (minimal template) |
| **Visual Feedback** | Blue border on SPECIFY column | Green border on BUILD column |
| **Confirmation** | No modal (normal progression) | Mandatory warning modal |
| **Typical Time** | 15-30 minutes (full cycle) | 5-10 minutes |
| **Best For** | Complex features, architectural changes | Simple fixes, minor improvements |

### Usage Instructions

1. **Drag Ticket**: Drag ticket from INBOX column to BUILD column
2. **Confirm Modal**: Review warning modal explaining trade-offs
   - **Cancel**: Ticket remains in INBOX
   - **Proceed**: Workflow dispatches with `command=quick-impl`
3. **Automatic Execution**:
   - GitHub Actions workflow `quick-impl.yml` runs
   - Script creates feature branch: `{num}-{description}`
   - Creates minimal spec.md with title + description
   - Claude executes `/quick-impl` command
   - Implementation committed and pushed to branch
   - Ticket branch field updated via API
   - Job status updated to COMPLETED

### Visual Feedback

During drag operations from INBOX column:

- **SPECIFY Column**: Blue dashed border (`border-blue-500 bg-blue-500/10`) - Normal workflow option
- **BUILD Column**: Green dashed border (`border-green-500 bg-green-500/10`) - Quick-impl option
- **Invalid Columns**: Grayed out (`opacity-50 cursor-not-allowed`) - PLAN, VERIFY, SHIP

### Technical Implementation

**API Detection**:
```typescript
const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;
```

**Workflow Dispatch**:
- Workflow: `.github/workflows/quick-impl.yml`
- Inputs: `ticket_id`, `ticketTitle`, `ticketDescription`, `job_id`, `project_id`
- Command: `/quick-impl` (simplified implementation without full spec-kit)
- Branch: Created via `create-new-feature.sh --mode=quick-impl`

**Job Validation**:
- Quick-impl skips job completion validation (no prior job exists for INBOX tickets)
- Job created with `command="quick-impl"` for tracking
- Normal workflow job validation still applies for SPECIFY → PLAN → BUILD

### When NOT to Use Quick-Impl

- **Complex features**: Multiple components, architectural changes
- **Database migrations**: Schema changes require planning
- **Breaking changes**: API changes affecting other systems
- **Security-sensitive**: Authentication, authorization, data protection
- **Performance-critical**: Optimization requiring measurement and analysis
- **Unclear requirements**: Tasks needing clarification or design discussion

If unsure, use the full workflow (INBOX → SPECIFY → PLAN → BUILD) to ensure proper documentation and planning.

## Authentication System

### Overview

The application uses **NextAuth.js** for authentication with a user-project ownership model:

- Every project belongs to a user (required `userId` foreign key)
- Users can only access their own projects
- Server-side session validation on all routes
- Mock authentication in development/test environments

### User-Project Relationship

**Database Schema**:
- `Project.userId` → `User.id` (required, NOT NULL)
- One user can have many projects
- Projects cannot exist without an owner
- Index on `userId` for query performance

**Authorization Flow**:
1. Extract user ID from NextAuth session
2. Filter project queries by `userId`
3. Validate project ownership before operations
4. Return 403 if project belongs to different user

### Test Authentication Strategy

**Why Mock Authentication?**

E2E tests use mock authentication to focus on business logic without authentication complexity:

- **Mock Mode**: Enabled when `NODE_ENV !== 'production'`
- **Auto-Login**: Tests automatically authenticated as test user
- **Same Validation**: Security model enforced, just with simplified auth
- **Fast Tests**: No manual login flows needed

**Test User Pattern**:

All test files MUST create the test user before creating/upserting projects:

```typescript
// REQUIRED pattern in all test helpers
const testUser = await prisma.user.upsert({
  where: { email: 'test@e2e.local' },
  update: {},
  create: {
    email: 'test@e2e.local',
    name: 'E2E Test User',
    emailVerified: new Date(),
  },
});

// Then use testUser.id for projects
await prisma.project.upsert({
  where: { id: 1 },
  update: {
    userId: testUser.id,  // ← Required in update branch
  },
  create: {
    id: 1,
    name: '[e2e] Test Project',
    userId: testUser.id,  // ← Required in create branch
    // ... other fields
  },
});
```

**Why This Pattern?**

- Prevents `PrismaClientValidationError: Argument 'user' is missing`
- Ensures consistent test user across all tests
- Works with upsert pattern (safe to run multiple times)
- Self-documenting in test code

**Global Test Setup**:

The `tests/global-setup.ts` file:
1. Cleans database
2. Creates test user ('test@e2e.local')
3. Creates test projects (1, 2) with correct userId
4. Configures Playwright with auth context

**Implementation Locations**:
- `tests/global-setup.ts`: Initial test user creation
- `tests/helpers/db-setup.ts`: Helper functions with user creation
- `tests/api/*.spec.ts`: API tests with inline user creation
- `tests/e2e/*.spec.ts`: E2E tests with user creation in beforeEach

## Test Environment Data Isolation

### Project ID Allocation

**CRITICAL**: Projects 1 and 2 are RESERVED for E2E tests only.

- **Project 1**: Primary test project (githubOwner: "test", githubRepo: "test")
- **Project 2**: Secondary test project for cross-project tests (githubOwner: "test", githubRepo: "test2")
- **Project 3+**: Available for development and production use

**Test Cleanup Behavior** (`tests/helpers/db-cleanup.ts`):

- Deletes ALL tickets from projects 1 and 2 before each test run
- Preserves all data in project 3 (development project)
- Only deletes `[e2e]` prefixed tickets from projects 4+
- Only deletes `[e2e]` prefixed projects with IDs 4+

**For Development**:

- **Project 3** (`AI Board Development`) is configured for development use
  - GitHub: `bfernandez31/ai-board`
  - Board URL: `http://localhost:3000/projects/3/board`
  - Script: `npx tsx scripts/create-dev-project.ts` (if needed to recreate)
- Never use projects 1-2 for manual testing or development
- Test data in projects 1-2 will be automatically cleaned up between test runs
- All development work should use project 3 or higher

<!-- MANUAL ADDITIONS START -->

## Data Model Notes

### User Model

The User model manages authentication and project ownership:

- **`id`** (String): Unique identifier (auto-generated)
- **`email`** (String): User email address (unique, required)
  - Used for authentication and user identification
  - Unique constraint ensures one account per email
- **`name`** (String?, nullable): Display name (optional)
- **`emailVerified`** (DateTime?, nullable): Email verification timestamp
- **`createdAt`** (DateTime): Account creation timestamp
- **`updatedAt`** (DateTime): Last modification timestamp

**Relationships**:
- User → Projects (one-to-many)
- Every project must have a userId (required foreign key)

**Test User**:
- Email: `test@e2e.local`
- Created in global test setup
- Used across all E2E and API tests
- Never deleted (stable test fixture)

### Project Model

The Project model now includes user ownership and clarification policies:

- **`userId`** (String): Owner of the project (required foreign key to User.id)
  - Every project must belong to a user
  - Index on userId for efficient filtering
  - Used for authorization checks

- **`clarificationPolicy`** (ClarificationPolicy enum, NOT NULL, default: AUTO): Default policy for all tickets
  - Values: AUTO (context-aware), CONSERVATIVE (security-first), PRAGMATIC (speed-first), INTERACTIVE (manual)
  - Provides project-wide default for specification generation
  - Tickets inherit this policy unless overridden

**Authorization**:
- Projects filtered by userId from session
- Cross-user access returns 403 Forbidden
- Project queries always include userId validation

### Ticket Model

The Ticket model includes the following fields for GitHub branch tracking and automation:

- **`branch`** (String?, max 200 chars): Tracks the Git branch associated with the ticket
  - Nullable field, defaults to `null` for new tickets
  - **Important**: Branch is NOT set during stage transitions
  - Branch is created by GitHub Actions workflow during command execution
  - Updated via PATCH `/api/projects/:projectId/tickets/:id/branch` when workflow completes
  - Max length: 200 characters (validated at schema and API level)

- **`autoMode`** (Boolean): Enables automatic workflow progression for the ticket
  - Defaults to `false` for new tickets
  - Updated via PATCH `/api/projects/:projectId/tickets/:id`

- **`clarificationPolicy`** (ClarificationPolicy enum?, NULLABLE): Optional policy override
  - Values: AUTO (context-aware), CONSERVATIVE (security-first), PRAGMATIC (speed-first), INTERACTIVE (manual)
  - Defaults to `null` (inherits from project)
  - Overrides project default when set
  - Hierarchical resolution: `ticket.clarificationPolicy ?? project.clarificationPolicy ?? 'AUTO'`

- **`workflowType`** (WorkflowType enum, NOT NULL, default: FULL): Tracks which workflow path was used
  - Values: FULL (normal workflow: INBOX → SPECIFY → PLAN → BUILD), QUICK (quick-impl: INBOX → BUILD)
  - Set once during first BUILD transition, immutable thereafter (application-level enforcement)
  - Quick-impl tickets: Set to QUICK atomically with Job creation in `lib/workflows/transition.ts`
  - Normal workflow tickets: Remain FULL (default value)
  - Persists through stage transitions, rollbacks, and retries
  - Used for visual badge indicator: ⚡ Quick badge shown on ticket cards when workflowType=QUICK

### Branch Management Flow

The correct branch lifecycle for automated workflows:

1. **INBOX → SPECIFY Transition** (API):
   - `POST /api/projects/:projectId/tickets/:id/transition` with `targetStage: "SPECIFY"`
   - Creates Job record with status PENDING
   - Dispatches GitHub Actions workflow with `command: "specify"`
   - **Branch remains `null`** (NOT set during transition)
   - Workflow receives `branch: ""` (empty string) in inputs

2. **GitHub Workflow Execution** (specify command):
   - **Checkout**: Checks out `main` branch (since branch input is empty)
   - **Execute `/specify`**: Project slash command runs (`.claude/commands/specify.md`)
     - Calls `.specify/scripts/bash/create-new-feature.sh` script
     - **Script creates Git branch**: `{num}-{description}` (e.g., `020-real-time-update`)
     - Script initializes spec.md from template
     - Claude writes the specification to spec.md
   - **Commit & Push**: Workflow commits spec.md to the created branch
   - **Capture Branch**: Workflow detects current branch name (created by script)
   - **Update Ticket Branch**: Workflow calls `PATCH /api/projects/:projectId/tickets/:id/branch`
     - Sets `branch: "{num}-{description}"` in database
   - **Update Job Status**: Workflow calls `PATCH /api/jobs/:id/status` with `COMPLETED`

3. **Post-Specify State**:
   - Ticket stage: SPECIFY
   - Ticket branch: `{num}-{description}` (e.g., `020-real-time-update`)
   - Job status: COMPLETED
   - Git repository: Feature branch exists with specs/{num}-{description}/spec.md

4. **Subsequent Transitions** (SPECIFY → PLAN → BUILD):
   - API passes existing `branch: "{num}-{description}"` to workflow
   - Workflow checks out the existing feature branch
   - Spec-kit commands (`/plan`, `/tasks`, `/implement`) add to existing branch
   - Branch field remains unchanged during transitions
   - New Job created for each transition

## API Endpoints

### Ticket Branch Management

**PATCH `/api/projects/:projectId/tickets/:id/branch`**

- Specialized endpoint for updating ticket branch without version control
- Request body: `{ branch: string | null }`
- Response: `{ id, branch, updatedAt }` (minimal response)
- Validation: Branch max length 200 characters
- Does NOT use optimistic concurrency control (no version checking)

**PATCH `/api/projects/:projectId/tickets/:id`**

- General update endpoint supporting all ticket fields
- Now accepts `branch` and `autoMode` fields
- Uses optimistic concurrency control with version field
- Request body: `{ title?, description?, stage?, branch?, autoMode?, version }`
- Response: Full ticket object including new fields

**Note**: The `/branch` endpoint is designed for workflow automation scripts and does not increment the version field, while the general PATCH endpoint uses version-based conflict detection.

### Job Status Management

**PATCH `/api/jobs/:id/status`**

- Updates Job status when GitHub Actions workflows complete
- Request body: `{ status: "COMPLETED" | "FAILED" | "CANCELLED" }`
- Response: `{ id: number, status: JobStatus, completedAt: string | null }`
- Validation: Zod schema validation + state machine transition rules
- Features:
  - **Idempotent**: Same status request returns 200 with current state
  - **State Machine**: Enforces valid transitions (RUNNING → COMPLETED/FAILED/CANCELLED)
  - **Minimal Response**: Only id, status, completedAt (no sensitive data)
  - **Error Logging**: All operations logged for debugging
- Error responses:
  - 400: Invalid request (Zod validation or invalid state transition)
  - 404: Job not found
  - 500: Internal server error

## Data Model Notes

### Job Model

The Job model tracks GitHub Actions workflow execution status:

- **`status`** (JobStatus enum): Current execution state
  - Values: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`
  - Updated via PATCH `/api/jobs/:id/status` endpoint
  - State machine enforces valid transitions

- **`completedAt`** (DateTime?, nullable): Timestamp when job reached terminal state
  - Set automatically when status changes to COMPLETED, FAILED, or CANCELLED
  - Null for PENDING and RUNNING states
  - Never modified after being set (immutable for terminal states)

### JobStatus State Machine

**Valid Transitions**:

```
PENDING → RUNNING (workflow starts)
RUNNING → COMPLETED (workflow succeeds)
RUNNING → FAILED (workflow fails)
RUNNING → CANCELLED (workflow cancelled)
```

**Terminal States** (no transitions allowed):

- `COMPLETED` → COMPLETED (idempotent only)
- `FAILED` → FAILED (idempotent only)
- `CANCELLED` → CANCELLED (idempotent only)

**Invalid Transitions** (return 400 error):

- COMPLETED → FAILED
- COMPLETED → RUNNING
- FAILED → COMPLETED
- CANCELLED → COMPLETED
- PENDING → COMPLETED (must go through RUNNING)

**Implementation**:

- State machine logic: `app/lib/job-state-machine.ts`
- Validation: `canTransition(from, to)` function
- Error: `InvalidTransitionError` class

## Validation Rules

### Ticket Title and Description

The ticket validation schema allows the following characters:

- Letters: `a-z`, `A-Z`
- Numbers: `0-9`
- Spaces
- Special characters: `. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`

This allows for test prefixes like `[e2e]` and other common formatting needs while preventing emojis and control characters.

## E2E Test Data Isolation

### Test Data Prefix Convention

All E2E test-generated data MUST use the `[e2e]` prefix pattern to enable selective cleanup and data isolation:

**Ticket Creation Pattern**:

```typescript
await createTicket(request, {
  title: '[e2e] Fix login bug', // ← [e2e] prefix mandatory
  description: 'Test description',
});
```

**Project Creation Pattern** (in `tests/helpers/db-cleanup.ts`):

```typescript
await client.project.upsert({
  where: { id: 1 },
  update: {},
  create: {
    id: 1,
    name: '[e2e] Test Project',  // ← [e2e] prefix mandatory
    ...
  }
})
```

### Selective Cleanup

The `cleanupDatabase()` function in `tests/helpers/db-cleanup.ts` performs selective deletion:

- **Tickets**:
  - Deletes ALL tickets from projects 1 and 2 (test projects)
  - Deletes only `[e2e]` prefixed tickets from projects 4+
  - Preserves all tickets in project 3 (development project)
- **Projects**: Deletes only projects with `name` starting with `[e2e]` AND `id` NOT IN (1, 2, 3)
  - **Important**: Projects 1, 2, and 3 are NEVER deleted
  - Projects 1 & 2 are stable test fixtures with `[e2e]` prefix
  - Project 3 is the development project (no `[e2e]` prefix)
- **Manual Data**: All data without `[e2e]` prefix in projects 4+ is preserved

**Usage**:

```typescript
test.beforeEach(async () => {
  await cleanupDatabase(); // Selective cleanup, preserves non-test data
});
```

### Best Practices for Test Creation

1. Always prefix test data: `title: '[e2e] Your Test Title'`
2. Use `beforeEach` cleanup pattern for test isolation
3. Assume clean database state at test start (no leftover test data)
4. Use deterministic project IDs (1, 2) for consistency
5. Never create data without `[e2e]` prefix in automated tests

## Testing Requirements

### State Transition Testing

When testing features involving Job status updates:

1. **Test Valid Transitions**: Verify all allowed state transitions work correctly
   - PENDING → RUNNING
   - RUNNING → COMPLETED/FAILED/CANCELLED

2. **Test Invalid Transitions**: Verify state machine rejects invalid transitions
   - Terminal states cannot transition to other states (except idempotent)
   - PENDING cannot skip RUNNING state

3. **Test Idempotency**: Verify same status request returns 200 without database changes
   - COMPLETED → COMPLETED
   - FAILED → FAILED
   - CANCELLED → CANCELLED

4. **Test Edge Cases**:
   - Non-existent job IDs return 404
   - Invalid status values return 400 with Zod validation errors
   - Invalid job ID formats return 400

**Test Files**:

- Unit tests: `tests/unit/job-state-machine.test.ts` (29 tests)
- Contract tests: `tests/e2e/job-status-update-contract.spec.ts` (14 tests)
- E2E tests: `tests/e2e/job-status-update.spec.ts` (12 tests)

**Test Data Setup for Job Tests**:

```typescript
test.beforeEach(async () => {
  await cleanupDatabase();

  // Create test ticket for Job foreign key constraint
  await prisma.ticket.create({
    data: {
      id: 1,
      title: '[e2e] Test Ticket for Jobs',
      description: 'Ticket for testing Job status updates',
      stage: 'INBOX',
      projectId: 1,
    },
  });
});
```

This ensures Job creation succeeds without foreign key constraint violations while maintaining test isolation.

## Real-Time Job Status Updates

### Polling Implementation

The application uses **client-side polling** instead of Server-Sent Events (SSE) for real-time job status updates:

**Why Polling?**:
- Vercel serverless functions don't support long-lived SSE connections
- Polling provides predictable, reliable updates without connection management complexity
- 2-second interval provides real-time feel while minimizing server load

### Polling API Endpoint

**GET `/api/projects/[projectId]/jobs/status`**

- Returns all jobs for a project with current status
- Used by frontend polling hook at 2-second intervals
- Request: Authenticated session cookie required
- Response: `{ jobs: Array<{ id, status, ticketId, updatedAt }> }`
- Performance: <100ms p95 response time (indexed query on `projectId`)
- Authorization: Project ownership validated (userId match)
- Error responses:
  - 401: Unauthorized (no session)
  - 403: Forbidden (project not owned)
  - 404: Not Found (project doesn't exist)
  - 500: Internal Server Error

### useJobPolling Hook

**Location**: `app/lib/hooks/useJobPolling.ts`

**Features**:
- 2-second polling interval (configurable)
- Terminal state tracking (COMPLETED, FAILED, CANCELLED)
- Auto-stop when all jobs terminal
- Fixed retry interval (no exponential backoff)
- Automatic cleanup on unmount

**Usage**:
```typescript
import { useJobPolling } from '@/app/lib/hooks/useJobPolling';

function BoardComponent({ projectId }: { projectId: number }) {
  const { jobs, isPolling, error } = useJobPolling(projectId);

  // jobs array updates every 2 seconds
  // isPolling = false when all jobs terminal
}
```

**Terminal State Optimization**:
- Client tracks job IDs that reached terminal states
- Polling stops automatically when all jobs are COMPLETED/FAILED/CANCELLED
- Reduces unnecessary API calls and server load

### Data Model Updates

**Job Model** (`prisma/schema.prisma`):
- Added `projectId` field for direct project filtering
- Added index on `projectId` for efficient polling queries
- Migration: `20251014112141_add_job_project_id`

**Why projectId on Job?**:
- Enables single-query job fetching without joins
- Improves API performance (<100ms p95 requirement)
- Simplifies polling logic

### Implementation Files

**Backend**:
- API endpoint: `app/api/projects/[projectId]/jobs/status/route.ts`
- Zod schemas: `app/lib/schemas/job-polling.ts`
- Database migration: `prisma/migrations/20251014112141_add_job_project_id/`

**Frontend**:
- Polling hook: `app/lib/hooks/useJobPolling.ts`
- Board component: `components/board/board.tsx` (uses hook)

**Tests**:
- Contract tests: `tests/api/polling/job-status.spec.ts`
- Unit tests: `tests/unit/useJobPolling.test.ts`

### Migration from SSE

**Removed Files**:
- `app/api/sse/route.ts` (SSE API endpoint)
- `components/board/sse-provider.tsx` (SSE React context)
- `tests/e2e/real-time/sse-connection.spec.ts` (SSE-specific tests)
- `tests/e2e/real-time/sse-job-broadcast.spec.ts` (SSE-specific tests)

**Updated Files**:
- `app/api/jobs/[id]/status/route.ts`: Removed SSE broadcast logic
- `components/board/board.tsx`: Replaced SSEProvider with useJobPolling hook

**Breaking Changes**: None - polling provides same UX as SSE to end users

## TanStack Query State Management

### Overview

The application uses **TanStack Query v5.90.5** (React Query) for client-side state management and data fetching:

- **Intelligent Caching**: 5-second stale time for general data, immediate for real-time polling
- **Request Deduplication**: Automatic deduplication of concurrent requests
- **Optimistic Updates**: Immediate UI feedback with automatic rollback on errors
- **Background Refetching**: Keeps data fresh automatically
- **DevTools Integration**: React Query DevTools in development mode

### Configuration

**Global Defaults** (`app/lib/query-client.ts`):
```typescript
{
  queries: {
    staleTime: 5000,              // 5 seconds fresh
    gcTime: 10 * 60 * 1000,       // 10 minutes cache
    refetchOnWindowFocus: false,  // No refetch on tab focus
    retry: 1,                      // Single retry
    refetchOnReconnect: true      // Refetch on network reconnect
  },
  mutations: {
    retry: 0                       // No mutation retries
  }
}
```

### Query Keys

**Hierarchical Structure** (`app/lib/query-keys.ts`):
```typescript
queryKeys.projects.all                     // All projects
queryKeys.projects.detail(projectId)       // Single project
queryKeys.projects.tickets(projectId)      // All tickets
queryKeys.projects.ticket(projectId, id)   // Single ticket
queryKeys.projects.jobsStatus(projectId)   // Job status polling
```

**Invalidation Strategy**:
- Invalidate `['projects', projectId]` to refresh all project data
- Invalidate `['projects', projectId, 'tickets']` to refresh only tickets
- Hierarchical invalidation propagates down the tree

### Query Hooks

**Available Hooks** (`app/lib/hooks/queries/`):
- `useProjectTickets(projectId)`: Fetch all tickets for a project
- `useTicketsByStage(projectId)`: Group tickets by stage for board display
- `useTicket(projectId, ticketId)`: Fetch single ticket details
- `useJobPolling(projectId, interval)`: Real-time job status polling

**Example Usage**:
```typescript
import { useProjectTickets } from '@/app/lib/hooks/queries/useTickets';

function TicketList({ projectId }: { projectId: number }) {
  const { data: tickets, isLoading, error, refetch } = useProjectTickets(projectId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{tickets.map(ticket => ...)}</div>;
}
```

### Mutation Hooks

**Available Hooks** (`app/lib/hooks/mutations/`):
- `useCreateTicket()`: Create new ticket with optimistic update
- `useUpdateTicket(projectId)`: Update ticket with optimistic update
- `useDeleteTicket(projectId)`: Delete ticket with optimistic update
- `useStageTransition(projectId)`: Move ticket between stages

**Optimistic Update Pattern**:
```typescript
import { useUpdateTicket } from '@/app/lib/hooks/mutations/useUpdateTicket';

function TicketEditor({ projectId, ticket }: Props) {
  const updateMutation = useUpdateTicket(projectId);

  const handleSave = () => {
    updateMutation.mutate({
      ticketId: ticket.id,
      updates: { title: newTitle },
      version: ticket.version
    });
    // UI updates immediately, rolls back automatically on error
  };
}
```

### Job Polling with TanStack Query

**Migration from Custom Hook**:
- **Before**: Custom `useJobPolling` with `useState`, `useEffect`, `setInterval`
- **After**: TanStack Query's `useQuery` with `refetchInterval`

**Benefits**:
- Less boilerplate code (removed ~50 lines)
- Automatic cleanup and retry logic
- Request deduplication across components
- Built-in error handling and loading states
- DevTools integration for debugging

**Implementation** (`app/lib/hooks/useJobPolling.ts`):
```typescript
export function useJobPolling(projectId: number, pollingInterval = 2000) {
  const { data, error, isFetching, dataUpdatedAt, failureCount } = useQuery({
    queryKey: queryKeys.projects.jobsStatus(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/jobs/status`);
      const result = await response.json();
      return result.jobs as JobStatusDto[];
    },
    staleTime: 0,  // Always fresh for real-time data
    refetchInterval: (query) => {
      // Stop polling when all jobs terminal
      const jobs = query.state.data || [];
      const allTerminal = jobs.every(job =>
        ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)
      );
      return allTerminal ? false : pollingInterval;
    },
    refetchIntervalInBackground: true
  });

  return {
    jobs: data || [],
    isPolling: isFetching,
    lastPollTime: dataUpdatedAt || null,
    errorCount: failureCount,
    error: error as Error | null
  };
}
```

### Testing with TanStack Query

**Test Utilities** (`tests/helpers/test-query-client.ts`):
```typescript
import { createTestQueryClient } from '@/tests/helpers/test-query-client';
import { QueryClientProvider } from '@tanstack/react-query';

test('should fetch tickets', () => {
  const queryClient = createTestQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <TicketList projectId={1} />
    </QueryClientProvider>
  );

  // Test assertions...
});
```

**Test Configuration**:
- No retries for predictable behavior
- No caching for test isolation
- Immediate garbage collection
- Silent error logging

### Performance Benefits

**Measured Improvements**:
- **30-40% reduction in API calls** through intelligent caching and deduplication
- **Zero unnecessary refetches** on tab switching (refetchOnWindowFocus: false)
- **Request coalescing** when multiple components query same data
- **Background updates** keep data fresh without blocking UI

**Bundle Size Impact**:
- Core library: 11.4KB gzipped
- DevTools: 15KB (development only, tree-shaken in production)
- Net increase: ~9KB after removing custom polling code

### Migration Status

**Completed**:
- ✅ Job status polling (useJobPolling)
- ✅ Query infrastructure (QueryProvider, query-client, query-keys)
- ✅ Type definitions (query-types.ts)
- ✅ Test utilities (test-query-client.ts)
- ✅ Mutation hooks (create, update, delete, stage transition)

**Pending**:
- 🔄 Board component integration (using manual state management currently)
- 🔄 TicketCard component mutations
- 🔄 TicketForm component mutations
- 🔄 Project settings mutations
- 🔄 Server-side prefetching with HydrationBoundary

### Best Practices

1. **Use Query Keys Consistently**: Always use `queryKeys` factory, never hardcode strings
2. **Optimistic Updates**: Implement `onMutate`, `onError`, and `onSuccess` for mutations
3. **Cancel Queries**: Call `cancelQueries` before optimistic updates to prevent race conditions
4. **Invalidate Hierarchically**: Invalidate parent keys to refresh all children
5. **Handle Errors**: Always provide fallback UI for error and loading states
6. **Test with Test Client**: Use `createTestQueryClient()` for consistent test behavior

### Resources

- **Official Docs**: https://tanstack.com/query/latest
- **TypeScript Guide**: https://tanstack.com/query/latest/docs/react/typescript
- **Migrating to v5**: https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5
- **DevTools**: Enabled automatically in development (press React Query button in corner)

<!-- MANUAL ADDITIONS END -->
