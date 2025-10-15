# Feature Specification: Quick Implementation Workflow

**Feature Branch**: `031-quick-implementation`
**Created**: 2025-01-15
**Status**: Draft
**Input**: User description: "Quick Implementation - Fast-track workflow for simple tasks bypassing SPECIFY and PLAN stages"

## Auto-Resolved Decisions

- **Decision**: Default clarification policy for specification generation
- **Policy Applied**: AUTO (no explicit policy provided in TEXT mode)
- **Confidence**: High (0.9) - well-defined requirements with minimal ambiguity
- **Fallback Triggered?**: No - requirements are clear and comprehensive
- **Trade-offs**:
  1. Bypassing specification phase trades documentation completeness for implementation speed
  2. Visual feedback system adds UI complexity but improves user understanding
- **Reviewer Notes**: Validate that warning modal messaging adequately conveys trade-offs between quick-impl and full workflow

---

- **Decision**: Workflow file naming convention (quick-impl.yml vs quick-implementation.yml)
- **Policy Applied**: PRAGMATIC (favor simplicity)
- **Confidence**: Medium (0.6) - consistency with existing naming patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Shorter name improves readability but may be less descriptive
  2. Aligns with command naming (`quick-impl`) for consistency
- **Reviewer Notes**: Ensure workflow name is clearly documented in CLAUDE.md

---

- **Decision**: Stage transition validation approach (extend STAGE_COMMAND_MAP vs explicit mode parameter)
- **Policy Applied**: CONSERVATIVE (maintain existing patterns)
- **Confidence**: High (0.85) - preserves system architecture integrity
- **Fallback Triggered?**: Yes - chose safer option due to impact on core workflow logic
- **Trade-offs**:
  1. Explicit mode parameter adds API complexity but provides clearer intent
  2. Detection logic avoids breaking changes to existing validation
- **Reviewer Notes**: Review transition logic for edge cases where INBOX → BUILD might be ambiguous

## User Scenarios & Testing

### User Story 1 - Quick Bug Fix Workflow (Priority: P1)

A developer wants to implement a simple bug fix (typo correction, minor style adjustment) without creating formal specifications.

**Why this priority**: Core value proposition - enables fastest path for simple changes while maintaining quality gates (modal confirmation, job tracking, branch management).

**Independent Test**: Can be fully tested by dragging ticket from INBOX to BUILD, confirming modal, and verifying workflow execution with proper branch creation.

**Acceptance Scenarios**:

1. **Given** a ticket in INBOX with title "Fix typo in button label", **When** user drags to BUILD column, **Then** warning modal appears with clear messaging about bypassing documentation
2. **Given** warning modal is displayed, **When** user clicks "Cancel", **Then** ticket remains in INBOX and no API call is made
3. **Given** warning modal is displayed, **When** user clicks "Proceed", **Then** Job is created with PENDING status and GitHub workflow is dispatched
4. **Given** workflow is dispatched, **When** execution completes, **Then** ticket branch is updated with format `031-quick-implementation` and Job status is COMPLETED
5. **Given** workflow fails, **When** error occurs, **Then** user sees friendly error message suggesting full workflow alternative

---

### User Story 2 - Visual Feedback During Drag (Priority: P1)

A developer drags a ticket from INBOX and needs clear visual cues about which columns accept drops.

**Why this priority**: Essential UX for feature discoverability - users must understand new capability without training.

**Independent Test**: Can be tested by initiating drag from INBOX and observing column visual states without completing drop.

**Acceptance Scenarios**:

1. **Given** user starts dragging ticket from INBOX, **When** hovering over SPECIFY column, **Then** column shows blue dashed border, blue background, and memo icon (📝)
2. **Given** user starts dragging ticket from INBOX, **When** hovering over BUILD column, **Then** column shows green dashed border, green background, lightning icon (⚡), and "Quick Implementation" badge
3. **Given** user starts dragging ticket from INBOX, **When** hovering over PLAN/VERIFY/SHIP columns, **Then** columns show reduced opacity (50%), gray styling, and prohibited icon (🚫)
4. **Given** user starts dragging ticket from INBOX, **When** hovering over invalid drop zone, **Then** cursor changes to `not-allowed`

