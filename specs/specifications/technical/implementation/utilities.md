# Utilities - Technical Documentation

Shared utility functions, helpers, and UI components used across the application.

## WorkflowTimeline Component

### Purpose

Displays a filterable, chronological timeline of all workflow executions for a ticket with expandable telemetry details. Provides users with visibility into job history, resource consumption, and execution status.

### File Location

`components/ticket/workflow-timeline.tsx`

### Component Interface

```typescript
interface WorkflowTimelineProps {
  jobs: TicketJobWithTelemetry[];
  githubOwner?: string | undefined;
  githubRepo?: string | undefined;
}
```

**Props**:
- `jobs`: Array of job records with full telemetry data (tokens, cost, duration, model, tools)
- `githubOwner`: Optional GitHub repository owner for workflow links
- `githubRepo`: Optional GitHub repository name for workflow links

### Features

**Timeline Display**:
- Jobs sorted chronologically (most recent first)
- Each row shows:
  - Job type icon (FileText, Settings2, Cog, CheckSquare, MessageSquare, Rocket)
  - Status icon with color coding (green=completed, red=failed, amber=cancelled, blue=running/pending)
  - Command name (formatted from job.command)
  - Model badge (e.g., "claude-sonnet-4-5")
  - Relative timestamp (e.g., "2 hours ago")
  - Duration (formatted as "Xm Xs" or "-")
  - Cost (formatted as "$X.XX" or "-")

**Status Icons**:
- COMPLETED: CheckCircle2 (green)
- FAILED: XCircle (red)
- CANCELLED: Ban (amber)
- RUNNING: Loader2 (blue, animated spin)
- PENDING: Clock (gray)

**Job Type Icons**:
- specify: FileText
- plan: Settings2
- implement/quick-impl/clean: Cog
- verify: CheckSquare
- comment-*: MessageSquare
- deploy-preview: Rocket

**Expandable Details** (click to reveal):
- Token breakdown (input, output, cache read, cache creation)
- Artifacts created (spec.md, plan.md, tasks.md, summary.md - only for COMPLETED jobs)
- Tools used (badge list)
- Full timestamps (started and completed)

**Filtering Controls**:
- Job type filter (dropdown): All Types, Specify, Plan, Implement, Verify, Quick Impl, etc.
- Status filter (dropdown): All Status, COMPLETED, FAILED, CANCELLED, RUNNING, PENDING
- Date range filter (dropdown): All time, Last 7 days, Last 30 days
- Results counter: "X of Y jobs"
- Clear all filters button (appears when filters active and no results)

**Empty States**:
- No jobs: "No workflow executions yet"
- No results after filtering: "No jobs match the selected filters"

**GitHub Actions Link**:
- Footer link to repository actions page (when githubOwner and githubRepo provided)
- Format: `https://github.com/{owner}/{repo}/actions`
- Opens in new tab with external link icon

### Implementation Details

**Job Command Formatting**:
```typescript
function formatCommandName(command: string): string {
  const config = JOB_TYPE_CONFIG[command];
  if (config) return config.label;

  return command
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

**Job Artifacts Mapping**:
```typescript
const JOB_ARTIFACTS: Record<string, string[]> = {
  specify: ['spec.md'],
  plan: ['plan.md', 'tasks.md'],
  implement: ['summary.md'],
  'quick-impl': ['summary.md'],
  verify: [],
  'deploy-preview': [],
  clean: ['summary.md'],
};
```

**Filtering Logic**:
- Command filter: Exact match on `job.command`
- Status filter: Exact match on `job.status`
- Date filter: `isAfter(job.startedAt, cutoffDate)` using date-fns
- Filters combine with AND logic (all active filters must match)
- Results sorted by `startedAt` descending after filtering

**Null Safety**:
- Duration/cost display "-" when value is null
- Token fields treat null as 0 for calculations
- Tools used checks `Array.isArray(job.toolsUsed)` before rendering
- Expandable details disabled when no telemetry data available

### Usage Example

```typescript
import { WorkflowTimeline } from '@/components/ticket/workflow-timeline';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

