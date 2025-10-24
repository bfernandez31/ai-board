# Component Interface Contracts: Simplified Job Status Display

**Feature**: `047-design-job-status`
**Date**: 2025-10-24
**Phase**: 1 - Design & Contracts

## Component Overview

This feature modifies two existing React components to simplify job status display:

1. **JobStatusIndicator**: Modified to remove stage prefix for workflow jobs and add compact icon-only mode for AI-BOARD jobs
2. **TicketCard**: Modified to change dual-line job layout to single-line horizontal layout

---

## Component 1: JobStatusIndicator (Modified)

### Component Signature

```typescript
export function JobStatusIndicator({
  status,
  command,
  jobType,
  stage,      // Still accepted but not rendered for WORKFLOW jobs
  className,
  animated = true,
  ariaLabel,
}: JobStatusIndicatorProps): JSX.Element
```

### Props Interface (Unchanged)

```typescript
export interface JobStatusIndicatorProps {
  /**
   * Current job status to display
   */
  status: JobStatus;

  /**
   * Job command for context (e.g., "specify", "plan", "build")
   */
  command: string;

  /**
   * Optional: Job type for visual distinction
   * Determines rendering mode (workflow vs AI-BOARD)
   */
  jobType?: JobType;

  /**
   * Optional: Current ticket stage for context
   * NOT RENDERED for WORKFLOW jobs (removed from display)
   */
  stage?: string;

  /**
   * Optional CSS class name for styling
   */
  className?: string;

  /**
   * Whether to show animation (for RUNNING status)
   * @default true
   */
  animated?: boolean;

  /**
   * Accessibility label for screen readers
   */
  ariaLabel?: string;
}
```

### Rendering Modes

#### Mode 1: Workflow Job (Simplified)

**Trigger**: `jobType === JobType.WORKFLOW`

**Visual Output**:
```
[Status Icon] [Status Label]
```

**Example**: `✅ COMPLETED` (no "🔧 BUILD :" prefix)

**Implementation Changes**:
- Skip rendering prefix section (Icon + Stage text + colon)
- Render only status icon + contextual label
- Maintain animation for RUNNING status (pen icon with quill-writing animation)

#### Mode 2: AI-BOARD Job (Compact Icon-Only)

**Trigger**: `jobType === JobType.AI_BOARD`

**Visual Output**:
```
[🤖 Bot Icon with Tooltip]
```

**Example**: Bot icon in purple with tooltip "AI-BOARD is working on this ticket"

