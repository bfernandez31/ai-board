# Feature Specification: Personal Access Tokens for API Authentication

**Feature Branch**: `AIB-184-personal-access-tokens`
**Created**: 2026-01-23
**Status**: Draft
**Input**: User description: "Add a Personal Access Token (PAT) system to allow external tools to authenticate with the ai-board API"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Token hashing algorithm
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score: +14, security context strongly detected via "auth", "token", "security", "bcrypt", "hashed")
- **Fallback Triggered?**: No - high confidence directly selected CONSERVATIVE
- **Trade-offs**:
  1. bcrypt for token hashing ensures strong security but adds ~100ms latency per validation
  2. Alternative SHA-256 would be faster but less resistant to brute-force attacks
- **Reviewer Notes**: Verify bcrypt cost factor (12 recommended) aligns with server CPU capacity; consider caching validated tokens briefly if performance becomes an issue

---

- **Decision**: Token validation on each request (vs. caching)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - security-critical authentication feature
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Validates token hash on every request to ensure revoked tokens are immediately rejected
  2. Adds database lookup per API call; consider read replicas if scale demands
- **Reviewer Notes**: If high-volume API usage is expected, evaluate adding short-lived (1-5 minute) validation cache with explicit invalidation on token deletion

---

- **Decision**: Token format and length
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - cryptographic security requirement
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 32-character random hex (128-bit entropy) provides strong security against brute-force
  2. Longer tokens would provide more security but increase storage and copy complexity
- **Reviewer Notes**: Ensure token generation uses cryptographically secure random source (crypto.randomBytes or equivalent)

---

- **Decision**: Error message specificity for authentication failures
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - security best practice
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Generic "Unauthorized" response prevents attackers from distinguishing valid vs invalid tokens
  2. Developers may need to check token validity via management UI rather than API error codes
- **Reviewer Notes**: Consider adding detailed error codes in development environments only

---

- **Decision**: Token name uniqueness constraint
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Allow duplicate names per user (flexibility) - users can distinguish by preview and creation date
  2. Alternative: unique names per user would force clear naming but adds friction
- **Reviewer Notes**: UI should clearly display creation date and preview to help users identify tokens

---

- **Decision**: Maximum tokens per user
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - prevent abuse
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Limit to 10 tokens per user prevents abuse and simplifies management
  2. Power users with many integrations may hit this limit
- **Reviewer Notes**: Can increase limit later based on user feedback; 10 is sufficient for typical use cases (CLI, MCP, CI, few tools)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a New Personal Access Token (Priority: P1)

As a user who wants to connect an external tool (MCP server, CLI) to ai-board, I need to generate a new personal access token so that the tool can authenticate with the API on my behalf.

**Why this priority**: This is the core functionality - without token generation, no external tool can authenticate. This enables the entire PAT feature.

**Independent Test**: Can be fully tested by navigating to token settings, entering a name, generating a token, and verifying the token is displayed once. Delivers immediate value: user can copy and use the token.

**Acceptance Scenarios**:

1. **Given** I am logged into ai-board and on the tokens settings page, **When** I click "Generate new token" and enter name "My MCP Server" and confirm, **Then** a new token is generated, displayed in full (e.g., `pat_a1b2c3...`), and I can copy it to clipboard.

2. **Given** I have just generated a token and see it displayed, **When** I navigate away from the page and return, **Then** the full token is no longer visible (only preview like `...o5p6`).

3. **Given** I am on the token generation modal, **When** I try to generate without entering a name, **Then** generation is blocked and I see a validation message requiring a name.

4. **Given** I have 10 existing tokens, **When** I try to generate another token, **Then** I see a message that the maximum token limit has been reached.

---

### User Story 2 - Authenticate API Requests with Personal Access Token (Priority: P1)

As a developer using an external tool, I need to use my PAT to authenticate API requests so that I can programmatically access ai-board resources (create tickets, read projects, etc.).

**Why this priority**: This is equally critical - tokens are useless without the ability to authenticate. This enables all external integrations.

**Independent Test**: Can be tested by making an API request with `Authorization: Bearer pat_xxx` header and verifying access is granted. Delivers immediate value: external tools can now access the API.

**Acceptance Scenarios**:

1. **Given** I have a valid PAT, **When** I make an API request with header `Authorization: Bearer pat_a1b2c3...`, **Then** the request succeeds with the same permissions as my logged-in session.

2. **Given** I have an invalid or revoked PAT, **When** I make an API request with that token, **Then** I receive a 401 Unauthorized response with body `{"error": "Unauthorized"}`.

3. **Given** I make an API request without any authentication, **When** the request is processed, **Then** I receive a 401 Unauthorized response.

4. **Given** I use a valid PAT, **When** the API processes my request successfully, **Then** the token's `lastUsedAt` timestamp is updated to the current time.

