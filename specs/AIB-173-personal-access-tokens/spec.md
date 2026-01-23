# Feature Specification: Personal Access Tokens for API Authentication

**Feature Branch**: `AIB-173-personal-access-tokens`
**Created**: 2026-01-23
**Status**: Draft
**Input**: Ticket AIB-173 - Add a Personal Access Token (PAT) system to allow external tools to authenticate with the ai-board API

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: UI location for token management - create new user-level settings page at `/settings/tokens`
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score +6) - Security-sensitive feature with clear authentication/compliance signals
- **Fallback Triggered?**: No - high confidence AUTO resolved cleanly to CONSERVATIVE
- **Trade-offs**:
  1. New route adds navigation complexity but provides dedicated space for user-level settings
  2. Separate from project settings aligns with token being user-scoped, not project-scoped
- **Reviewer Notes**: Verify that `/settings/tokens` route pattern aligns with future user settings expansion plans

---

- **Decision**: Token hashing algorithm - use SHA-256 with unique salt per token
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score +6) - Security-critical decision requires industry-standard approach
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. SHA-256 provides fast lookup (vs bcrypt which requires iterating all tokens)
  2. Unique salt per token prevents rainbow table attacks while maintaining O(1) lookup
- **Reviewer Notes**: Ensure token generation uses cryptographically secure random source

---

- **Decision**: Token length - 32 random bytes (64 hex characters) after `pat_` prefix
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High - Security best practice for API tokens
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 256-bit entropy exceeds security requirements (brute-force infeasible)
  2. Longer tokens slightly less convenient but significantly more secure
- **Reviewer Notes**: Verify entropy source and token format before implementation

---

- **Decision**: Rate limiting approach - standard rate limiting on token validation endpoints
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: Medium (score +4) - Common security practice, implementation details deferred to planning
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents brute-force token guessing attacks
  2. May impact legitimate high-volume API usage (acceptable trade-off for security)
- **Reviewer Notes**: Rate limits should be defined during planning phase based on expected usage patterns

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate New Token (Priority: P1)

A user wants to connect an external tool (MCP server, CLI, or CI pipeline) to ai-board. They navigate to their token settings, provide a descriptive name for the token, and receive a new personal access token that they can use for API authentication.

**Why this priority**: Core functionality - without token generation, no external tools can authenticate. This is the foundational capability that enables all other token features and external integrations.

**Independent Test**: Can be fully tested by generating a token and using it to authenticate an API request. Delivers immediate value by enabling programmatic access.

**Acceptance Scenarios**:

1. **Given** a user is logged in, **When** they navigate to token settings and click "Generate new token", **Then** they see a modal requesting a token name
2. **Given** the token generation modal is open, **When** the user enters a name (e.g., "My MCP Server") and confirms, **Then** a new token is generated and displayed once
3. **Given** a token has been generated, **When** displayed to the user, **Then** it shows the complete token with a copy button and a warning that it won't be shown again
4. **Given** a token has been generated, **When** the user closes the modal without copying, **Then** they cannot retrieve the full token again (only preview available)

---

### User Story 2 - Authenticate API Request with Token (Priority: P1)

An external tool (MCP server, CLI, or automation script) needs to make authenticated API requests to ai-board. The tool includes the user's personal access token in the Authorization header and successfully accesses protected endpoints.

**Why this priority**: Equal priority with generation - tokens are useless without authentication. This enables the actual integration use cases (MCP, CLI, CI/CD).

**Independent Test**: Can be tested by making an API request with a valid token in the Authorization header and verifying access is granted.

**Acceptance Scenarios**:

1. **Given** a valid personal access token exists, **When** an API request includes `Authorization: Bearer pat_xxxxx`, **Then** the request is authenticated as the token owner
2. **Given** a valid token is used for authentication, **When** the request completes, **Then** the token's "last used" timestamp is updated
3. **Given** an invalid or revoked token, **When** used in an API request, **Then** the system returns 401 Unauthorized
4. **Given** a request without an Authorization header, **When** made to a protected endpoint, **Then** session-based authentication is attempted as fallback

---

### User Story 3 - View Token List (Priority: P2)

A user wants to see all their active tokens to understand which tools/integrations they have connected. They navigate to token settings and see a list showing each token's name, creation date, last usage, and a preview of the token.

