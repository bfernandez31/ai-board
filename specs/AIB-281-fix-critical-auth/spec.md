# Feature Specification: Fix Critical Auth Bypass via Unguarded `x-test-user-id` Header

**Feature Branch**: `AIB-281-fix-critical-auth`  
**Created**: 2026-03-12  
**Status**: Draft  
**Input**: User description: "Close a critical authentication bypass that currently lets any caller impersonate another user by sending the test-user header on protected requests."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Clarification policy resolution was set to security-first defaults for this ticket
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score: 7) - strong sensitive/authentication signals with no meaningful speed-oriented counter-signals
- **Fallback Triggered?**: No - AUTO resolved directly to CONSERVATIVE
- **Trade-offs**:
  1. Tightening the rules may block any informal non-test workflows that were relying on the test header outside sanctioned test runs
  2. The stricter default reduces rollout flexibility but is appropriate for a complete authentication bypass
- **Reviewer Notes**: Confirm every environment that still needs impersonation is explicitly classified as test-only rather than implicitly trusted

---

- **Decision**: The test impersonation header is treated as valid only in explicitly sanctioned automated test execution contexts, not in production-facing or general shared environments
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score: 7) - the ticket describes unauthenticated account takeover risk, so the safest defensible default is to disable the bypass everywhere except test mode
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. This preserves testability while removing the highest-risk exposure path
  2. Teams lose the convenience of ad hoc impersonation in preview or development environments unless they add an explicit safe workflow later
- **Reviewer Notes**: Validate whether preview deployments should be treated as non-test by default

---

- **Decision**: Requests carrying the test impersonation header in non-test environments must fail closed and must not alter the authenticated identity derived from standard credentials
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score: 7) - fail-closed behavior is the only acceptable default for an auth-bypass incident
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Some previously accepted requests may now return unauthorized responses until callers use a valid session or token
  2. This change prioritizes integrity of user identity over backward compatibility for unsafe callers
- **Reviewer Notes**: Verify that valid session-based and token-based callers are unaffected when the unsafe header is present

---

- **Decision**: Defense in depth is required at the platform boundary so external callers cannot successfully rely on the test header even if an application-level regression reappears later
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: Medium (score: 7) - the ticket explicitly recommends boundary protection, and the security severity justifies making it part of scope
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Adding boundary enforcement increases coordination across deployment surfaces
  2. The extra control meaningfully reduces the blast radius of future application mistakes
- **Reviewer Notes**: Confirm who owns boundary enforcement for each deployment target and how compliance will be verified

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Protected Data Stays Private (Priority: P1)

As an authenticated product user, I want protected routes to honor only my real credentials so that no outside caller can impersonate me and read or change my data.

**Why this priority**: Preventing account takeover and unauthorized data access is the core business and security requirement. No feature value exists if identity can be forged.

**Independent Test**: Can be fully tested by sending protected requests in a non-test environment with only the impersonation header and confirming the requests are rejected instead of being treated as another user.

**Acceptance Scenarios**:

1. **Given** a caller has no valid session or personal access token, **When** they send a protected request with `x-test-user-id` in a non-test environment, **Then** the request is rejected as unauthenticated
2. **Given** a caller has a valid authenticated session for their own account, **When** they send a protected request with a different `x-test-user-id` value in a non-test environment, **Then** the system preserves the session identity and does not switch to the header identity
3. **Given** a caller has a valid personal access token, **When** they send a protected request with `x-test-user-id` in a non-test environment, **Then** the system processes the request as the token owner and ignores the header for identity purposes

---

### User Story 2 - Automated Tests Keep a Safe Override Path (Priority: P1)

As a QA or workflow engineer, I want sanctioned automated tests to keep using a test-only impersonation mechanism so that repeatable end-to-end validation still works without exposing production accounts.

**Why this priority**: The repo intentionally supports test-mode impersonation. The fix must remove the vulnerability without breaking required automated validation.

**Independent Test**: Can be fully tested by running a test-mode authentication flow that uses the header and confirming it still resolves the intended seeded test user only in the designated test context.

**Acceptance Scenarios**:

1. **Given** the application is running in an explicitly designated test context, **When** an automated test sends `x-test-user-id` for a valid seeded test account, **Then** the request is allowed to resolve that test identity
2. **Given** the application is running in an explicitly designated test context, **When** an automated test sends `x-test-user-id` for a nonexistent account, **Then** the request fails safely and does not resolve to any other user
3. **Given** the application is not running in the designated test context, **When** any caller sends `x-test-user-id`, **Then** the override path remains unavailable regardless of caller origin

---

### User Story 3 - Security Owners Can Verify the Fix (Priority: P2)