---

### User Story 3 - View and Manage Existing Tokens (Priority: P2)

As a user with multiple integrations, I need to view all my tokens and their usage information so that I can understand which tools are actively using the API.

**Why this priority**: Management visibility is important for security hygiene but not required for basic functionality.

**Independent Test**: Can be tested by navigating to token settings and verifying the list displays name, created date, last used date, and preview for each token. Delivers value: security visibility.

**Acceptance Scenarios**:

1. **Given** I have 3 tokens created, **When** I navigate to the tokens settings page, **Then** I see all 3 tokens listed with: name, created date, last used date (or "Never used"), and preview (last 4 characters).

2. **Given** I have a token that was used yesterday, **When** I view the tokens list, **Then** the "Last used" column shows a human-readable date/time.

3. **Given** I have no tokens, **When** I navigate to the tokens settings page, **Then** I see an empty state message encouraging me to create my first token.

---

### User Story 4 - Delete (Revoke) a Token (Priority: P2)

As a user who suspects a token may be compromised or no longer needs it, I need to delete a token so that it can no longer be used to access the API.

**Why this priority**: Token revocation is critical for security but secondary to initial token creation and usage.

**Independent Test**: Can be tested by deleting a token and confirming subsequent API requests with that token fail. Delivers value: security control.

**Acceptance Scenarios**:

1. **Given** I have a token named "Old CLI", **When** I click the delete button and confirm the deletion, **Then** the token is removed from my list and cannot be used for API authentication.

2. **Given** I click delete on a token, **When** the confirmation dialog appears, **Then** it clearly states the token name and warns this action is irreversible.

3. **Given** a token is deleted, **When** an external tool attempts to use it, **Then** the tool receives a 401 Unauthorized response.

---

### Edge Cases

- What happens when a user deletes their account? → All their tokens are cascade-deleted automatically (database foreign key constraint)
- How does the system handle concurrent token validation requests? → Each validation is independent; no race conditions since tokens are immutable after creation
- What if the database is temporarily unavailable during token validation? → Return 503 Service Unavailable, not 401 (to distinguish infrastructure issues from auth failures)
- What happens if a user copies a token incorrectly (partial copy)? → Token validation fails with generic 401; user must regenerate if original is lost
- How to handle very long-running API operations after token deletion? → In-flight requests with deleted tokens should complete (tokens validated at request start, not continuously)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to generate new personal access tokens with a user-provided name
- **FR-002**: System MUST display the full token exactly once upon generation, with no ability to retrieve it later
- **FR-003**: System MUST hash tokens using bcrypt before storing in the database (plain text tokens never stored)
- **FR-004**: System MUST store a token preview (last 4 characters) for display purposes
- **FR-005**: System MUST authenticate API requests that include a valid `Authorization: Bearer pat_xxx` header
- **FR-006**: System MUST update the `lastUsedAt` timestamp when a token is successfully used for authentication
- **FR-007**: System MUST return 401 Unauthorized for invalid, revoked, or missing tokens (generic message)
- **FR-008**: System MUST support both session-based auth and token-based auth (not mutually exclusive)
- **FR-009**: System MUST allow users to view a list of their tokens showing name, created date, last used date, and preview
- **FR-010**: System MUST allow users to delete tokens they own, with confirmation dialog
- **FR-011**: System MUST immediately revoke deleted tokens (no grace period)
- **FR-012**: System MUST enforce a maximum of 10 tokens per user
- **FR-013**: System MUST require token names to be non-empty (minimum 1 character)
- **FR-014**: Token names MUST have a maximum length of 50 characters
- **FR-015**: System MUST use cryptographically secure random generation for token values

### Key Entities *(include if feature involves data)*

- **PersonalAccessToken**: Represents a user's API access credential
  - Owned by exactly one User (foreign key relationship)
  - Contains: unique ID, user reference, display name, hashed token, preview, timestamps
  - Attributes: name (user-provided label), tokenHash (bcrypt hash), tokenPreview (last 4 chars), createdAt, lastUsedAt (nullable)

- **User** (existing): Extended relationship to own multiple PersonalAccessTokens
  - One user can have 0-10 tokens
  - Tokens cascade delete when user is deleted

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate a new token in under 30 seconds (navigate to settings, enter name, copy token)
- **SC-002**: API requests authenticated with valid tokens succeed within the same response time as session-authenticated requests (within 150ms overhead for token validation)
- **SC-003**: 100% of deleted tokens immediately fail authentication on subsequent API requests
- **SC-004**: Token list loads within 2 seconds showing all user tokens with usage information
- **SC-005**: Users successfully complete first-time token setup without external documentation (self-explanatory UI)
- **SC-006**: Zero plain-text tokens stored in database (verified by schema constraints and code review)
