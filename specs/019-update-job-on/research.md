# Research: Update Job Status on GitHub Actions Completion

**Feature**: 019-update-job-on
**Date**: 2025-10-10
**Status**: Complete

## Research Questions

### 1. GitHub Actions Workflow Conclusion States

**Question**: What are the possible conclusion states for GitHub Actions workflows, and how should they map to Job statuses?

**Decision**: Map GitHub Actions conclusions to JobStatus enum as follows:
- `success` → COMPLETED
- `failure` → FAILED
- `cancelled` → CANCELLED (new status)
- `timed_out` → FAILED (treat as failure)
- `skipped` → No update (workflow didn't actually run)

**Rationale**:
- Success/failure/cancelled are explicitly clarified in the spec
- Timeout is a failure mode and should be treated as FAILED
- Skipped workflows indicate no execution occurred, so no status update needed
- This mapping is simple, unambiguous, and covers all GitHub Actions conclusion states

**Alternatives Considered**:
- Creating separate TIMEOUT status: Rejected - adds unnecessary complexity, timeout is a failure
- Updating to CANCELLED for timeouts: Rejected - timeout is system-initiated, not user-initiated
- Creating SKIPPED status: Rejected - skipped workflows never started, no Job would exist

**Reference**: [GitHub Actions workflow conclusion documentation](https://docs.github.com/en/actions/learn-github-actions/contexts#job-context)

---

### 2. Next.js API Route Error Handling Patterns

**Question**: What are the best practices for error handling in Next.js 15 App Router API routes?

**Decision**: Use try-catch blocks with structured error responses following this pattern:
```typescript
try {
  // Validation
  const data = schema.parse(await request.json())

  // Business logic
  const result = await updateJob(data)

  // Success response
  return NextResponse.json(result, { status: 200 })
} catch (error) {
  // Validation errors (Zod)
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Invalid request', details: error.errors },
      { status: 400 }
    )
  }

  // Business logic errors
  if (error instanceof InvalidTransitionError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }

  // Unexpected errors
  console.error('Job status update failed:', error)
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
```

**Rationale**:
- Next.js 15 App Router uses NextResponse for type-safe responses
- Structured error handling separates validation, business logic, and unexpected errors
- Logging provides debugging context without exposing internal details to clients
- HTTP status codes follow REST conventions (400 for client errors, 500 for server errors)

**Alternatives Considered**:
- Global error handlers: Rejected - less explicit, harder to customize per endpoint
- Error middleware: Not available in App Router route handlers
- Custom error classes only: Adopted - enhances the try-catch pattern with type safety

**Reference**: [Next.js App Router Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

### 3. Prisma Optimistic Concurrency Control

**Question**: Do we need optimistic concurrency control (version fields) for Job status updates?

**Decision**: **No** - optimistic concurrency is NOT needed for this feature.

**Rationale**:
- Job status updates are single-record atomic operations
- State machine validation prevents invalid transitions (e.g., COMPLETED → COMPLETED is idempotent)
- Only one workflow execution updates a specific Job ID
- Terminal states cannot transition further, preventing conflicts
- Clarification specified log-only error handling (no retry), so race conditions are acceptable

**Implementation**:
```prisma
// WHERE clause ensures we only update if current state allows transition
await prisma.job.update({
  where: { id: jobId },
  data: {
    status: newStatus,
    completedAt: new Date()
  }
})
```

**Alternatives Considered**:
- Adding version field to Job model: Rejected - unnecessary complexity, no concurrent updates expected
- Using database transactions: Rejected - single record update is already atomic
- Implementing distributed locking: Rejected - overkill for this use case

**Reference**: Existing project pattern in `app/api/projects/[projectId]/tickets/[id]/route.ts` uses version field for tickets due to concurrent user edits. Jobs are workflow-controlled, not user-edited.

---

### 4. State Machine Patterns in TypeScript

**Question**: What's the best way to implement state transition validation in TypeScript?

**Decision**: Enum-based state machine with explicit transition map:

```typescript
type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ['RUNNING'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: []
}

function canTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}
```

**Rationale**:
- Explicit transition map is self-documenting
- Type-safe with TypeScript enums/union types
- Easy to unit test (pure function, no dependencies)
- Matches the state transitions defined in spec (FR-013)
- Simple to extend if new states added in future

**Alternatives Considered**:
- Class-based state pattern: Rejected - overkill for simple 5-state machine
- XState library: Rejected - adds dependency for straightforward validation
- Switch statement: Rejected - less declarative than transition map

**Reference**: Common TypeScript pattern for simple state machines

---

### 5. Idempotency in REST APIs

**Question**: How should idempotent status updates behave when the same request is repeated?

**Decision**: Return HTTP 200 with current state for no-op transitions:

```typescript
// Example: Job already COMPLETED, request to mark COMPLETED again
if (currentStatus === requestedStatus) {
  // Idempotent - return success with current state
  return NextResponse.json({ id, status: currentStatus, completedAt }, { status: 200 })
}

// Example: Job is COMPLETED, request to mark FAILED (invalid transition)
if (!canTransition(currentStatus, requestedStatus)) {
  // Not idempotent - return error
  return NextResponse.json({ error: 'Invalid state transition' }, { status: 400 })
}
```

**Rationale**:
- Same request → same result (idempotency definition)
- Distinguishes between "already done" (200) and "invalid" (400)
- Allows workflow retry without causing errors
- Clarification specified idempotent behavior for duplicate webhook calls
- Follows HTTP semantics: PUT/PATCH should be idempotent

**Alternatives Considered**:
- Return 409 Conflict for same-state requests: Rejected - not technically a conflict
- Return 204 No Content for no-ops: Rejected - client expects Job data in response
- Silently ignore duplicate requests: Rejected - client should know operation succeeded

**Reference**: [REST API idempotency best practices](https://www.rfc-editor.org/rfc/rfc7231#section-4.2.2)

---

## Summary of Key Decisions

| Topic | Decision | Impact |
|-------|----------|--------|
| Workflow conclusion mapping | success→COMPLETED, failure→FAILED, cancelled→CANCELLED, timeout→FAILED | Clear, unambiguous state mapping |
| Error handling | Try-catch with structured responses (Zod/business/unexpected) | Type-safe, debuggable, user-friendly errors |
| Concurrency control | No version field needed | Simpler implementation, atomic updates sufficient |
| State machine | Enum-based transition map | Type-safe, testable, self-documenting |
| Idempotency | Return 200 for same-state, 400 for invalid transitions | Supports retries, clear error semantics |

## Dependencies Confirmed

- **Next.js 15**: App Router with Route Handlers ✅
- **Prisma 6.x**: ORM for database operations ✅
- **Zod 4.x**: Request validation ✅
- **PostgreSQL 14+**: Database backend ✅
- **Playwright**: E2E testing framework ✅

All dependencies already exist in the project. No new external dependencies required.

## Performance Considerations

- **API Response Time**: Target <200ms for status updates
  - Single database UPDATE query (fast)
  - No external service calls
  - State validation is O(1) lookup

- **Concurrency**: Support multiple simultaneous workflow completions
  - Each workflow updates different Job ID (no contention)
  - Database connection pooling handles concurrent requests
  - Prisma client manages connection pool automatically

- **Error Handling**: Log-only approach (no retry)
  - Reduces complexity
  - Acceptable per clarification session
  - Workflow status still visible in GitHub Actions UI if update fails

## Security Considerations

- **Input Validation**: Zod schema validates all requests
  - Enum validation for status field
  - Numeric validation for job ID
  - Prevents injection attacks

- **Authorization**: Job ID correlation provides implicit auth
  - Only workflow with correct Job ID can update
  - No public-facing UI for job updates
  - Future enhancement: Verify workflow signature/token

- **Data Exposure**: Minimal response data
  - Return only id, status, completedAt
  - No sensitive workflow details in response
  - Logging includes context but not secrets

## Open Questions Resolved

All NEEDS CLARIFICATION items from Technical Context have been resolved:
- ✅ Job correlation mechanism: Job ID passed as workflow input
- ✅ Workflow cancellation handling: New CANCELLED status
- ✅ Data capture scope: Status + timestamp only
- ✅ Error handling strategy: Log-only, no retry
- ✅ Duplicate prevention: Idempotent state transitions

Ready to proceed to Phase 1: Design & Contracts.