---

### User Story 3 - Normal Workflow Preservation (Priority: P1)

An existing user continues using the standard INBOX → SPECIFY → PLAN → BUILD workflow for complex features.

**Why this priority**: Zero regression requirement - existing workflow must function identically to preserve user confidence.

**Independent Test**: Can be tested by following normal workflow path (INBOX → SPECIFY) and verifying no behavioral changes.

**Acceptance Scenarios**:

1. **Given** ticket in INBOX, **When** user drags to SPECIFY column, **Then** normal specify workflow executes without modal interruption
2. **Given** ticket in SPECIFY, **When** user drags to PLAN, **Then** planning workflow executes as before
3. **Given** ticket in PLAN, **When** user drags to BUILD, **Then** implementation workflow executes as before
4. **Given** multiple tickets in various stages, **When** quick-impl is used on one ticket, **Then** other tickets' workflows are unaffected

---

### User Story 4 - Job Status Monitoring (Priority: P2)

A developer wants to monitor quick-impl workflow progress in real-time using existing job polling.

**Why this priority**: Leverages existing infrastructure - no new monitoring UI needed, ensures consistent UX across workflows.

**Independent Test**: Can be tested by triggering quick-impl and observing job status updates in UI every 2 seconds.

**Acceptance Scenarios**:

1. **Given** quick-impl workflow is dispatched, **When** job is created, **Then** job appears in polling UI with PENDING status
2. **Given** workflow starts executing, **When** job status updates to RUNNING, **Then** UI reflects change within 2 seconds
3. **Given** workflow completes successfully, **When** job status updates to COMPLETED, **Then** UI shows success indicator and polling stops
4. **Given** workflow fails, **When** job status updates to FAILED, **Then** UI shows error with link to GitHub Actions logs

---

### User Story 5 - Error Recovery (Priority: P2)

A developer encounters workflow dispatch failure and needs clear recovery guidance.

**Why this priority**: Graceful degradation - ensures users aren't blocked by quick-impl failures and can fall back to standard workflow.

**Independent Test**: Can be tested by simulating GitHub API failure (mock) and verifying error handling and rollback.

**Acceptance Scenarios**:

1. **Given** GitHub workflow dispatch fails, **When** API returns error, **Then** ticket is rolled back to INBOX with error toast message
2. **Given** branch creation fails in workflow, **When** script exits with error, **Then** Job status updates to FAILED with descriptive message
3. **Given** job status update API fails, **When** workflow completes, **Then** user sees warning to manually refresh page
4. **Given** workflow fails, **When** user views error, **Then** error message suggests using full spec-kit workflow as alternative

---

### User Story 6 - Branch Naming Consistency (Priority: P3)

A developer wants quick-impl branches to follow the same naming convention as spec-kit branches for consistency.

**Why this priority**: Reduces cognitive load - developers don't need to remember different naming schemes for different workflows.

**Independent Test**: Can be tested by triggering quick-impl and verifying branch name format matches pattern `{num}-{description}`.

**Acceptance Scenarios**:

1. **Given** ticket titled "Fix login button color", **When** quick-impl workflow runs, **Then** branch name follows format `031-fix-login-button` (3-digit number + kebab-case slug)
2. **Given** ticket with long title (>50 chars), **When** branch is created, **Then** description slug is truncated to first 3 words
3. **Given** multiple quick-impl workflows run sequentially, **When** branches are created, **Then** feature numbers auto-increment (031, 032, 033)

---

### Edge Cases

