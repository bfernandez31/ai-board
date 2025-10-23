# Feature Specification: AI-BOARD Assistant for Ticket Collaboration

**Feature Branch**: `044-ai-board-assistant`
**Created**: 2025-10-23
**Status**: Draft
**Input**: User description: "AI-BOARD Assistant for Ticket Collaboration"

## Auto-Resolved Decisions

### Decision 1: AI-BOARD System User Creation Method

- **Decision**: AI-BOARD user will be created manually via database script or migration, not through the application UI
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.85) - Industry standard for system users is manual creation to prevent accidental deletion or modification through normal user flows
- **Fallback Triggered?**: No - Clear technical pattern for system accounts
- **Trade-offs**:
  1. **Scope Impact**: Requires one-time manual database operation but ensures system integrity
  2. **Timeline Impact**: Minimal - standard practice for system accounts
- **Reviewer Notes**: Verify that AI-BOARD user has appropriate database constraints (e.g., prevent deletion, unique email constraint)

### Decision 2: AI-BOARD Response Time Expectations

- **Decision**: AI-BOARD will process requests asynchronously with no guaranteed response time, similar to existing GitHub workflow patterns
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9) - Matches existing system behavior for all GitHub workflow-triggered operations
- **Fallback Triggered?**: No - Established pattern in codebase
- **Trade-offs**:
  1. **User Experience**: Users must wait for workflow completion, but this matches their current expectations
  2. **Complexity**: Avoids real-time processing complexity and API rate limit concerns
- **Reviewer Notes**: Consider adding workflow timeout notifications if requests exceed 10 minutes

### Decision 3: AI-BOARD Mention Validation Timing

- **Decision**: Availability validation will occur at mention time (client-side UI feedback) AND at workflow dispatch time (server-side enforcement)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - Defense in depth approach prevents invalid workflow executions
- **Fallback Triggered?**: No - Security best practice for distributed systems
- **Trade-offs**:
  1. **Complexity**: Requires dual validation but prevents race conditions
  2. **User Experience**: Clear feedback at both interaction points reduces confusion
- **Reviewer Notes**: Ensure error messages clearly distinguish between client-side (prevented) and server-side (rejected) validation failures

### Decision 4: Scope Limitation to SPECIFY and PLAN Stages

- **Decision**: Initial implementation will support AI-BOARD assistance only for SPECIFY and PLAN stages, with BUILD/VERIFY returning "not implemented" messages
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9) - Feature request explicitly lists BUILD/VERIFY as "Out of Scope (Future Work)"
- **Fallback Triggered?**: No - Aligned with stated requirements
- **Trade-offs**:
  1. **Feature Completeness**: Delivers high-value use cases first while deferring complex implementation scenarios
  2. **User Expectations**: Users will receive clear "not implemented" messages, setting proper expectations
- **Reviewer Notes**: Document the not-implemented message format and ensure it includes timeline or next steps for these stages

## User Scenarios & Testing

### User Story 1 - Request Specification Update via AI-BOARD (Priority: P1)

A project member is reviewing a ticket in the SPECIFY stage and realizes the specification needs additional detail about error handling. They mention @ai-board in a comment asking to add specific error scenarios, triggering an automated workflow that updates the spec.md file and posts a summary response.

**Why this priority**: Core value proposition - enables collaborative specification refinement without manual Git operations. This is the primary use case that demonstrates AI-BOARD's collaborative assistance capability.

**Independent Test**: Can be fully tested by creating a ticket in SPECIFY stage, posting a comment with "@ai-board please add error handling for network timeouts", and verifying that spec.md is updated with error handling details and AI-BOARD responds with a summary comment.

**Acceptance Scenarios**:

1. **Given** a ticket in SPECIFY stage with no running jobs, **When** user posts a comment mentioning "@ai-board [request about specification]", **Then** system creates a Job record with command "comment-specify", dispatches GitHub workflow, and AI-BOARD updates spec.md and responds to the user
2. **Given** a ticket in SPECIFY stage with an active job, **When** user attempts to mention @ai-board, **Then** UI shows AI-BOARD greyed out with tooltip "AI-BOARD unavailable (job running)" and prevents mention
3. **Given** a ticket in INBOX stage, **When** user views comment input, **Then** UI shows AI-BOARD greyed out with tooltip "AI-BOARD unavailable for this stage"
4. **Given** AI-BOARD receives an out-of-context request (e.g., "tell me a joke"), **When** workflow executes, **Then** AI-BOARD responds with "Your request is out of context. Please focus on updating the specification for this feature." without modifying spec.md

---

### User Story 2 - Request Planning Document Updates via AI-BOARD (Priority: P2)

A project member reviewing a ticket in the PLAN stage wants to adjust the technical approach in plan.md. They mention @ai-board requesting the change, and AI-BOARD updates plan.md while ensuring consistency with spec.md and tasks.md.

**Why this priority**: Second-tier value after specification refinement - enables collaborative planning iteration. Depends on SPECIFY working correctly but provides additional workflow efficiency.

