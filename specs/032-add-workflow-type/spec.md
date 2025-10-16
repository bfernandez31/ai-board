# Feature Specification: Add Workflow Type Field to Track Quick-Implementation Tickets

**Feature Branch**: `032-add-workflow-type`
**Created**: 2025-01-16
**Status**: Draft
**Input**: User description: "Add Workflow Type Field to Track Quick-Implementation Tickets"

## Auto-Resolved Decisions

- **Decision**: Database field immutability strategy
- **Policy Applied**: AUTO (context-aware resolution)
- **Confidence**: High (0.9) - clear requirement from user input
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Immutable field prevents accidental changes but requires explicit manual updates for workflow conversions
  2. Default value of FULL ensures backward compatibility with existing tickets
- **Reviewer Notes**: Validate that immutability is enforced at application level (not just documentation)

---

- **Decision**: Badge styling approach (light/dark theme support)
- **Policy Applied**: AUTO (leveraging existing UI patterns)
- **Confidence**: High (0.85) - follows established shadcn/ui conventions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Using existing badge component ensures consistency but limits customization
  2. Amber color scheme distinguishes quick-impl from other indicators
- **Reviewer Notes**: Test badge visibility in both themes, especially amber-on-white contrast

---

- **Decision**: Transaction boundary for Job + Ticket update
- **Policy Applied**: CONSERVATIVE (data integrity requirement)
- **Confidence**: High (0.9) - critical for consistency
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Atomic transaction prevents orphaned Jobs but adds minimal performance overhead
  2. Single database roundtrip improves performance over separate updates
- **Reviewer Notes**: Verify rollback behavior if workflow dispatch fails after DB commit

## User Scenarios & Testing

### User Story 1 - Developer Identifies Quick-Impl Tickets (Priority: P1)

A developer views the kanban board and needs to quickly identify which tickets were implemented via quick-impl (INBOX → BUILD) versus the full workflow (INBOX → SPECIFY → PLAN → BUILD).

**Why this priority**: Core feature value - provides the persistent visual indicator that solves the stated problem. Without this, the feature has no user-facing impact.

**Independent Test**: Can be fully tested by creating a quick-impl ticket, verifying the badge appears on the card, and confirming it persists after moving to other stages.

**Acceptance Scenarios**:

1. **Given** a ticket created via quick-impl (INBOX → BUILD), **When** viewing the board, **Then** ticket card displays ⚡ Quick badge
2. **Given** a ticket created via full workflow (INBOX → SPECIFY), **When** viewing the board, **Then** ticket card does NOT display quick-impl badge
3. **Given** a quick-impl ticket in BUILD stage, **When** ticket is moved to VERIFY or SHIP, **Then** badge remains visible
4. **Given** a quick-impl ticket with subsequent jobs (retry, rollback), **When** viewing the board, **Then** badge still displays (workflowType unchanged)

---

### User Story 2 - System Sets Workflow Type During Transition (Priority: P1)

The system automatically sets the workflow type when a ticket transitions from INBOX to BUILD via quick-impl, ensuring accurate tracking without manual intervention.

**Why this priority**: Required backend logic - without this, the badge cannot be displayed correctly. Must be completed before frontend display work.

**Independent Test**: Can be tested by triggering INBOX → BUILD transition via API and verifying database field is set to QUICK atomically with Job creation.

**Acceptance Scenarios**:

1. **Given** ticket in INBOX stage, **When** user drags to BUILD (quick-impl), **Then** workflowType is set to QUICK in same transaction as Job creation
2. **Given** ticket in INBOX stage, **When** user drags to SPECIFY (normal workflow), **Then** workflowType remains FULL (default)
3. **Given** quick-impl transition fails (GitHub API error), **When** transaction rolls back, **Then** workflowType is NOT updated
4. **Given** ticket with workflowType=QUICK, **When** subsequent jobs run (implement, verify), **Then** workflowType remains QUICK (immutable)

