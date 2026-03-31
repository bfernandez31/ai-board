# Feature Specification: BYOK - User API Key Management for AI Agents

**Feature Branch**: `AIB-428-byok-gestion-des`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "BYOK - gestion des cles API utilisateur pour les agents AI"

## Auto-Resolved Decisions

- **Decision**: Encryption algorithm selection — AES-256-GCM with master key stored as environment variable
- **Policy Applied**: CONSERVATIVE (via AUTO recommendation)
- **Confidence**: High (score 0.9, net score +8 — multiple sensitive/compliance signals: encryption, authentication, secret management)
- **Fallback Triggered?**: No — AUTO clearly recommends CONSERVATIVE given security-critical context
- **Trade-offs**:
  1. AES-256-GCM is industry standard but requires careful IV/nonce management; no performance concern at expected scale
  2. Master key in env var is simple but limits future key rotation — acceptable for launch, upgradable to envelope encryption later
- **Reviewer Notes**: Verify that the master key environment variable is provisioned in all deployment environments before launch

---

- **Decision**: BYOK is mandatory with no fallback to server-level shared keys
- **Policy Applied**: CONSERVATIVE (via AUTO recommendation)
- **Confidence**: High (score 0.9 — aligns with compliance/billing isolation requirements stated in Terms of Service)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Higher onboarding friction — new users must configure a key before launching any workflow
  2. Eliminates shared-cost risk and aligns with per-user billing from day one
- **Reviewer Notes**: Ensure onboarding flow and error messaging clearly guide users to configure their key before first workflow launch

---

- **Decision**: One credential per provider per user (not per project)
- **Policy Applied**: CONSERVATIVE (via AUTO recommendation)
- **Confidence**: High (score 0.9 — simplest secure model, avoids key sprawl)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users cannot use different keys for different projects — acceptable at launch, can evolve later
  2. Reduces UI complexity and attack surface (fewer stored secrets)
- **Reviewer Notes**: If future feedback requests per-project keys, the data model (provider + userId unique constraint) can be relaxed without major refactoring

---

- **Decision**: Team/multi-member projects use the project owner's credential
- **Policy Applied**: CONSERVATIVE (via AUTO recommendation)
- **Confidence**: High (score 0.9 — standard SaaS B2B pattern, explicit in ticket description)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Team members cannot use their own keys — owner bears all AI costs for the project
  2. Simple authorization model; avoids complex per-member key selection logic
- **Reviewer Notes**: Confirm this aligns with billing expectations for TEAM plan users

---

- **Decision**: Credential validation strategy — client-side format check + server-side provider API call
- **Policy Applied**: CONSERVATIVE (via AUTO recommendation)
- **Confidence**: High (score 0.9 — dual validation is standard practice, explicitly requested)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Server-side validation adds latency on save but prevents storing invalid credentials
  2. Provider API validation may fail if the provider is temporarily unavailable — handle gracefully
- **Reviewer Notes**: Define behavior when provider validation endpoint is unreachable (suggest: allow save with warning, revalidate on next workflow launch)

## User Scenarios & Testing

### User Story 1 - Configure AI Credential (Priority: P1)

A user navigates to their settings page and adds their Anthropic API key (or OAuth token) so that AI workflows can run on their projects. They select the credential type, enter a label and the key value, and submit. The system validates the format in real-time and verifies the key with the provider on submission. Once saved, the key is masked (only last 4 characters visible) and the user sees a confirmation.

**Why this priority**: Without a configured credential, no workflow can run. This is the foundational capability that unblocks all AI features for the user.

**Independent Test**: Can be fully tested by navigating to settings, adding a credential, and verifying it appears masked in the credential list. Delivers the core value of credential storage.

**Acceptance Scenarios**:

1. **Given** a user with no configured credential, **When** they navigate to settings and add an Anthropic API key with label "My key", **Then** the key is validated, encrypted, stored, and displayed masked (e.g., `****ab12`) with the label.
2. **Given** a user entering an API key, **When** the format is invalid (e.g., missing `sk-ant-` prefix), **Then** a real-time validation error is shown before submission.
3. **Given** a user submitting a correctly formatted key, **When** the server-side validation against Anthropic fails, **Then** an explicit error message explains the key is invalid or the provider is unreachable.
4. **Given** a user choosing "OAuth Token" as credential type, **When** they submit a valid token, **Then** the system stores it with the OAUTH_TOKEN type and displays it masked.

---

### User Story 2 - Workflow Retrieves Owner Credential (Priority: P1)

When an AI workflow is triggered for a project, the system automatically retrieves the project owner's encrypted credential via a secure internal endpoint (authenticated by workflow token), decrypts it, and provides the appropriate environment variable to the workflow process. The credential is never passed in workflow dispatch inputs.

**Why this priority**: Equal priority with credential configuration — workflows are the consumers of stored credentials. Both must work for the feature to deliver value.

**Independent Test**: Can be tested by triggering a workflow on a project whose owner has a configured credential, and verifying the workflow receives the correct environment variable.

**Acceptance Scenarios**:

1. **Given** a project owner has an API_KEY credential configured, **When** a workflow is triggered for that project, **Then** the workflow retrieves the decrypted key and sets `ANTHROPIC_API_KEY`.
2. **Given** a project owner has an OAUTH_TOKEN credential configured, **When** a workflow is triggered, **Then** the workflow retrieves the decrypted token and sets `CLAUDE_CODE_OAUTH_TOKEN`.
3. **Given** a project owner has no credential configured, **When** a workflow is triggered, **Then** the workflow launch is blocked and the user sees an explicit message: "No AI credential configured. Please add your Anthropic key in Settings."
4. **Given** an unauthenticated request (no valid workflow token), **When** the credential retrieval endpoint is called, **Then** the request is rejected with 401.

---

### User Story 3 - Manage Existing Credential (Priority: P2)

A user can view, test, replace, or delete their existing credential from the settings page. Testing re-validates the key against the provider. Replacing overwrites the existing credential for that provider. Deleting removes it entirely.

**Why this priority**: Management operations are secondary to initial setup and workflow consumption, but essential for key rotation and troubleshooting.

**Independent Test**: Can be tested by adding a credential, then performing test/replace/delete operations and verifying each outcome.

**Acceptance Scenarios**:

1. **Given** a user with an existing Anthropic credential, **When** they click "Test", **Then** the system validates the key against the provider and shows success or failure.
2. **Given** a user with an existing credential, **When** they submit a new key for the same provider, **Then** the old credential is replaced (not duplicated) and the new one is encrypted and stored.
3. **Given** a user with an existing credential, **When** they delete it, **Then** the credential is permanently removed and workflows for their projects can no longer launch until a new one is added.
4. **Given** a user viewing their credential, **Then** only the last 4 characters are visible — the full key is never sent to the client after initial submission.

---

### Edge Cases

- What happens when a credential is deleted while a workflow is already running? The running workflow completes with the key it already fetched; only subsequent launches are blocked.
- What happens when the Anthropic validation endpoint is temporarily unavailable during key submission? The system displays a clear error distinguishing "invalid key" from "provider unreachable" and allows retry.
- What happens when a project owner's credential expires or is revoked at the provider level? The workflow fails with an explicit error; the owner is notified to update their credential.
- What happens when a user who owns multiple projects deletes their credential? All projects they own are affected — workflows for all their projects are blocked until a new credential is added.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to add one credential per supported provider (Anthropic at launch)
- **FR-002**: System MUST support two credential types: API_KEY and OAUTH_TOKEN
- **FR-003**: System MUST allow users to assign a free-text label to their credential
- **FR-004**: System MUST validate credential format on the client in real-time during input (e.g., `sk-ant-` prefix for API keys)
- **FR-005**: System MUST validate credentials against the provider API on server-side submission
- **FR-006**: System MUST encrypt credentials at rest using AES-256-GCM before database storage
- **FR-007**: System MUST never return the full credential value to the client after initial submission — only the last 4 characters
- **FR-008**: System MUST allow users to test, replace, or delete their existing credential at any time
- **FR-009**: System MUST enforce a unique constraint of one credential per provider per user
- **FR-010**: System MUST provide a secure internal endpoint for workflows to retrieve the decrypted credential of a project's owner, authenticated exclusively by workflow token
- **FR-011**: System MUST set the appropriate environment variable based on credential type: `ANTHROPIC_API_KEY` for API_KEY, `CLAUDE_CODE_OAUTH_TOKEN` for OAUTH_TOKEN
- **FR-012**: System MUST block workflow launch when the project owner has no credential configured and display an explicit user-facing message
- **FR-013**: System MUST never log credential values in any system log (server, workflow, CI/CD)
- **FR-014**: System MUST support adding new providers by extending an enumeration and adding format validation — without requiring architectural changes
- **FR-015**: System MUST use the project owner's credential for all workflows on that project, regardless of which team member triggers the workflow

### Key Entities

- **UserCredential**: Represents an encrypted AI provider credential belonging to a user. Key attributes: provider (enum: ANTHROPIC, extensible), credential type (API_KEY or OAUTH_TOKEN), user-assigned label, encrypted value, IV/nonce for decryption, last 4 characters (for display), validation status, timestamps. Unique per provider per user.
- **Provider (enum)**: Identifies the AI service provider. Initially contains ANTHROPIC only; designed as an extensible enumeration so new providers can be added without schema changes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can configure their AI credential and launch their first workflow within 3 minutes of navigating to settings
- **SC-002**: 100% of stored credentials are encrypted at rest — no plaintext credentials exist in the database at any time
- **SC-003**: Credential values never appear in application logs, workflow logs, or CI/CD output (verifiable by log audit)
- **SC-004**: Workflows retrieve and apply the correct credential within 2 seconds of launch, with no user-visible delay
- **SC-005**: Users receive clear, actionable error messages within 3 seconds when a credential is missing, invalid, or the provider is unreachable
- **SC-006**: Adding support for a new AI provider requires only adding an enum value and a format validation rule — no structural changes to the data model or credential management flow
- **SC-007**: 95% of users successfully add a valid credential on their first attempt (measured by success rate of credential creation requests)
