# Quick Implementation: [Compliance] Fix 1 violation - Error Handling

**Feature Branch**: `AIB-532-compliance-fix-1`
**Created**: 2026-04-04
**Mode**: Quick Implementation (bypassing formal specification)

## Description

[Compliance] Fix 1 violation - Error Handling

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

**Problem**: `deleteUserAccount()` in `lib/db/users.ts` silently swallowed Stripe subscription cancellation errors, violating constitution principle "External call failures MUST be propagated to the caller".

**Fix**: After completing GDPR-required user deletion, propagate Stripe failure via new `StripeCleanupError` (with original error as `cause`). User deletion still happens first to satisfy right-to-erasure.

**Files changed**:
- `lib/db/users.ts` — Added `StripeCleanupError` class; refactored error flow to propagate after deletion
- `tests/unit/lib/delete-account.test.ts` — Updated tests to verify error propagation; fixed missing `status` field in subscription mocks