**Independent Test**: Can be fully tested by creating a ticket in PLAN stage with existing spec.md/plan.md/tasks.md files, posting "@ai-board update the database approach to use read replicas", and verifying all three files remain consistent with the requested change.

**Acceptance Scenarios**:

1. **Given** a ticket in PLAN stage with completed specification, **When** user posts "@ai-board [request about implementation approach]", **Then** AI-BOARD updates plan.md (and tasks.md if necessary) while maintaining consistency with spec.md
2. **Given** a request that affects multiple planning artifacts, **When** AI-BOARD processes the request, **Then** all modified files (spec.md, plan.md, tasks.md) are committed together in a single atomic commit
3. **Given** AI-BOARD modifies planning documents, **When** changes are committed, **Then** commit message follows format "AI-BOARD: [brief summary of changes]"

---

### User Story 3 - AI-BOARD Auto-Membership in New Projects (Priority: P3)

When a user creates a new project, the system automatically adds AI-BOARD as a project member without requiring manual configuration, ensuring the assistant is immediately available for all tickets in that project.

**Why this priority**: Essential infrastructure but non-interactive - users don't directly trigger this. Must work correctly but can be tested independently of comment workflows.

**Independent Test**: Can be fully tested by creating a new project via POST /api/projects and verifying AI-BOARD appears in ProjectMember table for that project with role "member".

**Acceptance Scenarios**:

1. **Given** a user creates a new project, **When** project creation completes, **Then** system automatically adds AI-BOARD user as a ProjectMember with role "member"
2. **Given** AI-BOARD is a project member, **When** users compose comments on any ticket, **Then** AI-BOARD appears in the mention suggestion list
3. **Given** project creation fails partway through, **When** transaction rolls back, **Then** AI-BOARD membership is not created (transactional integrity)

---

### User Story 4 - Workflow Execution for Test Tickets (Priority: P4)

When AI-BOARD is mentioned in a comment on a test ticket (title contains [e2e]), the workflow executes but skips the expensive Claude CLI steps, posts a skip message, and marks the job as COMPLETED without consuming API credits.

**Why this priority**: Testing infrastructure - important for test reliability but not user-facing functionality. Similar to existing [e2e] skip behavior in other workflows.

**Independent Test**: Can be fully tested by creating a ticket with title "[e2e] Test Ticket", mentioning @ai-board, and verifying workflow completes quickly with skip message and no Claude API calls.

**Acceptance Scenarios**:

1. **Given** a ticket with title containing "[e2e]", **When** AI-BOARD workflow runs, **Then** workflow skips Claude CLI steps and posts comment "AI-BOARD analysis skipped for test ticket"
2. **Given** a workflow for [e2e] ticket completes, **When** job status is checked, **Then** job status is COMPLETED
3. **Given** a workflow skips Claude execution, **When** checking API usage, **Then** no Claude API calls are logged

---

### Edge Cases

- **Concurrent AI-BOARD mentions**: What happens when multiple users mention @ai-board simultaneously on the same ticket? System should reject the second request due to existing running job, preventing conflicts.

- **Workflow timeout**: How does the system handle when AI-BOARD workflow exceeds 120-minute timeout? Workflow fails, job status updates to FAILED, and user receives no response comment (existing GitHub Actions behavior).

- **AI-BOARD user deletion**: What happens if AI-BOARD system user is accidentally deleted? All mentions fail validation with "mentioned user is not a project member" error until user is recreated and re-added to projects.

- **Malformed AI-BOARD responses**: How does the workflow handle when Claude outputs invalid JSON? Workflow catches JSON parse error, updates job to FAILED, and logs error details without posting malformed comment.

- **Branch checkout failure**: What happens when AI-BOARD workflow cannot checkout the ticket's feature branch? Workflow fails early, updates job to FAILED, and no file modifications occur (Git safety).

- **Stage transition during workflow**: What happens if a ticket's stage changes while AI-BOARD workflow is running? Workflow completes using the stage captured at workflow dispatch time, ensuring consistency even if ticket moves between stages during processing.

## Requirements

### Functional Requirements

#### System User & Membership

- **FR-001**: System MUST create AI-BOARD user with email "ai-board@system.local" and prevent deletion through application UI
- **FR-002**: System MUST automatically add AI-BOARD as a ProjectMember with role "member" when new projects are created via POST /api/projects endpoint
- **FR-003**: AI-BOARD membership creation MUST be part of the project creation transaction (rollback on failure)

#### Mention Availability & Validation

- **FR-004**: System MUST show AI-BOARD in mention suggestion list only when ticket stage is SPECIFY, PLAN, BUILD, or VERIFY
- **FR-005**: System MUST grey out AI-BOARD in mention list with tooltip "AI-BOARD unavailable (job running)" when ticket has active jobs (status PENDING or RUNNING)
- **FR-006**: System MUST grey out AI-BOARD in mention list with tooltip "AI-BOARD unavailable for this stage" when ticket stage is INBOX or SHIP
- **FR-007**: System MUST validate AI-BOARD availability server-side when comment is posted, rejecting requests that fail availability rules

