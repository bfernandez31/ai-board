# Feature Specification: GitHub Workflow Transition API

**Feature Branch**: `018-add-github-transition`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "Add github transition - Create API route to dispatch GitHub Actions workflows when tickets transition between stages."

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature clearly described: API endpoint for GitHub Actions workflow dispatch
2. Extract key concepts from description
   → Actors: Frontend UI, API endpoint, GitHub Actions
   → Actions: Validate stage transition, create job record, dispatch workflow, update ticket
   → Data: Ticket, Project, Job, Stage transitions
   → Constraints: Valid stage transitions, project ownership, GitHub authentication
3. For each unclear aspect:
   → No major ambiguities - requirements are detailed
4. Fill User Scenarios & Testing section
   → User flow: Drag ticket → API validates → Workflow dispatches → Ticket updates
5. Generate Functional Requirements
   → Each requirement is testable with clear success criteria
6. Identify Key Entities
   → Ticket, Project, Job, Stage
7. Run Review Checklist
   → No [NEEDS CLARIFICATION] markers
   → Implementation details intentionally included per user requirements
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a project manager, when I move a ticket between workflow stages on the board, the system automatically triggers the appropriate automation workflow (specification generation, planning, or implementation) without requiring manual command-line intervention.

### Acceptance Scenarios
1. **Given** a ticket in the BACKLOG stage with valid title and description, **When** I drag it to the SPECIFY stage, **Then** the system creates a job record, dispatches the GitHub Actions workflow with the specify command, updates the ticket branch field, and returns the job ID
2. **Given** a ticket in the SPECIFY stage with an existing branch, **When** I drag it to the PLAN stage, **Then** the system creates a job record, dispatches the GitHub Actions workflow with the plan command for that branch, and updates the ticket stage
3. **Given** a ticket in the PLAN stage, **When** I drag it to the BUILD stage, **Then** the system creates a job record, dispatches the GitHub Actions workflow with the implement command, and tracks the job
4. **Given** a ticket in any stage, **When** I drag it to the VERIFY or SHIP stage, **Then** the system updates the stage without dispatching any workflow (no automation for these stages)
5. **Given** a ticket, **When** I attempt to transition it to an invalid stage, **Then** the system returns a 400 error with a clear validation message
6. **Given** a valid ticket ID, **When** the GitHub authentication fails, **Then** the system returns a 500 error with details logged and no ticket stage change occurs
7. **Given** a ticket that belongs to project A, **When** I attempt to transition it using project B's ID in the URL, **Then** the system returns a 403 error without dispatching any workflow

### Edge Cases
- What happens when the GitHub Actions workflow file ('speckit.yml') is missing or misconfigured? System should return 404 error from Octokit
- How does system handle rate limits from GitHub API? System should return 403 error with rate limit details
- What happens when a ticket has no associated project? System returns 404 error
- How does system handle concurrent transitions of the same ticket? Job records are created sequentially; workflow dispatch is idempotent
- What happens when GITHUB_TOKEN is missing or invalid? System returns 401 error and logs authentication failure
- How does system prevent cross-project access? Validates that ticket.projectId matches URL projectId parameter

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST provide a POST endpoint at /api/projects/[projectId]/tickets/[id]/transition that accepts a target stage
- **FR-002**: System MUST validate that projectId and ticketId are valid numeric identifiers
- **FR-003**: System MUST verify that the project exists before processing transitions
- **FR-004**: System MUST verify that the ticket exists and belongs to the specified project
- **FR-005**: System MUST return 403 error when attempting to transition a ticket that belongs to a different project than specified in the URL
- **FR-006**: System MUST map target stages to spec-kit commands: SPECIFY→specify, PLAN→plan, BUILD→implement
- **FR-007**: System MUST update ticket stage without dispatching workflows for VERIFY and SHIP stages
- **FR-008**: System MUST create a Job record with ticketId, command, status: pending, and startedAt timestamp
- **FR-009**: System MUST NOT populate the branch field in Job records at creation time (branch will be updated by workflow callback)
- **FR-010**: System MUST generate branch name as "feature/ticket-<id>" for SPECIFY command only
- **FR-011**: System MUST update ticket.branch field with the generated branch name for SPECIFY command
- **FR-012**: System MUST dispatch GitHub Actions workflow using the 'speckit.yml' workflow file on the 'main' branch
- **FR-013**: System MUST pass ticket_id (as string), command, and branch to the workflow dispatch
- **FR-014**: System MUST pass ticketTitle and ticketDescription to the workflow dispatch ONLY for the specify command
- **FR-015**: System MUST use ticket.project.githubOwner and ticket.project.githubRepo values for workflow dispatch target
- **FR-016**: System MUST handle Octokit errors: 401 (auth failure), 403 (rate limits), 404 (workflow not found)
- **FR-017**: System MUST update ticket.stage to the target stage after successful workflow dispatch
- **FR-018**: System MUST increment ticket.version after stage update for optimistic concurrency control
- **FR-019**: System MUST return a JSON response with success boolean, optional jobId, and optional message
- **FR-020**: System MUST return 400 error for invalid ticket IDs or malformed request bodies
- **FR-021**: System MUST return 404 error when ticket is not found
- **FR-022**: System MUST return 500 error for Octokit errors and database errors with detailed logging
- **FR-023**: System MUST log all workflow dispatch attempts including ticket ID, command, and branch
- **FR-024**: System MUST require GITHUB_TOKEN environment variable with repo and workflow scopes
- **FR-025**: System MUST accept only POST requests (reject other HTTP methods)

### Key Entities *(include if feature involves data)*
- **Ticket**: Represents a work item with stage, branch, version, and associated project; transitions between workflow stages trigger automation
- **Project**: Contains GitHub repository information (githubOwner, githubRepo) required for workflow dispatch targeting
- **Job**: Tracks automation execution with ticketId, command, status, branch (populated by workflow callback), and timestamps
- **Stage**: Enumeration of workflow states (BACKLOG, SPECIFY, PLAN, BUILD, VERIFY, SHIP); specific stages (SPECIFY, PLAN, BUILD) trigger spec-kit automation

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs) - **NOTE**: This spec intentionally includes technical details as requested by user (API routes, Octokit, environment variables)
- [x] Focused on user value and business needs - Automates workflow transitions without manual CLI usage
- [x] Written for non-technical stakeholders - Primary user story and scenarios are clear
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (HTTP status codes, job creation, workflow dispatch)
- [x] Scope is clearly bounded (excludes webhooks, polling, clarify endpoint, autoMode)
- [x] Dependencies and assumptions identified (Octokit package, stage-validation.ts, GITHUB_TOKEN)

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (none found)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
