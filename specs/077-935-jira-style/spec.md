# Feature Specification: Jira-Style Ticket Numbering System

**Feature Branch**: `077-935-jira-style`
**Created**: 2025-10-31
**Status**: Draft
**Input**: User description: "#935 Jira-Style Ticket Numbering System"

## Auto-Resolved Decisions

### Decision 1: Project Key Generation Strategy

- **Decision**: How to generate unique 3-character project keys from project names
- **Policy Applied**: AUTO (resolved as CONSERVATIVE due to data integrity concerns)
- **Confidence**: Medium (score: +3) - Data integrity signals (+3) combined with migration complexity (+2) outweigh speed directive (-3)
- **Fallback Triggered?**: No - Clear default strategy available
- **Trade-offs**:
  1. **Scope**: Automatic key generation from name simplifies user experience but requires collision handling logic
  2. **Timeline**: May need manual key assignment UI for edge cases (very short names, duplicate keys)
- **Reviewer Notes**: Validate that the key generation algorithm handles all edge cases: empty names, non-ASCII characters, duplicate keys across projects

### Decision 2: URL Migration and Backward Compatibility

- **Decision**: How to handle existing URLs using numeric ticket IDs during migration
- **Policy Applied**: CONSERVATIVE (explicit requirement for backward compatibility)
- **Confidence**: High - Feature description explicitly states "Backward compatible (keeps internal ID)"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Scope**: Supporting dual URL patterns increases API complexity
  2. **Timeline**: Requires updating all frontend routes and API endpoints to support both formats
- **Reviewer Notes**: Confirm timeline for deprecating old URL format (/projects/:id/tickets/:id) and migration plan for external integrations

### Decision 3: Test Update Scope

- **Decision**: Whether to create new tests or only fix existing tests
- **Policy Applied**: PRAGMATIC (explicit user instruction: "DO NOT ADD NEW TESTS ! YOU SHOULD ONLY FIX THE OLD ONE FOR NOW")
- **Confidence**: High - Direct instruction from user
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Quality**: Existing test coverage may have gaps for new functionality
  2. **Speed**: Faster initial delivery, but may require follow-up testing work
- **Reviewer Notes**: After implementation, assess test coverage gaps and create backlog items for comprehensive test suite

### Decision 4: Ticket Key Display Priority

- **Decision**: Which identifier to show as primary in UI (internal ID vs ticket key)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE based on user experience requirements)
- **Confidence**: High - Feature description emphasizes "Ticket #5 (local number)" and "clean, memorable" URLs
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **UX**: Ticket keys are more user-friendly but require UI updates across all ticket displays
  2. **Scope**: All components showing ticket IDs must be updated
- **Reviewer Notes**: Ensure ticket keys are displayed consistently across: board cards, ticket detail pages, search results, notifications, and exports

## User Scenarios & Testing

### User Story 1 - View Tickets with Project-Scoped Numbers (Priority: P1)

Users can identify and reference tickets using project-specific numbering (e.g., "ABC-5") instead of global IDs, making ticket references intuitive and project-scoped.

**Why this priority**: Core value proposition - without this, the feature provides no user benefit. This is the minimum viable change.

**Independent Test**: Users can view any ticket and see its project-scoped key (e.g., "ABC-123") displayed prominently. Can be tested by creating a project and viewing its tickets.

**Acceptance Scenarios**:

1. **Given** a project "Mobile App" with key "MOB", **When** I view the fifth ticket created in that project, **Then** I see the ticket labeled as "MOB-5"
2. **Given** two projects "Backend" (key "BAK") and "Frontend" (key "FRO"), **When** each has created 3 tickets, **Then** Backend shows tickets BAK-1, BAK-2, BAK-3 and Frontend shows FRO-1, FRO-2, FRO-3 (not sequential global IDs)
3. **Given** I'm viewing a ticket on the board, **When** I look at the ticket card, **Then** the ticket key (e.g., "ABC-123") is displayed as the primary identifier