function TicketHistoryTab({ ticketId, projectId, project }: Props) {
  const { data: ticketJobs } = useTicketJobs(projectId, ticketId);

  return (
    <WorkflowTimeline
      jobs={ticketJobs?.jobs || []}
      githubOwner={project.githubOwner}
      githubRepo={project.githubRepo}
    />
  );
}
```

### Real-Time Updates

The component receives job data from TanStack Query hooks that automatically refetch when jobs reach terminal states:

```typescript
// Parent component (ticket detail modal)
const { data: fullJobs } = useTicketJobs(projectId, ticketId);

// Job polling hook automatically invalidates ticketJobs cache when job completes
// WorkflowTimeline re-renders with updated data
```

**Update Flow**:
1. Job polling detects terminal state (COMPLETED/FAILED/CANCELLED)
2. TanStack Query invalidates `ticketJobs` cache
3. `useTicketJobs` refetches from `/api/projects/:projectId/tickets/:ticketId/jobs`
4. WorkflowTimeline re-renders with updated jobs array
5. New job appears in timeline, status updates reflect immediately

### Accessibility

- Keyboard accessible collapsible rows (Enter/Space to expand)
- ARIA labels on status icons (e.g., `aria-label="Completed"`)
- Screen reader compatible filter controls
- Focus indicators on interactive elements

### Performance

- Memoized filtering with `useMemo` to avoid unnecessary recalculations
- Collapsible details lazy-render telemetry breakdown
- Efficient sorting using single pass over jobs array
- No additional API calls (uses existing job polling infrastructure)

### Testing

**Unit Tests** (`tests/unit/components/workflow-timeline.test.tsx`):
- Empty state rendering
- Job sorting (chronological order)
- Command name formatting
- Duration/cost display with null handling
- Filter controls presence
- Expandable details interaction
- Artifacts display (COMPLETED vs FAILED)
- Tools used rendering
- GitHub Actions link generation
- Status icon rendering

**Integration Coverage**:
- Filtering interactions tested via Playwright (Radix UI Select not compatible with happy-dom)
- Full filter workflows including clear all button
- Multi-filter combinations (command + status + date)

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

**Iterate Command** (minor fixes during VERIFY):
- `iterate` → "Verification iteration"

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
getJobDisplayName('iterate')           // → "Verification iteration"

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

**Workflow Timeline** (`components/ticket/workflow-timeline.tsx`):
- Used by `formatCommandName()` to display job types in History tab
- Provides short labels for timeline job entries
- Integrated with filtering dropdown for job type selection

**Frontend Components**:
- Job status displays in ticket detail view
- Timeline rendering in Conversation tab
- History tab workflow execution list
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

Test coverage (21 test cases):
- Normal workflow commands (5 tests)
- Quick-impl workflow command (1 test)
- Deploy preview command (1 test)
- Iterate command (1 test)
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

**Memory Footprint**: Minimal (16 string mappings, ~600 bytes)

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

Fetches constitution markdown content from `.ai-board/memory/constitution.md` in the project repository.

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

getJobEventMessage('iterate', 'start', 'RUNNING')
// → "Verification iteration started"

getJobEventMessage('iterate', 'complete', 'COMPLETED')
// → "Verification iteration completed"

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

## Autocomplete Positioning

### Purpose

Provides viewport-aware positioning for autocomplete dropdowns to prevent overflow and ensure full visibility within modal and window boundaries.

### File Location

`components/comments/mention-input.tsx`

### API Reference

**Function**: `calculateBoundedPosition(coords: { top: number; left: number }, textareaRect: DOMRect): { top: number; left: number }`

Calculates autocomplete dropdown position with viewport boundary detection.

**Parameters**:
- `coords` (object): Relative coordinates from `getCaretCoordinates()`
  - `top` (number): Vertical position relative to textarea
  - `left` (number): Horizontal position relative to textarea
- `textareaRect` (DOMRect): Bounding rectangle of textarea element

**Returns**: Adjusted position object:
- `top` (number): Final vertical position (relative to textarea)
- `left` (number): Final horizontal position (relative to textarea)

**Constants**:
```typescript
const dropdownWidth = 320;     // w-80 (Tailwind class)
const dropdownHeight = 200;    // max-h-[200px]
const lineHeight = 24;         // Standard line height
const buffer = 16;             // Safety margin from edges
```

**Algorithm**:

1. **Convert to absolute viewport coordinates**:
   ```typescript
   const absoluteTop = textareaRect.top + coords.top + lineHeight;
   const absoluteLeft = textareaRect.left + coords.left;
   ```

2. **Initialize with default position**:
   ```typescript
   let top = coords.top + lineHeight;  // Below cursor
   let left = coords.left;              // Aligned with cursor
   ```

3. **Check right edge overflow**:
   ```typescript
   if (absoluteLeft + dropdownWidth > window.innerWidth - buffer) {
     left = Math.max(0, window.innerWidth - textareaRect.left - dropdownWidth - buffer);
   }
   ```
   - Shifts dropdown left when near right edge
   - Ensures minimum 16px margin from viewport edge
   - Prevents horizontal scrolling

4. **Check bottom edge overflow**:
   ```typescript
   if (absoluteTop + dropdownHeight > window.innerHeight - buffer) {
     const topAbove = coords.top - dropdownHeight - 8;
     if (textareaRect.top + topAbove > 0) {
       top = topAbove;  // Flip above cursor
     }
   }
   ```
   - Flips dropdown above cursor when near bottom edge
   - Only flips if there's enough space above (doesn't go above viewport top)
   - Adds 8px gap between dropdown and cursor line

**Examples**:

```typescript
// Cursor in center of modal - default position
const coords = { top: 50, left: 100 };
const rect = textareaRef.current.getBoundingClientRect();
const pos = calculateBoundedPosition(coords, rect);
// → { top: 74, left: 100 } (24px below cursor)

