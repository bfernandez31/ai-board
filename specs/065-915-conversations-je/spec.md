# Feature Specification: GitHub-Style Ticket Conversations

**Feature Branch**: `065-915-conversations-je`
**Created**: 2025-10-27
**Status**: Draft
**Input**: User description: "#915 Conversations - Redesign ticket comment section to match GitHub conversation UI, displaying job lifecycle events with user-friendly stage terminology"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Comment Display Format

- **Decision**: Conversation view should follow GitHub-style timeline layout
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (user explicitly referenced GitHub conversations with image example)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Scope**: Requires richer UI components (timeline, event cards) vs simple comment list
  2. **Timeline**: More front-end development effort for visual polish
- **Reviewer Notes**: Verify GitHub reference image matches expected UI patterns; confirm acceptable level of visual fidelity

### Decision 2: Job Event Visibility

- **Decision**: Display both job start and job completion events in conversation timeline
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly stated: "display comments when job starts and when it finishes")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Quality**: Complete audit trail and transparency vs potential visual clutter
  2. **Timeline**: Minimal - event generation logic straightforward
- **Reviewer Notes**: Confirm both events provide user value; consider if start events add noise for quick jobs

### Decision 3: User-Friendly Terminology

- **Decision**: Use stage names (SPECIFY, PLAN, BUILD) and mention "quick workflow" type when applicable, avoiding internal command names
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly stated: "user doesn't have notion of commands but can understand quick workflow")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Quality**: User comprehension improved; requires clear Job.command → stage message mapping
  2. **Scope**: Need message templates for each stage and workflow type combination
- **Reviewer Notes**: Validate that stage names are sufficiently clear without additional context; confirm "quick workflow" badge/mention is intuitive

### Decision 4: Scope Exclusion - VERIFY and SHIP Stages

- **Decision**: Exclude VERIFY and SHIP stages from current implementation (no jobs yet, future feature handles these)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly stated: "VERIFY and SHIP don't have jobs, will be added in another feature")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Scope**: Reduced current work; incomplete conversation history for all stages
  2. **Timeline**: Faster delivery; requires follow-up feature for full coverage
- **Reviewer Notes**: Ensure VERIFY/SHIP exclusion is documented for users; plan follow-up feature ticket

### Decision 5: No Database Schema Changes

- **Decision**: Rebuild conversation history from existing Job records and Comments without adding new tables/fields
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly stated: "no data changes, can rebuild history from jobs")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Quality**: Minimal risk; uses existing data integrity
  2. **Scope**: May require join queries or data aggregation logic
- **Reviewer Notes**: Confirm Job table contains sufficient data (timestamps, status, command, workflowType) for event generation

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Ticket Conversation Timeline (Priority: P1)

As a project team member, I want to see all ticket activity (comments and workflow events) in a unified conversation view, so I can quickly understand the ticket's progress and discussions without switching contexts.

**Why this priority**: Core feature value - provides essential visibility into ticket lifecycle; foundational for other stories.

**Independent Test**: Can be fully tested by creating a ticket with mixed comments and job events, then verifying the timeline displays chronologically with correct formatting.

**Acceptance Scenarios**:

1. **Given** a ticket with 3 user comments and 2 completed jobs (SPECIFY, PLAN), **When** user opens ticket detail page, **Then** conversation timeline displays 5 items in chronological order with distinct visual styling for comments vs job events
2. **Given** a ticket with only user comments and no job history, **When** user views ticket, **Then** timeline displays only comments without job event entries
3. **Given** a ticket with multiple job events (start and complete) for same stage, **When** user views timeline, **Then** events appear in correct sequence showing job lifecycle progression
4. **Given** user is viewing ticket conversation, **When** timeline includes job events, **Then** each job event shows user-friendly stage name (not command name) and workflow type indicator when quick workflow was used

---

### User Story 2 - Understand Job Lifecycle Events (Priority: P2)

As a project team member, I want to see when automated workflows start and complete, so I can track ticket progress and identify any delays or failures.

**Why this priority**: Provides transparency into automation; helps users understand system activity without requiring technical knowledge.

**Independent Test**: Can be tested by triggering a workflow (e.g., INBOX → SPECIFY transition) and verifying start/complete events appear with correct stage terminology.

**Acceptance Scenarios**:

