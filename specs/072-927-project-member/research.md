# Research: Project Member Authorization

**Feature**: Project Member Authorization
**Branch**: `072-927-project-member`
**Date**: 2025-10-29

## Overview

This document captures research decisions for implementing project member authorization. Since the feature specification used AUTO → CONSERVATIVE clarification policy, most architectural decisions were resolved during specification. This research document consolidates those findings and adds implementation-specific guidance.

## Research Questions Resolved

### 1. Authorization Pattern: Owner-Only vs Owner-OR-Member

**Decision**: Implement "owner OR member" access pattern for project-scoped resources

**Rationale**:
- Existing codebase uses `verifyProjectOwnership()` and `verifyTicketOwnership()` helpers
- These functions check `Project.userId` against session user ID
- ProjectMember schema already exists with proper foreign keys and indexes
- Prisma supports efficient joins for membership validation

**Alternatives Considered**:
1. **Role-Based Access Control (RBAC)**: Rejected for initial iteration
   - More complex implementation (action-level permissions)
   - ProjectMember.role field exists but unused (future enhancement)
   - Spec decision: Defer granular permissions to later iteration

2. **Middleware-based authorization**: Rejected
   - Next.js App Router doesn't support route middleware in same way as Pages Router
   - Per-route authorization via helper functions is more explicit and testable
   - Constitution Principle II: Follow Next.js conventions

**Implementation Approach**:
- Create new helper functions: `verifyProjectAccess()` and `verifyTicketAccess()`
- These replace `verifyProjectOwnership()` and `verifyTicketOwnership()`
- Check ownership first (performance optimization), then membership
- Return project/ticket data on success, throw on failure

### 2. Database Query Performance for Membership Validation

**Decision**: Use Prisma joins with existing indexes for membership checks

**Rationale**:
- ProjectMember has indexes on `projectId` and `userId`
- Prisma query: `project.findFirst({ where: { id, OR: [{ userId }, { members: { some: { userId } } }] } })`
- Performance target: <100ms p95 (constitution requirement)
- Indexes support efficient lookup without N+1 queries

**Best Practices Applied**:
- **Ownership first**: Check `userId` match before expensive join (optimization)
- **Single query**: Use OR condition to avoid multiple round-trips
- **Minimal select**: Only fetch fields needed by endpoint (e.g., id, name, clarificationPolicy)
- **Test performance**: Add performance assertions in E2E tests

**Alternatives Considered**:
1. **Two separate queries** (ownership check, then membership check): Rejected
   - Two database round-trips vs one
   - No performance benefit, adds complexity

2. **Caching membership in session**: Rejected
   - Session invalidation complexity
   - Stale data risk (member removed but session still valid)
   - Constitution Principle V: Database is source of truth

### 3. Error Handling: 403 Forbidden vs 404 Not Found

**Decision**:
- **API endpoints**: Return 403 Forbidden when user is not owner/member
- **SSR pages**: Return 404 Not Found (don't reveal project existence)

**Rationale**:
- Consistent with existing authorization behavior
- API clients expect 403 for permission denied
- SSR pages should not leak information about project existence to non-members
- Matches current `verifyProjectOwnership()` pattern

**Best Practices Applied**:
- API routes: `if (!project) { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }`
- SSR pages: `if (!project) { notFound(); }` (Next.js helper returns 404)
- Never expose project details in error messages to non-members

### 4. Test Strategy for 22 API Endpoints

**Decision**: Hybrid testing with Vitest (unit) + Playwright (integration/E2E)

**Rationale**:
- Constitution Principle III mandates hybrid testing
- Pure authorization logic: Vitest unit tests (~1ms per test)
- API contracts: Playwright API tests (~500ms per test)
- Critical user flows: Playwright E2E tests (board access, ticket CRUD)

**Test Coverage Plan**:
1. **Unit tests** (`tests/unit/auth-helpers.test.ts`):
   - `verifyProjectAccess()` returns project when user is owner
   - `verifyProjectAccess()` returns project when user is member
   - `verifyProjectAccess()` throws when user is neither owner nor member
   - `verifyTicketAccess()` validates via parent project membership

2. **API contract tests** (`tests/api/project-member-auth.spec.ts`):
   - All 22 endpoints accept owner requests (backward compatibility)
   - All 22 endpoints accept member requests (new functionality)
   - All 22 endpoints reject non-member requests (403/404)
   - Member management endpoint rejects member requests (owner-only)

3. **E2E tests**:
   - Member accesses board page (no 404/403 error)
   - Member creates ticket via UI
   - Member transitions ticket stage
   - Member posts comment

**Test Data Pattern**:
- Use existing test projects (Project ID 1, 2)
- Create test users: owner (`test@e2e.local`) and member (`member@e2e.local`)
- Add ProjectMember record in test setup
- Clean up in `beforeEach` hook

### 5. Backward Compatibility with Existing API Clients

**Decision**: Maintain full backward compatibility - owners retain all existing access

**Rationale**:
- No breaking changes to auth flow
- Existing `verifyProjectOwnership()` calls replaced with `verifyProjectAccess()`
- Function signature unchanged: `async function verifyProjectAccess(projectId: number)`
- Owners continue to work exactly as before, members are additive

**Migration Strategy**:
1. Create new helper functions (`verifyProjectAccess`, `verifyTicketAccess`)
2. Update all API routes to use new helpers (search-and-replace)
3. Update SSR page to use new helper
4. Deprecate old helpers (add deprecation comments)
5. Remove old helpers in future release after confirming no usage

## Technology Stack Confirmation

**Authorization Layer**:
- NextAuth 5.0-beta: Session management (no changes needed)
- Prisma 6.17: Database queries with joins
- Zod 4.1: Input validation schemas (no changes needed)

**Testing Stack**:
- Vitest 4.0: Unit tests for auth helpers
- Playwright 1.48: API contract tests and E2E tests
- Test utilities: `tests/helpers/db-setup.ts`, `tests/helpers/db-cleanup.ts`

**No Additional Dependencies Required**: All necessary libraries already in package.json

## Implementation Risks & Mitigations

### Risk 1: Performance Regression on Authorization Queries

**Mitigation**:
- Use existing indexes on ProjectMember (projectId, userId)
- Optimize query: Check ownership before membership (short-circuit for owners)
- Add performance assertions in tests (<100ms p95 target)
- Monitor production query performance via Prisma logging

### Risk 2: Test Suite Execution Time Increase

**Mitigation**:
- Use Vitest for fast unit tests of pure auth logic (~1ms per test)
- Only use Playwright for integration/E2E scenarios (~500ms per test)
- Run unit tests in watch mode during development (instant feedback)
- Parallelize Playwright tests (default Playwright behavior)

### Risk 3: Authorization Bypass (Security)

**Mitigation**:
- Constitution Principle IV: Security-first design
- Test all 22 endpoints for both owner and member access
- Test rejection of non-member access (negative test cases)
- Code review authorization helper changes
- E2E tests validate end-to-end security (no bypasses via UI)

## Next Steps (Phase 1)

1. Generate `data-model.md` - Document ProjectMember entity relationships
2. Generate `contracts/` - API contract specifications for affected endpoints
3. Generate `quickstart.md` - Developer guide for implementing member authorization
4. Update `CLAUDE.md` - Add member authorization patterns to agent context

## References

- Feature Specification: `specs/072-927-project-member/spec.md`
- Constitution: `.specify/memory/constitution.md`
- Existing Auth Helpers: `lib/db/auth-helpers.ts`
- Prisma Schema: `prisma/schema.prisma` (ProjectMember model)
- Test Helpers: `tests/helpers/db-setup.ts`
