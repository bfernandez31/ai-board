# Feature Specification: Dev Login for Preview Environments

**Feature Branch**: `AIB-313-dev-login-for`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: User description: "Dev Login for preview environments (Credentials provider)"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Treat preview-environment login as a security-sensitive authentication feature even though it is intended for internal testing and preview use.
- **Policy Applied**: AUTO
- **Confidence**: Low (score: +2 from sensitive auth keywords, neutral user-facing login context, and internal preview/testing context)
- **Fallback Triggered?**: Yes — AUTO fell back to CONSERVATIVE because confidence was below 0.5 and the context included conflicting signal buckets.
- **Trade-offs**:
  1. This keeps the specification strict about access control, validation, and production exclusion instead of optimizing only for speed.
  2. It may add more acceptance coverage and review scrutiny than a purely internal-tool interpretation.
- **Reviewer Notes**: Confirm that preview-only access is the intended scope and that no production deployment path can expose this login method.

- **Decision**: Require dev-login users to receive the same post-sign-in account access as users who sign in through the standard authentication path.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — the request explicitly requires a fully functional session and end-to-end workflow access.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. This avoids partial-access accounts that would make preview validation unreliable.
  2. It requires the feature to align account provisioning and access expectations with existing signed-in users.
- **Reviewer Notes**: Validate that all project, ticket, and workflow permissions continue to be governed by the existing access rules once the session is created.

- **Decision**: Default invalid dev-login attempts to a failed sign-in with no account creation and a user-visible error that does not disclose the configured shared secret.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — this is the standard safe default for authentication failures.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. This minimizes the risk of accidental account creation or credential leakage.
  2. It requires explicit rejection handling instead of silent failure.
- **Reviewer Notes**: Validate the error wording so it is clear to testers without revealing sensitive configuration details.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In to a Preview Deployment (Priority: P1)

A tester opening a preview deployment can sign in with an email address and the shared dev-login secret when that preview has dev login enabled.

**Why this priority**: Without a working sign-in path, preview deployments cannot be validated end to end when the standard external sign-in option is unavailable.

**Independent Test**: Can be fully tested by opening a preview deployment with dev login enabled, submitting a valid email and secret, and confirming access to the main projects area.

**Acceptance Scenarios**:

1. **Given** a preview deployment has dev login enabled, **When** a tester submits a valid email address and the correct shared secret, **Then** the tester is signed in and redirected to the projects area.
2. **Given** a tester signs in through dev login for the first time, **When** the sign-in succeeds, **Then** a user account exists for that email and the session behaves like a standard signed-in session.

---

### User Story 2 - Preserve Existing Sign-In Behavior When Disabled (Priority: P2)

A user visiting an environment where dev login is not enabled continues to see only the standard sign-in option, with no additional preview-only login method exposed.

**Why this priority**: Production and other non-preview environments must not expose a fallback login path that bypasses the intended authentication flow.

**Independent Test**: Can be fully tested by opening an environment without dev login enabled and confirming that only the standard sign-in option is shown.

**Acceptance Scenarios**:

1. **Given** dev login is not enabled for an environment, **When** a user opens the sign-in page, **Then** no dev-login form or prompt is displayed.
2. **Given** production deployment rules remain unchanged, **When** a user opens the production sign-in page, **Then** only the standard sign-in option is available.

---

### User Story 3 - Reject Invalid Dev Login Attempts Safely (Priority: P3)

A tester who enters an incorrect shared secret or an invalid email format receives a clear sign-in failure and remains signed out.

**Why this priority**: Preview testing must be usable, but invalid attempts must not create access, create broken accounts, or leak credential details.

**Independent Test**: Can be fully tested by submitting incorrect credentials and confirming that the user remains signed out, sees an error, and cannot reach authenticated areas.

**Acceptance Scenarios**:

1. **Given** dev login is enabled, **When** a tester submits the wrong shared secret, **Then** sign-in fails, no session is created, and the tester sees an error message.
2. **Given** dev login is enabled, **When** a tester submits an invalid email format, **Then** sign-in fails before account access is granted and the tester sees guidance to correct the input.

### Edge Cases

- What happens when a user account already exists for the submitted email through the standard sign-in flow? The existing account must continue to be used so prior access and history remain intact.
- How does the system handle a deployment where dev login was previously enabled but is later disabled? Existing authenticated behavior must follow the current environment rules, and new sign-ins must no longer offer dev login.
- What happens when a tester repeatedly submits invalid secrets? Each attempt must fail consistently without creating an account or revealing whether the secret was close to correct.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a preview-environment sign-in method that uses an email address and a shared secret only when dev login is explicitly enabled for that deployment.
- **FR-002**: The system MUST hide the dev-login sign-in method entirely when dev login is not enabled, so the sign-in page continues to show only the standard authentication option.
- **FR-003**: The system MUST prevent the dev-login sign-in method from being available in production.
- **FR-004**: The system MUST validate that the submitted email address is in a valid email format before granting access.
- **FR-005**: The system MUST validate the submitted shared secret against the deployment’s configured dev-login secret before granting access.
- **FR-006**: The system MUST reject invalid dev-login attempts without creating an authenticated session.
- **FR-007**: The system MUST show a user-visible sign-in error for failed dev-login attempts without exposing the configured secret or other sensitive authentication details.
- **FR-008**: The system MUST create or update the user account associated with a successful dev-login email so the resulting session has the same functional access as a standard signed-in user.
- **FR-009**: The system MUST redirect users who successfully sign in through dev login to the projects area.
- **FR-010**: The system MUST ensure users authenticated through dev login can access projects, tickets, and workflow-related capabilities according to the same authorization rules applied to other signed-in users.
- **FR-011**: The system MUST preserve the existing standard sign-in behavior for deployments where dev login is unavailable.
- **FR-012**: The feature MUST be covered by automated validation that confirms enabled, disabled, successful, and failed dev-login scenarios without regressing existing authentication behavior.

### Key Entities *(include if feature involves data)*

- **Dev Login Configuration**: Deployment-level state that determines whether the preview-only login path is available and what shared secret must be validated.
- **User Account**: The person record identified by email that is created or updated on successful sign-in and used for authorization throughout the product.
- **Authenticated Session**: The signed-in state granted after successful authentication that allows access to projects, tickets, and workflows according to existing permissions.

### Assumptions

- Preview environments are the intended place for this feature, and production must never expose it.
- A single shared secret is acceptable for preview-environment testing because the goal is functional access for trusted testers rather than individualized password management.
- Existing authorization rules remain the source of truth for what a signed-in user can access after dev login succeeds.

### Dependencies

- Preview deployments must be able to enable or disable dev login through deployment configuration.
- Standard user identity records and session handling must remain available so successful dev-login sessions behave like existing signed-in sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In environments where dev login is enabled, 100% of testers using a valid email and the correct shared secret can reach the projects area on the first sign-in attempt.
- **SC-002**: In environments where dev login is disabled, 100% of sign-in page visits show only the standard authentication option and no preview-only login controls.
- **SC-003**: 100% of invalid dev-login attempts remain signed out and display a user-visible failure message.
- **SC-004**: 100% of users created or updated through dev login can complete the same authenticated project and ticket actions available to an equivalent standard signed-in user.