---

### User Story 2 - Access Tickets via Clean URLs (Priority: P1)

Users can access tickets using memorable, shareable URLs like `/browse/ABC-123` instead of numeric IDs, making it easier to reference tickets in conversations and documentation.

**Why this priority**: Critical for user adoption - clean URLs drive the usability improvement and enable easy ticket sharing.

**Independent Test**: Users can navigate to `/browse/ABC-123` and view the correct ticket. Can be tested by creating a ticket and accessing it via its key-based URL.

**Acceptance Scenarios**:

1. **Given** a ticket with key "ABC-123" exists, **When** I navigate to `/browse/ABC-123`, **Then** I see the ticket detail page for that ticket
2. **Given** I copy a ticket URL from the browser, **When** I share it with a colleague, **Then** the URL format is `/browse/[KEY]` (not `/projects/[id]/tickets/[id]`)
3. **Given** I bookmark a ticket URL, **When** I return to the bookmark weeks later, **Then** the URL still works (stable across ticket lifecycle)

---

### User Story 3 - Create New Projects with Unique Keys (Priority: P2)

Users can create new projects and receive automatically generated unique 3-character project keys, ensuring all new tickets have proper key-based identifiers.

**Why this priority**: Required for creating new projects after migration, but existing projects can function with migrated keys first.

**Independent Test**: Users can create a new project and the system assigns a unique 3-character key. Can be tested by creating projects with various names and verifying key generation.

**Acceptance Scenarios**:

1. **Given** I create a new project named "API Backend", **When** the project is created, **Then** it automatically receives a unique key like "API" (first 3 characters, uppercase)
2. **Given** a project with key "MOB" already exists, **When** I create a new project "Mobile", **Then** the system generates a different unique key (e.g., "MO1" or prompts for manual key)
3. **Given** I'm creating a project with a short name "Go", **When** the project is created, **Then** the system generates a valid 3-character key (e.g., "GO_" or "GO1")

---

### User Story 4 - Migrate Existing Tickets to New Numbering (Priority: P2)

Existing tickets are automatically migrated to the new numbering system, receiving project-scoped numbers and keys while maintaining their internal IDs for backward compatibility.

**Why this priority**: Essential for existing users, but new user adoption doesn't depend on this. Can be rolled out after P1 features work for new tickets.

**Independent Test**: After migration, all existing tickets have valid ticket keys and numbers. Can be tested by running migration on test data and verifying key generation.

**Acceptance Scenarios**:

1. **Given** Project 1 has existing tickets with IDs 1-5 and Project 2 has tickets with IDs 6-10, **When** migration runs, **Then** Project 1 tickets become KEY1-1 through KEY1-5, and Project 2 tickets become KEY2-1 through KEY2-5
2. **Given** a ticket existed with old URL `/projects/1/tickets/5`, **When** migration completes, **Then** both old URL and new URL `/browse/KEY-5` work correctly
3. **Given** foreign key references to ticket IDs exist in comments and jobs, **When** migration runs, **Then** all references remain valid (internal IDs unchanged)

---

### User Story 5 - Reference Tickets in Comments (Priority: P3)

Users can mention tickets in comments using clean key syntax (e.g., "ABC-123") and the system recognizes these as ticket references, potentially linking them.

**Why this priority**: Nice-to-have enhancement that improves collaboration, but core functionality works without it.

**Independent Test**: Users can type ticket keys in comments and they are recognized. Can be tested by adding a comment with a ticket key reference.

**Acceptance Scenarios**:

1. **Given** I'm writing a comment on ticket ABC-1, **When** I type "See ABC-5 for related issue", **Then** the system recognizes "ABC-5" as a ticket reference
2. **Given** I mention "MOB-123" in a Slack message, **When** I copy that reference into the ticket system, **Then** it's clear which ticket I'm referring to (no ambiguity like "ticket 123")

---

### Edge Cases

