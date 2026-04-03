# Quickstart: Delete Account Implementation

## Overview

Add a "Delete my account" flow to the profile settings page. Users confirm by typing their email, the system cancels any Stripe subscription, cascade-deletes all data, and signs the user out.

## Files to Create

| File | Purpose |
|------|---------|
| `app/api/account/route.ts` | DELETE endpoint — calls deleteUserAccount() |
| `app/api/account/summary/route.ts` | GET endpoint — returns data counts for modal |
| `components/settings/delete-account-dialog.tsx` | Confirmation modal with email input |
| `components/settings/danger-zone.tsx` | Danger zone section for profile page |

## Files to Modify

| File | Change |
|------|--------|
| `lib/db/users.ts` | Fix `deleteUserAccount()` — catch Stripe errors instead of throwing |
| `app/settings/profile/page.tsx` | Add DangerZone component at bottom |

## Implementation Order

1. Fix `deleteUserAccount()` in `lib/db/users.ts` (Stripe error handling)
2. Create `GET /api/account/summary` route
3. Create `DELETE /api/account` route
4. Create `DeleteAccountDialog` component
5. Create `DangerZone` component
6. Integrate into profile page
7. Write tests

## Testing Strategy

| Test | Type | Location |
|------|------|----------|
| deleteUserAccount with/without subscription | Unit | `tests/unit/lib/delete-account.test.ts` |
| DELETE /api/account endpoint | Integration | `tests/integration/account/delete-account.test.ts` |
| GET /api/account/summary endpoint | Integration | `tests/integration/account/account-summary.test.ts` |
| DeleteAccountDialog interactions | Component | `tests/unit/components/delete-account-dialog.test.tsx` |
| DangerZone rendering | Component | `tests/unit/components/danger-zone.test.tsx` |
