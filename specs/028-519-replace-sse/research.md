# Research: Replace SSE with Client-Side Polling

**Feature**: 028-519-replace-sse
**Date**: 2025-10-14
**Status**: Complete (all unknowns resolved via /clarify session)

## Research Scope

This document consolidates all technical decisions made during the `/clarify` session (2025-10-14) that resolved ambiguities in the feature specification. No additional research was required since all critical questions were answered through structured clarification.

---

## Decision 1: Polling Interval

**Question**: How frequently should the client poll for job status updates?

**Decision**: **2 seconds** (aggressive, ~30 requests/minute)

**Rationale**:
- Matches user expectation for "real-time" updates
- Balances responsiveness with server load
- Vercel serverless functions handle this frequency well (<100ms response time)
- Typical board has <50 jobs, query is fast with proper indexing

**Alternatives Considered**:
1. **5 seconds**: Too slow for "real-time" feel, users notice delay
2. **10 seconds**: Unacceptable delay, defeats purpose of real-time updates
3. **1 second**: Excessive server load, unnecessary for typical workflow duration

**Implementation Impact**:
- `setInterval(pollFunction, 2000)` in `useJobPolling` hook
- Server must handle ~30 requests/min per active user
- Database query must be optimized for sub-100ms response

---

## Decision 2: Terminal State Optimization

**Question**: Should the system stop polling for jobs that have reached terminal states?

**Decision**: **Yes** - Stop polling jobs in COMPLETED, FAILED, or CANCELLED states

**Rationale**:
- Terminal states never change (immutable)
- Reduces server load (fewer jobs to query per poll)
- Reduces network traffic (smaller response payloads)
- Client-side tracking of terminal job IDs is simple (Set data structure)

**Alternatives Considered**:
1. **Continue polling all jobs**: Wasteful, no benefit, scales poorly
2. **Server-side filtering**: Adds state management complexity, violates stateless API principle

**Implementation Impact**:
- Client maintains `Set<number>` of terminal job IDs
- Exclude terminal jobs from next poll (client-side filter before rendering)
- Stop polling entirely when all jobs terminal (optimization)

---

## Decision 3: Error Retry Strategy

**Question**: When a polling request fails, what retry strategy should be used?

**Decision**: **Fixed 2-second interval** (no exponential backoff, no retry limits)

**Rationale**:
- **Simplicity**: Matches polling interval, no additional complexity
- **Network errors are transient**: Typical cause is momentary connectivity loss
- **No retry limits**: Maintains real-time guarantee, user expects updates when network recovers
- **No exponential backoff**: Over-engineered for this use case, introduces state management

**Alternatives Considered**:
1. **Exponential backoff**: Too complex, not needed for transient network errors
2. **Stop after N failures**: Breaks real-time guarantee, poor UX when network recovers
3. **Increase interval on error**: Complicates state, delays recovery when network stabilizes

**Implementation Impact**:
- Single `setInterval` handles both success and error cases
- Catch API errors, log for debugging, retry on next interval
- Optional: Track consecutive errors for informational purposes (not behavior-changing)

---

## Decision 4: Polling Scope

**Question**: Should the system poll for all project jobs in a single request, or poll for individual ticket jobs separately?

**Decision**: **Single request for all project jobs** (project-wide aggregation)

**Rationale**:
- **Efficiency**: 1 HTTP request instead of N requests (where N = number of tickets)
- **Server load**: 1 database query instead of N queries
- **Network overhead**: Single TCP connection, smaller cumulative payload
- **Database optimization**: Single indexed query on `projectId` is fast

**Alternatives Considered**:
1. **Per-ticket polling**: N requests per interval, wasteful, scales poorly
2. **Batch polling with ticket IDs**: Complicates client state, no benefit over project-wide

**Implementation Impact**:
- API endpoint: `GET /api/projects/[projectId]/jobs/status`
- Returns all jobs for project (typical board has <50 jobs, response <10KB)
- Client filters response to relevant tickets (fast client-side operation)

---

## Decision 5: Polling Lifecycle

**Question**: When should polling start and stop?

**Decision**: **Start on component mount, stop on component unmount OR when all jobs terminal**

**Rationale**:
- **Automatic cleanup**: Component unmount clears interval (no memory leaks)
- **Optimal resource usage**: Stop when no active jobs remain (no wasted polls)
- **Simplicity**: No tab visibility logic, no pause/resume complexity
- **User expectation**: Polling continues if user switches tabs (maintains updates)

