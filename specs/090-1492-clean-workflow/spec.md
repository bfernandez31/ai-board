# Feature Specification: Clean Workflow

**Feature Branch**: `090-1492-clean-workflow`
**Created**: 2025-11-21
**Status**: Draft
**Input**: User description: "#1492 Clean workflow - Add workflow to clean the project"

## Auto-Resolved Decisions

- **Decision**: Clarification policy selection for feature specification
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3 confidence, net score: 0, abs score: 0)
- **Fallback Triggered?**: Yes — AUTO analysis showed low confidence (< 0.5) due to minimal context signals, promoted to CONSERVATIVE approach
- **Trade-offs**:
  1. Comprehensive validation ensures code quality and prevents technical debt accumulation
  2. May require more time for thorough analysis compared to lighter cleanup approach
  3. Reduces risk of introducing regressions or breaking changes during cleanup
- **Reviewer Notes**: Validate that the comprehensive cleanup scope (code, tests, documentation) aligns with project maintenance goals

---

- **Decision**: Tracking mechanism for "last clean" date
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — standard practice in ticket-based systems
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Using ticket creation date provides clear audit trail
  2. Requires querying ticket history to find previous clean tickets
- **Reviewer Notes**: Confirm this approach works with expected cleanup frequency (weekly, monthly, etc.)

---

- **Decision**: Scope of "no transitions" during workflow execution
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — explicit in feature description "aucune transition ne doit etre possible sur tous les tickets"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents conflicts during cleanup but blocks all ticket movement
  2. Users can still update descriptions, documents, and preview deployments
- **Reviewer Notes**: Ensure UI clearly indicates when transitions are locked and why

---

- **Decision**: Definition of "technical debt" for cleanup analysis
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — explicitly defined in description: "code, test, documentation (spécifications et claude md)"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Comprehensive scope ensures thorough cleanup
  2. May identify many issues requiring resolution
- **Reviewer Notes**: Validate that all three areas (code, tests, docs) should always be analyzed together

## User Scenarios & Testing

### User Story 1 - Trigger Project Cleanup (Priority: P1)

A project maintainer wants to periodically clean up technical debt accumulated from recently shipped features to maintain code quality and prevent issues from compounding.

**Why this priority**: Core functionality that enables the entire cleanup workflow. Without the ability to trigger cleanup, no other cleanup features can function.

**Independent Test**: Can be fully tested by clicking the cleanup menu option and verifying a new ticket is created with correct title, description, stage (BUILD), and initial job. Delivers value by providing a way to initiate cleanup.

**Acceptance Scenarios**:

1. **Given** user has appropriate permissions, **When** user clicks "Clean Project" menu option, **Then** system creates new ticket with title "Clean [TODAY'S DATE]" in BUILD stage
2. **Given** new clean ticket is created, **When** viewing ticket description, **Then** description contains list of all tickets with branches shipped since last clean operation
3. **Given** clean ticket is created, **When** system initializes workflow, **Then** system creates job record and dispatches automated cleanup workflow

---

### User Story 2 - Execute Automated Cleanup Analysis (Priority: P2)

The system automatically analyzes code changes from shipped branches to identify and fix technical debt without breaking existing functionality.

**Why this priority**: Core cleanup logic that delivers the actual value of code quality improvement. Depends on P1 for triggering but is the primary value driver.

**Independent Test**: Can be tested by monitoring workflow execution with predefined shipped branches, verifying analysis runs on code/tests/docs, and confirming fixes are applied without behavior changes.

**Acceptance Scenarios**:

1. **Given** clean workflow starts, **When** cleanup analysis process executes, **Then** system analyzes code, tests, and documentation from specified branches
2. **Given** analysis identifies technical debt, **When** fixes are applied, **Then** system ensures no breaking changes or behavior modifications occur
3. **Given** cleanup completes successfully, **When** workflow finishes, **Then** ticket automatically transitions to VERIFY stage

---

### User Story 3 - Prevent Conflicts During Cleanup (Priority: P3)

While cleanup workflow executes, the system prevents stage transitions on all tickets to avoid conflicts, while still allowing users to update ticket content.

**Why this priority**: Safety feature that prevents race conditions during cleanup. Important for data integrity but system could theoretically function without it (though with risk of conflicts).

**Independent Test**: Can be tested by attempting various ticket operations during cleanup workflow execution and verifying transitions are blocked but content updates succeed.