// Cursor near right edge - shift left
const coords = { top: 50, left: 800 };  // Assuming 1024px viewport
const pos = calculateBoundedPosition(coords, rect);
// → { top: 74, left: 688 } (shifted to fit within viewport)

// Cursor near bottom edge - flip above
const coords = { top: 400, left: 100 };  // Assuming 600px modal height
const pos = calculateBoundedPosition(coords, rect);
// → { top: 192, left: 100 } (flipped above cursor)
```

### Integration

**Position Calculation Hook**:
```typescript
useEffect(() => {
  if (isAutocompleteOpen && textareaRef.current && triggerPosition !== null) {
    const coords = getCaretCoordinates(textareaRef.current, triggerPosition);
    const rect = textareaRef.current.getBoundingClientRect();
    const boundedPosition = calculateBoundedPosition(coords, rect);

    setAutocompletePosition(boundedPosition);
  }
}, [isAutocompleteOpen, triggerPosition, getCaretCoordinates, calculateBoundedPosition]);
```

**Applies To**:
- User mentions (@)
- Ticket references (#)
- Command autocomplete (/)

### Design Rationale

**Viewport-Aware Positioning**:
- Prevents dropdowns from being cut off by modal or window edges
- Improves usability in constrained environments (small modals, mobile)
- Consistent behavior across all autocomplete types

**Prioritization**:
1. **Vertical adjustment** (flip above) takes priority
2. **Horizontal adjustment** (shift left) applied second
3. Default position (below and aligned) when space available

**Edge Cases**:
- **Insufficient space both above and below**: Dropdown positions below (user can scroll)
- **Insufficient space left and right**: Dropdown aligns to left edge with buffer
- **Textarea at viewport edge**: Math.max ensures non-negative positions

### Performance

**Execution Time**: <1ms (synchronous DOM calculations)

**Triggering**:
- Runs only when autocomplete opens or cursor moves
- Does not run on every keystroke
- Dependency array ensures minimal re-renders

### Testing

**Component Tests**: `tests/unit/components/mention-input.test.tsx`

Test coverage:
- "should shift dropdown left when near right edge"
- "should flip dropdown above cursor when near bottom edge"
- "should use default position when in center of viewport"

**Test Pattern**:
```typescript
it('should shift dropdown left when near right edge', async () => {
  const user = userEvent.setup();
  renderWithProviders(<MentionInput value="" onChange={vi.fn()} />);

  // Mock window size and textarea position
  Object.defineProperty(window, 'innerWidth', { value: 1024 });

  // Trigger autocomplete near right edge
  await user.type(screen.getByRole('textbox'), '@');

  // Verify dropdown shifted left
  const dropdown = screen.getByTestId('autocomplete-dropdown');
  expect(dropdown.style.left).toBeLessThan(cursorPosition);
});
```

## Branch Operations Utilities

### Purpose

Provides utility functions for Git branch creation and naming following project conventions. Used during full clone ticket duplication to create new feature branches from source branches.

### File Location

`lib/github/branch-operations.ts`

### API Reference

**Function**: `generateBranchName(ticketNumber: number, title: string): string`

Generates branch name following project convention: `{ticketNumber}-{slug}`.

**Parameters**:
- `ticketNumber` (number): Ticket number (e.g., 219)
- `title` (string): Ticket title for slug extraction

**Returns**: Branch name string (e.g., "219-add-full-clone")

**Algorithm**:
1. Convert title to lowercase
2. Remove non-alphanumeric characters (except spaces)
3. Trim whitespace
4. Split into words
5. Take first 3 words
6. Join with hyphens
7. Prepend ticket number

**Examples**:
```typescript
generateBranchName(219, "Add Full Clone Option");
// Returns: "219-add-full-clone"

