# Feature Specification: Add Gemini as AI agent (Google provider)

**Feature Branch**: `AIB-612-add-gemini-cli`  
**Created**: 2026-04-12  
**Status**: Draft  
**Input**: User description: "Add Gemini as an AI agent under the Google provider with parity for credential management, agent selection, workflow support, telemetry, analytics, and icon display, while also fixing existing Mistral gaps in analytics and project setup."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Use a conservative default for agent credential validation and storage behavior, including blocking unverified or invalid Google credentials from being used in workflow runs.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Medium (score: 4) - sensitive credential and authentication signals (+3) combined with general user-facing configuration context (+1)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Strong verification reduces the risk of failed runs and invalid credential storage.
  2. It adds friction for users entering credentials, but avoids avoidable workflow failures and support overhead.
- **Reviewer Notes**: Confirm the verification experience is clear enough for both API-key and OAuth-token users.

---

- **Decision**: Restrict Gemini availability to the explicitly supported multi-agent workflows and require unsupported workflows to prevent Gemini selection rather than failing only after dispatch.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Medium (score: 4) - workflow-scope restriction affects reliability and user expectations, and the request explicitly names unsupported flows
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preventing selection earlier reduces confusion and wasted workflow attempts.
  2. It requires every relevant entry point to honor workflow-specific agent availability consistently.
- **Reviewer Notes**: Validate which screens can trigger unsupported workflows so the restriction is visible before execution.

---

- **Decision**: Treat analytics, onboarding, and selector coverage as a shared agent-consistency requirement so Gemini and Mistral appear wherever the product supports those agent choices, instead of fixing each missing surface independently.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Medium (score: 4) - cross-surface consistency affects reporting integrity and reduces future omissions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A consistency-first requirement reduces repeated gaps when agents are added later.
  2. It broadens validation scope beyond the immediate Gemini surface work.
- **Reviewer Notes**: Review all agent-facing surfaces during implementation planning to ensure no hardcoded exclusions remain.

---

- **Decision**: When a Gemini model produces telemetry but does not have a recognized pricing entry, preserve usage metrics and mark cost as unavailable for review rather than reporting zero cost or dropping the job from analytics.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Medium (score: 4) - cost reporting affects business trust, while preserving raw usage prevents data loss
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserving partial telemetry keeps operational visibility intact even when pricing metadata lags.
  2. Reported cost totals may be temporarily incomplete until pricing data is updated.
- **Reviewer Notes**: Confirm how unavailable cost values should be surfaced to avoid misleading aggregate totals.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add and verify a Google credential (Priority: P1)

A user who works with Gemini needs to save a Google credential in AI Credentials, confirm that it is valid, and trust that the system will use it safely for Gemini-powered work.

**Why this priority**: Without a valid credential path, Gemini cannot be used at all. This is the gating capability for every downstream workflow and reporting surface.

**Independent Test**: Can be fully tested by saving each supported Google credential type, observing validation feedback, and confirming the credential is available for Gemini-backed workflows without exposing secret values back to the user.

**Acceptance Scenarios**:

1. **Given** a user enters a valid Google AI credential, **When** they save it in AI Credentials, **Then** the system accepts it, verifies it, and shows Google as an available provider for Gemini usage
2. **Given** a user enters a valid Gemini OAuth credential, **When** they save it, **Then** the system verifies it and stores it for later Gemini workflow use
3. **Given** a user enters an invalid or expired Google credential, **When** they attempt to save it, **Then** the system rejects it with actionable guidance and does not treat it as ready for workflow use

---

### User Story 2 - Choose Gemini where it is supported (Priority: P1)

A project owner or collaborator needs to select Gemini as the default or per-ticket agent in every supported agent-selection surface, while being prevented from using Gemini in workflows that remain Claude-centric or otherwise unsupported.

**Why this priority**: Agent selection is the main product entry point for Gemini adoption. Users need clear availability rules so they know when Gemini is usable and when another agent is required.

**Independent Test**: Can be fully tested by reviewing project setup, project settings, new-ticket creation, ticket overrides, ticket cards, and workflow entry points to verify Gemini appears where supported and is blocked where unsupported.

**Acceptance Scenarios**:

