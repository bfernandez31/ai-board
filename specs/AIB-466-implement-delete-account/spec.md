# Feature Specification: Delete Account Flow with Stripe Cancellation

**Feature Branch**: `AIB-466-implement-delete-account`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User description: "Implement delete account flow with Stripe cancellation — GDPR requirement with UI on profile page and API endpoint"

## Auto-Resolved Decisions

- **Decision**: Stripe cancellation failure should log the error but NOT block account deletion
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score 12) — all signals align on compliance/security sensitivity
- **Fallback Triggered?**: No — AUTO resolved to CONSERVATIVE with high confidence
- **Trade-offs**:
  1. Users will always be able to delete their account even if Stripe API is temporarily unavailable, satisfying GDPR right-to-erasure
  2. Minor risk of orphaned Stripe subscriptions requiring manual cleanup; mitigated by Stripe's own cancellation-on-customer-delete behavior
- **Reviewer Notes**: Verify that the existing `deleteUserAccount()` error handling is updated — current implementation throws on Stripe failure, which contradicts this decision

---

- **Decision**: Use Dialog component (not AlertDialog) for the confirmation modal to support the email input field
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — AlertDialog is semantically for simple confirmations; Dialog supports arbitrary form content including text inputs
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Dialog provides the flexibility needed for the email confirmation input
  2. Slightly more implementation work than a simple AlertDialog, but necessary for the confirmation pattern
- **Reviewer Notes**: Ensure the dialog is not dismissible by clicking outside or pressing Escape without confirmation

---

- **Decision**: Display actual counts of user data (projects, tickets, credentials, tokens) in the confirmation modal rather than generic text
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — GDPR transparency principle requires users understand what data will be deleted
- **Trade-offs**:
  1. Requires an additional data-fetching step to gather counts before displaying the modal
  2. Provides better user transparency and reduces accidental deletions
- **Reviewer Notes**: Counts should be fetched when the modal opens, not cached

---

- **Decision**: Redirect to the landing page (not login page) after successful account deletion
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the user no longer has an account, so redirecting to login would be confusing
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clean user experience — user sees the public-facing page after account removal
  2. No ambiguity about whether the account still exists
- **Reviewer Notes**: Ensure session cookies are fully cleared before redirect

## User Scenarios & Testing

### User Story 1 — Delete Account with Active Subscription (Priority: P1)

A user with an active paid subscription (Pro or Team) wants to permanently delete their account and all associated data. They navigate to their profile settings, find the danger zone, and initiate the deletion process. The system cancels their Stripe subscription, removes all data, and signs them out.

**Why this priority**: Core GDPR compliance requirement — users with paid subscriptions represent the most complex deletion path involving billing cancellation.

**Independent Test**: Can be fully tested by creating a user with an active subscription, triggering deletion, and verifying subscription cancellation + data removal + session invalidation.

**Acceptance Scenarios**:

1. **Given** a user with an active Pro subscription is on the profile settings page, **When** they click "Delete my account", **Then** a confirmation modal appears showing counts of their data (projects, credentials, subscription status, tokens) and a warning that deletion is permanent.

2. **Given** the confirmation modal is open, **When** the user types their email address correctly and clicks "Delete permanently", **Then** the system cancels the Stripe subscription, deletes all user data, invalidates the session, and redirects to the landing page.

3. **Given** the confirmation modal is open, **When** the user types an email that does not match their account email, **Then** the "Delete permanently" button remains disabled.

4. **Given** a user initiates deletion and the Stripe API is temporarily unavailable, **When** the subscription cancellation fails, **Then** the system logs the error and proceeds with account deletion anyway (GDPR compliance takes priority).

---

### User Story 2 — Delete Account without Subscription (Priority: P1)

A user on the free plan wants to delete their account. The flow is the same but skips the Stripe cancellation step entirely.

**Why this priority**: Equal priority to P1 — free users have the same GDPR rights and this is the simpler but equally critical path.

**Independent Test**: Can be tested by creating a free-tier user with projects and data, triggering deletion, and verifying all data is removed without any Stripe interaction.

