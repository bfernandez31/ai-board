# Feature Specification: BYOK - Bring Your Own API Key

**Feature Branch**: `AIB-283-byok-bring-your`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Permettre aux utilisateurs de fournir leurs propres cles API pour les agents AI (Claude, Codex) afin que les couts AI soient a leur charge. Dans les settings d'un projet, l'utilisateur peut ajouter ses cles API Anthropic et OpenAI, les tester, les remplacer ou les supprimer. Les cles sont chiffrees au repos, masquees dans l'interface, jamais affichees dans les logs, et les workflows ne peuvent pas se lancer sans les cles requises."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Access to manage project API keys is limited to the project owner, while other project members can only see whether a provider key is configured.
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: Medium (score: 4) - sensitive credential-management signals outweighed neutral product-setting signals
- **Fallback Triggered?**: No - AUTO resolved directly to CONSERVATIVE with no conflicting speed-oriented signals
- **Trade-offs**:
  1. Reduces the risk of accidental credential exposure or unauthorized key replacement
  2. Adds a coordination step for teams where non-owner members need to rotate credentials
- **Reviewer Notes**: Confirm that owner-only credential management matches project collaboration expectations for paid team plans

---

- **Decision**: Workflow eligibility is evaluated per provider, and a workflow is blocked before launch when any provider key required by that workflow is missing or fails validation.
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: Medium (score: 4) - security and reliability requirements favor explicit pre-flight blocking over partial execution
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents avoidable workflow failures and surprise billing against platform-managed credentials
  2. Requires clear messaging so users know which provider key must be added or fixed
- **Reviewer Notes**: Validate which workflows require Anthropic, OpenAI, or both so launch messaging stays accurate

---

- **Decision**: Replacing a provider key takes effect only for workflows launched after the change; in-progress workflows continue with the credential state captured at launch.
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: Medium (score: 4) - reliability concerns favor stable execution over mid-run credential switching
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Avoids mid-run inconsistencies and hard-to-debug partial failures
  2. Users must relaunch failed or outdated workflows to use the newly supplied key
- **Reviewer Notes**: Confirm this behavior is acceptable for urgent key revocation scenarios

---

- **Decision**: Key validation returns only high-level status and provider-safe guidance, never raw provider error payloads or any full credential fragment beyond the last four characters already shown in the UI.
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: Medium (score: 4) - credential secrecy requirements favor minimal exposure even during troubleshooting
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserves secret confidentiality across UI, logs, and support surfaces
  2. Gives users less low-level debugging detail when a provider rejects a key
- **Reviewer Notes**: Confirm that concise validation guidance is sufficient for support and self-service troubleshooting

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and validate provider keys (Priority: P1)

As a project owner, I want to add and validate Anthropic and OpenAI API keys in project settings so that AI workflows charge my own accounts instead of the platform.

**Why this priority**: Without a secure way to supply and validate provider keys, the BYOK model does not exist and the feature delivers no value.

**Independent Test**: Can be fully tested by adding a valid key for each provider from project settings, confirming the save succeeds, and confirming the UI shows only masked values plus a successful validation status.

**Acceptance Scenarios**:

1. **Given** I am the project owner and no Anthropic key is configured, **When** I add a valid Anthropic key and save it, **Then** the project records the key securely and the settings page shows Anthropic as configured with only the last four characters visible
2. **Given** I am the project owner and no OpenAI key is configured, **When** I add a valid OpenAI key and run validation, **Then** I receive a clear success result without the full key being shown again
3. **Given** I enter an invalid or expired provider key, **When** I run validation, **Then** the system rejects the key, keeps the invalid secret out of all user-visible responses, and explains that the key must be corrected before workflow use

---

### User Story 2 - Rotate or remove provider keys safely (Priority: P1)

As a project owner, I want to replace or delete stored provider keys at any time so that I can handle key rotation, compromised credentials, or billing changes without losing control of the project.

**Why this priority**: Secure lifecycle management is mandatory for any feature that stores long-lived secrets.

**Independent Test**: Can be fully tested by replacing one existing provider key, confirming only the new masked suffix is shown, then deleting the key and confirming the provider is marked as not configured.

**Acceptance Scenarios**:

1. **Given** a provider key is already configured, **When** I replace it with a new valid key, **Then** the old key is no longer usable for future workflow launches and the UI updates to show only the last four characters of the new key
2. **Given** a provider key is configured, **When** I delete it, **Then** the provider is marked as not configured and future workflows that need that provider are blocked before launch
3. **Given** another project member opens project settings, **When** they view provider status, **Then** they can see whether each provider is configured but cannot reveal, copy, edit, or delete the stored key

---

### User Story 3 - Launch workflows only when required keys are available (Priority: P1)

As a user launching an AI workflow, I want the system to tell me before the workflow starts whether the required provider keys are configured so that I do not waste time on workflows that cannot run.

**Why this priority**: Clear pre-launch eligibility is necessary to avoid failed jobs, unclear billing responsibility, and support overhead.

**Independent Test**: Can be fully tested by attempting to launch a workflow with a missing required provider key and verifying that launch is blocked with an explicit message naming the missing or invalid provider.

**Acceptance Scenarios**:

1. **Given** a workflow requires Anthropic and the project has no valid Anthropic key, **When** I try to start the workflow, **Then** the workflow does not start and I see a message explaining that an Anthropic key must be configured in project settings
2. **Given** a workflow requires OpenAI and the project has a valid OpenAI key, **When** I start the workflow, **Then** the workflow is allowed to launch under the project's BYOK configuration
3. **Given** a workflow requires both providers and one provider key is missing or invalid, **When** I try to start the workflow, **Then** launch is blocked and the message identifies every provider that must be fixed before retrying