- **What happens when user drags ticket from INBOX to BUILD while offline?** System prevents drag operation (existing offline detection) and shows offline indicator
- **How does system handle INBOX → BUILD transition if Job validation logic expects prior jobs?** Quick-impl skips job completion validation since no prior job exists (INBOX has no prerequisite jobs)
- **What if user confirms modal but network fails before API call?** Optimistic update is rolled back, error toast is shown, ticket remains in INBOX
- **How does system handle concurrent INBOX → BUILD and INBOX → SPECIFY transitions for same ticket?** Optimistic concurrency control (version field) detects conflict, returns 409, shows conflict resolution modal
- **What if create-new-feature.sh script fails mid-execution (branch created but spec.md fails)?** Workflow fails, Job status = FAILED, orphaned branch remains but can be cleaned up manually
- **How does quick-impl handle tickets with empty or null descriptions?** Warning modal displays regardless, workflow receives empty string for description, /quick-impl command must handle gracefully
- **What if user rapidly clicks "Proceed" multiple times?** Modal state management prevents multiple API calls (disabled button during execution)
- **How does system handle INBOX → BUILD if stage validation logic is modified?** Logic explicitly checks `currentStage === INBOX && targetStage === BUILD` as special case

## Requirements

### Functional Requirements

#### Drag-and-Drop Behavior

- **FR-001**: System MUST allow users to drag tickets from INBOX column to BUILD column, bypassing SPECIFY and PLAN stages
- **FR-002**: System MUST detect INBOX → BUILD drop and trigger quick-impl mode (distinct from normal SPECIFY → PLAN → BUILD flow)
- **FR-003**: System MUST preserve existing drag-and-drop behavior for all other stage transitions (INBOX → SPECIFY, SPECIFY → PLAN, PLAN → BUILD, BUILD → VERIFY, VERIFY → SHIP)
- **FR-004**: System MUST prevent INBOX → PLAN, INBOX → VERIFY, INBOX → SHIP direct transitions (invalid drop zones)

#### Visual Feedback

- **FR-005**: System MUST display blue dashed border (`border-blue-400`) and blue background (`bg-blue-50`) on SPECIFY column when dragging from INBOX
- **FR-006**: System MUST display green dashed border (`border-green-400`) and green background (`bg-green-50`) on BUILD column when dragging from INBOX
- **FR-007**: System MUST display lightning bolt emoji (⚡) and "Quick Implementation" text badge on BUILD column during INBOX drag operation
- **FR-008**: System MUST display prohibited emoji (🚫) and reduced opacity (`opacity-50`) on PLAN/VERIFY/SHIP columns during INBOX drag operation
- **FR-009**: System MUST change cursor to `not-allowed` when hovering over invalid drop zones during drag

#### Warning Modal

- **FR-010**: System MUST display confirmation modal when user drops ticket from INBOX to BUILD, before executing transition API call
- **FR-011**: Modal MUST display title "Quick Implementation" and warning message explaining trade-offs (speed vs. documentation)
- **FR-012**: Modal MUST provide "Cancel" button that closes modal and reverts ticket to INBOX without API call
- **FR-013**: Modal MUST provide "Proceed" button that executes transition, creates Job, dispatches workflow, and closes modal
- **FR-014**: Modal MUST appear 100% of the time for INBOX → BUILD drops (no "don't show again" option)
- **FR-015**: Modal MUST display within 100ms of drop event (performance requirement)

#### Workflow Execution

- **FR-016**: System MUST create Job record with command="quick-impl" and status=PENDING when user confirms quick-impl transition
- **FR-017**: System MUST dispatch `.github/workflows/quick-impl.yml` workflow (not `speckit.yml`) for INBOX → BUILD transitions
- **FR-018**: Workflow MUST receive inputs: ticket_id, project_id, ticket_title, ticket_description, job_id
- **FR-019**: Workflow MUST checkout main branch, run `create-new-feature.sh --mode=quick-impl`, execute `/quick-impl` command, commit & push changes
- **FR-020**: Workflow MUST update ticket branch field via PATCH API after branch creation (format: `{num}-{description}`)
- **FR-021**: Workflow MUST update job status via PATCH API on completion (COMPLETED, FAILED, or CANCELLED)

#### Script Modification

- **FR-022**: Script `create-new-feature.sh` MUST accept `--mode` parameter with values "specify" (default) or "quick-impl"
- **FR-023**: In "quick-impl" mode, script MUST create branch and minimal spec.md with only title and description (no full template)
- **FR-024**: In "specify" mode, script MUST maintain existing behavior (full spec template)
- **FR-025**: Script MUST maintain existing branch naming convention: `{num}-{description}` (e.g., `031-quick-implementation`)

