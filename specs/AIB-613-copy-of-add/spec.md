# Feature Specification: Add Gemini CLI as AI Agent (Google Provider)

**Feature Branch**: `AIB-613-copy-of-add`  
**Created**: 2024-07-14  
**Status**: Draft  
**Input**: User description from ticket AIB-613

## Auto-Resolved Decisions

- **Decision**: Credential encryption standard
- **Policy Applied**: CONSERVATIVE (via AUTO with high confidence)
- **Confidence**: High (0.9) - Sensitive data handling with explicit existing pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Uses established AES-256-GCM pattern - maintains consistency across providers
  2. No performance impact - matches current implementation
- **Reviewer Notes**: Verify encryption matches existing provider implementations exactly

- **Decision**: Telemetry format and collection method
- **Policy Applied**: CONSERVATIVE (via AUTO with high confidence)
- **Confidence**: High (0.9) - Leverages Gemini CLI native OTLP support
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Uses native OTLP format - ensures compatibility with Gemini CLI
  2. Aligns with existing telemetry pipeline - minimal integration effort
- **Reviewer Notes**: Validate OTLP event parsing handles all required token types

- **Decision**: Workflow availability restriction
- **Policy Applied**: CONSERVATIVE (via AUTO with high confidence)
- **Confidence**: High (0.9) - Explicit requirements in description
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Limits to 3 multi-agent workflows only - reduces scope and testing surface
  2. Explicitly excludes Claude-specific workflows - prevents integration issues
- **Reviewer Notes**: Verify workflow dispatch logic correctly excludes verify, ai-board-assist, retro-spec, and onboard

- **Decision**: Analytics dashboard fixes for Mistral
- **Policy Applied**: CONSERVATIVE (via AUTO with high confidence)
- **Confidence**: High (0.9) - Explicit requirement to fix existing gaps
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Makes analytics agent support dynamic - future-proof for additional agents
  2. Includes both Gemini and Mistral - addresses existing technical debt
- **Reviewer Notes**: Ensure NamedAgent type and getAgentLabel() support all current and future agents

- **Decision**: Project setup page fixes for Mistral
- **Policy Applied**: CONSERVATIVE (via AUTO with high confidence)
- **Confidence**: High (0.9) - Explicit requirement to fix existing gaps
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Makes agent list dynamic - eliminates hardcoded arrays
  2. Includes all agents consistently - improves user experience
- **Reviewer Notes**: Verify setup-page-client.tsx uses dynamic agent enumeration

## User Scenarios & Testing

### User Story 1 - Store and Validate Google Credentials (Priority: P1)

As a user who works with Google's Gemini CLI, I want to store and validate my Google AI Studio API key or OAuth token so I can use Gemini as an agent in my workflows.

**Why this priority**: This is the foundation - without credential storage, no other Gemini functionality can work. It delivers the core value of enabling Gemini usage.

**Independent Test**: Can be fully tested by storing a valid credential, verifying it passes format validation and live API verification, and confirming it's encrypted at rest. Delivers the value of secure credential management.

**Acceptance Scenarios**:

1. **Given** I navigate to Settings → AI Credentials, **When** I select GOOGLE as provider, **Then** I see fields for API_KEY and OAUTH_TOKEN
2. **Given** I enter an API key in format "AIza...", **When** I save, **Then** the system validates the format and shows success
3. **Given** I enter an invalid API key format, **When** I save, **Then** the system shows format error
4. **Given** I enter valid credentials, **When** I save, **Then** credentials are encrypted using AES-256-GCM
5. **Given** I have stored credentials, **When** I view them, **Then** sensitive data is masked

---

### User Story 2 - Select Gemini as Default or Per-Ticket Agent (Priority: P1)

As a user with Gemini credentials stored, I want to select Gemini as my default agent or override per-ticket so I can use Gemini for specific workflows.

**Why this priority**: This enables the core workflow functionality - users need to be able to choose when and where to use Gemini.

**Independent Test**: Can be fully tested by selecting Gemini as default agent, creating a ticket with Gemini override, and verifying the selection persists and displays correctly. Delivers the value of agent selection flexibility.

**Acceptance Scenarios**:

1. **Given** I have Gemini credentials stored, **When** I create a new project, **Then** Gemini appears as an agent option
2. **Given** I select Gemini as default agent, **When** I create a new ticket, **Then** Gemini is pre-selected
3. **Given** I create a ticket, **When** I override the agent to Gemini, **Then** the selection is saved
4. **Given** I view a ticket card, **When** Gemini is selected, **Then** the Gemini icon displays correctly
5. **Given** I open agent selector, **When** I view options, **Then** Gemini appears alongside Claude, Codex, and Mistral