1. **Given** a project supports Gemini-enabled workflows, **When** the owner selects a default agent, **Then** Gemini appears alongside the other supported agents with its name and icon
2. **Given** a user creates or edits a ticket, **When** they choose a ticket-specific agent override, **Then** Gemini is available as an option for supported workflows
3. **Given** a user is in a context that triggers an unsupported workflow, **When** they attempt to use Gemini, **Then** the product prevents the selection or dispatch and explains that the workflow does not support Gemini

---

### User Story 3 - Run supported Gemini workflows with complete job tracking (Priority: P1)

A user needs supported workflows launched with Gemini to complete successfully and produce the same job-level visibility they already expect for the other multi-agent providers.

**Why this priority**: Selecting Gemini has little value unless supported workflows can run end-to-end and produce trustworthy operational records for duration, tokens, tools, model, and estimated cost.

**Independent Test**: Can be fully tested by dispatching each supported Gemini workflow and confirming the resulting job records include the expected agent attribution, telemetry metrics, and status outcomes.

**Acceptance Scenarios**:

1. **Given** a user starts a specification, planning, implementation, quick-build, or iterate workflow with Gemini, **When** the workflow runs, **Then** the job is executed under Gemini and completes or fails with a clear recorded status
2. **Given** a Gemini job emits telemetry during execution, **When** the job record is updated, **Then** duration, token usage, tool usage, selected model, and estimated cost are captured in the same way as other supported agents
3. **Given** a Gemini workflow cannot start because the required Google credential is missing or no longer valid, **When** dispatch is attempted, **Then** the system blocks the run and provides a credential-related error instead of creating an ambiguous failed execution

---

### User Story 4 - Analyze agent usage consistently across Gemini and Mistral (Priority: P2)

A project team needs analytics and onboarding surfaces to treat Gemini and Mistral consistently with the existing agents so reporting, filtering, and setup decisions reflect the actual available options.

**Why this priority**: This work closes current product gaps, prevents Gemini from being only partially integrated, and improves trust in analytics and onboarding.

**Independent Test**: Can be fully tested by viewing analytics filters and project setup screens after the change and confirming all supported agents appear consistently and produce correct filtering behavior.

**Acceptance Scenarios**:

1. **Given** jobs exist for Gemini and Mistral, **When** a user filters the analytics dashboard by agent, **Then** both agents appear as filter options and return the correct job metrics
2. **Given** a user opens the project setup experience, **When** agent choices are shown, **Then** Gemini and Mistral appear alongside Claude and Codex where supported
3. **Given** mixed-agent usage across jobs, **When** the user views analytics summaries, **Then** token usage, cost, cache efficiency, and tool distribution include Gemini jobs and remain accurate for Mistral jobs

### Edge Cases

- A user has an existing project or ticket state referencing an agent that is not supported by the workflow they are about to run.
- A saved Google credential passes format checks but later fails live verification because it has been revoked or expired.
- A Gemini job emits partial telemetry, such as token counts without recognized pricing metadata.
- Analytics contain a mix of historical jobs from Claude, Codex, Mistral, and Gemini, including jobs created before the consistency fixes were released.
- A project setup or selector view is rendered in a context with limited workflow support and must not imply Gemini is universally available.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support `GOOGLE` as an AI credential provider for Gemini usage.
- **FR-002**: Users MUST be able to store either a Google AI credential or a Gemini OAuth credential for the Google provider.
- **FR-003**: The system MUST validate Google credentials before they are treated as usable for Gemini workflows.
- **FR-004**: The system MUST protect stored Google credentials with the same confidentiality standards already applied to other AI provider credentials.
- **FR-005**: Gemini MUST be available as an agent choice in project default-agent settings, ticket-level overrides, new-ticket creation, and ticket summary surfaces wherever those surfaces can lead to supported Gemini workflows.
- **FR-006**: The system MUST display Gemini with its own label and icon anywhere supported agent choices or agent identity are shown.
- **FR-007**: The system MUST allow Gemini-driven execution for the specification, planning, implementation, quick-build, and iteration workflows that already support multiple agents.
- **FR-008**: The system MUST prevent Gemini from being selected or dispatched for workflows that remain limited to other agents, including verification, AI-assist, retrospective-specification, and onboarding automation flows.
- **FR-009**: When a Gemini workflow is dispatched, the system MUST supply the associated Google credential at runtime without exposing the credential value in user-visible logs or UI.
- **FR-010**: Gemini workflow runs MUST record agent-attributed job metrics including status, duration, model, token usage, tool usage, and estimated cost when pricing data is available.
- **FR-011**: When Gemini usage metrics are available but pricing data is not, the system MUST preserve the job metrics and identify the cost as unavailable rather than substituting an inaccurate value.
- **FR-012**: The analytics dashboard MUST include Gemini as a filterable agent and MUST include Gemini jobs in aggregate token, cost, cache-efficiency, and tool-usage views.
- **FR-013**: The analytics dashboard MUST include Mistral anywhere agent-based analytics filtering or labeling is available today.
- **FR-014**: The project setup experience MUST show Gemini and Mistral in the agent-selection list anywhere that setup flow offers supported agent choices.
- **FR-015**: Agent-selection and analytics surfaces MUST use a consistent set of supported-agent definitions so newly supported agents do not appear on some surfaces and disappear from others.
- **FR-016**: The system MUST preserve existing behavior for Claude, Codex, and Mistral credential handling, agent selection, workflow dispatch, and analytics while adding Gemini support.