**Acceptance Scenarios**:

1. **Given** clean workflow is running, **When** user attempts to transition any ticket to different stage, **Then** system prevents transition and shows informative message
2. **Given** clean workflow is running, **When** user updates ticket description, documents, or preview deployment, **Then** system allows these modifications
3. **Given** clean workflow completes, **When** workflow finishes, **Then** system re-enables stage transitions for all tickets

---

### Edge Cases

- What happens when user triggers clean workflow while another clean is already in progress?
- How does system handle if no tickets have been shipped since last clean?
- What happens if clean workflow fails mid-execution - are transitions still blocked?
- How does system determine "last clean" on first-ever execution?
- What happens if cleanup analysis identifies issues that cannot be auto-fixed safely?

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide menu option to trigger project cleanup workflow
- **FR-002**: System MUST automatically create cleanup ticket with title "Clean [YYYY-MM-DD]" when cleanup is triggered
- **FR-003**: System MUST populate cleanup ticket description with list of all tickets whose branches were shipped since previous cleanup operation
- **FR-004**: System MUST place newly created cleanup ticket directly in BUILD stage (bypassing INBOX and SPECIFY stages)
- **FR-005**: System MUST create job record and dispatch automated cleanup workflow when cleanup ticket is created
- **FR-006**: System MUST support new workflow type "CLEAN" distinct from existing "QUICK" and "FULL" types
- **FR-007**: Cleanup workflow MUST perform diff-based analysis of all changes since last cleanup merge
- **FR-008**: Cleanup analysis MUST discover context from CLAUDE.md and `.specify/memory/constitution.md` (project-agnostic)
- **FR-009**: Cleanup analysis MUST examine code, tests, and documentation (specifications and CLAUDE.md files)
- **FR-010**: System MUST identify and fix technical debt while ensuring no breaking changes
- **FR-011**: System MUST ensure no behavior modifications occur during cleanup fixes
- **FR-012**: Cleanup MUST only run impacted tests, NEVER the full test suite
- **FR-013**: System MUST transition cleanup ticket to VERIFY stage (via transition-to-verify.sh) for PR creation
- **FR-014**: System MUST prevent all stage transitions on all tickets while cleanup workflow is executing
- **FR-015**: System MUST allow users to modify ticket descriptions, documents, and preview deployments during cleanup execution
- **FR-016**: System MUST re-enable stage transitions for all tickets when cleanup workflow completes or fails
- **FR-017**: Cleanup branch MUST be created using `create-new-feature.sh --mode=cleanup` script
- **FR-018**: Cleanup MUST track progress via `cleanup-tasks.md` file in spec directory

### Key Entities

- **Clean Ticket**: Special ticket type that triggers and tracks cleanup workflow execution; always starts in BUILD stage; uses diff-based analysis
- **Workflow Type**: Enumeration extended to include CLEAN alongside existing QUICK and FULL types; determines which automated workflow process is dispatched
- **Job**: Tracks cleanup workflow execution status (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED); linked to clean ticket
- **Merge Point**: Git commit SHA of last cleanup merge; discovered via `git log --merges --grep="cleanup-"`; starting point for diff analysis
- **Cleanup Tasks**: `cleanup-tasks.md` file in spec directory; tracks discovery, analysis, fixes, and validation progress
- **Transition Lock**: Project-level state via `activeCleanupJobId` that blocks stage transitions during cleanup workflow execution

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can trigger project cleanup with single menu click
- **SC-002**: System automatically creates properly formatted cleanup ticket within 2 seconds of trigger
- **SC-003**: Cleanup ticket description includes complete list of shipped branches since last cleanup
- **SC-004**: Cleanup workflow successfully analyzes all code, test, and documentation changes without manual intervention
- **SC-005**: 100% of cleanup fixes maintain existing behavior (zero regression bugs introduced)
- **SC-006**: All stage transitions are blocked during cleanup workflow execution
- **SC-007**: Users can successfully update ticket content (descriptions, documents, previews) during cleanup execution
- **SC-008**: Stage transitions are automatically re-enabled within 5 seconds of cleanup workflow completion
- **SC-009**: Cleanup ticket automatically transitions to VERIFY stage upon successful completion
- **SC-010**: System provides clear user feedback when transitions are blocked during cleanup
