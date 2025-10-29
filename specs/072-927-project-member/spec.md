# Feature Specification: Project Member Authorization

**Feature Branch**: `072-927-project-member`
**Created**: 2025-10-29
**Status**: Draft
**Input**: User description: "#927 Project member authorization - Allow project members to access boards and APIs"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Authorization Strategy

- **Decision**: Whether to use "owner OR member" access vs role-based permissions
- **Policy Applied**: AUTO → CONSERVATIVE (fallback triggered)
- **Confidence**: Medium (score: +5, net: +5, 2 conflicting buckets)
- **Fallback Triggered?**: Yes — AUTO detected authorization/access control (+3), existing data model (+1), API changes (+1) with net score +5. Conflicting signal buckets (CONSERVATIVE + NEUTRAL) triggered fallback to CONSERVATIVE.
- **Trade-offs**:
  1. **Scope**: Simple "member access" model is easier to implement than full role-based access control (RBAC). We defer granular permissions (admin/member distinction) to future iterations.
  2. **Security**: Conservative approach ensures all members have equal read/write access within a project. This matches typical team collaboration tools where project membership implies trusted access.
- **Reviewer Notes**: Verify that equal member access aligns with team collaboration expectations. If different permission levels are needed (e.g., read-only members), mark for future enhancement. The ProjectMember.role field exists but is not used for authorization in this iteration.

### Decision 2: Read-Only vs Read-Write Member Access

- **Decision**: Whether project members should have read-only or read-write access
- **Policy Applied**: AUTO → CONSERVATIVE (fallback triggered)
- **Confidence**: Medium (score: +5)
- **Fallback Triggered?**: Yes — Same authorization context as Decision 1
- **Trade-offs**:
  1. **Scope**: Read-write access enables true team collaboration (create tickets, comment, transition stages) without additional permission layers. Conservative choice for collaboration.
  2. **Timeline**: Simpler implementation - reuse existing authorization helpers with OR logic (owner OR member) instead of action-based permission checks.
  3. **Security**: All members are trusted collaborators. Access control boundary is at project membership level, not action level.
- **Reviewer Notes**: Confirm that all project members should be able to modify tickets, not just view them. If read-only members are needed, this would require role-based authorization (future enhancement).

### Decision 3: Project Owner Special Privileges

- **Decision**: Whether project owners retain exclusive rights for certain actions (e.g., delete project, manage members)
- **Policy Applied**: AUTO → CONSERVATIVE (fallback triggered)
- **Confidence**: Medium (score: +5)
- **Fallback Triggered?**: Yes — Authorization changes warrant careful boundaries
- **Trade-offs**:
  1. **Security**: Owner retains exclusive control over project-level destructive actions (delete project) and team management (add/remove members). Conservative approach prevents accidental data loss.
  2. **Scope**: Maintains clear ownership model - one owner (Project.userId), many members (ProjectMember table).
- **Reviewer Notes**: Validate that project settings and member management remain owner-only. Members get access to tickets, board, and collaboration features.

### Decision 4: Test Strategy for 21 API Endpoints

- **Decision**: How to validate authorization changes across all affected endpoints
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (security testing is non-negotiable)
- **Fallback Triggered?**: No — Conservative testing is standard for auth changes
- **Trade-offs**:
  1. **Quality**: Comprehensive test coverage for both ownership and membership access paths ensures no security regressions.
  2. **Timeline**: Testing 21 endpoints with member scenarios increases test effort, but is essential for authorization changes.
- **Reviewer Notes**: Ensure E2E tests cover "owner accesses project" and "member accesses project" scenarios for critical user journeys (board access, ticket CRUD).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project Member Board Access (Priority: P1)

As a project member (not owner), I want to access the project board so that I can view and collaborate on tickets with my team.

**Why this priority**: This is the primary value of the feature - enabling team collaboration. Without this, members cannot access the project at all (404/403 errors).

**Independent Test**: Can be fully tested by adding a user as ProjectMember, logging in as that user, and navigating to `/projects/:id/board`. Delivers immediate value by unblocking team access.

**Acceptance Scenarios**:

1. **Given** UserA owns Project123 and UserB is added as a ProjectMember, **When** UserB navigates to `/projects/123/board`, **Then** UserB sees the project board with all tickets (no 404/403 error)
2. **Given** UserA owns Project123 and UserB is NOT a ProjectMember, **When** UserB tries to access `/projects/123/board`, **Then** UserB receives a 404 error (project not found/access denied)
3. **Given** UserB is a member of Project123, **When** UserB views the board, **Then** UserB sees the same ticket data as the project owner (no data filtering by role)

---

### User Story 2 - Project Member Ticket Creation (Priority: P2)

As a project member, I want to create new tickets in the project so that I can contribute tasks and bug reports to the team's workflow.

**Why this priority**: After viewing the board (P1), creating tickets is the next most common collaboration action. Enables members to actively contribute to the project.

**Independent Test**: Can be fully tested by a member creating a ticket via POST `/api/projects/:id/tickets`. Delivers value by enabling member contributions without owner intervention.

**Acceptance Scenarios**:

1. **Given** UserB is a ProjectMember of Project123, **When** UserB submits a POST request to `/api/projects/123/tickets` with valid ticket data, **Then** the ticket is created successfully (201 response) and appears on the board
2. **Given** UserB is NOT a ProjectMember of Project123, **When** UserB tries to create a ticket, **Then** the API returns 403 Forbidden
3. **Given** UserB is a ProjectMember, **When** UserB creates a ticket, **Then** the ticket's projectId matches Project123 and the ticket is visible to all project members and the owner

---

### User Story 3 - Project Member Ticket Updates (Priority: P2)

As a project member, I want to update ticket titles, descriptions, and stages so that I can refine ticket details and move work through the workflow.

**Why this priority**: Equal priority with ticket creation - updating tickets is essential for maintaining up-to-date project information and progressing work.

**Independent Test**: Can be fully tested by a member updating an existing ticket via PATCH `/api/projects/:id/tickets/:ticketId`. Demonstrates full read-write collaboration capability.

**Acceptance Scenarios**:

1. **Given** UserB is a ProjectMember of Project123 with a ticket in INBOX, **When** UserB updates the ticket's stage to SPECIFY, **Then** the ticket transitions successfully and triggers the appropriate workflow
2. **Given** UserB is a ProjectMember, **When** UserB edits a ticket's title or description, **Then** the changes are saved and visible to all project collaborators
3. **Given** UserB is NOT a ProjectMember, **When** UserB tries to update a ticket in Project123, **Then** the API returns 403 Forbidden

---

### User Story 4 - Project Member Commenting (Priority: P3)

As a project member, I want to add comments to tickets so that I can discuss implementation details and provide feedback to the team.

**Why this priority**: Lower priority than core ticket CRUD - commenting enhances collaboration but is not blocking for basic workflow usage.

**Independent Test**: Can be fully tested by a member posting a comment via POST `/api/projects/:id/tickets/:ticketId/comments`. Adds communication layer to collaboration.

**Acceptance Scenarios**:

1. **Given** UserB is a ProjectMember, **When** UserB posts a comment on any ticket in Project123, **Then** the comment is saved and visible to all collaborators
2. **Given** UserB is a ProjectMember, **When** UserB mentions another member in a comment, **Then** the mention is processed correctly (autocomplete shows project members)
3. **Given** UserB is NOT a ProjectMember, **When** UserB tries to comment, **Then** the API returns 403 Forbidden

---

### User Story 5 - Project Owner Member Management (Priority: P3)

As a project owner, I want to retain exclusive control over adding/removing project members so that I can manage team composition and maintain project security.

**Why this priority**: Important for governance but less frequent than daily ticket operations. Owner-only actions provide necessary boundaries.

**Independent Test**: Can be tested by verifying that only owners can access member management endpoints while members receive 403. Ensures clear ownership model.

**Acceptance Scenarios**:

1. **Given** UserA owns Project123, **When** UserA adds UserB as a ProjectMember, **Then** UserB gains access to the project board and APIs
2. **Given** UserB is a ProjectMember but NOT the owner, **When** UserB tries to add another user as a member, **Then** the API returns 403 Forbidden (owner-only action)
3. **Given** UserA is the owner, **When** UserA removes UserB's ProjectMember record, **Then** UserB loses access to the project (404/403 on subsequent requests)

---

### Edge Cases