**Alternatives Considered**:
1. **Pause on tab blur**: Added complexity, unclear UX benefit, complicates state
2. **Continue polling terminal jobs**: Wasteful (see Decision 2)
3. **Manual start/stop**: Requires user action, poor UX, violates real-time guarantee

**Implementation Impact**:
- `useEffect` hook starts polling on mount
- Cleanup function stops polling on unmount (`clearInterval`)
- Conditional logic stops polling when `terminalJobIds.size === totalJobCount`

---

## Technology Best Practices

### React Polling Pattern

**Pattern**: `useEffect` + `setInterval` + cleanup function

```typescript
useEffect(() => {
  const intervalId = setInterval(pollFunction, 2000);
  return () => clearInterval(intervalId); // Cleanup on unmount
}, [dependencies]);
```

**Key Considerations**:
- Use `useRef` for interval ID to prevent stale closures
- Include all dependencies in dependency array (pollFunction, projectId)
- Track terminal job IDs in state (`Set<number>` for efficient lookup)
- Conditional polling: Check if all jobs terminal before each poll

**Sources**: React documentation (useEffect), established polling patterns in React ecosystem

---

### Next.js API Route Pattern (App Router)

**Pattern**: GET endpoint with Zod validation and session auth

**Endpoint**: `GET /api/projects/[projectId]/jobs/status`

**Request**:
- Path params: `projectId` (extracted from URL)
- Headers: Cookie (NextAuth.js session, validated)
- Query params: None (client filters terminal jobs)

**Response**:
```typescript
{
  jobs: Array<{
    id: number;
    status: JobStatus;
    ticketId: number;
    updatedAt: string; // ISO 8601
  }>;
}
```

**Validation**:
- Zod schema for response structure
- Session validation (NextAuth.js `getServerSession`)
- Project ownership check (userId from session matches project.userId)

**Sources**: Next.js 15 App Router documentation, Zod validation patterns, NextAuth.js best practices

---

### Performance Optimization

**Database Indexing**:
- Existing index on `projectId` (for job queries)
- Consider composite index: `(projectId, status)` if query slow
- Query excludes terminal jobs? No - client filters (server stateless)

**Client-Side Optimization**:
- React.memo for TicketCard component (prevent unnecessary re-renders)
- Terminal job IDs in Set (O(1) lookup for exclusion check)
- Conditional polling (stop when no active jobs)

**Network Optimization**:
- Single request per poll (not per-ticket)
- Small response payload (~10KB for 50 jobs)
- HTTP/2 connection reuse (automatic with fetch API)

**Sources**: Prisma indexing documentation, React performance optimization patterns

---

## Implementation References

### Similar Patterns in Codebase

**Existing polling-like behavior**: None (currently uses SSE push model)

**Existing API route patterns**:
- `/api/projects/[projectId]/tickets/route.ts` (GET all tickets)
- `/api/jobs/[id]/status/route.ts` (PATCH single job status)

**New pattern to introduce**: Polling hook (`useJobPolling`) following React hook conventions

---

### External References

1. **React Polling Pattern**: https://react.dev/reference/react/useEffect (cleanup functions)
2. **Next.js App Router**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
3. **Zod Validation**: https://zod.dev/ (schema validation)
4. **Prisma Performance**: https://www.prisma.io/docs/concepts/components/prisma-client/queries (indexing, query optimization)

---

## Risk Assessment

### Low Risk
- ✅ No schema changes (uses existing Job model)
- ✅ No breaking API changes (new endpoint, existing endpoints unchanged)
- ✅ Polling pattern is well-established in React
- ✅ All unknowns resolved via /clarify session

### Medium Risk
- ⚠️ **Server load**: 30 requests/min per active user (mitigated by fast queries, indexed DB)
- ⚠️ **Network usage**: More requests than SSE (acceptable tradeoff for Vercel compatibility)

### Mitigation Strategies
- Database indexing (projectId)
- Response size optimization (minimal fields)
- Client-side terminal state filtering (reduces query size over time)
- Conditional polling (stop when no active jobs)

---

## Conclusion

All technical unknowns were resolved through the `/clarify` session (2025-10-14). The chosen approach (2-second polling, terminal state optimization, single project-wide request) balances real-time user experience with server efficiency. Implementation follows established React and Next.js patterns with no constitutional violations.

**Ready for Phase 1**: Design & Contracts
