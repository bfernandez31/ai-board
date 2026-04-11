# Feature Specification: Add Gemini CLI as AI Agent (Google Provider)

**Feature Branch**: `AIB-607-add-gemini-cli`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Ticket AIB-607 — Add Gemini CLI as AI agent with full parity on credential management, agent selection, analytics, metrics/telemetry, and icon display. Also fix Mistral gaps in analytics and setup page.

## Auto-Resolved Decisions

### Decision 1: Google Credential Types

- **Decision**: Support both `API_KEY` (Google AI Studio key, format `AIza...`) and `OAUTH_TOKEN` (Gemini CLI OAuth refresh token) under a new `GOOGLE` credential provider
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — credential handling is security-sensitive; strict validation aligns with existing provider patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Dual credential types increase validation complexity but match real-world Gemini CLI usage
  2. OAUTH_TOKEN support enables existing Gemini CLI users to reuse their refresh tokens without re-auth
- **Reviewer Notes**: Confirm Google AI Studio API key format prefix (`AIza`) is stable across key generations. Verify OAuth refresh token can be validated without user interaction.

### Decision 2: Workflow Scope — Three Multi-Agent Workflows Only

- **Decision**: Gemini is available only for speckit, quick-impl, and iterate workflows. It is excluded from verify, ai-board-assist, retro-spec, and onboard workflows.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — ticket explicitly defines scope; verify/assist/retro-spec have hardcoded Claude dependencies that are out of scope to refactor
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users cannot use Gemini for code review (verify) or AI assistance — limits flexibility
  2. Keeps change scope contained and avoids risky refactors of Claude-centric workflows
- **Reviewer Notes**: Validate that workflow dispatch UI correctly hides Gemini from Claude-only workflows. Ensure no error path allows Gemini to be dispatched to excluded workflows.

### Decision 3: Mistral Gaps Fixed Alongside Gemini Addition

- **Decision**: Fix Mistral's missing presence in analytics filters and project setup page as part of this work, rather than deferring to a separate ticket
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — fixing existing gaps while adding a new agent ensures all non-Claude agents are treated consistently; prevents compounding technical debt
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly increases scope beyond pure Gemini addition
  2. Prevents Mistral users from encountering analytics gaps while Gemini is fully supported
- **Reviewer Notes**: Verify that making analytics agent support dynamic (based on the Agent enum) does not break existing Claude/Codex analytics queries or dashboard displays.

### Decision 4: Gemini Telemetry via Native OTLP

- **Decision**: Parse Gemini CLI's native OTLP telemetry events (`gemini_cli.api_response` for tokens, `gemini_cli.tool_call` for tools) rather than scraping post-execution like Mistral
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — Gemini CLI natively supports OTLP export; using native telemetry is more reliable and consistent with the Claude/Codex pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Requires telemetry endpoint to handle a new event format (additional parsing logic)
  2. Native OTLP provides real-time metrics vs post-execution scraping, improving accuracy
- **Reviewer Notes**: Confirm Gemini CLI OTLP event schema (`gemini_cli.api_response`, `gemini_cli.tool_call`) attribute names and types. Verify batch export interval (~60s) does not cause data loss on short-running jobs.

### Decision 5: Cost Estimation via Pricing Table

- **Decision**: Estimate Gemini costs using a static pricing table (same pattern as Codex and Mistral) since Gemini CLI does not report `cost_usd` directly
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — consistent with existing cost estimation patterns for non-Claude agents
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Pricing table requires manual updates when Google changes model pricing
  2. Consistent approach across all non-Claude agents simplifies maintenance
- **Reviewer Notes**: Confirm current Gemini model pricing (2.5 Pro, 2.5 Flash, etc.) at time of implementation. Include fallback cost handling for unknown model identifiers.

## User Scenarios & Testing

### User Story 1 — Store and Validate Google Credentials (Priority: P1)

A user who works with Gemini CLI navigates to Settings → AI Credentials and adds their Google credential (either an API key from Google AI Studio or an OAuth refresh token from their Gemini CLI setup). The system validates the credential format, verifies it against Google's API, and stores it encrypted.

**Why this priority**: Without valid credentials, no Gemini workflow can execute. This is the foundational prerequisite for all other Gemini functionality.

**Independent Test**: Can be fully tested by adding a Google credential in the settings page and verifying it shows as "Ready" — delivers the ability to authenticate with Google's API.

**Acceptance Scenarios**:

1. **Given** a user on the AI Credentials settings page, **When** they select Google provider and enter a valid API key starting with `AIza`, **Then** the system validates the format, verifies against Google's API, and shows the credential as "Ready"
2. **Given** a user on the AI Credentials settings page, **When** they select Google provider and enter a valid OAuth refresh token, **Then** the system validates minimum length, verifies the token, and stores it encrypted
3. **Given** a user on the AI Credentials settings page, **When** they enter an invalid or expired Google credential, **Then** the system shows a clear error message indicating the credential is invalid and sets status to "Action Required"
4. **Given** a user with an existing Google credential, **When** they update it with a new value, **Then** the old credential is replaced and the new one is verified