#### Comment Processing & Workflow Dispatch

- **FR-008**: System MUST detect @ai-board mentions in comment content when comments are created via POST endpoint
- **FR-009**: System MUST create Job record with command format "comment-{stage}" (e.g., "comment-specify") when AI-BOARD is mentioned
- **FR-010**: System MUST dispatch GitHub workflow "ai-board-assist.yml" with inputs: ticket_id, ticket_title, stage, branch, user (comment author), comment, job_id, project_id
- **FR-011**: System MUST validate that ticket has no running jobs before dispatching workflow (server-side enforcement)

#### GitHub Workflow Behavior

- **FR-012**: Workflow MUST skip Claude CLI execution for tickets with "[e2e]" in title, post skip message, and update job to COMPLETED
- **FR-013**: Workflow MUST skip Claude CLI execution for BUILD and VERIFY stages, post "not implemented" message, and update job to COMPLETED
- **FR-014**: Workflow MUST execute Claude slash command "/ai-board-assist" with inputs stage and comment for SPECIFY and PLAN stages
- **FR-015**: Workflow MUST parse JSON output from Claude command with structure: { status, message, filesModified }
- **FR-016**: Workflow MUST commit and push changes only when filesModified array contains file paths
- **FR-017**: Workflow MUST use commit message format "AI-BOARD: [brief summary of changes]" for all commits
- **FR-018**: Workflow MUST post AI-BOARD comment via new endpoint with content "@{user} {message}" and userId for AI-BOARD user
- **FR-019**: Workflow MUST update job status to COMPLETED or FAILED via PATCH /api/jobs/:id/status endpoint

#### Claude Command Logic

- **FR-020**: Claude command MUST validate that requests for SPECIFY stage concern updating spec.md for the current feature
- **FR-021**: Claude command MUST return status "out-of-context" with appropriate message for invalid SPECIFY requests
- **FR-022**: Claude command MUST validate that requests for PLAN stage concern spec.md, plan.md, or tasks.md
- **FR-023**: Claude command MUST ensure all modified planning files (spec.md, plan.md, tasks.md) remain consistent with each other
- **FR-024**: Claude command MUST output JSON to stdout with fields: status, message, filesModified (array)

#### AI-BOARD Comment Creation

- **FR-025**: System MUST provide new endpoint POST /api/projects/:projectId/tickets/:ticketId/comments/ai-board for workflow-authored comments
- **FR-026**: AI-BOARD comment endpoint MUST authenticate using GitHub workflow token (not session-based auth)
- **FR-027**: AI-BOARD comment endpoint MUST accept request body with content (string) and userId (AI-BOARD user ID)
- **FR-028**: AI-BOARD comment endpoint MUST validate comment content using existing comment validation rules (mentions, markdown, length limits)
- **FR-029**: AI-BOARD comment endpoint MUST return standard Comment object response

### Key Entities

- **AI-BOARD User**: System user account representing the AI assistant, with email "ai-board@system.local", automatically added as member to all projects, treated as a standard user for comment authorship and mention validation

- **Job Record**: Workflow execution tracking record with command format "comment-{stage}" (e.g., "comment-specify", "comment-plan"), links to ticket and project for status monitoring and availability validation

- **AI-BOARD Comment**: Standard Comment record authored by AI-BOARD user (not session user), posted by GitHub workflow after Claude command execution, contains mention of original requester plus AI response message

- **GitHub Workflow Dispatch**: Workflow trigger event with inputs including ticket metadata (id, title, stage, branch), user context (comment author), request content (comment text), and tracking identifiers (job_id, project_id)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can request specification updates by mentioning AI-BOARD in comments, receiving AI-generated updates to spec.md within workflow execution time (typically 2-5 minutes)
- **SC-002**: Users can request planning document updates by mentioning AI-BOARD in comments, receiving consistent updates across spec.md, plan.md, and tasks.md within workflow execution time
- **SC-003**: AI-BOARD is automatically available as a mentionable user in 100% of new projects without manual configuration
- **SC-004**: System prevents invalid AI-BOARD mentions 100% of the time when tickets are in INBOX/SHIP stages or have running jobs, providing clear feedback via greyed-out UI and tooltips
- **SC-005**: AI-BOARD correctly rejects out-of-context requests (e.g., requests unrelated to current ticket) with explanatory messages, maintaining focus on ticket artifact updates
- **SC-006**: Test tickets with "[e2e]" prefix skip expensive Claude execution 100% of the time while completing workflow successfully
- **SC-007**: Workflow failures (timeout, parse errors, Git errors) update job status to FAILED 100% of the time, allowing users to detect and retry failed requests
- **SC-008**: All AI-BOARD file modifications are committed atomically in a single commit with descriptive message, ensuring Git history remains clean and reviewable