---

### User Story 4 - Protect secrets throughout the user journey (Priority: P2)

As a project owner, I want my provider keys to remain hidden after initial entry so that using BYOK does not create new opportunities for accidental exposure.

**Why this priority**: The feature is only acceptable if it maintains strict secrecy in everyday usage, support, and operations.

**Independent Test**: Can be fully tested by saving keys, revisiting the settings screen, reviewing job histories and error messages, and confirming that no full key value is displayed in any user-accessible surface.

**Acceptance Scenarios**:

1. **Given** I have already saved a provider key, **When** I reopen project settings, **Then** I can see only masked status information and never the full key value
2. **Given** a key validation attempt fails, **When** the error is shown to me, **Then** the message contains troubleshooting guidance without exposing the key or raw provider error details that could leak it
3. **Given** a workflow runs or fails, **When** users review workflow-facing status information, **Then** no full provider key appears in messages, activity history, or any other user-visible output

### Edge Cases

- What happens when a project has only one provider key configured but a workflow needs both providers? The workflow is blocked before launch and names the missing provider requirement explicitly.
- What happens when a project owner saves a new key while a workflow is already running? The current workflow continues with its original launch context, and the new key applies only to later workflow launches.
- What happens when a previously valid key becomes revoked or exceeds provider quota? Validation and workflow launch checks must surface that the provider key is no longer usable and block new launches until corrected.
- What happens when a project is transferred to a new owner? Credential-management authority moves to the new owner without revealing the stored secret value during the handoff.
- What happens when a user pastes a malformed key, extra whitespace, or the wrong provider key type? The system rejects the input with provider-specific but non-sensitive guidance and does not mark the provider as configured.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a project owner to add one Anthropic API key and one OpenAI API key from project settings.
- **FR-002**: The system MUST store provider keys so that their full plaintext values are not retrievable from routine application data access.
- **FR-003**: The system MUST transmit a provider key back through the client only during the initial submission needed to save or replace it.
- **FR-004**: The system MUST show only masked provider key status after submission, including no more than the final four characters of a saved key.
- **FR-005**: The system MUST allow the project owner to validate each provider key and receive a clear valid or invalid result before using it in workflows.
- **FR-006**: The system MUST ensure validation responses and other user-facing messages never expose the full key value.
- **FR-007**: The system MUST allow the project owner to replace a stored provider key at any time.
- **FR-008**: The system MUST allow the project owner to delete a stored provider key at any time.
- **FR-009**: The system MUST mark each provider independently as configured, not configured, or invalid for workflow eligibility purposes.
- **FR-010**: The system MUST evaluate required provider availability before a workflow starts.
- **FR-011**: The system MUST block workflow launch when any provider key required by that workflow is missing, invalid, or no longer usable.
- **FR-012**: The system MUST explain which provider key must be added or corrected when a workflow is blocked for BYOK reasons.
- **FR-013**: The system MUST use the project's configured provider key for all workflow calls to that provider when the workflow is allowed to run.
- **FR-014**: The system MUST ensure replacing or deleting a key affects only future workflow launches and does not reveal or alter the secret material already in use by an in-progress workflow.
- **FR-015**: The system MUST prevent provider keys from appearing in user-visible workflow output, operational logs, or audit surfaces accessible through the product.
- **FR-016**: The system MUST preserve clear project-level ownership of AI usage charges by using BYOK credentials only from the project where they were configured.
- **FR-017**: The system MUST show non-owner project members only high-level provider configuration status and MUST prevent them from revealing, editing, deleting, or copying stored keys.
- **FR-018**: The system MUST provide actionable error guidance when a save, validation, replacement, deletion, or workflow eligibility check fails.

### Key Entities *(include if feature involves data)*

- **Project AI Credential**: A project-scoped secret for one supported AI provider, including provider identity, masked display suffix, configuration status, validation status, and last-updated ownership metadata.
- **Provider Validation Result**: The latest high-level outcome showing whether a provider key can currently be used, when it was last checked, and what corrective guidance should be shown without exposing secret data.
- **Workflow Provider Requirement**: The set of AI providers a workflow needs before launch so the system can decide whether the workflow is eligible to run under BYOK.

### Assumptions

- BYOK is configured at the project level rather than the individual user level because workflows run in a project context.
- Anthropic and OpenAI are the only supported BYOK providers in this phase because they correspond to the Claude and Codex agents named in the request.
- A workflow may require one provider or multiple providers, and eligibility checks must evaluate only the providers that specific workflow needs.
- Existing platform-managed credentials, if any, are not used as a silent fallback once BYOK gating is introduced for a workflow that requires a project-managed key.

### Dependencies

- Project settings must expose a dedicated BYOK area with clear provider status and management actions for the owner.
- Workflow launch surfaces must know which provider requirements apply before a job is queued.
- Operational monitoring and support workflows must respect the rule that full keys are never exposed in product-accessible logs or status surfaces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of project owners can add and validate a provider key for a supported AI provider in under 2 minutes without external support.
- **SC-002**: 100% of workflow launch attempts that lack a required valid provider key are blocked before execution begins and present an explicit provider-specific reason.
- **SC-003**: 100% of saved provider keys remain masked in product-facing settings and workflow status surfaces, with no more than the last four characters ever displayed.
- **SC-004**: At least 90% of invalid-key validation attempts give users enough guidance to correct the issue and succeed on their next attempt without contacting support.
- **SC-005**: Security or operational review finds zero instances of full provider keys appearing in user-visible messages, job histories, or support-accessible application logs for this feature.
