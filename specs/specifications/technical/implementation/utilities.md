# Utilities - Technical Documentation

Shared utility functions and helpers used across the application.

## Job Display Names

### Purpose

Maps internal job command strings to user-friendly display names for timeline rendering and UI presentation. Centralizes command naming to ensure consistent messaging across the application.

### File Location

`app/lib/utils/job-display-names.ts`

### Job Command Mapping

Complete mapping table for all job command types:

**Normal Workflow Commands** (FULL workflowType):
- `specify` → "Specification generation"
- `plan` → "Planning"
- `implement` → "Implementation"
- `verify` → "Verification"
- `ship` → "Deployment"

**Quick-Impl Workflow Command** (QUICK workflowType):
- `quick-impl` → "Quick implementation"

**Deploy Preview Command**:
- `deploy-preview` → "Preview deployment"

**AI-BOARD Assistance Commands** (comment-* pattern):
- `comment-specify` → "Specification assistance"
- `comment-plan` → "Planning assistance"
- `comment-build` → "Implementation assistance"
- `comment-verify` → "Verification assistance"
- `comment-ship` → "Deployment assistance"

**Legacy Commands**:
- `clarify` → "Clarification (legacy)"
- `tasks` → "Task generation (legacy)"

### API Reference

**Function**: `getJobDisplayName(command: string): string`

Resolves job command to user-friendly display name with intelligent fallback patterns.

**Parameters**:
- `command` (string): Job command from `Job.command` field

**Returns**: User-friendly display name (string)

**Algorithm**:
1. Handle empty/whitespace commands → "Unknown job type"
2. Direct lookup in mapping table → Return mapped name
3. Pattern-based fallback for `comment-*` commands → "{Stage} assistance"
4. Unknown commands → "Unknown command ({command})"

**Examples**:

```typescript
import { getJobDisplayName } from '@/app/lib/utils/job-display-names';

// Direct mappings
getJobDisplayName('specify')           // → "Specification generation"
getJobDisplayName('verify')            // → "Verification"
getJobDisplayName('ship')              // → "Deployment"
getJobDisplayName('quick-impl')        // → "Quick implementation"
getJobDisplayName('deploy-preview')    // → "Preview deployment"

// AI-BOARD assistance commands
getJobDisplayName('comment-plan')      // → "Planning assistance"
getJobDisplayName('comment-verify')    // → "Verification assistance"
getJobDisplayName('comment-ship')      // → "Deployment assistance"

// Fallback patterns
getJobDisplayName('comment-test')      // → "Test assistance" (auto-generated)
getJobDisplayName('unknown-cmd')       // → "Unknown command (unknown-cmd)"
getJobDisplayName('')                  // → "Unknown job type"
```

### Usage Locations

**Conversation Timeline** (`app/lib/utils/conversation-events.ts`):
- Used by `getJobEventMessage()` to generate timeline event messages
- Combines display name with event type (started/completed/failed)
- Adds quick indicator (⚡) for quick-impl commands

**Frontend Components**:
- Job status displays in ticket detail view
- Timeline rendering in Comments tab
- Job event notifications

### Design Considerations

**Centralized Mapping**:
- Single source of truth for command naming
- Easy to add new commands without code changes
- Consistent naming across UI and API

**Fallback Patterns**:
- Graceful degradation for unmapped commands
- Pattern-based generation for comment-* commands
- Clear error messages for debugging

**Type Safety**:
- TypeScript const assertion (`as const`) for mapping table
- Compile-time validation of command strings
- IDE autocomplete for known commands

### Testing

**Unit Tests**: `tests/unit/job-display-names.test.ts`

Test coverage (20 test cases):
- Normal workflow commands (5 tests)
- Quick-impl workflow command (1 test)
- Deploy preview command (1 test)
- AI-BOARD assistance commands (5 tests)
- Fallback patterns (6 tests)
- Legacy commands (2 tests)

**Test Categories**:
1. Direct mapping lookups
2. Pattern-based fallbacks
3. Edge cases (empty string, whitespace)
4. Unknown command handling
5. Capitalization in fallback patterns

### Performance

**Lookup Complexity**: O(1) for direct mappings (hash table lookup)

**Memory Footprint**: Minimal (15 string mappings, ~550 bytes)

**Execution Time**: <1ms per call (synchronous, no I/O)

### Extension Pattern

**Adding New Commands**:

1. Add mapping to `JOB_COMMAND_DISPLAY_NAMES` table:
```typescript
export const JOB_COMMAND_DISPLAY_NAMES: Record<string, string> = {
  // ... existing mappings
  'new-command': 'New Command Display Name',
};
```