As a security owner or operator, I want attempts to use the forbidden impersonation header outside test mode to be visible and consistently blocked so that regressions are detectable during validation and incident response.

**Why this priority**: Blocking the issue once is not enough; the platform must support verification and ongoing confidence that the bypass cannot silently return.

**Independent Test**: Can be fully tested by running validation in a non-test environment and confirming that disallowed header use is both blocked and observable in the platform's normal security-review process.

**Acceptance Scenarios**:

1. **Given** a non-test environment receives a protected request with `x-test-user-id`, **When** the request is evaluated, **Then** the request outcome clearly indicates the caller was not authenticated through the test override path
2. **Given** validation is performed after the fix, **When** reviewers inspect the security-relevant signals for blocked impersonation attempts, **Then** they can confirm the requests were rejected
3. **Given** an application-level regression is introduced later, **When** an external caller sends `x-test-user-id` from outside the trusted test context, **Then** an additional platform-layer control still prevents successful impersonation

---

### Edge Cases

- A non-test request includes `x-test-user-id` together with an invalid or expired session: the request must be rejected rather than falling back to header-based identity.
- A non-test request includes both a valid personal access token and a conflicting `x-test-user-id`: the token identity must win consistently.
- A non-test request includes `x-test-user-id` for a real user on a route that normally redirects unauthenticated users: the user must not be treated as authenticated through the header alone.
- A test-context request includes `x-test-user-id` for a deleted or unknown account: the request must fail safely and never resolve to an arbitrary user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Protected application routes and operations MUST require valid authentication before returning user-specific data or allowing state-changing actions.
- **FR-002**: The `x-test-user-id` header MUST be treated as a test-only identity override and MUST NOT authenticate or re-authenticate callers in non-test environments.
- **FR-003**: In non-test environments, the presence of `x-test-user-id` MUST NOT bypass pre-authentication checks, session validation, or authorization checks.
- **FR-004**: In non-test environments, if a request includes `x-test-user-id` without a valid session or personal access token, the request MUST fail as unauthenticated.
- **FR-005**: In non-test environments, if a request includes both valid standard credentials and `x-test-user-id`, the system MUST preserve the identity established by the valid credentials and ignore the header for identity resolution.
- **FR-006**: In explicitly designated test contexts, authorized automated tests MUST be able to use `x-test-user-id` to resolve a seeded test identity needed for automated validation.
- **FR-007**: If `x-test-user-id` references a user that does not exist or is not allowed for the current context, the request MUST fail safely and MUST NOT resolve to another identity.
- **FR-008**: All request paths that currently rely on current-user resolution or pre-authentication bypass logic MUST apply the same environment guardrails so the impersonation restriction is consistent across the platform.
- **FR-009**: The platform boundary for non-test environments MUST prevent external callers from successfully relying on `x-test-user-id`, providing defense in depth beyond a single application check.
- **FR-010**: Security reviewers and operators MUST be able to verify, during validation or incident review, that forbidden uses of `x-test-user-id` in non-test environments were blocked.
- **FR-011**: Existing legitimate session-based authentication and personal access token authentication flows MUST continue to work for protected routes after the fix.

### Key Entities *(include if feature involves data)*

- **Authenticated Identity**: The user identity established through approved credentials and used for access control decisions on protected routes.
- **Test Identity Override Header**: The `x-test-user-id` request header, intended only for sanctioned automated test contexts to impersonate a seeded test user.
- **Protected Request**: Any application page or user action that exposes user-specific information or allows a user-scoped action.
- **Personal Access Token**: A long-lived user-managed credential that authorizes programmatic access without an interactive session.
- **Security Validation Signal**: The evidence available to reviewers or operators showing whether a forbidden header-based impersonation attempt was blocked.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In non-test validation, 100% of protected-request checks that supply only `x-test-user-id` are rejected and return no impersonated user data.
- **SC-002**: In non-test validation, 100% of protected-request checks that combine valid standard credentials with a conflicting `x-test-user-id` continue under the original authenticated identity.
- **SC-003**: In designated test validation, 100% of approved automated test flows that depend on `x-test-user-id` continue to complete successfully with the intended seeded test user.
- **SC-004**: Reviewers can verify blocked use of `x-test-user-id` in non-test environments from the platform's normal validation evidence for every release containing this change.
- **SC-005**: Session-based and personal-access-token-based smoke tests for representative protected routes succeed after the fix with no unexpected unauthorized responses.

## Assumptions

- The current automated test strategy still requires a header-based impersonation path for seeded test users.
- Any environment that is publicly reachable or shared by real users is treated as non-test unless it is explicitly designated otherwise.
- Personal access token authentication remains a supported and approved access path for protected user operations.
