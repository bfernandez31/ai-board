# Research: Close Ticket Feature

**Feature**: AIB-147-close-ticket-feature
**Date**: 2026-01-06
**Status**: Complete

## Research Tasks

### 1. Prisma Enum Extension Pattern

**Context**: Need to add CLOSED to existing Stage enum without breaking existing data.

**Decision**: Use Prisma migration with enum alteration

**Rationale**:
- Prisma supports adding new enum values via `ALTER TYPE ... ADD VALUE`
- PostgreSQL enum extension is non-destructive (existing rows unaffected)
- Migration will add `CLOSED` after `SHIP` in the Stage enum

**Alternatives Considered**:
- Soft state field (e.g., `isClosed` boolean) - Rejected: Creates dual source of truth
- Separate enum for terminal states - Rejected: Over-engineering for single state

**Implementation Notes**:
```prisma
enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
  CLOSED  // New terminal state
}

model Ticket {
  // ... existing fields
  closedAt DateTime?  // Nullable, set when ticket enters CLOSED state
}
```

### 2. PR Closure Without Branch Deletion

**Context**: Need to close associated PRs when ticket is closed, but preserve branches for future reference.

**Decision**: Create `closePRsOnly()` function adapting existing `deleteBranchAndPRs()` pattern

**Rationale**:
- Existing `lib/github/delete-branch-and-prs.ts` provides proven Octokit patterns
- Only need Steps 1-2 (find PRs, close PRs), skip Step 3 (branch deletion)
- Add explanatory comment on closed PRs (FR-007 requirement)

**Alternatives Considered**:
- Call existing function with "skip delete" flag - Rejected: Function semantics imply deletion
- Close PRs in workflow instead of API - Rejected: Adds latency, complicates error handling

**Implementation Notes**:
```typescript
export async function closePRsOnly(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string,
  closeComment?: string
): Promise<{ prsClosed: number }> {
  // Step 1: Find all open PRs with matching head branch
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branchName}`,
    state: 'open',
  });

  // Step 2: Close all matching PRs with comment
  await Promise.all(
    prs.map(async (pr) => {
      // Add closure comment if provided
      if (closeComment) {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: pr.number,
          body: closeComment,
        });
      }
      // Close the PR
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pr.number,
        state: 'closed',
      });
    })
  );

  return { prsClosed: prs.length };
}
```

### 3. Dual Drop Zone UX Pattern

**Context**: SHIP column needs to split into Ship/Close zones only when dragging from VERIFY.

**Decision**: Conditional droppable zones using @dnd-kit/core

**Rationale**:
- DnD Kit supports multiple droppable zones within a single container
- Use `useDndContext` to detect drag source stage
- Render dual zones only when `dragSource === 'VERIFY'`

**Alternatives Considered**:
- Separate Close column - Rejected: CLOSED is not a workflow stage, shouldn't appear on board
- Context menu on drop - Rejected: Less discoverable, spec requires visual zones

**Implementation Notes**:
```typescript
// In stage-column.tsx for SHIP column
const { active } = useDndContext();
const dragSourceStage = active?.data?.current?.ticket?.stage;
const showDualZones = dragSourceStage === 'VERIFY';

// Render structure:
// - If showDualZones: render ShipZone (top 60%) + CloseZone (bottom 40%)
// - Otherwise: render normal single drop zone

// Close zone styling per spec:
// - Red dashed border (#f87171, dashed)
// - Archive icon (lucide-react Archive)
// - "Close" label
```

### 4. Search Result Styling for Closed Tickets

**Context**: CLOSED tickets should appear in search with muted styling and "Closed" badge.

**Decision**: Extend existing search result component with conditional styling

**Rationale**:
- Search endpoint already returns ticket stage
- Client-side styling based on `stage === 'CLOSED'` condition
- Badge component from shadcn/ui (existing dependency)

**Alternatives Considered**:
- Filter out closed tickets from search - Rejected: Violates FR-011
- Separate "closed tickets" search - Rejected: Fragments UX, over-engineering

**Implementation Notes**:
```typescript
// In search result component
const isClosed = ticket.stage === 'CLOSED';

