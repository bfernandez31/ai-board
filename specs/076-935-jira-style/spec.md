# Feature Specification: Jira-Style Ticket Numbering System

**Feature Branch**: `076-935-jira-style`
**Created**: 2025-10-31
**Status**: Draft
**Input**: User description: "#935 Jira-Style Ticket Numbering System"

## Auto-Resolved Decisions

- **Decision**: Default test strategy during migration
- **Policy Applied**: CONSERVATIVE (fallback from AUTO)
- **Confidence**: Low (score: 0, conflicting signals detected)
- **Fallback Triggered?**: Yes — AUTO scoring detected conflicting signals (reliability keywords +2, speed directive -3) with net score 0 and low confidence (<0.5), triggering fallback to CONSERVATIVE policy
- **Trade-offs**:
  1. **Scope**: All existing tests must be updated to work with new numbering system, not just "fixed" minimally
  2. **Timeline**: Conservative approach requires comprehensive test updates, increasing initial implementation time
  3. **Quality**: Ensures data integrity and prevents race conditions during migration, critical for production stability
- **Reviewer Notes**: The user note "DO NOT ADD NEW TESTS ! YOU SHOULD ONLY FIX THE OLD ONE FOR NOW" conflicts with the reliability requirements (thread-safety, race condition prevention). Reviewers must validate whether test suite updates are sufficient or if new integration tests are needed for concurrent ticket creation scenarios.

---

- **Decision**: URL migration strategy and backward compatibility approach
- **Policy Applied**: CONSERVATIVE (fallback from AUTO)
- **Confidence**: Medium (architectural change with breaking URL patterns)
- **Fallback Triggered?**: Yes — part of same AUTO → CONSERVATIVE fallback decision
- **Trade-offs**:
  1. **Breaking Change**: All existing `/projects/:projectId/tickets/:id` routes must be updated to support both old (ID-based) and new (key-based) URL patterns during transition period
  2. **Frontend Impact**: All ticket.id references in UI components must be updated to use ticket.key for display and navigation
  3. **Migration Path**: Requires temporary dual-route support and redirect strategy to prevent broken links
- **Reviewer Notes**: Validate whether a phased rollout with URL redirects is acceptable, or if all routes must change atomically. Consider impact on external integrations (webhooks, API consumers, documentation links).

## User Scenarios & Testing

### User Story 1 - View Per-Project Ticket Numbers (Priority: P1)

As a project team member, when I view tickets in my project, I see ticket numbers starting from 1 and incrementing independently within my project (e.g., "Ticket #5" in Project A, "Ticket #5" in Project B), making it easy to reference tickets in conversations without confusion about which project they belong to.

**Why this priority**: Core value proposition — independent numbering per project is the primary user benefit and enables familiar Jira-style workflows.

**Independent Test**: Can be fully tested by creating two projects, adding tickets to each, and verifying numbering starts at 1 in both projects and increments independently. Delivers immediate value by showing user-friendly ticket numbers in the UI.

**Acceptance Scenarios**:

1. **Given** a new project with no tickets, **When** I create the first ticket, **Then** it is assigned ticket number 1
2. **Given** a project with 5 existing tickets (numbered 1-5), **When** I create a new ticket, **Then** it is assigned ticket number 6
3. **Given** two different projects (Project A and Project B), **When** I create tickets in each project, **Then** both projects show independent numbering starting from 1 (e.g., A has tickets 1-3, B has tickets 1-2)

---

### User Story 2 - Use Human-Readable Ticket Keys (Priority: P1)

As a team member, when I reference tickets in comments, Slack messages, or documentation, I use short, memorable keys like "ABC-123" instead of meaningless global IDs, making cross-team communication clearer and reducing lookup friction.

**Why this priority**: Equally critical to P1 — the key format (project prefix + number) is the user-facing identifier that enables easy communication and mental model alignment with industry standards (Jira, GitHub issues).

**Independent Test**: Can be fully tested by creating a project with key "ABC", creating tickets, and verifying keys like "ABC-1", "ABC-2" appear in UI, URLs, and API responses. Delivers value by making ticket references human-readable.

**Acceptance Scenarios**:

1. **Given** a project with key "ABC", **When** I create a ticket, **Then** the ticket is assigned a unique key in format "ABC-1" (project key + hyphen + ticket number)
2. **Given** I'm viewing a ticket with key "ABC-123", **When** I copy the URL, **Then** the URL contains the human-readable key (e.g., `/browse/ABC-123`) not a numeric ID
3. **Given** multiple projects with different keys ("ABC", "DEF"), **When** I view tickets across projects, **Then** each ticket key clearly indicates which project it belongs to (e.g., "ABC-5" vs "DEF-5")

---

### User Story 3 - Navigate Using Clean URLs (Priority: P2)

As a user, when I access tickets via URL (bookmarks, external links, browser history), I use clean, meaningful URLs like `/browse/ABC-123` that remain stable and are easy to remember and share.

**Why this priority**: Important for usability but depends on P1 stories — URL structure leverages the ticket keys established in P1/P2. Enables bookmark persistence and link sharing.

**Independent Test**: Can be fully tested by accessing tickets via both key-based URLs (`/browse/ABC-123`) and verifying navigation works correctly. Delivers value by providing stable, shareable links.

**Acceptance Scenarios**:

1. **Given** a ticket with key "ABC-123", **When** I navigate to `/browse/ABC-123`, **Then** I see the correct ticket details
2. **Given** I bookmark a ticket URL `/browse/ABC-123`, **When** I revisit the bookmark after weeks, **Then** the link still works and shows the same ticket
3. **Given** I share a ticket URL with a colleague, **When** they click the link, **Then** they see the correct ticket without confusion about which project it belongs to

---

