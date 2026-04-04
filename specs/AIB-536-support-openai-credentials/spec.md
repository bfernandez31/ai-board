# Feature Specification: Support OpenAI Credentials for Codex Agent

**Feature Branch**: `AIB-536-support-openai-credentials`
**Created**: 2026-04-04
**Status**: Draft
**Input**: User description: "Support OpenAI credentials for Codex agent"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: OpenAI Key Format Validation Pattern

- **Decision**: OpenAI API keys will be validated with a `sk-` prefix check and minimum length (20+ characters). Unlike Anthropic's strict regex (`sk-ant-api\d{2}-...`), OpenAI keys have multiple formats (`sk-proj-...`, `sk-svcacct-...`, `sk-...`). A loose prefix check prevents false negatives when OpenAI changes formats.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9, score +5) — credential validation is security-sensitive; a loose format check risks accepting garbage but live verification catches it.
- **Fallback Triggered?**: No — AUTO recommended CONSERVATIVE with high confidence.
- **Trade-offs**:
  1. A loose prefix check may accept some invalid-format strings, but live verification is the authoritative gate.
  2. Avoids false negatives from an overly strict regex that breaks when OpenAI changes key format.
- **Reviewer Notes**: Confirm current OpenAI key format(s). The live verification step (calling OpenAI API) is the authoritative validation — format check is a fast pre-filter.

### Decision 2: OpenAI Live Verification Endpoint

- **Decision**: Use `GET https://api.openai.com/v1/models` with the API key as a Bearer token for live verification. This is a lightweight, read-only endpoint that confirms the key is valid without consuming tokens. Mirrors the pattern used for Anthropic OAuth token verification.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — standard practice for API key validation; stable endpoint with no usage charges.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The models endpoint may have rate limits, but the verification timeout pattern (10s) already handles this.
  2. A key could be valid but lack permissions for specific models — this check only confirms the key is recognized.
- **Reviewer Notes**: Verify that the OpenAI `/v1/models` endpoint returns 200 for valid keys and 401 for invalid ones.

### Decision 3: Credential Type Support for OpenAI

- **Decision**: Only `API_KEY` credential type is supported for the `OPENAI` provider. OpenAI does not offer an OAuth token flow for API access. The credential form restricts type selection to `API_KEY` when `OPENAI` is the selected provider.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — OpenAI's API authentication is exclusively API-key-based.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. If OpenAI introduces OAuth in the future, a schema/UI update will be needed — acceptable given low likelihood.
  2. Simplifies the UI and validation logic.
- **Reviewer Notes**: None — straightforward constraint aligned with provider capabilities.

### Decision 4: Error Message Updates for Multi-Provider Support

- **Decision**: The existing error message "No AI credential configured. Please add your Anthropic key..." will become provider-aware. When credential resolution fails, the message references the specific provider needed (e.g., "No OpenAI credential configured. Please add your OpenAI key in Settings → AI Credentials.").
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — a generic or incorrect error message would confuse users who have one provider's key but not the other.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Requires updating error message construction in multiple dispatch locations.
  2. Improved user guidance reduces support burden.
- **Reviewer Notes**: Ensure all credential resolution call sites surface the correct provider name.

### Decision 5: Agent-to-Provider Mapping as Centralized Constant

- **Decision**: The mapping `CLAUDE → ANTHROPIC`, `CODEX → OPENAI` will be a centralized constant. Credential resolution uses the ticket's effective agent (via `resolveEffectiveAgent()`) to determine which provider credential to fetch. Hardcoded CLAUDE commands (code-review, ai-board-assist) bypass this mapping and always resolve ANTHROPIC.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — the mapping is explicitly defined in the ticket requirements; centralizing prevents drift.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A centralized mapping requires updating when new agents are added, but this is infrequent.
  2. Clear separation between agent-based and command-based credential resolution.
- **Reviewer Notes**: Verify all dispatch paths that should respect the agent mapping do so, and that hardcoded CLAUDE paths remain unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save OpenAI API Key (Priority: P1)

A user who wants to run Codex agent workflows navigates to Settings → AI Credentials and saves their OpenAI API key. The system validates the key format and verifies it against the OpenAI API before storing it securely.

**Why this priority**: Without a stored OpenAI credential, no Codex agent workflows can execute. This is the foundational capability all other stories depend on.

**Independent Test**: Can be fully tested by navigating to the credentials page, selecting OpenAI as the provider, entering a key, and verifying it is stored with READY status.

**Acceptance Scenarios**:

1. **Given** a user on the AI Credentials settings page, **When** they select "OPENAI" as the provider and enter a valid OpenAI API key (e.g., `sk-proj-abc...`), **Then** the key is validated, verified against the OpenAI API, encrypted, and stored with readiness status READY.
2. **Given** a user entering an OpenAI key that does not start with `sk-`, **When** they attempt to save, **Then** the system rejects the key with a format validation error before making any API call.
3. **Given** a user entering a correctly formatted OpenAI key that is revoked or invalid, **When** they attempt to save, **Then** the system reports the key is invalid after live verification and sets readiness to ACTION_REQUIRED.
4. **Given** a user who already has an OpenAI credential stored, **When** they save a new OpenAI key, **Then** the existing credential is replaced (upsert behavior per the one-credential-per-provider-per-user constraint).

---

### User Story 2 - Codex Workflow Dispatches with OpenAI Credential (Priority: P1)

When a workflow is dispatched for a ticket using the Codex agent, the system automatically resolves the project owner's OpenAI credential and injects it as `OPENAI_API_KEY` into the workflow environment.

**Why this priority**: This is the core runtime behavior that makes Codex workflows functional. Equal priority with Story 1 since both are required for end-to-end functionality.

**Independent Test**: Can be tested by dispatching a workflow for a Codex-agent ticket and verifying the correct environment variable is set.

**Acceptance Scenarios**:

1. **Given** a ticket with effective agent CODEX and the project owner has a valid OpenAI credential, **When** a workflow is dispatched (specify, plan, build, etc.), **Then** the system resolves the owner's OPENAI credential and maps it to the `OPENAI_API_KEY` environment variable.
2. **Given** a ticket with effective agent CLAUDE and the project owner has a valid Anthropic credential, **When** a workflow is dispatched, **Then** the system resolves the ANTHROPIC credential as it does today (no behavior change).
3. **Given** a ticket with effective agent CODEX but the project owner has no OpenAI credential, **When** a workflow dispatch is attempted, **Then** the system blocks the dispatch with a clear error message: "No OpenAI credential configured. Please add your OpenAI key in Settings → AI Credentials."
4. **Given** a ticket with effective agent CODEX and the project owner has an OpenAI credential with readiness ACTION_REQUIRED, **When** a workflow dispatch is attempted, **Then** the system blocks the dispatch (only READY credentials are used).

---

### User Story 3 - Manage OpenAI Credentials (Priority: P2)

Users can test and delete their stored OpenAI credentials through the same UI and API used for Anthropic credentials.

**Why this priority**: Management operations (test, delete) are important for credential lifecycle but secondary to initial save and workflow dispatch.

**Independent Test**: Can be tested by testing an existing OpenAI credential via the UI test button and deleting it via the delete confirmation dialog.

**Acceptance Scenarios**:

1. **Given** a user with a stored OpenAI credential, **When** they click the test button, **Then** the system re-verifies the key against the OpenAI API and updates the readiness status accordingly.
2. **Given** a user with a stored OpenAI credential, **When** they delete it, **Then** the credential is permanently removed and subsequent Codex workflow dispatches fail with a missing credential error.

---

### User Story 4 - Hardcoded CLAUDE Commands Use Anthropic Credentials (Priority: P2)

Commands hardcoded to use the CLAUDE agent (code-review in verify.yml, ai-board-assist.yml) always resolve Anthropic credentials, regardless of the ticket's configured agent.

**Why this priority**: Ensures existing automated commands remain functional and do not break when a ticket is configured for Codex.

**Independent Test**: Can be tested by running a code-review or ai-board-assist command on a Codex-agent ticket and verifying it resolves the Anthropic credential.

**Acceptance Scenarios**:

1. **Given** a ticket with effective agent CODEX, **When** a code-review command is dispatched (verify.yml), **Then** the system resolves the project owner's ANTHROPIC credential (not OPENAI).
2. **Given** a ticket with effective agent CODEX, **When** an ai-board-assist command is dispatched, **Then** the system resolves the project owner's ANTHROPIC credential.

---

### User Story 5 - Health-Scan Credential Resolution (Priority: P3)

Health scan dispatches resolve credentials based on the appropriate agent/provider mapping for the context.

**Why this priority**: Health scans are a background operation; correctness matters but is lower priority than user-facing credential workflows.

**Independent Test**: Can be tested by triggering a health scan for a project and verifying correct credential resolution.

**Acceptance Scenarios**:

1. **Given** a health scan dispatched for a project, **When** the scan requires AI credentials, **Then** the system resolves the credential based on the appropriate agent/provider mapping.

---

### Edge Cases

