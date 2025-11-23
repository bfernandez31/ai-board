# Research: Rollback VERIFY to PLAN

**Feature**: AIB-75 | **Date**: 2025-11-23

## Overview

This document captures research findings for implementing the VERIFY to PLAN rollback feature, including decisions made, patterns identified from the existing codebase, and alternatives considered.

---

## Decision 1: Rollback Validation Strategy

**Question**: How should we determine if a VERIFY ticket can be rolled back to PLAN?

**Decision**: Extend existing `canRollbackToInbox()` pattern with new `canRollbackToPlan()` function

**Rationale**:
- Existing rollback validator at `lib/workflows/rollback-validator.ts` provides proven pattern
- Same validation structure: check stage, workflow type, job status
- Maintains consistency with BUILD→INBOX rollback implementation

**Alternatives Considered**:
1. **Single unified validator** - Rejected: would add complexity for different rollback rules
2. **Inline validation in API route** - Rejected: violates separation of concerns, harder to test

**Key Differences from BUILD→INBOX**:
| Aspect | BUILD→INBOX | VERIFY→PLAN |
|--------|-------------|-------------|
| Workflow Type | QUICK only | FULL only |
| Job Status | FAILED, CANCELLED | COMPLETED, FAILED, CANCELLED |
| Branch Handling | Clear branch | Keep branch |
| Preview URL | N/A | Clear previewUrl |

---

## Decision 2: Job Status Requirements

**Question**: Which job statuses should allow rollback from VERIFY to PLAN?

**Decision**: Allow rollback when latest workflow job is COMPLETED, FAILED, or CANCELLED

**Rationale**:
- User explicitly requested COMPLETED jobs be included (from spec auto-resolved decisions)
- Enables re-planning even after successful verification if team wants different approach
- RUNNING and PENDING jobs must block to prevent data inconsistency

**Alternatives Considered**:
1. **Only FAILED/CANCELLED** - Rejected: user requirement explicitly includes completed jobs
2. **Any status including RUNNING** - Rejected: would cause race conditions with active workflows

---

## Decision 3: Git Reset Approach

**Question**: How should the git branch be reset to preserve specs while reverting implementation?

**Decision**: Workflow-side implementation finds last spec-only commit and resets to it

**Rationale**:
- Git operations belong in GitHub workflow, not API
- Spec files in `.specify/[branch]/` must be preserved (contains planning work)
- Implementation files must be removed
- Similar pattern used in verify.yml for branch operations

**Implementation Notes**:
- API sets `stage: PLAN` and clears `previewUrl`
- Workflow (triggered separately or as part of transition) handles git reset
- Job record deleted to reflect fresh state for re-implementation

**Alternatives Considered**:
1. **API performs git operations** - Rejected: API has no git access, security concerns
2. **Keep all files, just change stage** - Rejected: violates spec requirement to revert implementation

---

## Decision 4: Confirmation Modal Pattern

**Question**: Which modal pattern should be used for the rollback confirmation?

**Decision**: Use `AlertDialog` pattern (like DeleteConfirmationModal)

**Rationale**:
- Rollback is a destructive operation (loses implementation work)
- AlertDialog pattern provides clear Cancel/Confirm actions
- Matches existing delete confirmation UX
- Spec requires destructive styling (red/amber border)

**Modal Content**:
- Title: "Rollback to Plan?"
- Description: Explain what will be reverted (implementation code, preview deployment)
- Explain what will be preserved (spec files, branch name)
- Warning about inability to recover implementation
- Cancel button (default focus)
- Confirm button (destructive variant)

**Alternatives Considered**:
1. **Dialog (non-blocking)** - Rejected: too easy to dismiss, rollback is destructive
2. **Inline confirmation** - Rejected: not enough space for consequences explanation

---

## Decision 5: Job Filtering for Validation

**Question**: How should we identify the relevant job for rollback validation?

**Decision**: Filter to most recent non-AI-BOARD workflow job

**Rationale**:
- AI-BOARD comment jobs (`comment-*` commands) don't affect transition eligibility
- Only workflow jobs (`verify`, `implement`, etc.) represent actual work state
- Most recent job reflects current state

