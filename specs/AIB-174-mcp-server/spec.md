# Feature Specification: MCP Server for AI-Board

**Feature Branch**: `AIB-174-mcp-server`
**Created**: 2026-01-23
**Status**: Draft
**Input**: User description: "Create an MCP (Model Context Protocol) server that allows Claude to interact directly with ai-board"

## Auto-Resolved Decisions

- **Decision**: Configuration file location and format
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Medium (0.6) - netScore +6 but 2 conflicting signal buckets
- **Fallback Triggered?**: Yes - conflicting signals between internal tool context and auth/security concerns prompted CONSERVATIVE stance
- **Trade-offs**:
  1. Quality: Strict config validation ensures users receive clear error messages for misconfiguration
  2. Timeline: Slightly more effort for comprehensive validation logic
- **Reviewer Notes**: Validate that `~/.aiboard/config.json` path works across Linux, macOS, and Windows. Consider environment variable override.

---

- **Decision**: Error handling for invalid/expired tokens
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - clear auth context
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Quality: Clear error messages help users diagnose authentication issues
  2. Timeline: Minimal - standard error handling patterns
- **Reviewer Notes**: Ensure error messages don't leak sensitive information about why token validation failed.

---

- **Decision**: API request timeout and retry behavior
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - reliability for CLI tool
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Quality: Reasonable timeouts (30s) prevent hanging commands while allowing for slower networks
  2. Timeline: Minimal additional complexity
- **Reviewer Notes**: Consider if users need configurable timeout via environment variable.

---

- **Decision**: move_ticket target stage validation
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - data integrity concern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Quality: Prevents users from creating invalid state transitions
  2. Timeline: Rely on existing API validation rather than duplicating logic
- **Reviewer Notes**: Confirm that the existing API returns clear error messages for invalid transitions.

## User Scenarios & Testing

### User Story 1 - List and View Projects (Priority: P1)

A Claude user wants to check what projects they have access to in ai-board and see the current status of a specific project before deciding what work to do.

**Why this priority**: This is the foundational capability - users must be able to discover and access their projects before they can do anything else. Without this, the MCP server provides no value.

**Independent Test**: Can be fully tested by asking Claude "What projects do I have in ai-board?" and receiving a list of project names, keys, and ticket counts.

**Acceptance Scenarios**:

1. **Given** a user has configured the MCP server with a valid PAT token, **When** they ask Claude to list their ai-board projects, **Then** they see all projects they own or are members of with project key, name, and ticket count.

2. **Given** a user has multiple projects, **When** they ask Claude to get details about a specific project by ID, **Then** they see the project's full details including GitHub repository info and clarification policy.

3. **Given** a user has an invalid or expired PAT token, **When** they attempt to list projects, **Then** they receive a clear error message indicating the authentication issue.

---

### User Story 2 - View Tickets in a Project (Priority: P2)

A Claude user wants to see what tickets exist in a project, optionally filtering by stage, to understand current work status and find tickets to work on.

**Why this priority**: After knowing what projects exist, users need to see the work items. This enables informed decision-making about what to create or modify.

**Independent Test**: Can be fully tested by asking Claude "Show me the INBOX tickets in project ABC" and receiving a list of tickets with titles and descriptions.

**Acceptance Scenarios**:

1. **Given** a project with tickets in various stages, **When** the user asks Claude to list tickets in that project, **Then** they see all tickets grouped by stage with ticketKey, title, and current stage.

2. **Given** a project has tickets across multiple stages, **When** the user filters by stage (e.g., "show me BUILD tickets"), **Then** they see only tickets in that specific stage.

3. **Given** a ticketKey like "ABC-42", **When** the user asks Claude for that ticket's details, **Then** they see the full ticket information including title, description, stage, branch (if set), and recent activity.

---

### User Story 3 - Create a Ticket (Priority: P3)

A Claude user wants to create a new ticket directly from their conversation without switching to the ai-board UI.

**Why this priority**: Creating tickets is the primary write operation. Once users can view projects and tickets, they need to add new work items.

**Independent Test**: Can be fully tested by asking Claude "Create a ticket in project ABC titled 'Fix login bug' with description 'The login button is unresponsive on mobile'" and verifying the ticket appears in the project INBOX.

