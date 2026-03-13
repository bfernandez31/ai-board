# Feature Specification: BYOK - Bring Your Own API Key

**Feature Branch**: `AIB-247-byok-bring-your`
**Created**: 2026-03-13
**Status**: Draft
**Input**: User description: "Allow users to provide their own API keys for AI agents (Claude, Codex) so that AI costs are charged to them."

## Auto-Resolved Decisions

- **Decision**: Encryption algorithm for API key storage
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 13 — strong security signals throughout the feature description)
- **Fallback Triggered?**: No — AUTO confidently recommended CONSERVATIVE due to multiple security/compliance keywords
- **Trade-offs**:
  1. Authenticated encryption (AES-256-GCM) adds implementation complexity but prevents tampering and ensures confidentiality
  2. Requires a dedicated server-side encryption key (environment variable), adding operational overhead but meeting industry standards
- **Reviewer Notes**: Verify that the encryption key management strategy (environment variable) meets the organization's security posture. Consider key rotation strategy for the encryption key itself.

---

- **Decision**: API key validation approach — real-time provider API call vs. format-only validation
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 13 — security context favors thorough validation)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Real-time validation confirms key works but adds latency (~1-2s) and requires external API calls
  2. Format-only validation is faster but could accept revoked or invalid keys
- **Reviewer Notes**: Real-time validation chosen per CONSERVATIVE policy. Confirm that a lightweight validation endpoint exists for each supported provider (Anthropic, OpenAI).

---

- **Decision**: Key storage scope — per-project (not per-user global)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 13 — ticket explicitly states "settings d'un projet")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Per-project keys offer finer control but require users to configure keys for each project
  2. Per-user global keys would reduce setup friction but conflict with the explicit ticket requirement
- **Reviewer Notes**: The ticket explicitly describes project-level settings. Future enhancement could add user-level default keys that auto-populate new projects.

---

- **Decision**: Workflow behavior when no API key is configured — block workflow launch with explicit error
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 13 — ticket explicitly states "workflows ne peuvent pas se lancer" without keys)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Blocking prevents wasted workflow runs and confusing failures
  2. Users must configure keys before any AI workflow can execute, which could be a friction point for onboarding
- **Reviewer Notes**: Error messaging must clearly guide users to the project settings page to add their API keys.

---

- **Decision**: Billing tier interaction — Free plan requires BYOK, paid plans may use platform-provided keys
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 13 — existing codebase already lists "BYOK API key required" as a Free plan feature)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Aligns with existing billing structure where Free plan explicitly requires BYOK
  2. Paid plans could optionally provide platform keys as a premium benefit, but this is out of scope for this ticket
- **Reviewer Notes**: This spec focuses on the BYOK infrastructure. Whether paid plans provide platform keys is a separate product decision.

## User Scenarios & Testing

### User Story 1 - Add API Keys to Project (Priority: P1)

A project owner navigates to their project settings and adds their Anthropic (Claude) and/or OpenAI (Codex) API keys. The keys are securely stored and the user sees a confirmation with only the last 4 characters visible.

**Why this priority**: This is the foundational capability — without key storage, no other BYOK functionality works. It delivers immediate value by enabling the user to configure their project for AI workflows.

**Independent Test**: Can be fully tested by navigating to project settings, entering an API key, and verifying it is saved with masked display. Delivers the core value of secure key storage.

**Acceptance Scenarios**:

1. **Given** a project owner on the project settings page, **When** they enter a valid Anthropic API key and save, **Then** the key is stored encrypted and the UI displays "sk-ant-...XXXX" (last 4 characters only)
2. **Given** a project owner on the project settings page, **When** they enter a valid OpenAI API key and save, **Then** the key is stored encrypted and the UI displays "sk-...XXXX" (last 4 characters only)
3. **Given** a project owner who has already saved an API key, **When** they return to the settings page, **Then** they see a masked indicator showing only the last 4 characters (the full key is never sent back to the client)
4. **Given** a project member (non-owner), **When** they visit the project settings page, **Then** they can see that keys are configured (masked) but cannot view, add, or modify them

---

### User Story 2 - Validate API Key (Priority: P2)

A project owner wants to verify that their API key is valid before relying on it for workflows. They click a "Test" button that checks the key against the provider's API and reports success or failure.

**Why this priority**: Prevents frustration from failed workflows due to invalid keys. Builds confidence in the setup process.

**Independent Test**: Can be tested by entering a key and clicking the test button, then verifying the validation result appears correctly. Delivers value by confirming key validity upfront.

**Acceptance Scenarios**:

1. **Given** a project owner with a saved API key, **When** they click the "Test Key" button, **Then** the system validates the key against the provider and displays a success or failure message
2. **Given** a project owner entering a new key, **When** they test a key with an invalid format, **Then** the system rejects it immediately with a format error (before making any external call)
3. **Given** a project owner testing a key, **When** the provider API is unreachable, **Then** the system displays a clear message indicating the validation could not be completed (not that the key is invalid)

