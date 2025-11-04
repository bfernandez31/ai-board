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

## Deploy Preview Icon State

### Purpose

Provides unified icon state resolution logic for the deploy preview feature, consolidating preview access, deployment triggering, and deployment status into a single stateful icon.

### File Location

`/specs/084-1499-fix-deploy/contracts/component-interface.ts`

### State Resolution

**Function**: `getDeployIconState(ticket: TicketWithVersion, deployJob: Job | null | undefined, isDeployable: boolean): DeployIconState`

Resolves the unified deploy icon state using priority-based logic.

**Parameters**:
- `ticket` (TicketWithVersion): Ticket record with preview URL and jobs
- `deployJob` (Job | null | undefined): Deploy job record (command: "deploy-preview")
- `isDeployable` (boolean): Result from `isTicketDeployable()` eligibility check

**Returns**: One of four possible states: `'preview' | 'deploying' | 'deployable' | 'hidden'`

**State Priority Logic** (evaluated in order):

```typescript
// 1. Preview State (Highest Priority)
if (ticket.previewUrl) {
  return 'preview';
}

// 2. Deploying State
if (deployJob?.status === 'PENDING' || deployJob?.status === 'RUNNING') {
  return 'deploying';
}

// 3. Deployable State
if (isDeployable || deployJob?.status === 'FAILED' || deployJob?.status === 'CANCELLED') {
  return 'deployable';
}

// 4. Hidden State (Default)
return 'hidden';
```

### Icon Configuration

**Constant**: `DEPLOY_ICON_CONFIG_MAP`

Maps each state to visual properties (icon type, color, animation, interaction behavior).

**Configuration Table**:

| State | Icon | Color | Clickable | Animated | Tooltip | Click Action |
|-------|------|-------|-----------|----------|---------|--------------|
| `preview` | ExternalLink | Green (text-green-400) | ✅ Yes | ❌ No | "Open preview deployment" | Opens `ticket.previewUrl` in new tab |
| `deploying` | Rocket | Blue (text-blue-400) | ❌ No (disabled) | ✅ Yes (bounce) | "Deployment in progress..." | None |
| `deployable` | Rocket | Neutral (text-[#a6adc8]) | ✅ Yes | ❌ No | "Deploy preview" / "Retry deployment" | Opens deploy confirmation modal |
| `hidden` | None | N/A | N/A | N/A | N/A | N/A |

### Usage Pattern

**Component Integration** (`components/board/ticket-card.tsx`):

```typescript
import { getDeployIconState } from '@/specs/084-1499-fix-deploy/contracts/component-interface';

// Compute state (memoized)
const deployIconState = React.useMemo(() => {
  return getDeployIconState(ticket, deployJob, isDeployable);
}, [ticket, deployJob, isDeployable]);

// Conditional rendering based on state
{deployIconState === 'preview' && (
  <Button onClick={() => window.open(ticket.previewUrl!, '_blank')}>
    <ExternalLink className="h-4 w-4 text-green-400" />
  </Button>
)}

{deployIconState === 'deploying' && (
  <Button disabled>
    <Rocket className="h-4 w-4 text-blue-400 animate-bounce" />
  </Button>
)}

{deployIconState === 'deployable' && (
  <Button onClick={() => setShowDeployModal(true)}>
    <Rocket className="h-4 w-4 text-[#a6adc8]" />
  </Button>
)}
```

### Design Rationale

**Single Icon Pattern**:
- Eliminates UI clutter from multiple deploy-related icons
- Provides clear visual feedback at each stage of deployment lifecycle
- Reduces cognitive load for users (one icon location to monitor)

**Priority-Based Resolution**:
- Ensures unambiguous state display when multiple conditions are true
- Preview state always takes precedence (primary user need is accessing active deployment)
- Deploying state overrides deployable (real-time feedback during operations)
- Failed/cancelled jobs fall back to deployable state (enables retry)

**State Immutability**:
- Icon state is derived (computed from ticket/job data)
- No internal state management required
- React.useMemo() optimizes recomputation

### Performance

**State Computation**: O(1) - Simple conditional checks (4-5 comparisons maximum)

**Memoization**: React.useMemo() prevents unnecessary recalculations

**Target Response**: <1ms for state resolution

**Memory**: Minimal (no persistent state, computed on-demand)

### Testing

**Unit Tests**: `tests/unit/unified-deploy-icon.test.ts`

Test coverage (state resolution logic):
- Preview state takes precedence over all others
- Deploying state for PENDING/RUNNING jobs
- Deployable state for eligible tickets and failed/cancelled jobs
- Hidden state as default fallback
- State priority enforcement (15 test scenarios)

**Integration Tests**: `tests/integration/board/unified-deploy-icon.spec.ts`

Test coverage (component rendering and interaction):
- Icon rendering for each state
- Click handlers (preview URL open, deploy modal trigger)
- Disabled state during deployment
- Tooltip text accuracy
- State transitions via job polling

### Related Utilities

**Deploy Eligibility Checker**: `isTicketDeployable()` (see section above)
- Used as input parameter to `getDeployIconState()`
- Validates deployment preconditions (stage, branch, job status)

**Job Filtering**: `getDeployJob()` (`lib/utils/job-filtering.ts`)
- Extracts deploy job from ticket's job array
- Filters by command: "deploy-preview"