### Key Entities *(include if feature involves data)*

- **Supported Agent**: A selectable AI agent identity that has a label, icon, availability rules, and workflow compatibility boundaries.
- **Google Credential**: A user-owned secret used to authorize Gemini access, with a provider type, validation state, and masked display details.
- **Job Usage Record**: A workflow execution record that captures the chosen agent, execution outcome, model identity, duration, token usage, tool usage, and estimated cost.
- **Agent Analytics View**: An aggregated representation of job usage that groups and filters metrics by supported agent.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Google Credential Verification**: Triggered when a user creates or updates a Google credential.
  - **Input**: Credential type, secret value, and the acting user context
  - **Phases**: Validate submitted format, verify the credential against the provider, classify the credential as usable or unusable, and return user-facing validation feedback
  - **Output**: A stored verified credential or a rejected submission with guidance
  - **Error behavior**: Transient verification failures must not mark the credential as verified; users receive a clear retry path

- **Supported Workflow Dispatch**: Triggered when a user starts a workflow from a project or ticket with Gemini selected.
  - **Input**: Selected agent, workflow type, project and ticket context, and the owning credential
  - **Phases**: Confirm the workflow supports the chosen agent, confirm a valid credential is available, launch the workflow under the selected agent, and associate the resulting job with that agent choice
  - **Output**: A running or rejected job with an explicit reason
  - **Error behavior**: Unsupported workflow-agent combinations and missing credentials must be rejected before ambiguous execution begins

- **Gemini Usage Ingestion and Cost Estimation**: Triggered as Gemini workflows emit job telemetry and when jobs finish.
  - **Input**: Agent-attributed job events, model identity, token counts, tool-usage details, and pricing reference data
  - **Phases**: Parse usage events, aggregate job metrics, estimate cost when pricing is known, and publish the results to job records and analytics views
  - **Output**: Updated job metrics and analytics-ready usage data
  - **Error behavior**: Partial usage data must still be retained; missing pricing data must not erase other metrics

### Assumptions & Dependencies

- Google continues to support the two credential paths described in the ticket: direct key-based credentials and Gemini OAuth credentials.
- Gemini is only required for workflows that are already intended to support multiple agents; expanding unsupported workflows is out of scope.
- Product icons and labels for Gemini are available and approved for use in the same surfaces that already display other agents.
- Current analytics views remain the source of truth for job-level usage reporting, so Gemini and Mistral must align with those existing reporting definitions rather than introducing a separate reporting path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid Google credentials entered for Gemini are either verified successfully or rejected with a clear error before a user can rely on them for workflow execution.
- **SC-002**: Users can select Gemini in every supported agent-selection surface and cannot dispatch Gemini from unsupported workflows during release validation.
- **SC-003**: 100% of supported Gemini workflow runs produce job records that include agent identity, duration, token usage, tool usage, and either estimated cost or an explicit unavailable-cost state.
- **SC-004**: Analytics release validation shows Gemini and Mistral as available agent filters and returns correct aggregate metrics for both agents on representative test data.
- **SC-005**: Regression validation confirms no loss of credential, workflow, selector, or analytics functionality for Claude, Codex, and existing Mistral behavior outside the gaps explicitly addressed by this feature.
