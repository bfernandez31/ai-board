# Feature Specification: BYOK - Bring Your Own API Key

**Feature Branch**: `AIB-285-copy-of-byok`
**Created**: 2026-03-13
**Status**: Draft
**Input**: User description: "Allow users to provide their own API keys for AI agents (Claude, Codex) so AI costs are borne by them."

## Auto-Resolved Decisions

- **Decision**: Encryption algorithm for API key storage at rest
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score 15+, all signals aligned on security)
- **Fallback Triggered?**: No - AUTO aligned with CONSERVATIVE due to strong security signals
- **Trade-offs**:
  1. Stronger encryption adds minor processing overhead on every workflow dispatch but ensures regulatory compliance
  2. Requires a server-side encryption master key as an environment variable, adding one secret to manage
- **Reviewer Notes**: Verify that the chosen encryption approach (symmetric, authenticated encryption) meets organizational compliance requirements. Ensure the master encryption key is rotated periodically.

---

- **Decision**: Backward compatibility mode - existing projects (ai-board self-management) continue using repository-level secrets without BYOK
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score 15+, explicit user requirement)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Dual-path logic (BYOK vs. repository secrets) adds complexity to workflow dispatch
  2. Ensures zero disruption to existing workflows; no migration required
- **Reviewer Notes**: Confirm that the fallback to repository secrets is clearly documented so future maintainers understand why some projects use BYOK and others do not.

---

- **Decision**: Key validation approach - validate keys by making a lightweight test call to the provider's API before saving
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score 15+, security-sensitive context)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Live validation ensures only working keys are saved, preventing workflow failures
  2. Adds a dependency on external API availability during key setup (acceptable since keys are set up infrequently)
- **Reviewer Notes**: Ensure validation errors provide clear, actionable messages without leaking sensitive details.

---

- **Decision**: API keys are scoped per project, not per user
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (explicit in user description: "settings d'un projet")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. All project members share the same keys, simplifying management
  2. Key management restricted to project owner only (CONSERVATIVE - principle of least privilege)
- **Reviewer Notes**: Confirm that project members (non-owners) should NOT be able to view, add, or modify API keys.

---

- **Decision**: Supported providers limited to Anthropic (Claude) and OpenAI (Codex) initially
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (explicit in user description)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Limiting to two providers keeps the scope focused and reduces maintenance burden
  2. Additional providers can be added later without schema changes if the data model is flexible
- **Reviewer Notes**: Verify these are the only two providers needed at launch.

## User Scenarios & Testing

### User Story 1 - Configure API Keys for a Project (Priority: P1)

As a project owner, I want to add my own Anthropic and OpenAI API keys to my project settings so that AI workflows use my keys and costs are billed to my account.

**Why this priority**: This is the core BYOK capability. Without it, no other BYOK feature works. It delivers the primary value of enabling users to run AI workflows with their own keys.

**Independent Test**: Can be fully tested by navigating to project settings, entering API keys, verifying they are saved (masked display showing last 4 characters), and confirming the keys persist across page reloads.

**Acceptance Scenarios**:

1. **Given** a project owner is on the project settings page, **When** they enter a valid Anthropic API key and save, **Then** the key is stored securely, the UI shows a masked value (e.g., `****abcd`), and a success message is displayed.
2. **Given** a project owner is on the project settings page, **When** they enter a valid OpenAI API key and save, **Then** the key is stored securely, the UI shows a masked value, and a success message is displayed.
3. **Given** a project owner has already configured an API key, **When** they view the settings page, **Then** they see the masked key (last 4 characters only) and can choose to replace or delete it.
4. **Given** a project member (non-owner) views the project settings, **When** they look at the API keys section, **Then** they can see whether keys are configured (status only) but cannot view, add, modify, or delete keys.

---

### User Story 2 - Validate API Keys Before Saving (Priority: P2)

As a project owner, I want to test my API key before saving it so that I know it is valid and will work when workflows run.

**Why this priority**: Key validation prevents workflow failures caused by invalid keys. It provides immediate feedback and avoids frustrating debugging later.

**Independent Test**: Can be tested by entering a key, clicking a "Test" button, and verifying the system reports whether the key is valid or invalid with an appropriate message.

**Acceptance Scenarios**:

1. **Given** a project owner enters an API key, **When** they click the test/validate button, **Then** the system makes a lightweight validation call to the provider and reports "Key is valid" on success.
2. **Given** a project owner enters an invalid or expired API key, **When** they click the test/validate button, **Then** the system reports a clear error message (e.g., "Invalid API key" or "Key does not have required permissions") without exposing sensitive details.
3. **Given** the provider's API is temporarily unavailable during validation, **When** the test fails due to a network error, **Then** the system displays a message indicating the provider could not be reached and suggests retrying later. The user may still choose to save the key without validation.

---

### User Story 3 - Workflows Use Project API Keys (Priority: P1)

As a project owner with configured BYOK keys, I want AI workflows to automatically use my project's API keys so that I bear the AI costs and workflows run without needing repository-level secrets for AI providers.

**Why this priority**: This is the other half of the core BYOK value proposition. Keys are useless if workflows don't consume them. Tied with P1 as both are essential for minimum viable BYOK.

**Independent Test**: Can be tested by configuring a project API key, triggering a workflow (e.g., specify or plan), and verifying the workflow completes successfully using the project's key rather than the default repository secret.

**Acceptance Scenarios**:

1. **Given** a project has a valid Anthropic API key configured, **When** a workflow is dispatched for that project, **Then** the workflow uses the project's Anthropic key for AI agent calls.
2. **Given** a project has NO API keys configured AND the project is the ai-board self-managed project, **When** a workflow is dispatched, **Then** the workflow falls back to the repository-level secret (existing behavior unchanged).
3. **Given** a project has NO API keys configured AND the project is an external project, **When** the user attempts to trigger a workflow, **Then** the system displays an explicit message: "API keys are required to run workflows. Please configure your API keys in project settings."
4. **Given** a project has a configured API key that has since been revoked or expired, **When** a workflow runs and the key fails, **Then** the workflow reports a clear error indicating the API key is invalid and the user should update it in project settings.

---

### User Story 4 - Manage (Replace/Delete) API Keys (Priority: P2)

As a project owner, I want to replace or delete my API keys at any time so that I can rotate keys or revoke access.

**Why this priority**: Key lifecycle management is essential for security hygiene but is secondary to the core configure-and-use flow.

**Independent Test**: Can be tested by replacing an existing key with a new one and verifying the old key is no longer used, and by deleting a key and verifying workflows can no longer run (for external projects).

**Acceptance Scenarios**:

1. **Given** a project has a configured API key, **When** the owner enters a new key and saves, **Then** the old key is securely overwritten and the new key is used for subsequent workflows.
2. **Given** a project has a configured API key, **When** the owner clicks "Delete" and confirms, **Then** the key is permanently removed from the system.
3. **Given** a project owner deletes an API key for an external project, **When** they attempt to trigger a workflow, **Then** the system blocks the workflow and shows the "API keys required" message.

---

### Edge Cases

- What happens when a user pastes a key with leading/trailing whitespace? The system trims whitespace before validation and storage.
- What happens when a user provides a key in an incorrect format (e.g., wrong prefix)? The system performs format validation (e.g., Anthropic keys start with `sk-ant-`) before attempting live validation.
- What happens if the encryption master key is rotated? All stored keys must be re-encrypted. This is an operational procedure, not a user-facing feature.
- What happens when multiple workflows run concurrently for the same project? Each workflow independently retrieves and decrypts the project's API key; no contention issues.
- What happens if the same user owns multiple projects? Each project has its own independent API key configuration; keys are not shared across projects.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow project owners to configure API keys for Anthropic (Claude) and OpenAI (Codex) providers within project settings.
- **FR-002**: System MUST store API keys encrypted at rest; keys MUST never be stored in plaintext in the database.
- **FR-003**: System MUST mask API keys in the UI after initial entry, displaying only the last 4 characters (e.g., `sk-****abcd`).
- **FR-004**: System MUST provide a key validation feature that tests the key against the provider's API before saving.
- **FR-005**: System MUST allow project owners to replace an existing API key with a new one at any time.
- **FR-006**: System MUST allow project owners to delete an API key at any time, with a confirmation step.
- **FR-007**: Workflows MUST use the project's configured API key when dispatching AI agent calls.
- **FR-008**: System MUST maintain full backward compatibility: projects without BYOK keys that use repository-level secrets (e.g., the ai-board self-managed project) MUST continue to work exactly as they do today with no changes required.
- **FR-009**: System MUST prevent workflow execution for external projects that have no API keys configured, displaying an explicit error message.
- **FR-010**: System MUST ensure API keys never appear in application logs, workflow logs, or API responses (except the masked last-4-character preview).
- **FR-011**: System MUST ensure API keys are never sent to the client after initial submission; the server only returns the masked preview and a boolean indicating whether a key is configured.
- **FR-012**: Only project owners MUST be able to add, modify, view (masked), or delete API keys. Project members can only see whether keys are configured (status indicator).
- **FR-013**: System MUST perform basic format validation on API keys before saving (e.g., prefix check for known providers).
- **FR-014**: System MUST support saving a key without prior validation if the provider API is unreachable during the test, with a warning to the user.

### Key Entities

- **ProjectAPIKey**: Represents an encrypted API key associated with a project. Key attributes: project reference, provider type (Anthropic/OpenAI), encrypted key value, masked preview (last 4 characters), timestamps (created/updated). One key per provider per project.
- **Provider**: The AI service provider the key authenticates against. Initially: Anthropic (Claude) and OpenAI (Codex). Stored as an enumerated type.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Project owners can configure, validate, replace, and delete API keys for both supported providers in under 2 minutes per key.
- **SC-002**: 100% of stored API keys are encrypted at rest; no plaintext keys exist in the database at any time.
- **SC-003**: Workflows for projects with configured BYOK keys complete successfully using those keys, with a success rate matching the current repository-secret-based workflow success rate.
- **SC-004**: Existing workflows for the ai-board self-managed project continue to function with zero configuration changes after BYOK is deployed (full backward compatibility).
- **SC-005**: API keys never appear in any application logs, API responses, or client-side state (verified by security audit of all code paths).
- **SC-006**: 100% of workflow dispatch attempts for external projects without configured keys are blocked with a clear, actionable error message.
- **SC-007**: Key validation provides accurate feedback (valid/invalid/unreachable) within 5 seconds of the user initiating a test.

## Assumptions

- The system has access to a server-side encryption master key (environment variable) for encrypting/decrypting API keys.
- Anthropic and OpenAI both provide lightweight API endpoints suitable for key validation (e.g., a models list endpoint or similar).
- The ai-board self-managed project is identifiable programmatically (e.g., by a known project ID or a flag) to enable the backward-compatibility fallback path.
- Project owners are responsible for the costs incurred by their API keys; the system does not track or limit usage.
- Key rotation is the user's responsibility; the system does not enforce automatic rotation policies.