- What happens when a user has an Anthropic credential but not an OpenAI one, and dispatches a Codex ticket? → Blocked with a provider-specific error message naming OpenAI.
- What happens when a user has both credentials, and changes a ticket's agent from CLAUDE to CODEX? → Next workflow dispatch automatically uses the OpenAI credential.
- What happens when the OpenAI API is unreachable during key verification? → Timeout after 10 seconds, credential saved with ACTION_REQUIRED readiness (same pattern as Anthropic).
- How does the system handle OpenAI keys with new sub-formats (e.g., `sk-svcacct-...`)? → Format validation accepts any `sk-` prefix with sufficient length; live verification is authoritative.
- What happens if OpenAI returns a rate-limit response (429) during verification? → Treated as inconclusive; credential set to ACTION_REQUIRED with appropriate message.
- What happens if a user selects OPENAI provider and tries to choose OAUTH_TOKEN type? → The credential type is restricted to API_KEY for OPENAI; OAUTH_TOKEN option is not available.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support `OPENAI` as a credential provider alongside `ANTHROPIC`.
- **FR-002**: System MUST validate OpenAI API keys with a `sk-` prefix format check and minimum length before attempting live verification.
- **FR-003**: System MUST verify OpenAI API keys against the OpenAI API (using a lightweight read-only endpoint) during credential creation and testing.
- **FR-004**: System MUST encrypt, store, and decrypt OpenAI credentials using the same encryption standard and patterns as Anthropic credentials.
- **FR-005**: System MUST allow users to select between ANTHROPIC and OPENAI providers when adding a credential.
- **FR-006**: System MUST restrict credential type to API_KEY when provider is OPENAI.
- **FR-007**: System MUST resolve credentials at workflow dispatch time based on the ticket's effective agent: CLAUDE → ANTHROPIC provider, CODEX → OPENAI provider.
- **FR-008**: System MUST map OPENAI API_KEY credentials to the `OPENAI_API_KEY` environment variable in workflow payloads.
- **FR-009**: System MUST display a provider-specific error message when a required credential is missing at dispatch time.
- **FR-010**: System MUST continue resolving ANTHROPIC credentials for hardcoded CLAUDE commands (code-review, ai-board-assist) regardless of the ticket's configured agent.
- **FR-011**: System MUST enforce the existing one-credential-per-provider-per-user constraint, allowing users to have both an Anthropic and an OpenAI credential simultaneously.
- **FR-012**: System MUST support testing and deleting OpenAI credentials through the same UI and API flows used for Anthropic credentials.
- **FR-013**: Health-scan dispatch MUST resolve credentials based on the appropriate agent/provider mapping.

### Key Entities *(include if feature involves data)*

- **UserCredential**: Stores encrypted API keys per user per provider. Extended to support OPENAI provider. Key attributes: provider (ANTHROPIC | OPENAI), credentialType (API_KEY), encryptedValue, readinessStatus, preview (last 4 chars).
- **CredentialProvider**: Enum of supported credential providers. Extended with OPENAI value.
- **Agent**: Enum of supported AI agents (CLAUDE, CODEX). Used to determine which provider credential to resolve at dispatch time.
- **Agent-to-Provider Mapping**: Centralized mapping connecting each Agent to its CredentialProvider: CLAUDE → ANTHROPIC, CODEX → OPENAI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can save, test, and delete OpenAI credentials through the settings page, completing each operation in under 30 seconds.
- **SC-002**: Codex agent workflows dispatch successfully when the project owner has a valid OpenAI credential, with zero manual environment variable configuration required.
- **SC-003**: 100% of workflow dispatches for Codex agent tickets resolve the correct OpenAI credential (not Anthropic).
- **SC-004**: 100% of hardcoded CLAUDE commands (code-review, ai-board-assist) continue resolving Anthropic credentials, even on Codex-agent tickets.
- **SC-005**: Invalid or revoked OpenAI keys are detected during save/test operations, preventing workflows from dispatching with broken credentials.
- **SC-006**: Error messages for missing credentials clearly identify which provider credential is needed, eliminating user confusion.

## Assumptions

- OpenAI API keys consistently use the `sk-` prefix across all key types (project keys, service account keys, legacy keys).
- The OpenAI `/v1/models` endpoint returns 200 for valid keys and 401 for invalid keys, with no usage charges.
- No changes are needed to GitHub workflow files or `run-agent.sh` — they already handle the `OPENAI_API_KEY` environment variable.
- The existing `@@unique([userId, provider])` database constraint already supports multiple providers per user without migration beyond adding the enum value.
- The existing credential encryption infrastructure works identically for OpenAI keys (same encryption, same security guarantees).