#### API Modifications

- **FR-026**: API endpoint `POST /api/projects/:projectId/tickets/:id/transition` MUST detect INBOX → BUILD transitions as quick-impl mode
- **FR-027**: API MUST validate INBOX → BUILD as valid transition (extend `isValidTransition()` logic)
- **FR-028**: API MUST skip job completion validation for INBOX → BUILD transitions (no prior job exists)
- **FR-029**: API MUST dispatch `quick-impl.yml` workflow instead of `speckit.yml` for INBOX → BUILD transitions
- **FR-030**: API MUST maintain optimistic concurrency control (version field) for all transitions including quick-impl

#### Frontend State Management

- **FR-031**: Frontend MUST store drop intent in state when modal opens (ticket, target stage)
- **FR-032**: Frontend MUST execute transition API call only after modal confirmation
- **FR-033**: Frontend MUST perform optimistic update (move ticket to BUILD) during API call
- **FR-034**: Frontend MUST rollback optimistic update if API call fails (409 conflict, network error)
- **FR-035**: Frontend MUST integrate with existing `useJobPolling` hook for real-time status updates (no changes to hook)

#### Error Handling

- **FR-036**: System MUST display user-friendly error message if GitHub workflow dispatch fails, suggesting full workflow alternative
- **FR-037**: System MUST rollback ticket to INBOX if transition API fails (error toast notification)
- **FR-038**: System MUST display warning if job status update fails, prompting manual page refresh
- **FR-039**: System MUST update Job status to FAILED if workflow execution fails (branch creation, command execution, commit)
- **FR-040**: System MUST provide link to GitHub Actions logs in error messages for workflow failures

### Key Entities

- **Job**: Represents workflow execution tracking
  - Attributes: id, ticketId, projectId, command ("quick-impl"), status (JobStatus enum), startedAt, completedAt, updatedAt
  - Relationships: belongs to Ticket, belongs to Project
  - Command values: "specify", "plan", "implement", "quick-impl" (new)

- **Ticket**: Represents work item in kanban board
  - Attributes: id, title, description, stage (Stage enum), branch (nullable string, max 200 chars), version (for optimistic concurrency), projectId, autoMode, clarificationPolicy
  - Relationships: has many Jobs, belongs to Project
  - Stage transitions: INBOX → SPECIFY (normal) OR INBOX → BUILD (quick-impl, new)

- **TransitionMode**: Conceptual entity (not persisted) representing workflow type
  - Values: "normal" (INBOX → SPECIFY → PLAN → BUILD), "quick-impl" (INBOX → BUILD)
  - Determined by: currentStage === INBOX AND targetStage === BUILD

## Success Criteria

### Measurable Outcomes

#### Functional Success

- **SC-001**: Users can successfully drag tickets from INBOX to BUILD column and trigger quick-impl workflow (100% success rate for valid drops)
- **SC-002**: Warning modal appears within 100ms of drop event for all INBOX → BUILD transitions (performance requirement)
- **SC-003**: Visual feedback (blue SPECIFY, green BUILD, gray invalid zones) displays correctly during drag operations (verified via visual regression testing)
- **SC-004**: Quick-impl workflow creates branch, implements feature, and updates ticket branch field within 5 minutes (95th percentile)
- **SC-005**: Job status updates propagate to UI within 2 seconds via existing polling mechanism (no new infrastructure)

#### Compatibility Success

- **SC-006**: Zero regression in existing INBOX → SPECIFY → PLAN → BUILD workflow (all existing E2E tests pass without modification)
- **SC-007**: Optimistic UI updates and version conflict handling work identically for quick-impl and normal transitions (409 response triggers same rollback)
- **SC-008**: Authentication and project ownership validation apply to quick-impl transitions (403 Forbidden for unauthorized access)
- **SC-009**: Job status polling continues to function for quick-impl jobs (PENDING → RUNNING → COMPLETED/FAILED lifecycle)

#### User Experience Success

