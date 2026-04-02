# Implementation Plan: Delete Account Flow with Stripe Cancellation

**Ticket**: AIB-466
**Branch**: `AIB-466-implement-delete-account`
**Spec**: `specs/AIB-466-implement-delete-account/spec.md`
**Created**: 2026-04-02

---

## Technical Context

| Aspect | Details |
|--------|---------|
| **Database** | No schema changes needed. All user-related models already have `onDelete: Cascade`. |
| **Auth** | NextAuth session-based auth. `requireAuth()` returns userId. Client-side `signOut()` clears cookies. |
| **Stripe** | Existing `deleteUserAccount()` in `lib/db/users.ts` already handles cancellation — needs error handling fix. |
| **UI Framework** | shadcn/ui Dialog component for confirmation modal. Existing delete dialog patterns in `components/tokens/` and `components/credentials/`. |
| **State** | TanStack Query v5 for data fetching. `useMutation` for delete action. |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new files in strict TypeScript with explicit types |
| II. Component-Driven | PASS | Using shadcn/ui Dialog, feature-based folder structure under `components/settings/` |
| III. Test-Driven | PASS | Unit + component + integration tests planned (see Testing section) |
| IV. Security-First | PASS | Session auth required, no sensitive data exposure, Zod validation on API |
| V. Database Integrity | PASS | No schema changes, cascade deletes via Prisma, Stripe cancellation before deletion |
| V. Spec Guardrails | PASS | Auto-resolved decisions documented with trade-offs |

---

## Phase 1: Backend — Fix deleteUserAccount & Create API Routes

### Task 1.1: Fix Stripe Error Handling in deleteUserAccount

**File**: `lib/db/users.ts` (lines 271-293)
**Change**: Modify the catch block to log the error and continue instead of re-throwing.

```typescript
// BEFORE (current - blocks deletion):
catch (error) {
  console.error("Failed to cancel Stripe subscription:", error)
  throw new Error("Failed to cancel subscription. Account deletion blocked.")
}

// AFTER (GDPR compliant - log and continue):
catch (error) {
  console.error("Failed to cancel Stripe subscription during account deletion:", error)
  // GDPR: right-to-erasure takes priority over billing cleanup
}
```

### Task 1.2: Create GET /api/account/summary

**File**: `app/api/account/summary/route.ts` (new)

Fetches counts of user data for the confirmation modal:
- `projectCount` — count of owned projects
- `credentialCount` — count of AI credentials
- `tokenCount` — count of personal access tokens
- `hasActiveSubscription` — whether user has active/trialing subscription
- `plan` — current subscription plan name

Uses `requireAuth()` for authentication. Queries Prisma `_count` aggregation.

### Task 1.3: Create DELETE /api/account

**File**: `app/api/account/route.ts` (new)

- Authenticates via `requireAuth()`
- Calls `deleteUserAccount(userId)`
- Returns `{ message: "Account deleted successfully" }` on success
- Catches errors and returns 500 with structured error response
- No request body needed (user identified by session)

---

## Phase 2: Frontend — Delete Account UI Components

### Task 2.1: Create DeleteAccountDialog Component

**File**: `components/settings/delete-account-dialog.tsx` (new)

Props:
```typescript
interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail: string
}
```

Features:
- Dialog (not AlertDialog) to support email input field
- Fetches data counts from `GET /api/account/summary` when opened
- Email confirmation input — delete button disabled until exact match
- Red/destructive styling on delete button (following existing patterns)
- Loading state during deletion (button disabled, spinner)
- Prevents dismiss on outside click and Escape key
- On success: calls `signOut({ callbackUrl: '/' })` to clear session and redirect
- On error: shows error via toast, re-enables button
- On cancel: closes dialog, clears input state

### Task 2.2: Create DangerZone Component

**File**: `components/settings/danger-zone.tsx` (new)

Props:
```typescript
interface DangerZoneProps {
  userEmail: string
}
```

Features:
- Red-bordered section with "Danger Zone" heading
- Warning text explaining the action is permanent
- "Delete my account" button that opens the DeleteAccountDialog
- Follows existing card/section patterns from the profile page

### Task 2.3: Integrate into Profile Page

**File**: `app/settings/profile/page.tsx`

Changes:
- Import and render `DangerZone` component after the existing profile grid
- Pass `profile.email` as prop
- Add visual separator before the danger zone

---

## Phase 3: Testing

### Test 3.1: Unit Test — deleteUserAccount

**File**: `tests/unit/lib/delete-account.test.ts` (new)
**Type**: Unit test (Vitest)

Test cases:
- Deletes user with active subscription (Stripe cancel succeeds)
- Deletes user with active subscription (Stripe cancel fails — should NOT throw)
- Deletes user without subscription (no Stripe call)
- Throws for non-existent user

### Test 3.2: Integration Test — DELETE /api/account

**File**: `tests/integration/account/delete-account.test.ts` (new)
**Type**: Integration test (Vitest)

Test cases:
- Returns 200 and deletes user + all related data
- Returns 401 for unauthenticated request
- Verifies cascade deletion (projects, tokens, etc. removed)

### Test 3.3: Integration Test — GET /api/account/summary

**File**: `tests/integration/account/account-summary.test.ts` (new)
**Type**: Integration test (Vitest)

Test cases:
- Returns correct counts for user with data
- Returns zeros for user with no data
- Returns 401 for unauthenticated request
- Correctly reports subscription status

### Test 3.4: Component Test — DeleteAccountDialog

**File**: `tests/unit/components/delete-account-dialog.test.tsx` (new)
**Type**: Component test (Vitest + RTL)

Test cases:
- Renders data counts when opened
- Delete button disabled when email doesn't match
- Delete button enabled when email matches (case-insensitive)
- Cancel clears input and closes dialog
- Shows loading state during deletion
- Button disabled during deletion (prevents double-click)

### Test 3.5: Component Test — DangerZone

**File**: `tests/unit/components/danger-zone.test.tsx` (new)
**Type**: Component test (Vitest + RTL)

Test cases:
- Renders danger zone with delete button
- Opens dialog when button clicked

---

## Testing Decision Tree Application

| Requirement | Decision | Test Type |
|-------------|----------|-----------|
| deleteUserAccount() logic | Pure function with DB dependency | Unit test (mock Prisma + Stripe) |
| API endpoints | API + database operations | Integration test (Vitest) |
| Dialog interactions | React component with forms | Component test (RTL) |
| Full delete flow in browser? | No browser-specific features needed | NOT E2E — integration sufficient |

---

## Implementation Order (Dependency Graph)

```
1.1 Fix deleteUserAccount()
 ↓
1.2 GET /api/account/summary ──→ 2.1 DeleteAccountDialog
 ↓                                ↓
1.3 DELETE /api/account ─────→ 2.2 DangerZone
                                  ↓
                               2.3 Profile page integration
                                  ↓
                               3.x Tests (all)
```

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Orphaned Stripe subscriptions | Stripe auto-cancels on customer deletion; logged for manual review |
| Accidental deletion | Email confirmation input + non-dismissible dialog |
| Session cookies persist after deletion | Client-side signOut() clears cookies before redirect |
| Running jobs for deleted user | Jobs fail gracefully — parent project cascade-deleted |
| Double-click on delete | Button disabled immediately on click + API idempotent (user.delete on missing user = no-op) |

---

## Artifacts Generated

- `research.md` — All decisions resolved
- `data-model.md` — Cascade chain and state transitions
- `contracts/api.md` — API endpoint contracts
- `quickstart.md` — Implementation summary and file map
- `plan.md` — This file
