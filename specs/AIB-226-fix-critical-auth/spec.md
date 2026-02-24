# Feature Specification: Fix Critical Auth Bypass via Unguarded x-test-user-id Header

**Feature Branch**: `AIB-226-fix-critical-auth`
**Created**: 2026-02-24
**Status**: Draft
**Input**: User description: "Fix critical auth bypass via unguarded x-test-user-id header"

## Auto-Resolved Decisions

- **Decision**: Whether to apply defense-in-depth (guard at both the middleware layer and the user lookup layer independently) vs. a single-point fix
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score: 15) — all context signals are security/compliance-related with zero conflicting buckets
- **Fallback Triggered?**: No — AUTO resolved to CONSERVATIVE with high confidence (0.9); no fallback needed
- **Trade-offs**:
  1. Defense-in-depth adds a small amount of redundancy across two code locations, but this is desirable for a security fix where a single point of failure would be catastrophic
  2. No meaningful cost impact — the change is minimal in both locations
- **Reviewer Notes**: Verify that both authentication checkpoints independently reject the test header in production. Confirm the build-time environment detection mechanism works correctly in the Edge Runtime context where runtime environment variables are unavailable.

---

- **Decision**: Whether test-mode bypass should use a runtime environment variable or a build-time constant for the middleware layer (which runs in Edge Runtime)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score: 15) — the existing codebase comment explicitly documents that Edge Runtime cannot read `process.env.NODE_ENV` at runtime, making a build-time mechanism the only viable option
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A build-time constant means the test bypass is baked into the deployed artifact — this is acceptable because test and production builds are separate deployments
  2. Slightly different gating mechanisms in middleware vs. server code, but this is an inherent constraint of the Edge Runtime limitation
- **Reviewer Notes**: Confirm that the build-time constant is correctly injected and resolves to the expected value in both test and production builds. Ensure the mechanism does not leak test-mode capability into production artifacts.

---

- **Decision**: Whether to strip the `x-test-user-id` header at the middleware layer or simply ignore it when not in test mode
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score: 15) — CONSERVATIVE dictates the more secure approach
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Ignoring the header (not processing it) is sufficient when both checkpoints independently verify the environment, and avoids request mutation complexity
  2. Header stripping adds defense-in-depth but may not be necessary given the dual-guard approach
- **Reviewer Notes**: The minimum requirement is that the header is ignored in production. Header stripping is a recommended enhancement but not strictly required if both guards are in place.

## User Scenarios & Testing

### User Story 1 - Production Users Protected from Auth Bypass (Priority: P1)

An attacker attempts to access the system by sending an API request with the `x-test-user-id` header set to another user's identifier. The system rejects this attempt at every authentication checkpoint, ensuring the attacker cannot impersonate any user.

**Why this priority**: This is the core vulnerability being fixed. Without this, any unauthenticated user can fully impersonate any other user in production, gaining complete access to their projects, tickets, workflows, and data.

**Independent Test**: Can be fully tested by sending API requests with the `x-test-user-id` header in a production-like environment and verifying that authentication is enforced normally (header is ignored).

**Acceptance Scenarios**:

1. **Given** the system is running in production mode, **When** an unauthenticated request includes the `x-test-user-id` header with a valid user ID, **Then** the system ignores the header and requires standard authentication (session or token)
2. **Given** the system is running in production mode, **When** an unauthenticated request includes the `x-test-user-id` header, **Then** the middleware does not bypass authentication checks and the request is redirected to sign-in or returns 401
3. **Given** the system is running in production mode, **When** an authenticated user sends a request that also includes the `x-test-user-id` header for a different user, **Then** the system uses the authenticated user's identity, not the header value

---

### User Story 2 - Test Environment Retains Test User Impersonation (Priority: P2)

During automated testing, the system accepts the `x-test-user-id` header to allow test suites to impersonate specific users without requiring full authentication flows. This enables fast, reliable testing of user-specific behavior.