- **SC-010**: Modal cancellation rate <30% (indicates users understand when to use quick-impl vs. full workflow)
- **SC-011**: Quick-impl workflow success rate matches normal workflow success rate (>95%) (same reliability expectations)
- **SC-012**: Users can identify quick-impl capability without documentation (visual feedback + modal messaging provide sufficient guidance)
- **SC-013**: Error messages clearly explain failure reasons and provide actionable recovery steps (validated via user testing)

#### Technical Success

- **SC-014**: Code follows project conventions: TypeScript strict mode, Prisma types, Zod validation (passes linter with zero warnings)
- **SC-015**: Test coverage >80% for new logic (transition detection, modal handling, workflow dispatch, visual feedback)
- **SC-016**: E2E tests pass for quick-impl workflow (drag-and-drop, modal interaction, job tracking)
- **SC-017**: Git commit history uses conventional commit format (feat:, fix:, docs:) and references feature number (#031)
- **SC-018**: CLAUDE.md updated with quick-impl workflow documentation (usage examples, workflow comparison table)

### Out of Scope (Future Features)

The following capabilities are explicitly excluded from this specification and planned for future iterations:

1. **Rollback from BUILD to SPECIFY**: Ability to revert quick-impl ticket and create full specification retrospectively
2. **Quick-Impl Badge**: Visual indicator (⚡ badge) on tickets to distinguish quick-impl from full workflow tickets in board UI
3. **Smart Suggestions**: Contextual warnings when ticket description length <50 chars, suggesting full workflow may be more appropriate
4. **Metrics Dashboard**: Analytics tracking quick-impl usage rate, success rate comparison vs. full workflow, time savings metrics
5. **Quick-Impl Policy**: Project-level or ticket-level settings to enable/disable quick-impl capability
6. **Batch Quick-Impl**: Ability to select multiple INBOX tickets and apply quick-impl in parallel
7. **Quick-Impl Templates**: Pre-configured implementation patterns for common task types (bug fix, style tweak, typo correction)

## Dependencies and Assumptions

### Dependencies

- **Existing Infrastructure**: Job status polling (`useJobPolling` hook), optimistic UI updates, version conflict handling
- **GitHub Actions**: Workflow dispatch API, secrets (ANTHROPIC_API_KEY, WORKFLOW_API_TOKEN, GITHUB_TOKEN), environment variables (APP_URL, NODE_ENV)
- **Database Schema**: No schema changes required (Job.command VARCHAR supports "quick-impl", Ticket.branch already exists)
- **Frontend Libraries**: @dnd-kit/core for drag-and-drop, shadcn/ui Dialog for modal, existing toast notifications

### Assumptions

- **User Skill Level**: Developers understand trade-offs between quick-impl (speed) and full workflow (documentation/planning)
- **Network Reliability**: API calls complete within reasonable timeframe (3-5 seconds); failures trigger rollback and user notification
- **Workflow Execution Time**: Quick-impl completes within 5 minutes (95th percentile) - similar to specify command execution time
- **Git Repository State**: Main branch is always in clean state; no merge conflicts when creating feature branches
- **Command Execution**: `/quick-impl` Claude command successfully implements features based on title + description context (no formal spec)
- **Browser Compatibility**: Drag-and-drop works on desktop browsers (Chrome, Firefox, Safari, Edge); mobile touch support via TouchSensor
- **Test Environment**: E2E tests use `[e2e]` prefix convention and mock GitHub API calls (NODE_ENV=test)

### Design Rationale

- **Modal-First Approach**: Warning modal ensures users consciously choose quick-impl vs. full workflow, reducing accidental bypasses of documentation
- **Visual Consistency**: Color coding (blue=normal, green=quick-impl, gray=invalid) aligns with traffic light metaphor (go/caution/stop)
- **Script Reuse**: Extending `create-new-feature.sh` with `--mode` parameter avoids duplicating branch creation logic
- **No Database Changes**: Leveraging existing VARCHAR fields (Job.command, Ticket.branch) minimizes migration complexity
- **Explicit Mode Detection**: Checking `currentStage === INBOX && targetStage === BUILD` provides clear intent vs. implicit workflow selection