### User Story 4 - Migrate Existing Tickets Without Data Loss (Priority: P1)

As a system administrator, when the new numbering system is deployed, all existing tickets are automatically migrated to the new format with stable ticket numbers assigned based on creation order within each project, ensuring no tickets are lost or renumbered unexpectedly.

**Why this priority**: Critical for production deployment — must preserve existing data and prevent breaking changes to user workflows. Blockers for all other stories.

**Independent Test**: Can be fully tested by running migration on test database with known ticket data, verifying all tickets receive correct project-scoped numbers, and confirming no data loss. Delivers value by enabling safe production rollout.

**Acceptance Scenarios**:

1. **Given** existing tickets in multiple projects (e.g., Project 1 has global IDs 1,5,8; Project 2 has global IDs 2,3,4), **When** migration runs, **Then** Project 1 tickets are renumbered 1-3 and Project 2 tickets are renumbered 1-3 based on creation order
2. **Given** old URLs using global IDs (e.g., `/projects/1/tickets/5`), **When** a user accesses the old URL after migration, **Then** they are redirected to the new key-based URL (e.g., `/browse/ABC-2`)
3. **Given** external links or bookmarks using old ticket IDs, **When** migration completes, **Then** a redirect mechanism ensures old links continue to work for a transition period

---

### Edge Cases

- **Concurrent ticket creation**: What happens when two users create tickets simultaneously in the same project? System must use thread-safe sequence generation (PostgreSQL function) to prevent duplicate ticket numbers or race conditions.
- **Project key conflicts**: What happens if a user tries to create a project with a key that already exists? System must enforce unique constraint and provide clear error message.
- **Project key generation**: What happens if a project name is too short to generate a 3-character key (e.g., "AI")? System must handle short names (pad with sequential number or user input).
- **Migration rollback**: What happens if migration fails partway through? System must support atomic migration or provide rollback mechanism to restore original state.
- **URL collision**: What happens if old numeric ID-based URL conflicts with new key-based URL format? Routing logic must clearly distinguish between patterns (e.g., `/projects/:id/tickets/:id` vs `/browse/:key`).
- **Deleted projects**: What happens to ticket keys when a project is deleted? System must handle orphaned keys and prevent reuse if project is recreated with same key.

## Requirements

### Functional Requirements

- **FR-001**: System MUST assign each project a unique 3-character key (uppercase alphanumeric) derived from project name or provided by user during creation
- **FR-002**: System MUST assign each ticket a unique ticket number starting from 1 within its project, incrementing sequentially for each new ticket
- **FR-003**: System MUST generate a unique ticket key for each ticket combining project key and ticket number in format "{PROJECT_KEY}-{TICKET_NUMBER}" (e.g., "ABC-123")
- **FR-004**: System MUST use thread-safe sequence generation (PostgreSQL sequence or function) to prevent race conditions during concurrent ticket creation
- **FR-005**: System MUST support lookup of tickets by ticket key (e.g., "ABC-123") in addition to internal numeric ID
- **FR-006**: System MUST update all API routes to accept ticket keys instead of (or in addition to) numeric ticket IDs for user-facing operations
- **FR-007**: System MUST provide URL format `/browse/{TICKET_KEY}` for accessing tickets via human-readable keys
- **FR-008**: System MUST migrate existing tickets during deployment by assigning project-scoped ticket numbers based on creation order within each project
- **FR-009**: System MUST maintain backward compatibility by redirecting old ID-based URLs to new key-based URLs during transition period
- **FR-010**: System MUST preserve internal numeric ticket ID as primary key for foreign key relationships and database integrity
- **FR-011**: System MUST enforce unique constraint on ticket key field to prevent duplicate keys across all projects
- **FR-012**: System MUST enforce unique constraint on combination of (projectId, ticketNumber) to prevent duplicate numbers within a project
- **FR-013**: System MUST display ticket number (not internal ID) in UI components (ticket cards, lists, detail views)
- **FR-014**: System MUST display ticket key (e.g., "ABC-123") in shareable contexts (URLs, notifications, exports)
- **FR-015**: System MUST update all existing tests to work with new ticket numbering system and key-based lookups

### Key Entities

- **Project Key**: A unique 3-character identifier for each project (e.g., "ABC", "DEF"), used as the prefix for ticket keys. Generated from project name or provided by user. Must be unique across all projects.

- **Ticket Number**: A sequential integer starting from 1 within each project. Increments independently per project. Combined with project key to form ticket key.

- **Ticket Key**: A unique human-readable identifier in format "{PROJECT_KEY}-{TICKET_NUMBER}" (e.g., "ABC-123"). Used for URLs, user references, and API lookups. Cached as a denormalized field for performance.

- **Ticket Internal ID**: The existing auto-incrementing integer primary key. Preserved for foreign key relationships and backward compatibility. Not exposed in user-facing contexts.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can reference tickets using short keys (e.g., "ABC-123") in 100% of user-facing contexts (UI, URLs, exports) without seeing internal numeric IDs
- **SC-002**: Ticket creation under concurrent load (10+ simultaneous creates in same project) produces unique, sequential ticket numbers with zero duplicates or gaps
- **SC-003**: Migration of existing tickets completes successfully with 100% data preservation and correct project-scoped numbering based on creation order
- **SC-004**: Old bookmark URLs and external links continue to work via redirect mechanism for at least 90 days post-migration with zero broken links
- **SC-005**: Users can create tickets and navigate using keys in under 2 seconds with no perceived performance degradation compared to current system
- **SC-006**: All existing tests pass after updates to support new numbering system, with zero test failures related to ticket ID/key handling
- **SC-007**: Project team members can identify which project a ticket belongs to by looking at the key alone, reducing cross-project confusion to zero incidents