return (
  <div className={cn(
    "flex items-center gap-2",
    isClosed && "opacity-60" // Muted styling
  )}>
    {/* Ticket info */}
    <span>{ticket.ticketKey}</span>
    <span>{ticket.title}</span>

    {/* Closed badge */}
    {isClosed && (
      <Badge variant="secondary" className="text-xs">
        Closed
      </Badge>
    )}
  </div>
);
```

### 5. Read-Only Modal for Closed Tickets

**Context**: When opening a CLOSED ticket from search, all edit controls must be disabled.

**Decision**: Add `isReadOnly` prop to TicketDetailModal based on stage

**Rationale**:
- Modal already has conditional rendering for different stages
- Disable form fields and hide edit buttons when `stage === 'CLOSED'`
- Existing `field-edit-permissions.ts` can be extended for CLOSED stage

**Alternatives Considered**:
- Separate read-only modal component - Rejected: Code duplication
- Prevent opening closed tickets entirely - Rejected: Violates FR-012

**Implementation Notes**:
```typescript
// In ticket-detail-modal.tsx
const isReadOnly = ticket.stage === 'CLOSED';

// Disable all form fields
<Input disabled={isReadOnly} ... />

// Hide edit buttons
{!isReadOnly && <Button>Save</Button>}

// Show closed state banner
{isReadOnly && (
  <Alert>
    <AlertDescription>
      This ticket was closed on {formatDate(ticket.closedAt)}
    </AlertDescription>
  </Alert>
)}
```

### 6. Board Exclusion for Closed Tickets

**Context**: CLOSED tickets must not appear in any board column.

**Decision**: Filter at data layer (ticket fetch query)

**Rationale**:
- Most efficient to exclude at database query level
- Prevents unnecessary data transfer and client-side processing
- Consistent with how board already filters by projectId

**Alternatives Considered**:
- Client-side filter - Rejected: Wasteful, sends unused data
- Add `visible` boolean - Rejected: Stage already determines visibility

**Implementation Notes**:
```typescript
// In ticket fetch query
const tickets = await prisma.ticket.findMany({
  where: {
    projectId,
    stage: { not: 'CLOSED' }, // Exclude closed tickets from board
  },
  orderBy: { updatedAt: 'desc' },
});
```

### 7. Validation Blocking Patterns

**Context**: Ticket closure must be blocked when conditions are unsafe (active jobs, cleanup locks).

**Decision**: Extend existing validation in transition route

**Rationale**:
- FR-005, FR-006 require blocking on PENDING/RUNNING jobs and cleanup locks
- Existing transition route already has these validations
- Reuse `canRollbackToInbox` pattern for `canCloseTicket` validator

**Alternatives Considered**:
- Separate validation endpoint - Rejected: Duplicates logic
- Client-only validation - Rejected: Not secure, race conditions

**Implementation Notes**:
```typescript
// Validation function
export function canCloseTicket(
  currentStage: Stage,
  workflowType: 'FULL' | 'QUICK' | 'CLEAN',
  mostRecentJob: { status: string } | null
): { allowed: boolean; reason?: string } {
  // Only VERIFY can transition to CLOSED
  if (currentStage !== 'VERIFY') {
    return { allowed: false, reason: 'Only tickets in VERIFY stage can be closed' };
  }

  // Block if job is active
  if (mostRecentJob && ['PENDING', 'RUNNING'].includes(mostRecentJob.status)) {
    return { allowed: false, reason: 'Cannot close: workflow is still running' };
  }

  return { allowed: true };
}
```

## Summary

All NEEDS CLARIFICATION items resolved. Key technical decisions:

1. **Schema**: Add `CLOSED` to Stage enum + `closedAt` DateTime field
2. **PR Closure**: New `closePRsOnly()` function (no branch deletion)
3. **Dual Zones**: Conditional DnD Kit droppables for VERIFY → SHIP
4. **Search**: Muted styling + Badge for closed tickets
5. **Read-Only**: Extend modal with `isReadOnly` prop
6. **Board Filter**: Exclude CLOSED at database query level
7. **Validation**: Extend existing transition validators