---

### User Story 3 - Existing Tickets Default to Full Workflow (Priority: P2)

After database migration, all existing tickets automatically have workflowType=FULL, with manual correction available for the 2 known quick-impl tickets.

**Why this priority**: Data migration safety - ensures existing tickets have valid state. Lower priority because it's one-time setup and only affects 2 tickets manually.

**Independent Test**: Can be tested by running migration on staging database and verifying all tickets have workflowType=FULL.

**Acceptance Scenarios**:

1. **Given** database before migration, **When** migration runs, **Then** all existing tickets have workflowType=FULL
2. **Given** 2 manually-identified quick-impl tickets, **When** admin updates them, **Then** workflowType changes to QUICK
3. **Given** tickets created after migration, **When** created via normal workflow, **Then** workflowType defaults to FULL

---

### User Story 4 - Badge Works in Light and Dark Themes (Priority: P3)

The quick-impl badge maintains sufficient contrast and readability in both light and dark color schemes.

**Why this priority**: UI polish - important for user experience but not blocking core functionality. Can be adjusted post-launch if needed.

**Independent Test**: Can be tested by toggling theme and verifying badge contrast meets WCAG AA standards.

**Acceptance Scenarios**:

1. **Given** user in light theme, **When** viewing quick-impl ticket, **Then** badge has amber background with dark text (readable)
2. **Given** user in dark theme, **When** viewing quick-impl ticket, **Then** badge has adjusted amber tones for visibility
3. **Given** quick-impl badge displayed, **When** compared to other badges, **Then** distinct color prevents confusion

---

### Edge Cases

- What happens when a ticket is manually updated to change workflowType? System allows admin updates via database tools, but UI does not provide workflow conversion feature (out of scope).
- How does system handle race conditions during transition? Atomic transaction ensures Job and Ticket update together; if Job creation fails, Ticket update rolls back.
- What if migration runs multiple times? Migration is idempotent - existing WorkflowType enum and field are not modified on subsequent runs.
- How are tickets created before the quick-impl feature (pre-031) classified? All default to FULL since they followed the only available workflow at the time.

## Requirements

### Functional Requirements

#### Database Schema

- **FR-001**: System MUST define WorkflowType enum with values FULL and QUICK
- **FR-002**: Ticket model MUST include workflowType field with default value FULL
- **FR-003**: Database migration MUST add workflowType column to Ticket table without data loss
- **FR-004**: System MUST create index on (projectId, workflowType) for future filtering queries

#### Backend Logic

- **FR-005**: System MUST set workflowType to QUICK when creating quick-impl Job (isQuickImpl=true)
- **FR-006**: System MUST update Job and Ticket.workflowType in single atomic transaction
- **FR-007**: System MUST preserve workflowType=QUICK after subsequent jobs (retries, rollbacks, stage transitions)
- **FR-008**: System MUST NOT automatically modify workflowType after initial BUILD transition (immutable)
- **FR-009**: System MUST allow manual workflowType updates via admin tools (for 2 existing tickets)

#### Frontend Display

- **FR-010**: Board query MUST include workflowType field when loading tickets
- **FR-011**: Ticket card MUST display ⚡ Quick badge when workflowType=QUICK
- **FR-012**: Badge MUST NOT display when workflowType=FULL
- **FR-013**: Badge MUST use amber color scheme (bg-amber-100 text-amber-800 in light, adjusted for dark)
- **FR-014**: Badge MUST maintain visibility and contrast in both light and dark themes
- **FR-015**: Badge MUST appear in consistent position on ticket card (next to title or in header area)

#### Type Definitions

- **FR-016**: TicketWithVersion type MUST include workflowType: WorkflowType field
- **FR-017**: Board components MUST receive workflowType in ticket props

### Key Entities