**Acceptance Scenarios**:

1. **Given** a valid project ID, title, and description, **When** the user asks Claude to create a ticket, **Then** a new ticket is created in the INBOX stage and the ticketKey is returned (e.g., "Created ticket ABC-123").

2. **Given** an invalid project ID, **When** the user attempts to create a ticket, **Then** they receive a clear error message indicating the project doesn't exist or they don't have access.

3. **Given** a title that exceeds the 100-character limit, **When** the user attempts to create a ticket, **Then** they receive a validation error explaining the constraint.

---

### User Story 4 - Move Ticket to Next Stage (Priority: P4)

A Claude user wants to move a ticket forward through the workflow stages (e.g., from INBOX to SPECIFY) directly from their conversation.

**Why this priority**: Stage transitions are the core workflow mechanism. This enables users to advance tickets through the ai-board pipeline without leaving Claude.

**Independent Test**: Can be fully tested by asking Claude "Move ticket ABC-42 to SPECIFY stage" and verifying the ticket's stage changes and any associated workflow is triggered.

**Acceptance Scenarios**:

1. **Given** a ticket in INBOX stage, **When** the user asks Claude to move it to SPECIFY, **Then** the ticket transitions to SPECIFY and a workflow job is created.

2. **Given** a ticket in BUILD stage with a failed job, **When** the user asks to roll back to INBOX (quick-impl workflow), **Then** the ticket returns to INBOX.

3. **Given** an invalid stage transition (e.g., INBOX directly to SHIP), **When** the user attempts the move, **Then** they receive a clear error explaining the valid transition paths.

---

### Edge Cases

- What happens when the config file doesn't exist? → Clear error message guiding user to create it with required fields.
- What happens when the API URL is unreachable? → Timeout after 30 seconds with error message suggesting to check network/URL.
- What happens when rate limiting is triggered? → Return error with Retry-After information from API response.
- What happens when a ticket's stage can't be changed due to active job? → Return error explaining the constraint and job status.
- What happens when user lacks permission for a project? → Return 403 error with clear "access denied" message.

## Requirements

### Functional Requirements

- **FR-001**: MCP server MUST authenticate API requests using Personal Access Tokens from user's config file
- **FR-002**: MCP server MUST expose a `list_projects` tool that returns all projects the authenticated user can access
- **FR-003**: MCP server MUST expose a `get_project` tool that returns details for a specific project by ID
- **FR-004**: MCP server MUST expose a `create_ticket` tool that creates a new ticket in a project's INBOX stage
- **FR-005**: MCP server MUST expose a `get_ticket` tool that returns ticket details by ticketKey
- **FR-006**: MCP server MUST expose a `list_tickets` tool that returns tickets for a project, with optional stage filter
- **FR-007**: MCP server MUST expose a `move_ticket` tool that transitions a ticket to a specified target stage
- **FR-008**: MCP server MUST read configuration from `~/.aiboard/config.json` containing `apiUrl` and `token`
- **FR-009**: MCP server MUST communicate via stdio transport (standard MCP pattern)
- **FR-010**: MCP server MUST return clear, actionable error messages for authentication failures, validation errors, and API errors
- **FR-011**: MCP server MUST validate configuration file exists and contains required fields before making API calls

### Key Entities

- **MCP Server**: Standalone process that implements MCP protocol, communicates via stdio, and proxies requests to ai-board API
- **Config**: User configuration containing API URL and PAT token for authentication (`~/.aiboard/config.json`)
- **Tool**: MCP-exposed function that Claude can invoke (list_projects, get_project, create_ticket, get_ticket, list_tickets, move_ticket)
- **API Client**: HTTP client component that handles authentication headers, request/response serialization, and error handling

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can successfully list their projects from Claude within 5 seconds of issuing the command
- **SC-002**: Users can create a ticket from Claude that appears correctly in ai-board UI within 3 seconds
- **SC-003**: Error messages enable users to self-diagnose and resolve configuration issues without external documentation
- **SC-004**: All 6 MCP tools (list_projects, get_project, create_ticket, get_ticket, list_tickets, move_ticket) function correctly as verified by integration tests
- **SC-005**: MCP server starts and responds to first tool call within 2 seconds