generateBranchName(123, "Fix: Authentication Bug!");
// Returns: "123-fix-authentication-bug"

generateBranchName(456, "Update README");
// Returns: "456-update-readme"

generateBranchName(789, "Implement User Profile Settings and Preferences");
// Returns: "789-implement-user-profile" (3-word limit)
```

**Function**: `createBranchFromSource(octokit: Octokit, owner: string, repo: string, sourceBranch: string, newBranchName: string): Promise<{ commitSha: string; ref: string }>`

Creates new Git branch from existing source branch via GitHub API.

**Parameters**:
- `octokit` (Octokit): Authenticated Octokit instance
- `owner` (string): Repository owner (e.g., "bfernandez31")
- `repo` (string): Repository name (e.g., "ai-board")
- `sourceBranch` (string): Source branch name to copy from
- `newBranchName` (string): New branch name to create

**Returns**: Promise resolving to object with:
- `commitSha` (string): Commit SHA that new branch points to
- `ref` (string): Full Git ref (e.g., "refs/heads/219-add-full-clone")

**Algorithm**:
1. Fetch source branch via `octokit.rest.repos.getBranch()`
2. Extract commit SHA from source branch
3. Create new ref via `octokit.rest.git.createRef()`
4. New branch points to same commit as source
5. Return commit SHA and ref

**Error Handling**:
- **404 (Not Found)**: Source branch doesn't exist on GitHub
  - Throws: `Source branch '{sourceBranch}' not found on GitHub`
- **422 (Unprocessable Entity)**:
  - Reference already exists: `Branch '{newBranchName}' already exists`
  - Other 422 errors: `Invalid branch name or operation: {message}`
- **403 (Forbidden)**: GitHub token lacks repo permissions
  - Throws: `GitHub API permission denied. Check token scope includes 'repo' access.`
- **429 (Rate Limit)**: GitHub API rate limit exceeded
  - Throws: `GitHub API rate limit exceeded. Please try again later.`
- **Other errors**: Re-thrown with original message

**GitHub API Integration**:
```typescript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Step 1: Get source branch commit SHA
const { data: sourceBranchData } = await octokit.rest.repos.getBranch({
  owner,
  repo,
  branch: sourceBranch,
});
const sourceSha = sourceBranchData.commit.sha;