**Implementation Changes**:
- Render ONLY bot-message-square icon (no text label)
- Apply color based on status:
  - PENDING/RUNNING/COMPLETED: `text-purple-500` (#a855f7)
  - FAILED: `text-red-500` (#ef4444)
  - CANCELLED: `text-gray-500` (#6b7280)
- Wrap icon in Tooltip component with status-specific content
- No animation for AI-BOARD jobs (static icon)

### Tooltip Content Specification

| Status    | Tooltip Text                                        |
|-----------|-----------------------------------------------------|
| PENDING   | "AI-BOARD is preparing..."                          |
| RUNNING   | "AI-BOARD is working on this ticket"                |
| COMPLETED | "AI-BOARD assisted on [formatted timestamp]"        |
| FAILED    | "AI-BOARD assistance failed"                        |
| CANCELLED | "AI-BOARD assistance cancelled"                     |

**Timestamp Formatting**: Use `formatTimestamp(job.completedAt)` utility
- Recent (< 1 hour): "2 minutes ago"
- Same day: "3:42 PM"
- Past days: "Oct 23, 3:42 PM"

### Accessibility Requirements

**ARIA Labels**:
- Workflow jobs: `"Job [command] is [contextual label]"` (e.g., "Job specify is writing")
- AI-BOARD jobs: `"AI-BOARD [status description]"` (e.g., "AI-BOARD is working on this ticket")

**Keyboard Navigation** (AI-BOARD tooltips only):
- Tab to focus on icon
- Enter/Space to show tooltip
- Escape to dismiss tooltip
- Auto-dismiss on focus loss

**Screen Reader Behavior**:
- Tooltip content announced on focus
- Status changes announced via live region (existing behavior preserved)

### CSS Classes

**Workflow Job Layout** (unchanged):
```typescript
<div className="flex items-center gap-1.5">
  <StatusIcon />
  <span className="text-sm font-medium [status-color]">{label}</span>
</div>
```

**AI-BOARD Job Layout** (new):
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <BotMessageSquare className="h-4 w-4 [status-color] cursor-help" />
  </TooltipTrigger>
  <TooltipContent>
    <p className="text-xs">{tooltipText}</p>
  </TooltipContent>
</Tooltip>
```

---

## Component 2: TicketCard (Modified)

### Component Signature (Unchanged)

```typescript
export const TicketCard = React.memo(
  ({ ticket, workflowJob, aiBoardJob, isDraggable = true, onTicketClick }: DraggableTicketCardProps): JSX.Element
```

### Props Interface (Unchanged)

```typescript
interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  workflowJob?: Job | null;   // Workflow job display
  aiBoardJob?: Job | null;    // AI-BOARD job display
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
}
```

### Layout Changes

**Before** (Dual-line vertical stack):
```tsx
<div className="border-t border-[#313244] pt-3 space-y-2">
  {workflowJob && <JobStatusIndicator {...} />}
  {aiBoardJob && <JobStatusIndicator {...} />}
</div>
```

**After** (Single-line horizontal layout):
```tsx
<div className="border-t border-[#313244] pt-3">
  <div className="flex items-center justify-between gap-3">
    {/* Left: Workflow job status */}
    {workflowJob && (
      <JobStatusIndicator
        status={workflowJob.status}
        command={workflowJob.command}
        jobType={classifyJobType(workflowJob.command)}
        stage={ticket.stage}
        animated={true}
      />
    )}

    {/* Right: AI-BOARD job status (compact icon) */}
    {aiBoardJob && (
      <JobStatusIndicator
        status={aiBoardJob.status}
        command={aiBoardJob.command}
        jobType={classifyJobType(aiBoardJob.command)}
        stage={ticket.stage}
        animated={true}
      />
    )}
  </div>
</div>
```

### Visual Layout Specification

**Flexbox Configuration**:
- Parent: `flex items-center justify-between gap-3`
- Workflow job: Natural left alignment (flex-start)
- AI-BOARD job: Right alignment (flex-end via justify-between)
- Gap: 3 units (0.75rem) minimum spacing between indicators

**Responsive Behavior**:
- If only workflow job: Takes full width naturally
- If only AI-BOARD job: Positioned at far right (justify-between with single child)
- If both jobs: Workflow left, AI-BOARD right with space between

**Edge Case Handling**:
- Long workflow status text: No wrapping, AI-BOARD remains right-aligned
- No workflow job + AI-BOARD only: AI-BOARD still right-aligned
- No jobs at all: Section not rendered (existing behavior preserved)

---

## Component 3: formatTimestamp Utility (New)

### Function Signature

```typescript
/**
 * Format timestamp for tooltip display
 *
 * Converts Date objects or ISO strings into human-readable relative or absolute time.
 *
 * @param timestamp - Date object, ISO string, or null
 * @returns Formatted string (e.g., "2 minutes ago", "Oct 24, 3:42 PM")
 *
 * @example
 * formatTimestamp(new Date()) // "just now"
 * formatTimestamp(new Date('2025-10-24T15:40:00')) // "2 minutes ago"
 * formatTimestamp(new Date('2025-10-23T10:00:00')) // "Oct 23, 10:00 AM"
 * formatTimestamp(null) // "Unknown time"
 */
export function formatTimestamp(timestamp: Date | string | null): string;
```

### Implementation Requirements

**Input Normalization**:
- Accept `Date` objects, ISO 8601 strings, or `null`
- Convert strings to Date objects using `new Date(timestamp)`
- Handle invalid inputs gracefully (return "Unknown time")

**Output Format Logic**:

1. **Null/Invalid Input** → `"Unknown time"`
2. **< 1 minute ago** → `"just now"`
3. **< 1 hour ago** → `"X minutes ago"` (use `Intl.RelativeTimeFormat`)
4. **< 24 hours ago (same day)** → `"3:42 PM"` (use `Intl.DateTimeFormat` with `timeStyle: 'short'`)
5. **Older than 24 hours** → `"Oct 24, 3:42 PM"` (use `Intl.DateTimeFormat` with `dateStyle: 'medium'`, `timeStyle: 'short'`)

**Internationalization**:
- Use browser locale via `navigator.language` (default: `'en-US'`)
- Support 12-hour and 24-hour time formats based on locale
- Month names localized (e.g., "Oct" in English, "oct" in French)

### Error Handling

```typescript
try {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) {
    return "Unknown time";
  }
  // Formatting logic...
} catch (error) {
  console.error('formatTimestamp error:', error);
  return "Unknown time";
}
```

---

## Integration Contract

### Component Communication Flow

```
Board Component
  ↓ (passes jobs via props)
TicketCard Component
  ↓ (renders in flex layout)
JobStatusIndicator × 2
  ├─→ Workflow: Simple display (icon + label)
  └─→ AI-BOARD: Compact display (icon + tooltip)
        ↓ (tooltip content)
      formatTimestamp() utility
```

### Data Dependencies

**From Database (via Job entity)**:
- `job.status`: JobStatus enum
- `job.command`: String (for classification and contextual labels)
- `job.completedAt`: DateTime | null (for COMPLETED status tooltips)

**From Application Layer**:
- `classifyJobType(command)`: JobType enum (WORKFLOW | AI_BOARD)
- `getContextualLabel(command, status)`: String (e.g., "WRITING", "COMPLETED")

**External Dependencies**:
- `lucide-react`: BotMessageSquare icon
- `@/components/ui/tooltip`: Tooltip, TooltipTrigger, TooltipContent, TooltipProvider
- `@/lib/utils`: cn() utility for class merging

---

## Testing Contracts

### Visual Regression Tests (Playwright)

**Test File**: `tests/integration/job-status-display.spec.ts`

**Test Cases**:

1. **Workflow Job Simplified Display**
   - Given: Ticket with workflow job in COMPLETED status
   - When: Card is rendered
   - Then: Status displays as "✅ COMPLETED" (no "🔧 BUILD :" prefix)

2. **AI-BOARD Compact Icon Display**
   - Given: Ticket with AI-BOARD job in RUNNING status
   - When: Card is rendered
   - Then: Purple bot icon visible on right side

3. **Single-Line Layout**
   - Given: Ticket with both workflow and AI-BOARD jobs
   - When: Card is rendered
   - Then: Both indicators on same horizontal line, space between them

4. **Tooltip Interaction**
   - Given: AI-BOARD job in COMPLETED status
   - When: User hovers over bot icon
   - Then: Tooltip shows "AI-BOARD assisted on [timestamp]"

5. **Accessibility**
   - Given: AI-BOARD job indicator
   - When: User tabs to icon and presses Enter
   - Then: Tooltip appears, ARIA label announced to screen reader

### Unit Tests (Vitest)

**Test File**: `tests/unit/format-timestamp.test.ts`

**Test Cases**:

1. `formatTimestamp(null)` → `"Unknown time"`
2. `formatTimestamp(new Date())` → `"just now"`
3. `formatTimestamp(2 minutes ago)` → `"2 minutes ago"`
4. `formatTimestamp(yesterday)` → `"Oct 23, 3:42 PM"`
5. `formatTimestamp("invalid")` → `"Unknown time"`

---

## Performance Contract

### Rendering Performance
- **Target**: <16ms render time (60fps)
- **Constraint**: No layout shift during status updates
- **Optimization**: React.memo preserved on TicketCard

### Memory Usage
- **Tooltip Instance**: Lazy-loaded on hover (not pre-rendered)
- **Icon Import**: Tree-shakeable from lucide-react

### Network Impact
- **Zero additional requests**: No API calls, no external resources
- **Bundle Size**: +2KB (Tooltip component + formatTimestamp utility)

---

## Backward Compatibility

### Breaking Changes
- ✅ **None** - All changes are visual refinements
- ✅ Props interfaces unchanged
- ✅ Existing tests need updates (expected behavior changed)

### Migration Path
- ✅ No user action required (automatic UI improvement)
- ✅ No data migration needed
- ✅ No API version bump required

---

## Phase 1 Contracts Completion

**Status**: ✅ COMPLETE

**Deliverables**:
- [x] Component interface specifications
- [x] Visual layout contracts
- [x] Tooltip behavior specification
- [x] Utility function contract
- [x] Testing contracts
- [x] Performance targets

**Next Phase**: Generate quickstart guide for implementation