---

### User Story 2 — Select Gemini as Agent for a Project or Ticket (Priority: P1)

A user creating or configuring a project can choose Gemini as the default agent. When creating or editing a ticket, they can override the project default with Gemini. The Gemini icon and label display consistently across all surfaces (ticket cards, detail modals, agent selectors, setup/onboarding page).

**Why this priority**: Agent selection is the core user-facing interaction that determines which AI processes their work. This is essential for Gemini to be usable.

**Independent Test**: Can be fully tested by setting Gemini as a project's default agent and verifying the icon/label appear on ticket cards — delivers agent selection capability.

**Acceptance Scenarios**:

1. **Given** a user on the project setup/onboarding page, **When** they view the agent selection list, **Then** Gemini appears alongside Claude, Codex, and Mistral with its icon, label ("Gemini"), and description
2. **Given** a user editing project settings, **When** they select Gemini as the default agent, **Then** the project's default agent is updated and all new tickets inherit Gemini
3. **Given** a user creating a new ticket, **When** they select Gemini from the agent dropdown, **Then** the ticket is created with Gemini as its agent override
4. **Given** a ticket assigned to Gemini, **When** viewing the ticket card in the board, **Then** the Gemini icon (`/agents/gemini.svg`) is displayed correctly
5. **Given** a user on the project setup page, **When** they view the agent list, **Then** Mistral also appears (fixing the existing gap where only Claude and Codex were shown)

---

### User Story 3 — Execute Workflows with Gemini Agent (Priority: P1)

A user triggers a workflow (specify, plan, implement, quick-impl, or iterate) on a ticket assigned to Gemini. The system dispatches the workflow with the correct Gemini credentials injected, installs Gemini CLI in the workflow environment, and executes the agent command in headless mode with telemetry enabled.

**Why this priority**: Workflow execution is the core value proposition — without it, selecting Gemini as an agent has no effect.

**Independent Test**: Can be fully tested by dispatching a quick-impl job with Gemini agent and verifying the workflow completes — delivers end-to-end AI-assisted code generation via Gemini.

**Acceptance Scenarios**:

1. **Given** a ticket with Gemini agent and valid Google credentials, **When** the user triggers a specify/plan/implement workflow, **Then** the system dispatches the speckit workflow with `GEMINI_API_KEY` or `GEMINI_OAUTH_TOKEN` injected from the owner's encrypted credential
2. **Given** a ticket with Gemini agent, **When** the quick-impl workflow is triggered, **Then** Gemini CLI is installed, configured in headless mode, and executes the command successfully
3. **Given** a ticket with Gemini agent, **When** the iterate workflow is triggered during VERIFY stage, **Then** Gemini CLI processes the iteration request and reports results
4. **Given** a ticket with Gemini agent, **When** a user attempts to trigger the verify, ai-board-assist, retro-spec, or onboard workflow, **Then** the system prevents dispatch and communicates that these workflows require Claude
5. **Given** a ticket with Gemini agent but no valid Google credential for the project owner, **When** a workflow is triggered, **Then** the system blocks dispatch and notifies the user that credentials are required

---

### User Story 4 — Track Gemini Job Metrics and Costs (Priority: P2)

After a Gemini workflow completes, the system captures telemetry data including token usage (input, output, cache, thought tokens), tool calls, model name, duration, and estimated cost. This data appears on the job detail view and feeds into analytics.

**Why this priority**: Metrics provide visibility into Gemini usage and cost, enabling users to make informed decisions about agent selection. Important but not blocking core functionality.

**Independent Test**: Can be fully tested by running a Gemini job and verifying token counts, cost, and duration appear on the job — delivers usage visibility.

**Acceptance Scenarios**:

1. **Given** a completed Gemini job, **When** the telemetry endpoint receives `gemini_cli.api_response` OTLP events, **Then** it extracts input tokens, output tokens, thought tokens, and cache tokens and accumulates them on the job record
2. **Given** a completed Gemini job, **When** the telemetry endpoint receives `gemini_cli.tool_call` OTLP events, **Then** it extracts tool names and records them in the job's `toolsUsed` field
3. **Given** a completed Gemini job with a known model (e.g., "gemini-2.5-pro"), **When** cost is calculated, **Then** the system estimates cost using the Gemini pricing table and records it as `costUsd`
4. **Given** a completed Gemini job with an unknown model identifier, **When** cost is calculated, **Then** the system falls back gracefully (zero cost or best-effort estimate) and does not fail

---

### User Story 5 — View Gemini and Mistral in Analytics Dashboard (Priority: P2)