- **What happens when a user is both owner AND member?** Project.userId takes precedence - no need to check ProjectMember table if user is the owner. Authorization logic should check ownership first (performance optimization and logical clarity).
- **How does the system handle orphaned ProjectMember records?** Foreign key constraints (`onDelete: Cascade`) ensure ProjectMember records are deleted when projects or users are deleted. No manual cleanup needed.
- **What happens when member authorization fails?** Return 403 Forbidden for API endpoints and 404 Not Found for board pages (consistent with current ownership behavior - don't reveal project existence to non-members).
- **How does authorization work for nested resources (comments, jobs)?** Authorization validates at the project level first, then allows access to nested resources. No need to check membership repeatedly for each comment/job within a ticket.
- **Can members delete projects?** No - project deletion remains owner-only (Project.userId check). Members cannot delete the project or modify project settings.
- **Can members see other projects' data?** No - the membership check is project-scoped. Being a member of Project123 does not grant access to Project456.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow both project owners (Project.userId) AND project members (ProjectMember table) to access project boards at `/projects/:id/board`
- **FR-002**: System MUST validate project access by checking if the authenticated user is EITHER the project owner OR a project member (via ProjectMember join)
- **FR-003**: All 21 project-scoped API endpoints MUST enforce "owner OR member" authorization instead of owner-only authorization
- **FR-004**: System MUST return 404 Not Found for board page access when user is neither owner nor member (consistent with current behavior - don't reveal project existence)
- **FR-005**: System MUST return 403 Forbidden for API endpoints when user is neither owner nor member (explicit denial for API requests)
- **FR-006**: Project members MUST have read-write access to all tickets (create, read, update, delete tickets, transition stages, add comments)
- **FR-007**: Project owner MUST retain exclusive rights to project deletion and member management (owner-only actions)
- **FR-008**: Authorization helpers (`verifyProjectOwnership`, `verifyTicketOwnership`) MUST be updated to check membership OR renamed/replaced to reflect new "owner OR member" logic
- **FR-009**: System MUST optimize authorization checks by verifying ownership first, then membership (avoid redundant database queries when user is owner)
- **FR-010**: System MUST maintain backward compatibility with existing authentication flow (NextAuth session-based auth, mock auth in tests)

### Key Entities *(include if feature involves data)*

- **User**: Represents an authenticated user who can own projects or be a member of projects
  - **Attributes**: id (String), email (String), name (String?), session data
  - **Relationships**: Owns Projects (Project.userId), Has Memberships (ProjectMember.userId)

- **Project**: Represents a collaborative workspace with tickets
  - **Attributes**: id (Int), name, description, githubOwner, githubRepo, userId (owner)
  - **Relationships**: Belongs to one User (owner), Has many ProjectMembers (members), Contains many Tickets
  - **Authorization**: Access granted if user is owner OR project member

- **ProjectMember**: Represents a user's membership in a project
  - **Attributes**: id (Int), projectId (Int), userId (String), role (String, default "member")
  - **Relationships**: Belongs to Project, Belongs to User
  - **Authorization**: Used to grant non-owner users access to project resources
  - **Note**: The `role` field exists but is not used for authorization in this iteration (all members have equal access)

- **Ticket**: Represents a work item within a project
  - **Attributes**: id, title, description, stage, projectId, etc.
  - **Relationships**: Belongs to Project
  - **Authorization**: Inherited from Project access (owner OR member of parent project)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Project members can successfully access project boards without receiving 404/403 errors (100% success rate for valid members)
- **SC-002**: All 21 project-scoped API endpoints enforce consistent "owner OR member" authorization (verified by test coverage)
- **SC-003**: Authorization validation completes in under 100ms for typical requests (performance target for database queries)
- **SC-004**: Project owners retain exclusive control over project deletion and member management (0% unauthorized member actions on owner-only endpoints)
- **SC-005**: Existing owner-based authorization continues to work without regression (backward compatibility - all existing tests pass)
- **SC-006**: Project members can create, update, and comment on tickets with the same capabilities as owners (excluding project-level admin actions)
- **SC-007**: Test suite covers both ownership and membership access paths for critical user journeys (board access, ticket CRUD, commenting)
- **SC-008**: Authorization errors return appropriate status codes (404 for pages, 403 for APIs) without leaking project existence to non-members