2. Add test cases in `tests/unit/job-display-names.test.ts`:
```typescript
it('should return "New Command Display Name" for new-command', () => {
  expect(getJobDisplayName('new-command')).toBe('New Command Display Name');
});
```

3. Update documentation (this file)

**Pattern-Based Commands**:
- New `comment-*` commands automatically supported by fallback pattern
- No code changes required for new assistance commands
- Test fallback pattern with example command

## Constitution Fetcher

### Purpose

Provides utility functions for fetching and managing constitution files from GitHub repositories with test environment support.

### File Location

`lib/github/constitution-fetcher.ts`

### API Reference

**Function**: `fetchConstitutionContent(githubOwner: string, githubRepo: string): Promise<{ content: string; exists: boolean }>`

Fetches constitution markdown content from `.specify/memory/constitution.md` in the project repository.

**Parameters**:
- `githubOwner` (string): GitHub repository owner (org or user)
- `githubRepo` (string): GitHub repository name

**Returns**: Promise resolving to object with:
- `content` (string): Raw markdown content
- `exists` (boolean): Whether file exists in repository

**Test Environment**:
- Returns mock constitution content when `NODE_ENV !== 'production'`
- Consistent test data for E2E testing

**Errors**:
- Throws if GitHub API request fails
- Returns `exists: false` if file not found (404)

**Function**: `updateConstitutionContent(githubOwner: string, githubRepo: string, content: string): Promise<void>`

Updates constitution file content via GitHub API commit.

**Parameters**:
- `githubOwner` (string): GitHub repository owner
- `githubRepo` (string): GitHub repository name
- `content` (string): New markdown content

**Behavior**:
- Creates commit with message "Update constitution"
- Uses authenticated GitHub API (PAT token)
- Test mode: returns success without persisting changes

**Function**: `fetchConstitutionHistory(githubOwner: string, githubRepo: string): Promise<ConstitutionCommit[]>`

Fetches commit history for constitution file.

**Returns**: Array of commits with:
- `sha` (string): Commit SHA hash
- `message` (string): Commit message
- `author` (string): Author name
- `date` (string): ISO 8601 timestamp
- `url` (string): GitHub commit URL

**Function**: `fetchConstitutionDiff(githubOwner: string, githubRepo: string, sha: string): Promise<ConstitutionDiff>`

Fetches diff for specific commit.

**Parameters**:
- `sha` (string): Commit SHA to fetch diff for

**Returns**: Object with:
- `additions` (string[]): Added lines
- `deletions` (string[]): Removed lines
- `unchanged` (string[]): Unchanged lines

### Implementation Details

**GitHub API Integration**:
- Uses Octokit for repository operations
- Authenticates with `GITHUB_TOKEN` or `GH_PAT`
- Handles rate limiting and network errors
- Caches responses at TanStack Query level

**Test Mode Detection**:
```typescript
const isTestMode = process.env.NODE_ENV !== 'production';
if (isTestMode) {
  return mockConstitutionData;
}
```

## Conversation Events

### Purpose

Transforms and merges Comment and Job records into a unified conversation timeline for ticket discussion views.

### File Location

`app/lib/utils/conversation-events.ts`

### Data Transformation

**Comment Transformation** (`createCommentEvent`):
```typescript
export function createCommentEvent(comment: CommentWithUser): CommentEvent {
  return {
    type: 'comment',
    timestamp: comment.createdAt,
    data: comment,
  };
}
```

**Job Transformation** (`createJobEvents`):
```typescript
export function createJobEvents(job: Job): JobEvent[] {
  const events: JobEvent[] = [];

  // Start event (always present)
  events.push({
    type: 'job',
    timestamp: job.startedAt.toISOString(),
    data: job,
    eventType: 'start',
  });

  // Completion event (only if finished)
  if (job.completedAt) {
    events.push({
      type: 'job',
      timestamp: job.completedAt.toISOString(),
      data: job,
      eventType: 'complete',
    });
  }

  return events;
}
```

### Timeline Merging

**Function**: `mergeConversationEvents(comments: CommentWithUser[], jobs: Job[]): ConversationEvent[]`

**Algorithm**:
1. Transform comments to CommentEvent objects
2. Transform jobs to JobEvent arrays (1-2 events per job)
3. Flatten job events into single array
4. Merge comment and job events
5. Sort by timestamp (reverse chronological, newest first)

**Performance**:
- Time complexity: O(n log n) for sorting
- Memory complexity: O(n) for merged array
- Optimized for <100 items per timeline

### Job Event Messages

**Function**: `getJobEventMessage(command: string, eventType: 'start' | 'complete', status: JobStatus): string`