---

### User Story 3 - Replace or Remove API Key (Priority: P2)

A project owner needs to rotate or revoke an API key. They can replace an existing key with a new one or remove it entirely from the project settings.

**Why this priority**: Key rotation is a standard security practice. Users must be able to manage keys throughout their lifecycle.

**Independent Test**: Can be tested by saving a key, then replacing it with a new key or deleting it, and verifying the old key is no longer stored. Delivers value by enabling key lifecycle management.

**Acceptance Scenarios**:

1. **Given** a project with a saved Anthropic API key, **When** the owner enters a new key and saves, **Then** the old key is permanently replaced (not retained) and the new masked preview is displayed
2. **Given** a project with a saved API key, **When** the owner clicks "Remove Key" and confirms, **Then** the key is permanently deleted and the settings show no key configured
3. **Given** a project owner removing a key, **When** the removal is confirmed, **Then** a warning is displayed explaining that workflows will be blocked until a new key is configured

---

### User Story 4 - Workflow Uses Project API Key (Priority: P1)

When a workflow is triggered for a project, the system retrieves the project's encrypted API key, decrypts it, and provides it to the workflow execution environment. If no key is configured, the workflow is blocked with a clear error message.

**Why this priority**: This is the core integration point — BYOK only delivers value when workflows actually use the user-provided keys. Tied with P1 because key storage without workflow integration is incomplete.

**Independent Test**: Can be tested by configuring a key and triggering a workflow, then verifying the workflow uses the project key. Also test by removing the key and confirming the workflow is blocked with an appropriate message.

**Acceptance Scenarios**:

1. **Given** a project with a valid Anthropic API key configured, **When** a workflow requiring Claude is triggered, **Then** the workflow uses the project's API key (not the platform default)
2. **Given** a project with no API keys configured, **When** a user attempts to trigger a workflow, **Then** the system blocks the workflow and displays: "API key required. Configure your API keys in Project Settings to run workflows."
3. **Given** a project with an Anthropic key but no OpenAI key, **When** a workflow requiring Codex is triggered, **Then** the system blocks the workflow with a message specifying which key is missing

---

### Edge Cases

- What happens when an API key is revoked by the provider after being saved? The system cannot detect this proactively; the workflow will fail at execution time and the error should clearly indicate the key may be invalid, directing the user to test/replace it.
- What happens when a project owner is transferred? API keys remain with the project (they are project-scoped, not user-scoped). The new owner can replace them.
- What happens when the same API key is used across multiple projects? This is allowed — the system does not enforce key uniqueness across projects.
- What happens if the encryption key (server-side) is rotated? All stored API keys must be re-encrypted. This is an operational concern, not a user-facing feature.
- What happens when a project member tries to access API keys via the API directly? The endpoint must enforce project ownership checks — members can see that keys exist (masked) but cannot read, set, or delete them.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow project owners to save API keys for supported providers (Anthropic, OpenAI)
- **FR-002**: System MUST encrypt API keys at rest using authenticated encryption before storing in the database
- **FR-003**: System MUST never return the full API key to the client after initial submission — only a masked preview (last 4 characters)
- **FR-004**: System MUST never log API keys in application logs, error traces, or audit logs
- **FR-005**: System MUST provide a validation mechanism that tests a saved API key against the provider's API
- **FR-006**: System MUST allow project owners to replace an existing API key with a new one at any time
- **FR-007**: System MUST allow project owners to remove an API key entirely from a project
- **FR-008**: System MUST block workflow execution when the required API key is not configured, with a clear user-facing error message
- **FR-009**: System MUST restrict API key management (add, update, delete, test) to project owners only
- **FR-010**: System MUST display to project members whether keys are configured (without revealing any key content)
- **FR-011**: System MUST transmit API keys only over encrypted connections (HTTPS) and never include them in client-side state after the initial save request
- **FR-012**: System MUST support key format validation before attempting provider validation (e.g., Anthropic keys start with "sk-ant-")

### Key Entities

- **ProjectApiKey**: Represents an encrypted API key associated with a project. Key attributes: project association, provider type (ANTHROPIC, OPENAI), encrypted key value, masked preview (last 4 characters), creation timestamp, last-updated timestamp. One key per provider per project.
- **ApiKeyProvider**: Enumeration of supported AI providers (ANTHROPIC, OPENAI). Determines validation rules and workflow integration behavior.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Project owners can configure an API key for any supported provider in under 60 seconds
- **SC-002**: API keys are never exposed in full after initial submission — 100% of API responses and UI renders show only the masked preview
- **SC-003**: Key validation provides a pass/fail result within 5 seconds of user action
- **SC-004**: 100% of workflow launches for projects without configured keys are blocked with an actionable error message
- **SC-005**: Key replacement and removal operations complete within 3 seconds and take effect immediately for subsequent workflow runs
- **SC-006**: Zero instances of API keys appearing in application logs, network responses (beyond initial save), or client-side storage