// Step 2: Create new branch pointing to same commit
const { data: newRef } = await octokit.rest.git.createRef({
  owner,
  repo,
  ref: `refs/heads/${newBranchName}`,
  sha: sourceSha,
});
```

### Integration Points

**Full Clone Duplication** (`app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts`):
- Called when `mode: "full"` in duplicate request
- Generates new branch name using next ticket number
- Creates Git branch before database transaction
- Returns 400/500 errors on branch creation failure

**Workflow Context**:
- Enables A/B testing of alternative implementations
- Preserves complete Git history from source branch
- Allows independent development on cloned branch
- Spec files copied automatically via Git reference

### Performance

**Branch Name Generation**: <1ms (synchronous string operations)

**Branch Creation**: <2 seconds (GitHub API round-trip):
1. Fetch source branch: ~800ms
2. Create new ref: ~800ms
3. Total: ~1.6s average

**Error Cases**: <1 second for validation failures (404, 422)

### Testing

**Unit Tests**: `tests/unit/branch-slug.test.ts`

Test coverage:
- Branch name generation with various titles
- Special character handling
- 3-word limit enforcement
- Empty title edge cases

**Integration Tests**: `tests/integration/tickets/duplicate.test.ts`

Test coverage:
- Full clone creates new branch
- Branch points to same commit as source
- Branch creation errors handled correctly
- Missing branch validation

### Security Considerations

**GitHub Token Permissions**:
- Requires `repo` scope for branch creation
- Token validated at API boundary
- Errors logged without exposing token

**Branch Naming**:
- Alphanumeric characters only (prevents injection)
- Hyphen separator (safe for Git refs)
- Lowercase for consistency

**Error Messages**:
- User-friendly without exposing internals
- Logged errors include full context for debugging
- GitHub API responses sanitized before returning to client

### Design Rationale

**3-Word Slug Limit**:
- Balances readability with branch name length
- Prevents excessively long branch names
- Consistent with existing project conventions

**Lowercase Convention**:
- Avoids case-sensitivity issues across filesystems
- Follows common Git branch naming patterns
- Easier to type and remember

**Same Commit SHA**:
- Preserves exact Git history from source
- Enables direct comparison via Git tools
- No merge conflicts when comparing implementations

**Synchronous Branch Creation**:
- Validates branch creation before database commit
- Atomic operation (both succeed or both fail)
- Clear error messages for users

## Push Notification Utilities

### Purpose

Provides server-side functions for sending browser push notifications to users for job completions and @mention events.

### File Location

`app/lib/push/send-notification.ts`

### API Reference

**Function**: `sendJobCompletionNotification(jobId: number, status: 'COMPLETED' | 'FAILED' | 'CANCELLED'): Promise<void>`

Sends push notifications to project owners when jobs reach terminal states.

**Parameters**:
- `jobId` (number): Database ID of completed job
- `status` (JobStatus): Terminal job status (COMPLETED, FAILED, or CANCELLED)

**Behavior**:
1. Fetches job with related ticket and project data
2. Retrieves all push subscriptions for project owner
3. Sends notification to each active subscription
4. Cleans up invalid/expired subscriptions (404/410 responses)
5. Logs delivery success rate

**Notification Payload**:
```typescript
{
  title: `Job ${status}: ${ticketKey}`,
  body: `${command} ${status} for "${ticketTitle}"`,
  icon: '/icon-success.png' | '/icon-error.png' | '/icon-warning.png',
  url: `/projects/${projectId}/board?ticket=${ticketKey}&modal=open`,
  type: 'job_completion',
  ticketKey: string
}
```

**URL Format**: The notification URL includes `modal=open` query parameter to automatically open the ticket modal when the push notification is clicked. This ensures users land directly on the ticket conversation rather than just the board view.

**Icon Selection**:
- COMPLETED → `/icon-success.png` (green checkmark)
- FAILED → `/icon-error.png` (red X)
- CANCELLED → `/icon-warning.png` (yellow warning)

**Error Handling**:
- Returns early if VAPID not configured (development mode)
- Logs warning if job/ticket not found
- Gracefully handles subscription cleanup failures
- Continues sending to remaining subscriptions if one fails

**Function**: `sendMentionNotification(recipientId: string, actorName: string, ticketKey: string, projectId: number): Promise<void>`

Sends push notifications when users are mentioned in comments.

**Parameters**:
- `recipientId` (string): User ID of mentioned user
- `actorName` (string): Display name of user who created mention
- `ticketKey` (string): Ticket key where mention occurred (e.g., "ABC-123")
- `projectId` (number): Project ID for navigation

**Notification Payload**:
```typescript
{
  title: `Mentioned in ${ticketKey}`,
  body: `${actorName} mentioned you in a comment`,
  icon: '/icon-mention.png',
  url: `/projects/${projectId}/board?ticket=${ticketKey}&modal=open`,
  type: 'mention',
  ticketKey: string
}
```

**URL Format**: The notification URL includes `modal=open` query parameter to automatically open the ticket modal when the push notification is clicked, landing users directly in the conversation context.

**Recipient Filtering**:
- Only sends to users with active push subscriptions
- Self-mentions do not trigger notifications (handled at comment level)
- Non-project members do not receive notifications (handled at comment level)

**Examples**:

```typescript
// Job completion notification
await sendJobCompletionNotification(42, 'COMPLETED');
// Sends: "Job completed: ABC-123" → "specify completed for 'Add login feature'"
// URL: /projects/1/board?ticket=ABC-123&modal=open

