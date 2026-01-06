# Research: Close Ticket Feature

**Feature**: AIB-148-copy-of-close
**Date**: 2026-01-06

## Research Tasks

### 1. Dual Drop Zone Pattern

**Question**: How to implement dual drop zones in SHIP column for VERIFY tickets?

**Findings**:
- Existing pattern in `board.tsx` (lines 961-972): INBOX dragging shows different zones for SPECIFY (blue) vs BUILD (green)
- `getDropZoneStyle()` function handles conditional styling based on `dragSource` stage
- Quick-impl uses `pendingTransition` state + `QuickImplModal` to intercept drops
- Visual feedback via CSS classes: `border-4 border-dashed border-{color}-500 bg-{color}-500/10`

**Decision**: Adapt INBOX→BUILD/SPECIFY pattern for VERIFY→SHIP/CLOSED
- Detect when dragging VERIFY ticket over SHIP column
- Split column into Ship zone (top ~60%) and Close zone (bottom ~40%)
- Ship zone: Purple solid border (existing behavior)
- Close zone: Red dashed border with Archive icon and "Close" label
- Use `pendingCloseTransition` state to track close drop, show `CloseConfirmationModal`

**Rationale**: Follows established patterns, minimal new code, consistent UX

**Alternatives Considered**:
- Context menu on SHIP drop → Rejected: Less discoverable, breaks drag-drop flow
- Separate CLOSED column → Rejected: Spec explicitly excludes CLOSED from board columns

---

### 2. GitHub PR Close Without Branch Deletion

**Question**: Best approach for closing PRs while preserving the branch?

**Findings**:
- Existing `deleteBranchAndPRs()` in `lib/github/delete-branch-and-prs.ts` does both operations
- Uses Octokit `pulls.list()` to find open PRs with matching head branch
- Uses Octokit `pulls.update({ state: 'closed' })` to close PRs
- Branch deletion is separate step after PR close

**Decision**: Create new `closePRsForBranch()` function
- Extract PR close logic from existing function
- Add comment via `issues.createComment()` explaining closure via ai-board
- Return count of PRs closed
- Handle idempotency: 404 errors for already-closed PRs are acceptable

**Rationale**: Reuses proven Octokit patterns, separates concerns cleanly

**Implementation**:
```typescript
// lib/github/close-prs.ts
export interface CloseResult {
  prsClosed: number;
  prsAlreadyClosed: number;
}

export async function closePRsForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string,
  comment: string
): Promise<CloseResult>
```

---

### 3. Stage Transition State Machine

**Question**: How to integrate CLOSED into the existing state machine?

**Findings**:
- `lib/stage-transitions.ts` defines `Stage` enum and `STAGE_ORDER` array
- `isValidTransition()` handles special cases (quick-impl, rollbacks)
- `isTerminalStage()` checks if stage === SHIP
- Current terminal stage: SHIP (no outbound transitions)

**Decision**: Add CLOSED as second terminal stage
- Add `CLOSED = 'CLOSED'` to Stage enum (after SHIP for ordering)
- Add VERIFY → CLOSED as valid transition in `isValidTransition()`
- Update `isTerminalStage()` to return true for both SHIP and CLOSED
- CLOSED has no outbound transitions (truly terminal)

**Rationale**: Minimal changes to existing logic, clean terminal state semantics

**Implementation**:
```typescript
// Updated isValidTransition
if (fromStage === Stage.VERIFY && toStage === Stage.CLOSED) {
  return true; // VERIFY → CLOSED always valid (validation in API)
}

// Updated isTerminalStage
export function isTerminalStage(stage: Stage): boolean {
  return stage === Stage.SHIP || stage === Stage.CLOSED;
}
```

---

### 4. Read-Only Ticket Modal for CLOSED State

**Question**: How to implement read-only mode in ticket detail modal?

**Findings**:
- `ticket-detail-modal.tsx` uses `canEditDescriptionAndPolicy()` to control editing
- Currently only INBOX stage allows editing (line 799)
- Edit controls conditionally rendered based on `isInboxStage` flag
- Pattern already established for read-only vs editable UI

**Decision**: Extend existing pattern for CLOSED stage
- Add explicit check for CLOSED stage: `const isClosedStage = ticket.stage === 'CLOSED'`
- When CLOSED: disable all edit controls, show visual "Read-only" indicator
- Disable comment form for CLOSED tickets (terminal state, no further interaction)
- Keep branch link visible (for reference, points to preserved branch)

**Rationale**: Follows existing patterns, consistent UX with other read-only stages

---

### 5. Search Result Styling for Closed Tickets

**Question**: How to style closed tickets in search results?

**Findings**:
- `ticket-search.tsx` renders search results with ticket info
- No existing muted styling pattern for special states
- Spec requires: reduced opacity (~60%), gray text, "Closed" badge

**Decision**: Add conditional styling for closed tickets
- Check `result.stage === 'CLOSED'` in result rendering
- Apply `opacity-60 text-gray-500` classes to closed results
- Add neutral gray badge: `<Badge variant="outline">Closed</Badge>`
- Badge styling: gray background similar to INBOX column

**Rationale**: Clear visual distinction, follows spec requirements, uses existing shadcn/ui Badge component

---

### 6. Close API Validation

**Question**: What validations are needed for the close endpoint?

**Findings**:
- Existing transition endpoint validates: stage, active jobs, cleanup lock
- Job validation uses `canRollbackToInbox()` / `canRollbackToPlan()` patterns
- Cleanup lock returns HTTP 423 with explanatory message
- Version-based optimistic concurrency control

**Decision**: Create dedicated `/close` endpoint with validations
1. **Authorization**: `verifyTicketAccess(ticketId)` - owner or member
2. **Stage check**: Must be in VERIFY stage (400 otherwise)
3. **Job check**: No PENDING or RUNNING jobs (400 otherwise)
4. **Cleanup lock**: Project not locked (423 otherwise)
5. **Atomic update**: Set stage=CLOSED, closedAt=now(), increment version
6. **GitHub PR close**: Best-effort, log failures but don't block transition

**Rationale**: Consistent with existing validation patterns, graceful GitHub failure handling

---

### 7. Cleanup Lock Compatibility

**Question**: How does close interact with project cleanup lock?

**Findings**:
- Cleanup lock in `lib/transition-lock.ts`
- Transition API returns 423 Locked when cleanup active
- Visual feedback in board.tsx: disabled drop zones, banner message
- Lock auto-releases when cleanup job completes

**Decision**: Apply same lock check to close operation
- Check `isCleanupLockActive` before allowing close
- Return 423 with explanatory message
- Visual feedback: Close zone shows disabled state during cleanup

**Rationale**: Consistent with all other transitions, prevents data inconsistency during cleanup

---

## Dependencies Summary

| Dependency | Usage | Version |
|------------|-------|---------|
| Prisma | Schema migration (Stage enum, closedAt field) | 6.x |
| @octokit/rest | PR close API calls | Existing |
| shadcn/ui AlertDialog | Close confirmation modal | Existing |
| @dnd-kit/core | Drag-drop zones | Existing |
| TanStack Query | State management, optimistic updates | v5 |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GitHub API failure during PR close | Medium | Low | Log error, complete local transition anyway |
| Race condition with concurrent close attempts | Low | Medium | Optimistic concurrency control (version check) |
| Orphaned CLOSED tickets with open PRs | Low | Low | Periodic reconciliation job (future enhancement) |

## Unresolved Questions

None - all technical questions resolved through codebase analysis.