**Implementation**:
```typescript
const isWorkflowJob = (job: Job) => !job.command.startsWith('comment-');
const mostRecentWorkflowJob = jobs
  .filter(isWorkflowJob)
  .sort((a, b) => b.createdAt - a.createdAt)[0];
```

---

## Decision 6: Data Changes on Rollback

**Question**: What ticket/job data should change when rollback completes?

**Decision**: Atomic transaction updates:
- `ticket.stage`: VERIFY → PLAN
- `ticket.previewUrl`: cleared (set to null)
- `ticket.version`: incremented
- `job`: deleted (most recent workflow job)

**Rationale**:
- Stage change is core requirement
- PreviewUrl must clear (deployment becomes invalid after rollback)
- Version increment triggers optimistic update reconciliation
- Job deletion signals fresh state for re-planning

**What NOT to change**:
- `ticket.branch`: Keep the branch (contains spec files)
- `ticket.workflowType`: Stays FULL
- `ticket.description`, `ticket.title`: Unchanged

---

## Decision 7: Visual Feedback Pattern

**Question**: How should the UI indicate rollback availability during drag?

**Decision**: Amber dashed border on PLAN column when dragging eligible VERIFY ticket

**Rationale**:
- Matches BUILD→INBOX rollback visual pattern
- Amber indicates caution (destructive but reversible)
- Dashed border distinguishes from normal drop zones
- Disabled styling (opacity, cursor) for ineligible tickets

**States**:
1. **Not dragging**: Normal column appearance
2. **Dragging eligible VERIFY ticket**: Amber dashed border on PLAN column
3. **Dragging ineligible VERIFY ticket**: Disabled overlay on PLAN column
4. **Dragging non-VERIFY ticket**: Normal transition styling

---

## Pattern Reference: Existing Rollback Implementation

### BUILD→INBOX Rollback Flow (for reference)

**Files**:
- Validator: `lib/workflows/rollback-validator.ts`
- API: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- Frontend: `components/board/board.tsx` (handleDragEnd)

**Flow**:
1. User drags BUILD ticket toward INBOX
2. Frontend validates via `isValidTransition()`
3. On drop, shows confirmation modal
4. On confirm, POST to transition API
5. API validates with `canRollbackToInbox()`
6. Atomic transaction: update ticket, delete job
7. Return updated ticket
8. Frontend shows success toast

**VERIFY→PLAN will follow identical pattern** with adjusted:
- Target column (PLAN vs INBOX)
- Validation rules (FULL workflow, include COMPLETED status)
- Data updates (clear previewUrl, keep branch)

---

## Technology Patterns

### TanStack Query Integration

Existing pattern from board.tsx:
```typescript
const queryClient = useQueryClient();

// Optimistic update
queryClient.setQueryData(['tickets', projectId], (old) =>
  updateTicketStageOptimistically(old, ticketId, newStage)
);

// On error, invalidate to refetch
queryClient.invalidateQueries(['tickets', projectId]);
```

### Prisma Transaction Pattern

From existing rollback:
```typescript
await prisma.$transaction(async (tx) => {
  const updated = await tx.ticket.update({ ... });
  await tx.job.delete({ ... });
  return updated;
});
```

### Zod Validation Pattern

Existing transition API uses:
```typescript
const schema = z.object({
  targetStage: z.nativeEnum(Stage),
});
const body = schema.parse(await request.json());
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Git reset fails | Low | Medium | Keep ticket in VERIFY, job fails, user can retry |
| Race condition with running job | Low | High | Validate job status server-side before transition |
| Accidental rollback | Medium | Medium | Confirmation modal with clear consequences |
| Preview URL still accessible | Low | Low | Vercel deployment eventually expires; cleared URL prevents confusion |

---

## Next Steps

1. **Phase 1**: Generate data-model.md, contracts/, quickstart.md
2. **Phase 2**: Generate tasks.md via /speckit.tasks
3. **Implementation**: Follow TDD with unit tests for validator, E2E for flow
