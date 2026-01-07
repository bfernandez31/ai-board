# Research: Fix Ticket Modal Display from URL Navigation

**Feature**: AIB-158 | **Date**: 2026-01-07

## Summary

This is a simple bug fix requiring minimal research. The issue is clearly identified as a missing URL parameter in the redirect logic.

## Findings

### 1. Root Cause Identified

**Decision**: The bug is a missing `modal=open` parameter in `/ticket/[key]/page.tsx` line 71

**Rationale**:
- The Board component at `components/board/board.tsx:234` explicitly checks for `searchParams.get('modal') === 'open'`
- Without this parameter, the modal opening logic short-circuits and returns early
- The search component and notification dropdown both correctly include this parameter

**Alternatives considered**: None - this is a clear regression where one navigation path was implemented incorrectly.

### 2. Existing Patterns Verified

**Decision**: Follow existing URL parameter patterns already used in the codebase

**Rationale**:
- Search component (`components/search/ticket-search.tsx:51`): `params.set('modal', 'open')`
- Notification dropdown (`app/components/notifications/notification-dropdown.tsx:50,105`): `&modal=open&tab=comments`
- Both paths work correctly, only the `/ticket/[key]` redirect was implemented without the parameter

**Alternatives considered**: None - consistency with existing patterns is required.

### 3. Testing Approach

**Decision**: Use Vitest integration test, not Playwright E2E

**Rationale**:
- Per Testing Trophy (Constitution Section III): "API tests use Vitest, NOT Playwright - 10-20x faster execution"
- The redirect behavior can be tested by examining the server response
- No browser-required features (no OAuth, drag-drop, viewport testing)

**Alternatives considered**:
- E2E test was rejected due to slower execution (~5s vs ~50ms) and constitution requirements

## Research Questions Resolved

| Question | Answer |
|----------|--------|
| Why doesn't the modal open? | Missing `modal=open` URL parameter in redirect |
| Where is the modal opening logic? | `components/board/board.tsx:231-275` |
| What triggers modal open? | `searchParams.get('modal') === 'open' && ticketKey` |
| Are closed tickets supported? | Yes, AIB-156 added pendingTicketKey pattern |
| What cleans up URL params? | `router.replace(pathname)` after modal opens |

## No Clarifications Needed

This fix requires no design decisions or clarifications. The implementation is straightforward:
1. Add `&modal=open` to the redirect URL
2. Add integration test to prevent regression

## Dependencies

None - this fix uses only existing Next.js `redirect()` function and URL string concatenation.
