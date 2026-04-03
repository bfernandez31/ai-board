# Research: Delete Account Flow with Stripe Cancellation

## Decision 1: Stripe Cancellation Failure Handling

- **Decision**: Log Stripe errors but do NOT block account deletion (GDPR compliance)
- **Rationale**: GDPR right-to-erasure takes priority over billing cleanup. Stripe automatically cancels subscriptions when the customer is deleted. Orphaned subscriptions are low-risk.
- **Alternatives considered**: (a) Block deletion on Stripe failure (current implementation) — rejected because it violates GDPR; (b) Retry queue — over-engineered for this use case.
- **Action**: Modify existing `deleteUserAccount()` in `lib/db/users.ts` to catch and log Stripe errors instead of re-throwing.

## Decision 2: Dialog vs AlertDialog

- **Decision**: Use Dialog component (not AlertDialog) for the confirmation modal
- **Rationale**: AlertDialog is semantically for simple yes/no confirmations. We need a text input for email confirmation, which requires Dialog's flexible content area.
- **Alternatives considered**: AlertDialog with custom content — rejected because AlertDialog auto-focuses the cancel button and doesn't semantically support form inputs.

## Decision 3: Data Counts API

- **Decision**: Create a dedicated `GET /api/account/summary` endpoint for data counts
- **Rationale**: The confirmation modal needs to display counts of projects, credentials, tokens, and subscription status. Fetching this on modal open (not cached) ensures accuracy per spec decision.
- **Alternatives considered**: (a) Reuse existing profile endpoint — doesn't include counts; (b) Inline counts in delete response — too late, user needs to see counts before confirming.

## Decision 4: Session Invalidation

- **Decision**: Use NextAuth `signOut` on the client side after successful API deletion response
- **Rationale**: The API deletes the user record (including sessions via cascade), but client cookies must be cleared. NextAuth's `signOut({ callbackUrl: '/' })` handles cookie cleanup and redirect.
- **Alternatives considered**: Server-side session invalidation only — insufficient because client-side cookies would persist.

## Decision 5: Cascade Deletion Strategy

- **Decision**: Rely on Prisma's `onDelete: Cascade` for all user-related data
- **Rationale**: All 10 models referencing User already have `onDelete: Cascade` configured in the schema. A single `prisma.user.delete()` cascades to: Account, Project (→ Tickets → Comments), ProjectMember, Session, Comment, Notification (both relations), PersonalAccessToken, PushSubscription, Subscription, UserCredential.
- **Alternatives considered**: Manual deletion in transaction — unnecessary and error-prone given existing cascade setup.

## Decision 6: Prevent Escape/Outside-Click Dismissal

- **Decision**: Set `onInteractOutside` and `onEscapeKeyDown` to `preventDefault()` on the Dialog
- **Rationale**: Spec requires the dialog not be dismissible without explicit cancel/confirm action, matching the gravity of account deletion.