**Why this priority**: Removing the test bypass entirely would break all existing E2E and integration tests that rely on this mechanism. The fix must preserve test functionality while closing the production vulnerability.

**Independent Test**: Can be fully tested by running the existing test suite and verifying that all tests using the `x-test-user-id` header continue to pass in test mode.

**Acceptance Scenarios**:

1. **Given** the system is running in test mode, **When** a request includes the `x-test-user-id` header with a valid user ID, **Then** the system authenticates the request as that user without requiring a session or token
2. **Given** the system is running in test mode, **When** the middleware receives a request with the `x-test-user-id` header, **Then** it allows the request to proceed without redirecting to sign-in
3. **Given** the system is running in test mode, **When** a request includes the `x-test-user-id` header with a non-existent user ID, **Then** the system falls back to standard authentication (does not create phantom users)

---

### User Story 3 - Existing Authentication Flows Unaffected (Priority: P3)

All existing authentication mechanisms — session-based authentication via NextAuth and Bearer token (PAT) authentication — continue to function identically after the fix. No user experiences any disruption to their normal login or API access patterns.

**Why this priority**: While not directly related to the vulnerability, any regression in authentication would affect all users of the system. This story ensures the fix is surgical and does not introduce side effects.

**Independent Test**: Can be fully tested by exercising session login, PAT-based API access, and unauthenticated access patterns and verifying identical behavior to the pre-fix state.

**Acceptance Scenarios**:

1. **Given** a user is authenticated via NextAuth session, **When** they access protected resources, **Then** access is granted as before
2. **Given** a request includes a valid Bearer PAT token, **When** it accesses an API endpoint, **Then** authentication succeeds as before
3. **Given** an unauthenticated request without any auth headers or test headers, **When** it accesses a protected route, **Then** it is redirected to sign-in or receives a 401 response as before

---

### Edge Cases

- What happens when the `x-test-user-id` header is present but empty in production? System must ignore it.
- What happens when the `x-test-user-id` header is present alongside a valid session in production? Session identity takes precedence; header is ignored.
- What happens when the `x-test-user-id` header is present alongside a valid PAT token in production? Token identity takes precedence; header is ignored.
- What happens when the build-time test mode flag is misconfigured? System must default to rejecting test headers (fail-secure).
- What happens when a deployment uses an unexpected environment configuration? The system must treat any non-test environment as production (fail-secure).

## Requirements

### Functional Requirements

- **FR-001**: System MUST reject the `x-test-user-id` header as an authentication mechanism in all non-test environments
- **FR-002**: System MUST accept the `x-test-user-id` header as an authentication mechanism only when running in a designated test environment
- **FR-003**: System MUST enforce environment gating at the middleware layer independently of the user lookup layer (defense in depth — each checkpoint must independently verify the environment before honoring the test header)
- **FR-004**: System MUST use a build-time environment detection mechanism for the middleware layer, since runtime environment variables are unavailable in the Edge Runtime
- **FR-005**: System MUST use a runtime environment check for the server-side user lookup layer, since runtime environment variables are available in that context
- **FR-006**: System MUST default to rejecting the test header when the environment cannot be determined (fail-secure behavior)
- **FR-007**: System MUST NOT alter the behavior of existing authentication mechanisms (NextAuth sessions and Bearer PAT tokens) as a result of this fix

### Assumptions

- Test and production environments are deployed as separate builds, so a build-time constant correctly distinguishes them
- The existing test suite relies on the `x-test-user-id` header mechanism and must continue to work
- No external reverse proxy or CDN currently strips custom headers, so the fix must be applied at the application layer

## Success Criteria

### Measurable Outcomes

- **SC-001**: Zero successful authentication bypass attempts via the `x-test-user-id` header in non-test environments
- **SC-002**: 100% of existing automated tests that use the `x-test-user-id` header continue to pass in test environments
- **SC-003**: Zero regressions in session-based and token-based authentication flows after the fix is deployed
- **SC-004**: Both authentication checkpoints (middleware and user lookup) independently reject the test header in production, verified through targeted security tests
