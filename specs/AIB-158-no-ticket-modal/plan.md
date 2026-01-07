# Implementation Plan: Fix Ticket Modal Display from URL Navigation

**Branch**: `AIB-158-no-ticket-modal` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-158-no-ticket-modal/spec.md`

## Summary

Fix the `/ticket/[key]` page route redirect to include the `modal=open` URL parameter. This is a one-line bug fix where the redirect is missing the parameter required by the Board component to auto-open the ticket modal.

**Root Cause**: Line 71 of `app/ticket/[key]/page.tsx` redirects to `/projects/{projectId}/board?ticket={key}` but omits the `&modal=open` parameter that the Board component checks before opening the modal.

**Technical Approach**: Add `&modal=open` to the redirect URL string.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18
**Storage**: PostgreSQL 14+ via Prisma 6.x (no schema changes required)
**Testing**: Vitest (unit + integration), Playwright (E2E - browser-required only)
**Target Platform**: Web (Vercel deployment)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: N/A (one-line redirect change)
**Constraints**: URL parameter cleanup must occur within 100ms (already implemented in Board component)
**Scale/Scope**: Single file change affecting all direct ticket URL navigation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| TypeScript strict mode | ✅ PASS | No new code added, existing file maintains strict types |
| shadcn/ui components | ✅ N/A | No UI changes required |
| Server Components by default | ✅ PASS | `/ticket/[key]/page.tsx` is already a Server Component |
| Security (input validation) | ✅ PASS | Existing ticket key regex validation preserved |
| Testing Trophy compliance | ✅ PASS | Integration test for redirect behavior |
| No `any` types | ✅ PASS | No new types introduced |
| Prisma migrations | ✅ N/A | No database changes |

**Post-Design Re-check**: All gates remain passing. No architectural decisions or new patterns required.

## Project Structure

### Documentation (this feature)

```
specs/AIB-158-no-ticket-modal/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file
├── research.md          # Phase 0 output (minimal - simple fix)
├── data-model.md        # N/A - No data model changes
├── contracts/           # N/A - No API changes
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
app/
└── ticket/
    └── [key]/
        └── page.tsx        # FIX: Add modal=open to redirect (line 71)

components/
├── board/
│   └── board.tsx           # EXISTING: Already handles modal=open param correctly
├── search/
│   └── ticket-search.tsx   # EXISTING: Already includes modal=open correctly
└── notifications/
    └── notification-dropdown.tsx  # EXISTING: Already includes modal=open correctly

tests/
└── integration/
    └── tickets/
        └── ticket-page-redirect.test.ts  # NEW: Test redirect includes modal param
```

**Structure Decision**: Minimal change to existing Next.js App Router structure. One file modified, one test file added.

## Complexity Tracking

*No complexity violations. This is a one-line fix with minimal test coverage needed.*

## Implementation Details

### The Bug

**Location**: `app/ticket/[key]/page.tsx:71`

**Current Code**:
```typescript
redirect(`/projects/${ticket.projectId}/board?ticket=${key}`);
```

**Fixed Code**:
```typescript
redirect(`/projects/${ticket.projectId}/board?ticket=${key}&modal=open`);
```

### Why This Fix Works

1. **Board Component Logic** (`components/board/board.tsx:231-275`):
   - Checks for `searchParams.get('modal') === 'open'`
   - When found with a `ticket` param, opens the modal
   - Already handles closed tickets (AIB-156 implementation)
   - Already cleans up URL params after modal opens via `router.replace()`

2. **Consistent with Other Navigation Paths**:
   - Search component: `params.set('modal', 'open')` ✅
   - Notification dropdown: `&modal=open&tab=comments` ✅
   - Only `/ticket/[key]` redirect was missing the param

### Test Strategy

**Integration Test** (Vitest) - Preferred per Testing Trophy:
- Test that `/ticket/[key]` page returns redirect with both `ticket` and `modal=open` params
- Test redirect URL format: `/projects/{projectId}/board?ticket={key}&modal=open`
- Mock fetch for ticket API call

**Why Not E2E**:
- No browser-required features (no OAuth, drag-drop, keyboard navigation)
- Redirect behavior can be verified by checking server response
- Integration tests are 100x faster (~50ms vs ~5s)

### Files to Modify

| File | Action | Lines Changed |
|------|--------|---------------|
| `app/ticket/[key]/page.tsx` | Modify | 1 (line 71) |
| `tests/integration/tickets/ticket-page-redirect.test.ts` | Create | ~50 |

### Acceptance Criteria Mapping

| Requirement | Implementation | Test |
|-------------|----------------|------|
| FR-001: Include both ticket and modal=open in redirect | Add `&modal=open` to redirect URL | Integration test verifies redirect format |
| FR-002: Open modal when URL contains params | Already implemented in Board | Existing tests cover |
| FR-003: Support closed tickets | Already implemented (AIB-156) | Existing tests cover |
| FR-004: Clean up URL params | Already implemented in Board | Existing tests cover |
| FR-005: Search continues working | No changes to search | Existing tests cover |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Regression in redirect behavior | Very Low | Medium | Integration test covers new behavior |
| URL encoding issues | None | N/A | Simple string concatenation with alphanumeric values |
| Breaking existing modal logic | None | N/A | No changes to modal opening logic |

**Overall Risk**: Very Low - This is a minimal, targeted fix to an existing feature.