---

### User Story 3 - Execute Workflows with Gemini Agent (Priority: P1)

As a user who has selected Gemini for a workflow, I want the workflow to execute successfully with proper environment variables and telemetry so my tasks complete correctly.

**Why this priority**: This delivers the actual workflow execution value - without successful execution, the agent integration is incomplete.

**Independent Test**: Can be fully tested by dispatching a speckit.yml workflow with Gemini agent and verifying it completes successfully with proper telemetry collection. Delivers the value of functional workflow execution.

**Acceptance Scenarios**:

1. **Given** I have a ticket with Gemini selected, **When** I dispatch speckit.yml workflow, **Then** GEMINI_API_KEY or GEMINI_OAUTH_TOKEN is injected
2. **Given** speckit.yml workflow runs, **When** Gemini CLI executes, **Then** it runs in headless mode with telemetry enabled
3. **Given** workflow completes, **When** I check telemetry, **Then** token counts and tool calls are recorded
4. **Given** I try to dispatch verify.yml workflow, **When** Gemini is selected, **Then** the dispatch is prevented
5. **Given** workflow executes, **When** telemetry events arrive, **Then** OTLP events are parsed correctly

---

### User Story 4 - View Gemini Metrics in Analytics Dashboard (Priority: P2)

As a user who has run Gemini workflows, I want to view Gemini-specific metrics in the analytics dashboard so I can track usage and costs.

**Why this priority**: While not blocking core functionality, analytics is important for cost tracking and usage monitoring.

**Independent Test**: Can be fully tested by running Gemini workflows, then viewing the analytics dashboard and verifying Gemini data appears in filters and charts. Delivers the value of usage visibility.

**Acceptance Scenarios**:

1. **Given** I navigate to analytics dashboard, **When** I open agent filter, **Then** Gemini appears as an option
2. **Given** I select Gemini filter, **When** I view token usage chart, **Then** Gemini data is displayed
3. **Given** I view cost metrics, **When** Gemini jobs exist, **Then** costs are estimated via pricing table
4. **Given** I check agent filter, **When** I view options, **Then** Mistral also appears (fix applied)
5. **Given** I view tool distribution, **When** Gemini jobs exist, **Then** tool usage is tracked

---

### User Story 5 - Complete Project Setup with Gemini (Priority: P2)

As a new user setting up a project, I want to see Gemini as an available agent option so I can choose it during onboarding.

**Why this priority**: Important for user onboarding but not blocking existing functionality.

**Independent Test**: Can be fully tested by starting project setup, verifying Gemini appears in agent selection, and completing onboarding with Gemini selected. Delivers the value of complete onboarding experience.

**Acceptance Scenarios**:

1. **Given** I start project setup, **When** I reach agent selection, **Then** Gemini appears alongside other agents
2. **Given** I select Gemini during setup, **When** I complete onboarding, **Then** Gemini is set as default agent
3. **Given** I view agent selection, **When** I check options, **Then** Mistral also appears (fix applied)
4. **Given** I complete setup, **When** I create first ticket, **Then** Gemini is available for selection

### Edge Cases

- What happens when user stores invalid credentials that pass format validation but fail live API verification?
- How does system handle concurrent Gemini workflow executions?
- What happens when Gemini CLI returns partial telemetry data?
- How does system handle rate limiting from Google API?
- What happens when user tries to select Gemini for an unsupported workflow?

## Requirements

### Functional Requirements