**Acceptance Scenarios**:

1. **Given** a user on the free plan with 3 projects is on the profile settings page, **When** they click "Delete my account", **Then** the confirmation modal shows the count of projects and other data, and does NOT mention subscription cancellation.

2. **Given** the user confirms deletion by typing their email, **When** they click "Delete permanently", **Then** all user data (projects, tickets, credentials, tokens, notifications) is removed, the session is invalidated, and the user is redirected to the landing page.

---

### User Story 3 — Cancel Deletion (Priority: P2)

A user opens the deletion confirmation modal but decides not to proceed. They should be able to safely exit without any changes.

**Why this priority**: Important safety net to prevent accidental deletions, but secondary to the core deletion flow.

**Independent Test**: Can be tested by opening the modal, verifying no changes occur on cancel, and confirming the user remains on the profile page.

**Acceptance Scenarios**:

1. **Given** the confirmation modal is open, **When** the user clicks "Cancel" or closes the modal, **Then** no data is deleted, no subscription is cancelled, and the user remains on the profile page.

2. **Given** the confirmation modal is open with partial email typed, **When** the user cancels, **Then** the modal closes and the partial input is cleared for next opening.

---

### Edge Cases

- What happens when a user who is a project owner with team members deletes their account? All projects and memberships are cascade-deleted; members lose access immediately.
- What happens when a user has running jobs at the time of deletion? Jobs will fail gracefully because the parent project no longer exists.
- What happens when the user's session has expired before they click "Delete permanently"? The API returns an authentication error and the user is redirected to sign in (deletion does not proceed).
- What happens if the user double-clicks the delete button? The UI should disable the button immediately after the first click to prevent duplicate requests.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a "Danger Zone" section at the bottom of the profile settings page with a clearly labeled "Delete my account" button.
- **FR-002**: System MUST show a confirmation modal when the user clicks the delete button, displaying counts of data that will be deleted (projects, AI credentials, active subscription if any, personal access tokens).
- **FR-003**: System MUST require the user to type their exact email address in a text input to confirm deletion. The "Delete permanently" button MUST remain disabled until the input matches.
- **FR-004**: System MUST cancel any active Stripe subscription before deleting the user's account data.
- **FR-005**: If Stripe subscription cancellation fails, the system MUST log the error and proceed with account deletion (not block the user).
- **FR-006**: System MUST delete all user data including projects, tickets, comments, AI credentials, personal access tokens, notifications, push subscriptions, sessions, and subscription records.
- **FR-007**: System MUST invalidate the user's session (clear authentication cookies) after successful deletion.
- **FR-008**: System MUST redirect the user to the landing page after successful account deletion.
- **FR-009**: System MUST require authentication — only the authenticated user can delete their own account.
- **FR-010**: The "Delete permanently" button MUST be visually styled as a destructive action (red/danger styling).
- **FR-011**: The "Delete permanently" button MUST be disabled during the deletion process to prevent duplicate submissions.
- **FR-012**: The confirmation modal MUST dynamically show subscription status — mentioning cancellation only when the user has an active subscription.

### Key Entities

- **User Account**: The central entity being deleted. All related data cascades from this entity.
- **Stripe Subscription**: External billing relationship that must be cancelled before local data removal. May or may not exist depending on the user's plan.
- **User Session**: Authentication state that must be invalidated after deletion to prevent access with stale credentials.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can complete the full account deletion flow (from clicking "Delete my account" to landing page redirect) in under 30 seconds.
- **SC-002**: 100% of user data is removed from the system after account deletion — no orphaned records remain across any data store.
- **SC-003**: Active subscriptions are cancelled at the billing provider before or during account deletion in 99%+ of cases (with graceful handling of the remaining edge cases).
- **SC-004**: Users cannot access any authenticated pages after account deletion — all sessions are fully invalidated.
- **SC-005**: The deletion flow works identically for users with and without active paid subscriptions (minus the subscription-specific confirmation text).
- **SC-006**: Zero accidental deletions — the email confirmation step prevents unintended account removal.