- **What happens when a project name is very short (1-2 characters)?** System should pad or generate valid 3-character key (e.g., "A" → "A__" or "A01")
- **What happens when two projects would generate the same key?** System must detect collision and either auto-disambiguate (e.g., "API" → "AP1", "AP2") or prompt user for manual key assignment
- **What happens when a project name contains non-ASCII characters?** System should transliterate or fallback to a default pattern (e.g., "日本" → "JPN" or "P01")
- **How does system handle ticket references during migration if old URLs are bookmarked?** Both old and new URL formats must resolve to the same ticket during transition period
- **What happens if ticket number generation fails (race condition)?** PostgreSQL sequence function must be thread-safe; if generation fails, retry or return clear error
- **What happens when users search for tickets by old numeric ID?** System should support search by both old ID and new key during transition period

## Requirements

### Functional Requirements

- **FR-001**: System MUST assign each project a unique 3-character key (uppercase alphanumeric)
- **FR-002**: System MUST generate project keys automatically from project names (first 3 characters, uppercase) with collision detection
- **FR-003**: System MUST assign tickets a project-scoped sequential number starting at 1 for each project
- **FR-004**: System MUST generate ticket numbers using a thread-safe PostgreSQL sequence function to prevent race conditions
- **FR-005**: System MUST create a unique ticket key by combining project key and ticket number (format: "KEY-NUM", e.g., "ABC-123")
- **FR-006**: System MUST store ticket keys as a denormalized field for query performance
- **FR-007**: System MUST support ticket lookup by ticket key via `/browse/:key` URL pattern
- **FR-008**: System MUST maintain backward compatibility by preserving internal numeric ticket IDs
- **FR-009**: System MUST support legacy URL pattern `/projects/:projectId/tickets/:id` during transition period
- **FR-010**: System MUST display ticket keys (not internal IDs) as the primary identifier in all user-facing contexts
- **FR-011**: System MUST create database indexes on ticket key field for efficient lookups
- **FR-012**: System MUST enforce unique constraint on ticket keys across all projects
- **FR-013**: System MUST enforce unique constraint on (projectId, ticketNumber) combination
- **FR-014**: System MUST migrate existing tickets to assign ticket numbers and keys during database migration
- **FR-015**: System MUST update all API endpoints to accept ticket keys in addition to internal IDs where applicable

### Key Entities

- **Project Key**: A unique 3-character uppercase alphanumeric identifier for each project (e.g., "ABC", "MOB", "API"). Generated from project name with collision handling. Immutable after creation.

- **Ticket Number**: An integer representing the sequential position of a ticket within its project (1, 2, 3, ...). Independent per project. Generated by PostgreSQL sequence function.

- **Ticket Key**: A unique composite identifier combining project key and ticket number (format: "KEY-NUM"). Denormalized field stored on ticket for performance. Primary user-facing identifier.

- **Ticket (Internal ID)**: The existing auto-increment integer ID preserved for backward compatibility and foreign key relationships. Not exposed in user-facing contexts.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can identify any ticket using its project-scoped key (e.g., "ABC-5") within 2 seconds of viewing it
- **SC-002**: 100% of new tickets created after migration receive valid project-scoped ticket keys in format "KEY-NUM"
- **SC-003**: Ticket lookup by key completes in under 50ms at p95 (via indexed key field)
- **SC-004**: Zero collisions in ticket key generation (enforced by unique constraint)
- **SC-005**: Zero race conditions in ticket number generation (enforced by PostgreSQL sequence function)
- **SC-006**: All existing tickets migrated to new numbering system with valid keys assigned
- **SC-007**: Both old URLs (`/projects/:id/tickets/:id`) and new URLs (`/browse/KEY-NUM`) resolve correctly for all tickets
- **SC-008**: Users can share ticket URLs that remain stable and memorable (e.g., `/browse/ABC-123`)
- **SC-009**: All foreign key relationships remain intact after migration (zero broken references)
- **SC-010**: Test suite passes with updates to accommodate new ticket identification system