- **WorkflowType**: Enum representing how a ticket was initially implemented
  - Values: FULL (normal workflow), QUICK (quick-implementation)
  - Set once during first BUILD transition, immutable thereafter

- **Ticket**: Work item in kanban board
  - New field: workflowType (WorkflowType enum, defaults to FULL)
  - Relationship: One ticket has exactly one workflow type (1:1)
  - Lifecycle: Set when ticket first enters BUILD stage, persists through all subsequent stages

## Success Criteria

### Measurable Outcomes

#### Functional Success

- **SC-001**: Developers can distinguish quick-impl from full workflow tickets by visual indicator on board (100% accuracy)
- **SC-002**: All new quick-impl tickets automatically have workflowType=QUICK after transition completes (0% manual intervention required)
- **SC-003**: All new full workflow tickets automatically have workflowType=FULL (default behavior preserved)
- **SC-004**: Badge persists correctly through stage transitions, rollbacks, and retries (100% retention across 10+ ticket lifecycle tests)
- **SC-005**: Database migration completes without errors or data loss (verified on staging environment)

#### Data Integrity Success

- **SC-006**: Job creation and workflowType update execute atomically (0 orphaned Jobs or mismatched states)
- **SC-007**: WorkflowType field is never modified after initial setting except via explicit admin action (immutability verified)
- **SC-008**: Existing tickets default to FULL after migration (100% of pre-migration tickets)

#### User Experience Success

- **SC-009**: Badge is readable in both light and dark themes (WCAG AA contrast ratio ≥4.5:1 for text)
- **SC-010**: Badge appears within 100ms of board load (no perceptible delay)
- **SC-011**: Badge color (amber) is distinct from other board indicators (verified via user testing or design review)

#### Technical Success

- **SC-012**: Code passes all linter checks (TypeScript strict mode, Prisma validation)
- **SC-013**: Test coverage for new logic ≥80% (transition logic, badge rendering, migration)
- **SC-014**: E2E tests validate badge appears for quick-impl tickets and not for full workflow tickets
- **SC-015**: Database index on (projectId, workflowType) improves query performance for future filtering features (baseline established)

### Out of Scope (Future Features)

The following capabilities are explicitly excluded from this specification:

1. **Workflow Conversion UI**: User interface to convert quick-impl tickets to full workflow (manually creating spec.md retrospectively)
2. **Board Filtering**: Filter/toggle to show only quick-impl or only full workflow tickets
3. **Analytics Dashboard**: Metrics showing percentage of quick-impl vs full workflow tickets, success rates by type
4. **Ticket Detail Modal Indicator**: Displaying workflow type in ticket detail view (currently only visible on board cards)
5. **Bulk Operations**: Select multiple quick-impl tickets for batch actions (e.g., bulk spec creation)
6. **Workflow Type Override**: UI for admins to manually change workflowType (currently requires database access)

## Dependencies and Assumptions

### Dependencies

- **Prisma ORM**: Migration system for schema changes
- **Existing Quick-Impl Feature (031)**: `lib/workflows/transition.ts` contains `isQuickImpl` detection logic
- **shadcn/ui Badge Component**: Used for visual indicator on ticket cards
- **Database**: PostgreSQL supports enum types and atomic transactions

### Assumptions

- **User Skill Level**: Developers understand the difference between quick-impl and full workflow based on badge presence
- **Theme Support**: Application already has light/dark theme infrastructure (shadcn/ui theming)
- **Badge Placement**: Ticket card has sufficient space in header area for additional badge without layout issues
- **Migration Safety**: Existing tickets can safely default to FULL workflow type (accurate assumption since quick-impl feature is recent)
- **Manual Updates**: Admin has database access to manually update the 2 existing quick-impl tickets (acceptable one-time manual operation)
- **Immutability Enforcement**: Application code enforces workflowType immutability (no database constraint needed beyond default value)
- **Transaction Support**: PostgreSQL transaction isolation level supports atomic Job + Ticket updates without race conditions