**Why this priority**: Important for token management and security awareness, but not blocking for basic functionality.

**Independent Test**: Can be tested by viewing the tokens page after creating multiple tokens and verifying all metadata displays correctly.

**Acceptance Scenarios**:

1. **Given** a user has created tokens, **When** they visit the tokens page, **Then** they see a list of all their tokens with name, created date, and last used date
2. **Given** a token has never been used, **When** displayed in the list, **Then** the "last used" field shows "Never"
3. **Given** a token exists, **When** displayed in the list, **Then** it shows a partial preview (last 4 characters) for identification
4. **Given** a user has no tokens, **When** they visit the tokens page, **Then** they see an empty state with guidance to create their first token

---

### User Story 4 - Delete Token (Priority: P2)

A user wants to revoke access for a specific tool without affecting other integrations. They navigate to their token list, identify the token by name, and delete it with confirmation.

**Why this priority**: Essential for security hygiene and managing compromised tokens, but secondary to create/use functionality.

**Independent Test**: Can be tested by deleting a token and verifying subsequent API requests with that token fail.

**Acceptance Scenarios**:

1. **Given** a user views their token list, **When** they click delete on a token, **Then** a confirmation dialog appears
2. **Given** the confirmation dialog is shown, **When** the user confirms deletion, **Then** the token is immediately and permanently revoked
3. **Given** a token has been deleted, **When** an API request uses that token, **Then** the request returns 401 Unauthorized
4. **Given** a token is deleted, **When** the user returns to the token list, **Then** the deleted token no longer appears

---

### Edge Cases

- What happens when a user tries to create a token with an empty name? System requires a non-empty name (1-50 characters)
- What happens when a user tries to create a token with a duplicate name? System allows duplicate names (users may want "CI Pipeline" for multiple projects)
- How does the system handle token authentication when the owning user is deleted? Tokens are cascade-deleted with the user account
- What happens if a token is used while being deleted concurrently? Token validation should fail gracefully (return 401)
- How does the system behave when token validation experiences high latency? Token validation should have reasonable timeout to prevent hanging requests

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to generate new personal access tokens with a user-provided name
- **FR-002**: System MUST display the complete token exactly once at generation time with a copy-to-clipboard action
- **FR-003**: System MUST store tokens in a hashed format, never storing the plain text token
- **FR-004**: System MUST validate API requests containing `Authorization: Bearer pat_xxxxx` headers against stored token hashes
- **FR-005**: System MUST update the "last used" timestamp when a token is successfully used for authentication
- **FR-006**: System MUST return 401 Unauthorized for requests with invalid, missing, or revoked tokens
- **FR-007**: System MUST allow users to view a list of their tokens showing name, creation date, last used date, and partial token preview
- **FR-008**: System MUST allow users to delete their own tokens with confirmation
- **FR-009**: System MUST immediately revoke authentication capability when a token is deleted
- **FR-010**: System MUST support both session-based (existing) and token-based authentication on all API endpoints
- **FR-011**: System MUST prefix all generated tokens with `pat_` for easy identification
- **FR-012**: System MUST enforce rate limiting on token validation to prevent brute-force attacks
- **FR-013**: System MUST generate tokens using cryptographically secure random bytes

### Key Entities *(include if feature involves data)*

- **PersonalAccessToken**: Represents a user's API authentication credential
  - Belongs to a single User (owner)
  - Has a name (user-provided label for identification)
  - Has a hashed token value (never stored in plain text)
  - Has a token preview (last 4 characters for display purposes)
  - Tracks creation timestamp
  - Tracks last usage timestamp (nullable, null if never used)
  - Cascade deletes when owning User is deleted

- **User**: Extended relationship
  - Has zero or more PersonalAccessTokens
  - Tokens grant same permissions as user's session

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate a new token and copy it within 30 seconds of starting the process
- **SC-002**: 100% of API requests with valid tokens are authenticated correctly on first attempt
- **SC-003**: Token revocation takes effect within 1 second of deletion confirmation
- **SC-004**: Users can identify and manage their tokens by name without confusion (unique identification via name + preview)
- **SC-005**: External tools can make authenticated API requests using only the token (no session cookies required)
- **SC-006**: 95% of users successfully complete token generation on first attempt
- **SC-007**: Zero plain-text tokens are stored in the database at any time
