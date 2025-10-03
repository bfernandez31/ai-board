# Research: Refactor Routes and APIs to Require Project Context

**Feature**: 011-refactor-routes-and
**Date**: 2025-10-03
**Status**: Complete

## Overview
This document consolidates research findings for implementing project-scoped routes and APIs in the ai-board Next.js 15 application.

## Technical Decisions

### 1. Next.js 15 Dynamic Route Segments

**Decision**: Use Next.js App Router dynamic segments `[projectId]` for route parameterization

**Rationale**:
- Next.js 15 App Router provides first-class support for dynamic segments
- Type-safe access to route parameters via `context.params`
- Built-in URL pattern matching and validation
- SEO-friendly URLs with explicit resource hierarchy

**Implementation Pattern**:
```typescript
// Route: /projects/[projectId]/board
// File: app/projects/[projectId]/board/page.tsx
export default async function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const id = parseInt(projectId, 10);
  // Validate and use projectId
}
```

**Alternatives Considered**:
- Query parameters (`/board?projectId=1`) - Rejected: Not RESTful, harder to validate, poor SEO
- Server-side context/cookies - Rejected: State management complexity, not shareable URLs

**References**:
- Next.js 15 Dynamic Routes: https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes
- Next.js 15 Params Migration: https://nextjs.org/docs/messages/sync-dynamic-apis

---

### 2. Server-Side Redirects in Next.js

**Decision**: Use `redirect()` from `next/navigation` for root page redirection

**Rationale**:
- Server-side redirects are faster than client-side (no hydration delay)
- SEO-friendly (301/302 status codes)
- Works with JavaScript disabled
- Recommended Next.js pattern for route forwarding

**Implementation Pattern**:
```typescript
// app/page.tsx
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/projects/1/board');
}
```

**Alternatives Considered**:
- Client-side redirect with `useRouter()` - Rejected: Requires client component, slower, not SEO-friendly
- Middleware redirect - Rejected: Overkill for simple static redirect, complicates middleware logic

**References**:
- Next.js redirect() API: https://nextjs.org/docs/app/api-reference/functions/redirect

---

### 3. API Route Parameter Validation

**Decision**: Use Zod schema validation for projectId before database queries

**Rationale**:
- Consistent with existing validation patterns in the codebase
- Type-safe validation with TypeScript integration
- Descriptive error messages for invalid input
- Prevents SQL injection and invalid database queries

**Implementation Pattern**:
```typescript
import { z } from 'zod';

const ProjectIdSchema = z.object({
  projectId: z.string().regex(/^\d+$/, 'Project ID must be a number')
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const params = await context.params;
  const result = ProjectIdSchema.safeParse(params);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  const projectId = parseInt(result.data.projectId, 10);
  // Proceed with validated projectId
}
```

**Alternatives Considered**:
- Manual parseInt() and isNaN() checks - Rejected: Less robust, no type safety, inconsistent with codebase
- Prisma validation only - Rejected: Database errors are harder to debug than validation errors

**References**:
- Zod documentation: https://zod.dev
- Existing validation patterns: `/lib/validations/ticket.ts`

---

### 4. Project Existence Validation

**Decision**: Validate project exists before processing ticket operations

**Rationale**:
- Prevents 500 errors from foreign key violations
- Provides clear 404 responses for non-existent projects
- Security: Prevents enumeration of valid project IDs through ticket operations
- Better user experience with specific error messages

**Implementation Pattern**:
```typescript
// Check project exists before ticket operations
const project = await prisma.project.findUnique({
  where: { id: projectId }
});

if (!project) {
  return NextResponse.json(
    { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
    { status: 404 }
  );
}

// Proceed with ticket operations
```

**Alternatives Considered**:
- Rely on foreign key constraints - Rejected: Results in 500 errors, not user-friendly
- Check project existence in middleware - Rejected: Adds complexity, harder to test

**References**:
- Prisma findUnique: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#findunique

---

### 5. Cross-Project Access Prevention

**Decision**: Add `projectId` filter to all ticket WHERE clauses

**Rationale**:
- Defense in depth: Even if ticket ID is valid, must belong to project
- Prevents cross-project data leaks via URL manipulation
- Aligns with principle of least privilege
- Required for proper 403 Forbidden responses

**Implementation Pattern**:
```typescript
// Update ticket with project validation
const ticket = await prisma.ticket.update({
  where: {
    id: ticketId,
    projectId: projectId,  // Ensures ticket belongs to project
    version: requestVersion
  },
  data: { /* updates */ }
});

if (!ticket) {
  // Could be 404 (ticket doesn't exist) or 403 (wrong project)
  // Check if ticket exists at all to determine correct status
  const exists = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!exists) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

**Alternatives Considered**:
- Check project ownership after query - Rejected: Race conditions, less efficient
- Application-level access control layer - Rejected: Over-engineering for MVP

**References**:
- Prisma composite WHERE clauses: https://www.prisma.io/docs/concepts/components/prisma-client/filtering-and-sorting

---

### 6. Database Query Function Signatures

**Decision**: Update `getTicketsByStage()` and `createTicket()` to require `projectId` parameter

**Rationale**:
- Makes project context explicit at the data layer
- Impossible to forget project scoping (compile-time enforcement)
- Consistent API across all ticket operations
- Enables future optimizations (project-based caching)

**Implementation Pattern**:
```typescript
// Before:
export async function getTicketsByStage(): Promise<Record<Stage, TicketWithVersion[]>>

// After:
export async function getTicketsByStage(projectId: number): Promise<Record<Stage, TicketWithVersion[]>>

// Before:
export async function createTicket(input: CreateTicketInput)

