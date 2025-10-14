# ai-board Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-12

## Active Technologies

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
- **Real-time Updates**: Client-side polling

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

- Authentication: Added NextAuth.js authentication with user-project ownership
- 027-display-project-specifications: Added GitHub spec viewer with markdown rendering
- 025-header-ajoute-un: Added project header with toast notifications
- 024-16204-description-validation: Enhanced ticket validation rules

<!-- MANUAL ADDITIONS START -->

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

The Project model now includes user ownership:

- **`userId`** (String): Owner of the project (required foreign key to User.id)
  - Every project must belong to a user
  - Index on userId for efficient filtering
  - Used for authorization checks

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

<!-- MANUAL ADDITIONS END -->
