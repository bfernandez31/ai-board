# Feature Specification: Refactor Routes and APIs to Require Project Context

**Feature Branch**: `011-refactor-routes-and`
**Created**: 2025-10-03
**Status**: Draft
**Input**: User description: "Refactor routes and APIs to require project context.

  WHAT:
  Change app structure to enforce project selection before board access. Routes become /projects/:id/board and APIs become project-scoped.

  WHY:
  Explicit project context in URLs makes architecture clear, enables multi-project support later, and prevents cross-project data leaks.

  REQUIREMENTS:

  ROUTES:
  - Change /board → /projects/[projectId]/board
  - Root / redirects to /projects/1/board (default project for MVP)
  - All ticket operations scoped to project context from URL

  API ENDPOINTS:
  - Change GET /api/tickets → GET /api/projects/[projectId]/tickets
  - Change POST /api/tickets → POST /api/projects/[projectId]/tickets
  - Change PATCH /api/tickets/[id] → PATCH /api/projects/[projectId]/tickets/[id]
  - All APIs validate projectId exists and ticket belongs to project

  DATA LAYER:
  - Update getTicketsByStage() to accept projectId parameter
  - Update createTicket() to require projectId in input
  - Update all ticket queries to filter by projectId
  - Validate ticket.projectId matches URL projectId on updates

  UI:
  - Board page reads projectId from route params
  - New ticket form doesn't show project selector (uses current project)
  - (Optional) Display project name in header

  ERROR HANDLING:
  - Invalid projectId → 404
  - Ticket not in specified project → 403
  - Project doesn't exist → 404

  ACCEPTANCE:
  - Board displays only tickets from specified project
  - Creating ticket auto-assigns current project
  - URLs reflect project context
  - Cross-project access blocked

  NON-GOALS:
  - No project switcher UI (single project for MVP)
  - No project creation/edit UI
  - No branch field yet
  - No autoMode field yet"

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
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

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a user of the ai-board application, I need to access the board for a specific project so that I can view and manage tickets in an organized, project-scoped manner. The application must ensure I can only see and modify tickets that belong to the project I'm currently viewing, preventing accidental access to other projects' data.

### Acceptance Scenarios
1. **Given** a user navigates to the root URL, **When** the page loads, **Then** they are automatically redirected to the default project's board
2. **Given** a user is viewing a project's board, **When** they view the ticket list, **Then** only tickets belonging to that specific project are displayed
3. **Given** a user creates a new ticket while viewing a project's board, **When** the ticket is saved, **Then** it is automatically associated with the current project without requiring manual project selection
4. **Given** a user attempts to access a project that doesn't exist, **When** the request is made, **Then** they receive a "not found" error
5. **Given** a user attempts to modify a ticket through a URL with a different project ID than the ticket's actual project, **When** the request is processed, **Then** they receive a "forbidden" error and the ticket is not modified
6. **Given** a user is viewing a project's board, **When** they check the URL, **Then** the URL explicitly includes the project identifier

### Edge Cases
- What happens when a user bookmarks a project board URL and the project is later deleted?
- How does the system handle a user manually editing the URL to access a different project's tickets?
- What happens if the default project (ID 1) doesn't exist when a user accesses the root URL?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST display board pages with project context included in the URL path
- **FR-002**: System MUST redirect users accessing the root URL to the default project's board (project ID 1)
- **FR-003**: System MUST scope all ticket retrieval operations to a specific project
- **FR-004**: System MUST scope all ticket creation operations to a specific project without requiring user input for project selection
- **FR-005**: System MUST scope all ticket update operations to a specific project
- **FR-006**: System MUST validate that the project specified in the URL exists before processing any request
- **FR-007**: System MUST validate that tickets being accessed or modified belong to the project specified in the URL
- **FR-008**: System MUST return a "not found" error (404) when a non-existent project is requested
- **FR-009**: System MUST return a "forbidden" error (403) when a ticket operation is attempted with a project that doesn't match the ticket's actual project
- **FR-010**: System MUST return a "not found" error (404) when an invalid project identifier is provided in the URL
- **FR-011**: System MUST filter all ticket queries by the project context from the URL
- **FR-012**: System MUST automatically assign the current project (from URL context) to newly created tickets
- **FR-013**: System MUST prevent cross-project data access through URL manipulation
- **FR-014**: System MUST maintain project context throughout all ticket operations without requiring re-specification

### Key Entities *(include if feature involves data)*
- **Project**: Represents a container for organizing tickets; has a unique identifier used in URLs to establish context
- **Ticket**: Represents a work item; belongs to exactly one project and can only be accessed within that project's context
- **Board**: Represents the user interface for viewing and managing tickets; always operates within a specific project's context

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
