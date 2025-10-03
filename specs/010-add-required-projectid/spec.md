# Feature Specification: Add required projectId foreign key to Ticket model

**Feature Branch**: `010-add-required-projectid`
**Created**: 2025-10-03
**Status**: Draft
**Input**: User description: "Add required projectId foreign key to Ticket model.

  WHAT:
  Link every ticket to a project through a required projectId field.

  WHY:
  Tickets must belong to a project context. This is foundational for project-scoped boards and future multi-project support.

  REQUIREMENTS:

  SCHEMA:
  - Add projectId field to Ticket: integer, required, foreign key to Project.id
  - Add cascade delete: when project deleted, all its tickets deleted
  - Add index on Ticket.projectId for efficient project-scoped queries
  - Add relation in Prisma schema: Ticket.project and Project.tickets[]

  DATABASE:
  - Clean approach: reset database (npx prisma migrate reset)
  - Seed must create default project BEFORE any tickets
  - For MVP: single hardcoded project (id=1, name='ai-board')

  ACCEPTANCE:
  - Prisma schema includes Ticket.projectId (required, indexed)
  - Foreign key constraint prevents orphaned tickets
  - Seed creates project first, then tickets reference it
  - All ticket queries work with projectId filter

  NON-GOALS:
  - No API changes yet (next feature)
  - No route changes yet (next feature)
  - No branch field (separate concern)
  - No autoMode field (separate concern)
  - No multi-project UI"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature is clear: Link tickets to projects via required foreign key
2. Extract key concepts from description
   → Actors: system, data model
   → Actions: link tickets to projects, enforce data integrity
   → Data: tickets, projects, foreign key relationship
   → Constraints: required field, cascade delete, indexed for performance
3. For each unclear aspect:
   → No major ambiguities - schema changes are well-specified
4. Fill User Scenarios & Testing section
   → Focus on data integrity and relationship enforcement
5. Generate Functional Requirements
   → All requirements are testable via schema validation and database constraints
6. Identify Key Entities (if data involved)
   → Ticket and Project entities with required relationship
7. Run Review Checklist
   → No implementation details beyond necessary schema definition
   → Spec is ready for planning
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
The system needs to enforce that every ticket belongs to a project. This ensures data integrity and enables project-scoped organization of tickets. When a project is deleted, all associated tickets should be automatically removed to prevent orphaned data.

### Acceptance Scenarios
1. **Given** a new ticket is being created, **When** no project is specified, **Then** the system MUST prevent the ticket from being saved
2. **Given** a ticket exists with a project reference, **When** the project is deleted, **Then** all tickets associated with that project MUST be automatically deleted
3. **Given** tickets exist across multiple projects, **When** querying tickets for a specific project, **Then** the system MUST efficiently retrieve only tickets belonging to that project
4. **Given** the system is initialized, **When** seed data is loaded, **Then** a default project MUST be created before any tickets are created

### Edge Cases
- What happens when attempting to create a ticket without a project reference? (System must reject the operation)
- What happens when a project with tickets is deleted? (All associated tickets are automatically removed via cascade delete)
- How does the system handle queries for tickets when filtering by project? (Indexed projectId field ensures efficient lookups)

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST enforce that every ticket belongs to exactly one project through a required foreign key relationship
- **FR-002**: System MUST prevent creation of tickets without a valid project reference
- **FR-003**: System MUST automatically delete all tickets when their associated project is deleted (cascade delete)
- **FR-004**: System MUST efficiently query tickets by project through an indexed project reference field
- **FR-005**: System MUST maintain referential integrity between tickets and projects, preventing orphaned tickets
- **FR-006**: System initialization MUST create a default project before creating any tickets
- **FR-007**: System MUST support single-project operations for the MVP phase with a predefined default project

### Key Entities
- **Ticket**: Represents a work item or task that MUST belong to a project; includes a required reference to its parent project with cascading delete behavior
- **Project**: Represents a collection or context that contains tickets; when deleted, all associated tickets are automatically removed
- **Ticket-Project Relationship**: Required one-to-many relationship where one project can have multiple tickets, but each ticket must have exactly one project

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
- [x] Scope is clearly bounded (MVP: single project, no UI changes, no API changes)
- [x] Dependencies and assumptions identified (requires existing Project and Ticket models)

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