**Message Generation Rules**:

**Start Events** (`eventType: 'start'`):
- Pattern: "{Display Name}{Quick Indicator} started"
- Example: "Specification generation started"
- Quick indicator (⚡) only for `quick-impl` command

**Completion Events** (`eventType: 'complete'`):
- Status: COMPLETED → "{Display Name}{Quick Indicator} completed"
- Status: FAILED → "{Display Name}{Quick Indicator} failed"
- Status: CANCELLED → "{Display Name}{Quick Indicator} cancelled"
- Default: "{Display Name}{Quick Indicator} updated"

**Examples**:
```typescript
getJobEventMessage('specify', 'start', 'RUNNING')
// → "Specification generation started"

getJobEventMessage('verify', 'complete', 'COMPLETED')
// → "Verification completed"

getJobEventMessage('quick-impl', 'complete', 'COMPLETED')
// → "Quick implementation ⚡ completed"

getJobEventMessage('comment-plan', 'start', 'RUNNING')
// → "Planning assistance started"

getJobEventMessage('deploy-preview', 'complete', 'COMPLETED')
// → "Preview deployment completed"

getJobEventMessage('ship', 'complete', 'FAILED')
// → "Deployment failed"
```

### Type Definitions

**ConversationEvent Union Type**:
```typescript
type ConversationEvent = CommentEvent | JobEvent;
```

**CommentEvent**:
```typescript
interface CommentEvent {
  type: 'comment';
  timestamp: string | Date;
  data: CommentWithUser;
}
```

**JobEvent**:
```typescript
interface JobEvent {
  type: 'job';
  timestamp: string;
  data: Job;
  eventType: 'start' | 'complete';
}
```

### Usage Context

**Timeline Rendering**:
- Comments tab in ticket detail modal
- Unified view of discussion and automation events
- Chronological ordering for natural conversation flow

**Frontend Components**:
- `components/board/ticket-modal.tsx` (or similar)
- Job status indicators with color coding
- Comment display with user avatars

**API Integration**:
- Comments API returns `CommentWithUser[]`
- Jobs API returns `Job[]`
- Frontend merges via `mergeConversationEvents()`

### Design Rationale

**Two Events Per Job**:
- Start event: When job begins (RUNNING status)
- Completion event: When job finishes (COMPLETED/FAILED/CANCELLED)
- Provides clear status updates in timeline
- Allows users to track job progress

**Reverse Chronological Sort**:
- Newest events at top (Reddit/Twitter pattern)
- Matches user expectation for conversation views
- Easier to see latest updates without scrolling

**Unified Event Type**:
- Single array for both comments and jobs
- Simplifies rendering logic
- Type discrimination via `type` field

### Performance Optimization

**Timeline Size Limits**:
- Expected: <50 events per ticket (typical case)
- Maximum: <100 events per ticket (design target)
- O(n log n) sort acceptable for this range

**Memory Management**:
- Spread operator (`[...array]`) optimal for small arrays
- No pagination needed for timeline (all events fit in memory)
- Client-side caching via TanStack Query

## Authorization Helpers

### Purpose

Reusable authorization validation functions for project and ticket access control.

### File Location

`app/lib/db/auth-helpers.ts`

### Helper Functions

**verifyProjectAccess(projectId: number)**:
- Validates owner OR member access
- Use for board, tickets, comments
- Returns project record or throws 403

**verifyTicketAccess(ticketId: number)**:
- Validates owner OR member access via parent project
- Use for ticket operations
- Returns ticket record or throws 403

**verifyProjectOwnership(projectId: number)**:
- Validates owner-only access
- Use for member management, project settings
- Returns project record or throws 403

**Note**: The deprecated `verifyTicketOwnership` function has been removed. Use `verifyTicketAccess` for ticket access validation, which validates both owner and member access via the parent project.

### Usage Pattern

```typescript
// Example: Ticket access validation
const ticket = await verifyTicketAccess(ticketId);

// Validate ticket belongs to correct project
if (ticket.projectId !== projectId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Proceed with authorized operation
```

See [authentication.md](authentication.md#authorization-patterns) for detailed authorization patterns.

## Date Utilities

### Purpose

Date formatting and manipulation using `date-fns` library.

### Library

`date-fns` (latest) - Modern date utility library

### Common Operations

**Relative Time Formatting**:
- "2 hours ago", "3 days ago"
- Used in comment timestamps
- Real-time updates via polling

**Date Parsing**:
- ISO 8601 string parsing
- Timezone handling
- UTC conversion

See [architecture/stack.md](../architecture/stack.md#date-utilities) for date-fns integration details.
