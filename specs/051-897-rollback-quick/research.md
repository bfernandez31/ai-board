# Research: Quick Workflow Rollback

**Feature Branch**: `051-897-rollback-quick`
**Date**: 2025-10-24

## Phase 0: Research Findings

This document captures research decisions, rationale, and alternatives considered for implementing the rollback feature.

---

## 1. Rollback Validation Strategy

### Decision: Implement rollback eligibility validation as pure function

**Rationale**:
- Testable via Vitest unit tests (fast feedback, ~1ms per test)
- Reusable across API endpoint and UI preview logic
- Type-safe with TypeScript strict mode
- No side effects (pure business logic)

**Implementation Approach**:
```typescript
// app/lib/workflows/rollback-validator.ts
export function canRollbackToInbox(
  currentStage: Stage,
  targetStage: Stage,
  mostRecentJob: Job | null
): { allowed: boolean; reason?: string } {
  // Validation logic here
}
```

**Alternatives Considered**:
1. **Inline validation in API route**: Harder to test, couples business logic to HTTP layer
2. **Database-level check constraint**: Cannot provide user-friendly error messages, harder to evolve
3. **Middleware-based validation**: Overkill for single transition type, adds complexity

**Why chosen approach is superior**: Pure function testing via Vitest provides fastest feedback loop, enables TDD workflow, and separates concerns (validation logic vs HTTP handling).

---

## 2. State Reset Strategy

### Decision: Use Prisma transaction to atomically reset all rollback-related fields

**Rationale**:
- Ensures atomicity (all-or-nothing state reset)
- Prevents partial rollback state corruption
- Existing Prisma infrastructure supports transactions
- Follows constitution Database Integrity principle (Principle V)

**Implementation Approach**:
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Update ticket fields atomically
  await tx.ticket.update({
    where: { id: ticketId },
    data: {
      stage: 'INBOX',
      workflowType: 'FULL',
      branch: null,
      version: 1,
    },
  });

  // 2. Delete failed/cancelled job
  await tx.job.delete({
    where: { id: mostRecentJob.id },
  });
});
```

**Alternatives Considered**:
1. **Sequential updates without transaction**: Risk of partial state (e.g., ticket updated but job not deleted)
2. **Soft delete job with deletedAt field**: Violates spec requirement (FR-005: delete job record)
3. **Two-phase commit**: Over-engineered for single database operations

**Why chosen approach is superior**: Prisma transactions provide ACID guarantees at application layer, require no schema changes, and align with existing codebase patterns (see `/app/api/projects/[projectId]/tickets/route.ts` for transaction examples).

---

## 3. Visual Feedback Approach

### Decision: Extend existing drag-and-drop visual feedback with rollback-specific color (amber/warning)

**Rationale**:
- Existing codebase already has visual feedback for quick-impl (green border) and normal workflow (blue border)
- Amber/warning color semantically represents "recovery action" vs "forward progress"
- No new UI primitives required (uses Tailwind utility classes)
- Consistent with existing UX patterns

**Implementation Approach**:
```typescript
// components/board/board.tsx (existing file)
const getRollbackFeedback = (ticket: Ticket, mostRecentJob: Job | null) => {
  if (canRollbackToInbox(ticket.stage, 'INBOX', mostRecentJob).allowed) {
    return 'border-amber-500 bg-amber-500/10'; // Rollback-eligible
  }
  return 'opacity-50 cursor-not-allowed'; // Invalid
};
```

**Alternatives Considered**:
1. **Modal confirmation dialog**: Adds friction, requires extra click, slows down workflow
2. **Toast notification after drop**: Too late (user already committed action)
3. **Tooltip on hover**: Not discoverable during drag operation

**Why chosen approach is superior**: Real-time visual feedback during drag (before drop) prevents user errors, aligns with existing UI patterns (blue/green borders for SPECIFY/BUILD), and requires minimal code changes.

---

## 4. Job Filtering Strategy

### Decision: Filter workflow jobs by command name pattern (exclude "comment-*")

**Rationale**:
- FR-007 requires distinguishing workflow jobs from AI-BOARD jobs
- Command naming convention already exists: `specify`, `plan`, `implement`, `quick-impl` (workflow), `comment-specify`, `comment-plan`, etc. (AI-BOARD)
- Simple string check (`!job.command.startsWith('comment-')`) is performant and maintainable

**Implementation Approach**:
```typescript
const workflowJobs = jobs.filter(job => !job.command.startsWith('comment-'));
const mostRecentWorkflowJob = workflowJobs.sort((a, b) =>
  b.startedAt.getTime() - a.startedAt.getTime()
)[0];
```

**Alternatives Considered**:
1. **Add `jobType` enum field to Job model**: Requires schema migration, adds complexity, couples database to business logic
2. **Separate tables for workflow vs AI-BOARD jobs**: Over-engineered, breaks existing job tracking infrastructure
3. **Job metadata JSON field**: Harder to query, no type safety, requires JSON parsing

**Why chosen approach is superior**: Leverages existing naming convention, zero schema changes, type-safe with TypeScript, and aligns with existing job command patterns throughout codebase.

---

## 5. Error Messaging Strategy

### Decision: Structured error responses with actionable messages

**Rationale**:
- Constitution Principle IV (Security-First) requires clear, user-friendly error messages
- Users need to understand WHY rollback is blocked and WHAT to do next
- Existing API patterns use structured `{ error: string }` responses

**Implementation Approach**:
```typescript
// app/api/projects/[projectId]/tickets/[id]/transition/route.ts
if (!rollbackValidation.allowed) {
  return NextResponse.json(
    { error: rollbackValidation.reason },
    { status: 400 }
  );
}
```

**Example Error Messages**:
- `"Cannot rollback: workflow is still running. Wait for completion or cancel the job."`
- `"Cannot rollback: workflow completed successfully. Rollback only available for failed or cancelled jobs."`
- `"Cannot rollback from SPECIFY stage. Only BUILD stage supports rollback to INBOX."`

**Alternatives Considered**:
1. **Generic error codes (e.g., "ROLLBACK_INVALID")**: Not actionable, requires docs lookup
2. **Silent failure with UI toast**: Error not captured in network logs, harder to debug
3. **Verbose stack traces**: Exposes internal implementation, security risk

**Why chosen approach is superior**: Balances security (no sensitive data exposure) with usability (actionable guidance), follows existing API error patterns, and supports client-side error handling.

---

## Summary of Research Outcomes

All technical unknowns from Phase 0 have been resolved:

✅ **Rollback validation strategy**: Pure function with Vitest unit tests
✅ **State reset atomicity**: Prisma transactions (existing pattern)
✅ **Visual feedback approach**: Extend existing drag-and-drop UX with amber borders
✅ **Job filtering logic**: Command name prefix filtering (zero schema changes)
✅ **Error messaging**: Structured responses with actionable guidance

**No additional dependencies required**. All implementation uses existing stack (Prisma, TanStack Query, @dnd-kit, Zod, Vitest, Playwright).

**Next Phase**: Generate data-model.md and API contracts based on these decisions.
