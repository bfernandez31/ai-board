# Feature Specification: Dev Login for Preview Environments (Credentials Provider)

**Feature Branch**: `AIB-311-dev-login-for`
**Created**: 2026-03-18
**Status**: Draft
**Input**: User description: "Dev Login for preview environments — add a Credentials-based login gated by DEV_LOGIN_SECRET so preview deployments on Vercel can authenticate without GitHub OAuth."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: User identity source for Credentials login — use email as the sole identifier, upsert user in database with a deterministic ID derived from email, matching existing GitHub OAuth behavior where email is the unique key
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — auth-related feature with security implications warrants conservative defaults
- **Fallback Triggered?**: No — AUTO naturally recommended CONSERVATIVE due to positive net score on security signals
- **Trade-offs**:
  1. Requires users to know both a valid email and the shared secret, adding friction but improving security
  2. Deterministic user creation means the same email always maps to the same user record, enabling consistent testing
- **Reviewer Notes**: Verify that the shared secret length minimum (32+ chars) is enforced server-side, not just documented. Confirm the Credentials provider is completely absent from the provider list when DEV_LOGIN_SECRET is unset.

---

- **Decision**: Client-side visibility of Dev Login form — use a separate public environment variable (`NEXT_PUBLIC_DEV_LOGIN=true`) to control whether the form renders, keeping the actual secret server-side only
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — prevents accidental secret leakage to client bundle
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Requires two env vars instead of one, but cleanly separates "show the form" (public) from "validate credentials" (server-side secret)
  2. If `NEXT_PUBLIC_DEV_LOGIN` is set but `DEV_LOGIN_SECRET` is not, the form renders but login always fails — acceptable safe failure mode
- **Reviewer Notes**: Ensure `DEV_LOGIN_SECRET` is never exposed to the client. The public flag only controls UI visibility.

---

- **Decision**: User display name for Credentials-created users — derive from email prefix (part before @) since no OAuth profile is available
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — low-risk default that provides reasonable display names for dev/test purposes
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Display names like "john.doe" are less polished than full names from OAuth profiles
  2. Sufficient for preview testing purposes where polish is not a priority
- **Reviewer Notes**: No action needed — this only affects preview environment users.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dev Login on Preview Environment (Priority: P1)

A developer or QA tester opens a Vercel preview deployment and needs to sign in. GitHub OAuth is unavailable because the preview URL is not registered as a callback URL. The tester sees a "Dev Login" form on the signin page, enters their email and the shared secret, and is authenticated with a fully functional session.

**Why this priority**: This is the core purpose of the feature — without it, preview environments are untestable.

**Independent Test**: Can be fully tested by deploying to a preview environment with `DEV_LOGIN_SECRET` and `NEXT_PUBLIC_DEV_LOGIN` set, entering valid credentials, and verifying redirect to `/projects` with a working session.

**Acceptance Scenarios**:

1. **Given** a preview environment with `DEV_LOGIN_SECRET` and `NEXT_PUBLIC_DEV_LOGIN=true` configured, **When** a user navigates to the signin page, **Then** both the GitHub OAuth button and a "Dev Login" form (email + secret fields) are visible.
2. **Given** the Dev Login form is visible, **When** a user enters a valid email and the correct secret and submits, **Then** a session is created, the user is redirected to `/projects`, and the user has full access to all features (projects, tickets, workflows).
3. **Given** the Dev Login form is visible, **When** a user enters an email that does not yet exist in the database and the correct secret, **Then** a new user record is created (upserted) and the session is fully functional.

---

### User Story 2 - Invalid Credentials Rejection (Priority: P1)

A user attempts to sign in via Dev Login with an incorrect secret. The system rejects the authentication and displays an error message without creating a session.

**Why this priority**: Security is co-equal with functionality — invalid credentials must never grant access.

**Independent Test**: Can be tested by submitting the Dev Login form with an incorrect secret and verifying no session is created and an error is displayed.

**Acceptance Scenarios**:

1. **Given** the Dev Login form is visible, **When** a user enters a valid email but an incorrect secret and submits, **Then** no session is created and an error message is displayed.
2. **Given** the Dev Login form is visible, **When** a user submits with an empty email or empty secret, **Then** the form validates client-side and prevents submission.

---

### User Story 3 - Production Environment Unchanged (Priority: P1)

In production (or any environment without `DEV_LOGIN_SECRET`), the signin page shows only the existing GitHub OAuth button. The Credentials provider is not registered in the auth configuration at all.

**Why this priority**: This is a non-negotiable security requirement — the dev login must never be available in production.

**Independent Test**: Can be tested by verifying the signin page without `NEXT_PUBLIC_DEV_LOGIN` set shows only GitHub OAuth, and by verifying the NextAuth providers list does not include Credentials when `DEV_LOGIN_SECRET` is unset.

**Acceptance Scenarios**:

1. **Given** an environment where `DEV_LOGIN_SECRET` is not set, **When** a user navigates to the signin page, **Then** only the GitHub OAuth button is visible (no Dev Login form).
2. **Given** an environment where `DEV_LOGIN_SECRET` is not set, **When** the auth configuration is initialized, **Then** the Credentials provider is not included in the providers array.

---

### Edge Cases

- What happens when `NEXT_PUBLIC_DEV_LOGIN=true` is set but `DEV_LOGIN_SECRET` is not? The form renders but all login attempts fail with an error — safe failure mode.
- What happens when the same email is used via both GitHub OAuth and Dev Login? The user record is shared (upserted by email), so the same account is accessed regardless of auth method.
- What happens when an email is entered with different casing? Email comparison should be case-insensitive to prevent duplicate user records.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST add a Credentials-based authentication provider that is only registered when the `DEV_LOGIN_SECRET` environment variable is set.
- **FR-002**: System MUST display a "Dev Login" form with email and secret input fields on the signin page when the `NEXT_PUBLIC_DEV_LOGIN` environment variable is set to `true`.
- **FR-003**: System MUST validate the submitted secret against the `DEV_LOGIN_SECRET` environment variable server-side using a timing-safe comparison.
- **FR-004**: System MUST upsert the user in the database upon successful Credentials authentication, creating a new user record if one does not exist for the given email.
- **FR-005**: System MUST create a fully functional session after successful Credentials login, granting the same access level as GitHub OAuth login (projects, tickets, workflows).
- **FR-006**: System MUST redirect the user to `/projects` (or the original callback URL) after successful Credentials login.
- **FR-007**: System MUST display an error message when authentication fails due to an incorrect secret.
- **FR-008**: System MUST NOT expose the `DEV_LOGIN_SECRET` value to the client-side bundle under any circumstances.
- **FR-009**: System MUST NOT register the Credentials provider when `DEV_LOGIN_SECRET` is not set, ensuring production environments are unaffected.
- **FR-010**: System MUST treat email addresses as case-insensitive to prevent duplicate user records.

### Key Entities *(include if feature involves data)*

- **User**: Existing entity — Dev Login upserts users by email, creating records with a deterministic ID, display name derived from email prefix, and no linked OAuth account.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can sign in via Dev Login on a preview environment and reach the projects page within 5 seconds of form submission.
- **SC-002**: 100% of login attempts with an incorrect secret are rejected without creating a session.
- **SC-003**: Users authenticated via Dev Login can perform all actions available to GitHub OAuth users (create projects, manage tickets, trigger workflows).
- **SC-004**: The signin page in production environments shows zero visual or functional differences from the current behavior.
- **SC-005**: All existing automated tests continue to pass without modification.
- **SC-006**: Type-check and lint pass with zero new errors or warnings.

## Assumptions

- The shared secret is distributed to authorized testers out-of-band (e.g., via team password manager or Vercel environment settings). Secret distribution is outside the scope of this feature.
- Preview environments share the same database as production, so user records created via Dev Login are visible in production. This is intentional for end-to-end workflow testing.
- The `NEXT_PUBLIC_DEV_LOGIN` flag is acceptable as a public env var because it only controls UI visibility, not security. Security is enforced by the server-side `DEV_LOGIN_SECRET` validation.