1. **Given** a job has status PENDING or RUNNING, **When** user views ticket conversation, **Then** timeline shows a "job started" event with stage name (e.g., "Specification generation started")
2. **Given** a job has status COMPLETED, **When** user views ticket conversation, **Then** timeline shows a "job completed" event with stage name and success indicator
3. **Given** a job has status FAILED, **When** user views ticket conversation, **Then** timeline shows a "job failed" event with stage name and error indicator
4. **Given** a ticket used quick workflow (workflowType = QUICK), **When** job events are displayed, **Then** events include visual indicator or mention of "quick workflow" to differentiate from full workflow
5. **Given** a ticket is in VERIFY or SHIP stage, **When** user views conversation, **Then** no job events appear for these stages (out of scope for current feature)

---

### User Story 3 - GitHub-Like Visual Experience (Priority: P3)

As a project team member familiar with GitHub, I want the conversation view to visually resemble GitHub's issue/PR timeline, so I can leverage existing mental models and reduce learning curve.

**Why this priority**: User experience enhancement; reduces friction but not strictly necessary for functionality.

**Independent Test**: Can be tested through visual regression testing or manual UX review comparing to GitHub conversation layout.

**Acceptance Scenarios**:

1. **Given** user views ticket conversation, **When** timeline renders, **Then** visual layout includes timeline indicators (vertical line, event nodes) similar to GitHub
2. **Given** conversation includes both comments and events, **When** displayed, **Then** comments use distinct visual styling (e.g., speech bubble, author avatar) vs system events (e.g., icon badge, system user indicator)
3. **Given** user views job event in timeline, **When** event renders, **Then** it includes timestamp, stage name, and status icon consistent with GitHub event styling patterns

---

### Edge Cases

- What happens when a job is CANCELLED? Timeline should show cancellation event with appropriate messaging.
- How does system handle jobs with no explicit end state (RUNNING for extended periods)? Show start event only; completion event appears when status updates.
- What if Job.command doesn't map to a known stage? Use generic fallback message (e.g., "Workflow task started").
- How are rapid successive jobs displayed (e.g., quick retry)? Each job gets separate start/complete events; timeline shows chronological sequence.
- What if user scrolls to old ticket with legacy jobs before this feature? Generate events retroactively from Job.createdAt and Job.completedAt timestamps.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display ticket comments and job lifecycle events in a unified conversation timeline ordered chronologically by timestamp
- **FR-002**: System MUST generate conversation events for job status transitions: PENDING/RUNNING (start event), COMPLETED (success event), FAILED (failure event), CANCELLED (cancellation event)
- **FR-003**: System MUST translate Job.command values to user-friendly stage names in event messages (e.g., "specify" → "Specification generation", "plan" → "Planning", "implement" → "Implementation")
- **FR-004**: System MUST indicate workflow type in job events when Job.workflowType = QUICK (e.g., via badge, icon, or text mention like "Quick workflow")
- **FR-005**: System MUST exclude VERIFY and SHIP stage job events from conversation timeline (out of current scope)
- **FR-006**: System MUST visually distinguish user comments from automated job events in the timeline (different styling, icons, or layout)
- **FR-007**: System MUST display timestamps for all conversation items (comments and events)
- **FR-008**: System MUST generate job events retroactively for existing jobs when loading ticket conversation (using Job.createdAt, Job.completedAt, Job.status fields)
- **FR-009**: System MUST handle missing or unmapped Job.command values gracefully with generic fallback messaging
- **FR-010**: Conversation timeline MUST update when new comments are added or job statuses change without requiring page reload

### Key Entities

- **Comment**: Existing entity representing user-authored comments on tickets (no schema changes)
- **Job**: Existing entity tracking workflow execution (fields used: id, ticketId, command, status, workflowType, createdAt, completedAt)
- **ConversationEvent** (conceptual, not database entity): Represents either a Comment or a generated Job event for timeline display, containing timestamp, type (comment vs job event), content/message, and metadata (author for comments, stage/status for job events)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view complete ticket conversation history (comments + job events) in under 2 seconds on tickets with up to 50 combined items
- **SC-002**: 100% of job status transitions (PENDING→RUNNING, RUNNING→COMPLETED/FAILED/CANCELLED) generate corresponding conversation events
- **SC-003**: 100% of job event messages use stage terminology (SPECIFY, PLAN, BUILD) instead of command names, verified through automated messaging tests
- **SC-004**: Visual distinction between comments and job events is clear: user testing shows 95% of users correctly identify item type without reading content
- **SC-005**: Timeline displays items in correct chronological order for 100% of test cases including mixed comments, overlapping jobs, and retroactive event generation
- **SC-006**: Quick workflow indicators appear on all relevant job events (workflowType = QUICK) with 100% accuracy
- **SC-007**: Zero job events appear for VERIFY or SHIP stages in current implementation, verified through automated tests