// Mention notification
await sendMentionNotification('user-123', 'Alice Smith', 'ABC-456', 1);
// Sends: "Mentioned in ABC-456" → "Alice Smith mentioned you in a comment"
// URL: /projects/1/board?ticket=ABC-456&modal=open
```

### Integration Points

**Job Status Updates** (`app/api/jobs/[id]/status/route.ts`):
- Called when job status transitions to COMPLETED, FAILED, or CANCELLED
- Runs asynchronously (does not block API response)
- Only project owners receive notifications

**Comment Creation** (`app/api/projects/[projectId]/tickets/[ticketId]/comments/route.ts`):
- Called after notification records created for mentions
- Sends to each mentioned user individually
- Skips users without push subscriptions

**Service Worker Navigation** (`public/sw.js`):
- Receives notification click events
- Extracts URL from payload
- Opens or focuses browser window
- Navigates to `/projects/{projectId}/board?ticket={ticketKey}&modal=open`
- Modal automatically opens due to URL query parameters

### Configuration

**Environment Variables**:
- `VAPID_PUBLIC_KEY`: Web Push VAPID public key
- `VAPID_PRIVATE_KEY`: Web Push VAPID private key
- `VAPID_SUBJECT`: Contact email (mailto: format)

**VAPID Setup** (`app/lib/push/web-push-config.ts`):
```typescript
import webpush from 'web-push';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@ai-board.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export const isPushConfigured = !!(
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
);
```

### Error Recovery

**Expired Subscriptions**:
- HTTP 404/410 responses trigger automatic cleanup
- Subscription removed from database
- Does not throw error or block other notifications

**Rate Limiting**:
- HTTP 429 responses logged and skipped
- Will retry on next event (no queue)
- Does not impact other subscriptions

**Invalid Subscriptions**:
- Malformed endpoints fail silently
- Subscription cleaned up automatically
- Error logged for debugging

### Performance

**Concurrent Delivery**: Uses `Promise.allSettled()` to send to all subscriptions in parallel

**Subscription Limits**: Expected <5 subscriptions per user (multiple browsers/devices)

**Delivery Time**: <5 seconds from trigger event to browser notification display

**Database Queries**:
- Job completion: 1 query (job with includes) + 1 query (subscriptions)
- Mention: 1 query (subscriptions)
- Cleanup: 1 delete per failed subscription (async, non-blocking)

### Testing

**Integration Tests**: `tests/integration/push-notifications.test.ts`

Test coverage:
- Job completion notification sending
- Mention notification sending
- Subscription cleanup on 404/410 errors
- Graceful degradation when VAPID not configured
- Multiple subscriptions per user

**Test Pattern**:
```typescript
import { sendJobCompletionNotification } from '@/app/lib/push/send-notification';
import { prisma } from '@/lib/db/client';

it('should send job completion notification to project owner', async () => {
  // Create test subscription
  await prisma.pushSubscription.create({
    data: { userId: ownerId, endpoint: 'https://...', p256dh: '...', auth: '...' }
  });

  // Send notification
  await sendJobCompletionNotification(jobId, 'COMPLETED');

  // Verify notification sent (check logs or mock webpush)
});
```

### Security Considerations

**VAPID Keys**:
- Private key never exposed to client
- Public key safe to expose in HTML/JavaScript
- Keys generated via `web-push generate-vapid-keys` command

**Subscription Validation**:
- Endpoints validated by browser Push API
- Invalid subscriptions rejected at registration
- Expired subscriptions cleaned up automatically

**Authorization**:
- Only project owners receive job completion notifications
- Mention notifications respect project membership
- No cross-project notification leakage

### Design Rationale

**Automatic Modal Opening**:
- Push notification URLs include `modal=open` parameter
- Users land directly in conversation context
- Reduces navigation friction from external notification
- Consistent with in-app notification click behavior

**Project Owner Only**:
- Reduces notification fatigue for members
- Owners responsible for project oversight
- Members can opt into in-app notifications via bell icon

**Icon Differentiation**:
- Visual status indication in notification tray
- Helps users prioritize attention (failures vs completions)
- Consistent with in-app UI patterns

**Graceful Degradation**:
- System works without push notifications (in-app polling fallback)
- Development mode doesn't require VAPID setup
- Unsupported browsers hide opt-in prompt