// After:
export async function createTicket(projectId: number, input: CreateTicketInput)
```

**Alternatives Considered**:
- Optional projectId parameter - Rejected: Allows accidental omission, defeats purpose
- Global project context - Rejected: State management complexity, harder to test

**References**:
- TypeScript function signatures: https://www.typescriptlang.org/docs/handbook/2/functions.html

---

### 7. Client Component API Call Updates

**Decision**: Update API calls in client components to use project-scoped endpoints

**Rationale**:
- All API calls must use new `/api/projects/[projectId]/tickets` routes
- projectId is available from route params (passed down from page component)
- Maintains existing error handling and optimistic updates

**Implementation Pattern**:
```typescript
// In client component (e.g., new-ticket-modal.tsx)
interface NewTicketModalProps {
  projectId: number; // Passed from parent Server Component
}

export function NewTicketModal({ projectId }: NewTicketModalProps) {
  const handleSubmit = async (data: CreateTicketInput) => {
    const response = await fetch(`/api/projects/${projectId}/tickets`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Handle response
  };
}
```

**Alternatives Considered**:
- Read projectId from URL in client component - Rejected: Duplicates state, harder to test
- Context API for projectId - Rejected: Over-engineering, prop drilling is simple here

**References**:
- React props: https://react.dev/learn/passing-props-to-a-component

---

### 8. Test Migration Strategy

**Decision**: Update all existing E2E tests to use new project-scoped routes

**Rationale**:
- Ensures backward compatibility of functionality
- Existing test coverage remains intact
- New tests added for project validation scenarios
- TDD approach: Update tests first, then implementation

**Implementation Pattern**:
```typescript
// Before:
await page.goto('http://localhost:3000/board');

// After:
await page.goto('http://localhost:3000/projects/1/board');

// Before:
await page.request.post('/api/tickets', { data: ticketData });

// After:
await page.request.post('/api/projects/1/tickets', { data: ticketData });
```

**New Test Scenarios**:
1. Invalid project ID (404)
2. Non-existent project (404)
3. Ticket belongs to different project (403)
4. Root redirect to default project
5. Project validation in all endpoints

**Alternatives Considered**:
- Rewrite all tests from scratch - Rejected: Unnecessary work, loses existing coverage
- Keep old routes for backward compatibility - Rejected: Defeats purpose, technical debt

**References**:
- Playwright API testing: https://playwright.dev/docs/api-testing

---

## No Research Required

The following areas required no research as they use existing patterns:

1. **TypeScript Strict Mode**: Already configured in `tsconfig.json`
2. **Prisma Client Usage**: Existing patterns in `/lib/db/client.ts`
3. **Error Response Format**: Existing pattern `{ error: string, code?: string }`
4. **Optimistic Concurrency Control**: Existing version field pattern
5. **Server Component Props**: Standard Next.js pattern
6. **Zod Validation**: Existing schemas in `/lib/validations/ticket.ts`

---

## Edge Cases Identified

1. **Default Project Missing**: What if project ID 1 doesn't exist?
   - **Solution**: Create default project in seed script or ensure it exists before redirect

2. **Project Deletion**: What happens to tickets when project is deleted?
   - **Current**: Cascade delete (already configured in schema)
   - **No change needed**

3. **Concurrent Project Changes**: User has board open, project is deleted
   - **Solution**: Existing error handling shows 404, user must navigate away

4. **Bookmarked URLs**: User bookmarks `/board` before refactor
   - **Solution**: Old route becomes 404, acceptable for internal MVP tool

---

## Performance Considerations

1. **Additional Project Query**: Each request now validates project exists
   - **Impact**: +1 DB query per request (~5-10ms)
   - **Mitigation**: Project queries are indexed, can cache later if needed

2. **URL Parameter Parsing**: parseInt() on every request
   - **Impact**: Negligible (<1ms)
   - **No mitigation needed**

3. **Composite WHERE Clauses**: Adding projectId to ticket queries
   - **Impact**: None - index already exists on projectId
   - **No mitigation needed**

---

## Security Considerations

1. **Project ID Enumeration**: Can users guess valid project IDs?
   - **Risk**: Low - internal tool, sequential IDs acceptable for MVP
   - **Future**: Use UUIDs if exposing to external users

2. **SQL Injection**: Is projectId properly sanitized?
   - **Protected**: Zod validation + Prisma parameterized queries
   - **No additional mitigation needed**

3. **Authorization**: Who can access which projects?
   - **MVP**: No user auth yet, all projects accessible
   - **Future**: Add project membership checks when auth is implemented

---

## Migration Path

This is a breaking change to routes. Migration approach:

1. ✅ **Phase 0**: Research and design (this document)
2. ⏳ **Phase 1**: Create new project-scoped routes alongside old routes
3. ⏳ **Phase 2**: Update all internal links and API calls to new routes
4. ⏳ **Phase 3**: Update all tests to use new routes
5. ⏳ **Phase 4**: Remove old `/board` and `/api/tickets` routes
6. ⏳ **Phase 5**: Deploy and verify

**Rollback Plan**:
- If issues found, temporarily restore old routes
- New routes are additive, so rollback is low-risk

---

## Open Questions

None - all technical decisions are documented above with clear rationale.

---

## Summary

All technical unknowns have been resolved. The refactor is straightforward:
- Use Next.js dynamic segments for project scoping
- Add Zod validation for projectId parameters
- Update database queries to filter by projectId
- Migrate existing tests to new routes
- Add new tests for project validation

No new dependencies required. No database migrations needed. All existing patterns can be reused.

**Status**: ✅ Ready for Phase 1 (Design & Contracts)