- **FR-001**: System MUST support GOOGLE as a credential provider with API_KEY and OAUTH_TOKEN fields
- **FR-002**: System MUST validate Google API key format (starts with "AIza")
- **FR-003**: System MUST perform live verification of Google credentials against Google API
- **FR-004**: System MUST encrypt stored Google credentials using AES-256-GCM
- **FR-005**: System MUST display Gemini icon (/agents/gemini.svg) on all agent selectors and ticket displays
- **FR-006**: System MUST allow Gemini selection as default agent during project setup
- **FR-007**: System MUST allow Gemini selection as per-ticket override
- **FR-008**: System MUST make Gemini available only for speckit.yml, quick-impl.yml, and iterate.yml workflows
- **FR-009**: System MUST prevent Gemini selection for verify.yml, ai-board-assist.yml, retro-spec.yml, and onboard.yml workflows
- **FR-010**: System MUST inject GEMINI_API_KEY or GEMINI_OAUTH_TOKEN environment variables when Gemini workflows execute
- **FR-011**: System MUST extend run-agent.sh to handle GEMINI case with Gemini CLI installation and headless execution
- **FR-012**: System MUST configure Gemini CLI telemetry with OTLP endpoint and 60s batch interval
- **FR-013**: System MUST parse gemini_cli.api_response events for input_token_count and output_token_count
- **FR-014**: System MUST parse gemini_cli.tool_call events for tool usage tracking
- **FR-015**: System MUST estimate Gemini costs via pricing table (no direct cost_usd reporting)
- **FR-016**: System MUST include Gemini in analytics dashboard agent filters
- **FR-017**: System MUST track duration, tokens, cost, model, and tools per Gemini job
- **FR-018**: System MUST fix analytics to include Mistral in NamedAgent type and getAgentLabel()
- **FR-019**: System MUST make analytics agent iteration dynamic based on Agent enum
- **FR-020**: System MUST fix project setup page to include Mistral in agent selection
- **FR-021**: System MUST make project setup agent list dynamic or include all agents

### Key Entities

- **GoogleCredential**: Represents stored Google credentials (provider: GOOGLE, api_key: string, oauth_token: string, validation_status: enum)
- **AgentMetadata**: Represents agent display information (agent: GEMINI, label: "Gemini", icon_path: "/agents/gemini.svg", description: string)
- **WorkflowDispatch**: Represents workflow execution (workflow_name: string, agent: enum, status: enum, error_message: string)
- **TelemetryEvent**: Represents collected telemetry (job_id: string, agent: enum, event_type: string, token_counts: object, tool_calls: array)
- **PricingTable**: Represents cost estimation data (agent: enum, model: string, input_cost_per_token: float, output_cost_per_token: float)

### Internal Processes

- **Gemini Workflow Dispatch**: Triggered when user dispatches a supported workflow with Gemini agent
  - **Input**: Workflow name, ticket context, Gemini credentials
  - **Phases**:
    1. Validate Gemini is allowed for requested workflow
    2. Inject GEMINI_API_KEY or GEMINI_OAUTH_TOKEN from encrypted storage
    3. Set up telemetry environment variables
    4. Execute run-agent.sh with GEMINI case
    5. Monitor Gemini CLI execution
    6. Collect and parse OTLP telemetry events
  - **Output**: Completed workflow artifacts, accumulated telemetry metrics, job status
  - **Error behavior**: Fail fast if Gemini not allowed for workflow, retry transient failures, log detailed error information

- **Telemetry Collection and Parsing**: Triggered when Gemini CLI emits OTLP events
  - **Input**: OTLP-formatted telemetry events from Gemini CLI
  - **Phases**:
    1. Receive OTLP batch export
    2. Parse gemini_cli.api_response events for token counts
    3. Parse gemini_cli.tool_call events for tool tracking
    4. Estimate cost using pricing table
    5. Accumulate metrics on Job entity
  - **Output**: Updated job metrics, telemetry database records
  - **Error behavior**: Store raw events if parsing fails, continue processing subsequent events

- **Analytics Dashboard Filtering**: Triggered when user views analytics dashboard
  - **Input**: User filter selections, time range
  - **Phases**:
    1. Dynamically enumerate available agents from Agent enum
    2. Include Gemini and Mistral in filter options
    3. Query metrics for selected agents
    4. Aggregate and display charts
  - **Output**: Rendered analytics dashboard with all agents
  - **Error behavior**: Gracefully handle missing data, show appropriate empty states

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can store and validate Google credentials in under 1 minute
- **SC-002**: Gemini agent selection works for 100% of supported workflows without errors
- **SC-003**: Gemini workflows complete successfully with telemetry in 95% of executions
- **SC-004**: Analytics dashboard displays Gemini metrics accurately within 5% of actual usage
- **SC-005**: Project setup completes successfully with Gemini selection in under 2 minutes
- **SC-006**: All existing Claude/Codex/Mistral functionality remains unaffected (0% regression)
- **SC-007**: Gemini is correctly excluded from unsupported workflows in 100% of attempts
- **SC-008**: Telemetry parsing handles all Gemini OTLP event types without data loss
- **SC-009**: Analytics filters include all agents (Gemini, Mistral, Claude, Codex) dynamically
- **SC-010**: Cost estimation for Gemini jobs is accurate within 10% of actual Google pricing