A user viewing the analytics dashboard can filter by Gemini (and Mistral, fixing the existing gap) to see token usage, cost, cache efficiency, and tool distribution for jobs run with those agents. The agent filter dynamically reflects all agents that have job data.

**Why this priority**: Analytics provide aggregate insights across agents. Fixing the Mistral gap alongside Gemini addition ensures consistency for all non-Claude agents.

**Independent Test**: Can be fully tested by running jobs with Gemini and Mistral and verifying both appear in the analytics agent filter — delivers comprehensive analytics coverage.

**Acceptance Scenarios**:

1. **Given** the analytics dashboard, **When** a user opens the agent filter, **Then** Gemini and Mistral appear as options alongside Claude, Codex, and "All agents"
2. **Given** jobs executed with Gemini agent, **When** a user filters analytics by Gemini, **Then** token usage, cost, cache efficiency, and tool distribution charts display data for Gemini jobs only
3. **Given** jobs executed with Mistral agent, **When** a user filters analytics by Mistral, **Then** charts display Mistral job data (fixing the current gap where Mistral was excluded)
4. **Given** the analytics dashboard with the "All agents" filter, **When** viewing aggregate data, **Then** Gemini and Mistral jobs are included in totals alongside Claude and Codex

---

### Edge Cases

- What happens when a user's Google API key is revoked between credential verification and workflow execution? The workflow should fail gracefully with a clear error, and the credential status should be updated on next verification.
- What happens when Gemini CLI is unavailable or fails to install in the workflow environment? The job should fail with an actionable error message identifying the installation failure.
- What happens when Gemini CLI sends OTLP events with unexpected or missing attributes? The telemetry endpoint should handle partial data gracefully, recording what is available without failing the entire batch.
- What happens when a project has Gemini as default agent but the owner has no Google credential? Workflow dispatch should be blocked with a notification directing the user to add credentials.
- What happens when the Gemini pricing table does not include a model identifier reported by the CLI? Cost estimation should fall back to zero or a documented default rate rather than erroring.
- What happens when a user tries to select Gemini for a Claude-only workflow via direct API call (bypassing UI)? The backend should validate agent eligibility per workflow and reject invalid combinations.

## Requirements

### Functional Requirements

- **FR-001**: System MUST support `GEMINI` as a value in the Agent enum, available for project default agent and per-ticket agent override
- **FR-002**: System MUST support `GOOGLE` as a credential provider with both `API_KEY` and `OAUTH_TOKEN` credential types
- **FR-003**: System MUST validate Google API keys using format check (prefix `AIza`, minimum length) and live verification against Google's generative AI API
- **FR-004**: System MUST validate Google OAuth refresh tokens using minimum length check and live verification
- **FR-005**: System MUST store Google credentials encrypted using AES-256-GCM, consistent with all other providers
- **FR-006**: System MUST display a Gemini icon (`/agents/gemini.svg`) on ticket cards, detail modals, agent selectors, and the project setup page
- **FR-007**: System MUST register Gemini agent metadata (label: "Gemini", description, icon path) in the agent-icons utility
- **FR-008**: System MUST include Gemini in the project setup/onboarding agent selection list
- **FR-009**: System MUST include Mistral in the project setup/onboarding agent selection list (fixing existing gap)
- **FR-010**: System MUST allow Gemini agent dispatch for speckit, quick-impl, and iterate workflows only
- **FR-011**: System MUST prevent Gemini agent dispatch for verify, ai-board-assist, retro-spec, and onboard workflows
- **FR-012**: System MUST inject `GEMINI_API_KEY` or `GEMINI_OAUTH_TOKEN` environment variables from the owner's encrypted credential when dispatching Gemini workflows
- **FR-013**: System MUST install Gemini CLI, configure headless mode, and enable OTLP telemetry in the workflow execution environment
- **FR-014**: System MUST parse Gemini OTLP events (`gemini_cli.api_response` for token counts, `gemini_cli.tool_call` for tool tracking) and accumulate metrics on the job record
- **FR-015**: System MUST estimate Gemini job costs using a pricing table keyed by model identifier (covering Gemini 2.5 Pro, 2.5 Flash, and other current models)
- **FR-016**: System MUST include Gemini as a filter option in the analytics dashboard agent selector
- **FR-017**: System MUST include Mistral as a filter option in the analytics dashboard agent selector (fixing existing gap)
- **FR-018**: System MUST make analytics agent filtering dynamic based on the Agent enum rather than hardcoded agent lists
- **FR-019**: System MUST map the `GEMINI` agent to the `GOOGLE` credential provider for credential resolution
- **FR-020**: System MUST configure Gemini CLI telemetry environment variables (`GEMINI_TELEMETRY_ENABLED=1`, OTLP endpoint, OTLP protocol `http/json`) during workflow execution
- **FR-021**: System MUST identify Gemini from agent identifier strings (e.g., containing "gemini" or "google") for agent inference
- **FR-022**: All existing Claude, Codex, and Mistral functionality MUST remain unaffected by these changes

### Key Entities

- **Agent (GEMINI)**: New enum value representing Google's Gemini CLI as an AI agent, selectable as project default or ticket override
- **CredentialProvider (GOOGLE)**: New enum value for Google as a credential provider, supporting API_KEY and OAUTH_TOKEN types
- **UserCredential (Google)**: Encrypted credential record linking a user to their Google API key or OAuth refresh token, with verification status tracking
- **Job (Gemini telemetry)**: Existing job entity extended to track Gemini-specific metrics (tokens, cost, model, tools, duration) via OTLP telemetry events

### Internal Processes

- **Gemini Credential Verification**: Triggered when a user saves a Google credential. Receives the credential value and type (API_KEY or OAUTH_TOKEN). Validates format, then makes a live verification call to Google's generative AI API. Updates credential status to READY, ACTION_REQUIRED, or retains PENDING_VERIFICATION. Handles rate limiting (429) and invalid key (401/403) responses gracefully.

- **Gemini Workflow Dispatch**: Triggered when a job is created for a ticket with Gemini agent. Receives the job command, ticket context, and project configuration. Resolves the owner's Google credential, maps it to the appropriate environment variable (`GEMINI_API_KEY` or `GEMINI_OAUTH_TOKEN`), and dispatches the GitHub Actions workflow with the credential injected. Blocks dispatch if no valid credential exists.
  - **Input**: Job ID, ticket key, agent (GEMINI), project ID, command (specify/plan/implement/quick-impl/iterate)
  - **Phases**: 1) Validate agent is allowed for the command, 2) Fetch owner's Google credential, 3) Decode and inject as workflow environment variable, 4) Dispatch GitHub Actions workflow
  - **Output**: Workflow run initiated with Gemini credentials available
  - **Error behavior**: Fails with descriptive error if credential missing, expired, or agent not allowed for workflow type

- **Gemini CLI Execution in Workflow**: Triggered by the run-agent shell script when agent is GEMINI. Installs Gemini CLI, configures telemetry (OTLP endpoint, protocol, enabled flag), and invokes the CLI in headless mode with the provided command prompt.
  - **Input**: Agent identifier (GEMINI), command file path, environment variables (credential, telemetry config)
  - **Phases**: 1) Validate GEMINI_API_KEY or GEMINI_OAUTH_TOKEN is set, 2) Install Gemini CLI, 3) Configure telemetry environment, 4) Invoke Gemini CLI in headless mode with prompt
  - **Output**: CLI execution result, OTLP telemetry events streamed to endpoint
  - **Error behavior**: Job fails if CLI installation fails or credential is invalid; telemetry collection is fire-and-forget (never fails the job)

- **Gemini Telemetry Processing**: Triggered when the telemetry endpoint receives OTLP events from a Gemini workflow. Parses `gemini_cli.api_response` events for token counts (input, output, thought, cache tokens) and `gemini_cli.tool_call` events for tool names. Estimates cost via pricing table. Accumulates all metrics on the job record.
  - **Input**: OTLP resource logs containing Gemini-specific event attributes
  - **Phases**: 1) Identify Gemini events by event name prefix, 2) Extract token counts and model from api_response events, 3) Extract tool names from tool_call events, 4) Estimate cost using Gemini pricing table, 5) Accumulate on job record
  - **Output**: Updated job record with inputTokens, outputTokens, cacheReadTokens, costUsd, model, toolsUsed, durationMs
  - **Error behavior**: Partial data is recorded; missing attributes default to zero; unknown models get zero cost; processing errors are logged but do not fail the job

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can store and verify a Google credential in under 30 seconds, with clear feedback on success or failure
- **SC-002**: Gemini appears as a selectable agent on 100% of agent selection surfaces (project setup, project settings, ticket creation, ticket editing)
- **SC-003**: Gemini workflows (speckit, quick-impl, iterate) complete successfully when valid credentials are provided, with the same reliability as existing Claude/Codex workflows
- **SC-004**: Telemetry captures token usage, cost, model, and tool data for 100% of completed Gemini jobs
- **SC-005**: Analytics dashboard displays Gemini and Mistral data when jobs exist for those agents, with filtering working identically to Claude and Codex filters
- **SC-006**: Zero regressions in existing Claude, Codex, and Mistral functionality as verified by the existing test suite
- **SC-007**: Gemini is not selectable or dispatchable for verify, ai-board-assist, retro-spec, or onboard workflows — attempts are blocked with clear user feedback
- **SC-008**: Cost estimation for Gemini jobs produces non-zero values for known models, matching published Google pricing within 10% accuracy
