# Feature Specification: Add Code Simplifier and PR Review to Verify Workflow

**Feature Branch**: `AIB-167-add-code-simplifier`
**Created**: 2026-01-21
**Status**: Draft
**Input**: User description: "Add code simplifier agent and PR code review steps to the verify workflow"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Placement of code simplifier step in verify workflow
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) - neutral feature context with mixed signals
- **Fallback Triggered?**: Yes - confidence below 0.5 threshold, defaulted to CONSERVATIVE
- **Trade-offs**:
  1. Conservative approach ensures code simplifier runs before documentation sync, preserving file consistency
  2. May add workflow execution time but ensures cleaner code before PR
- **Reviewer Notes**: Verify that running code simplifier before doc sync doesn't conflict with any existing file change patterns

---

- **Decision**: Confidence threshold for code review issue filtering
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (based on reference implementation)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Using 80 confidence threshold (matching reference) filters false positives effectively
  2. May miss some valid issues below threshold, but reduces noise in PR comments
- **Reviewer Notes**: The 80 threshold is proven in the reference code-review plugin; adjust only if significantly more/fewer issues than expected

---

- **Decision**: Constitution file inclusion in code review context
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicit user requirement)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reading constitution.md provides comprehensive project guidelines beyond CLAUDE.md
  2. Slightly increases context size for review agents but improves compliance accuracy
- **Reviewer Notes**: Ensure constitution path (`.specify/memory/constitution.md`) is correctly referenced

---

- **Decision**: Number of parallel code review agents
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (based on reference implementation)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reference uses 5 parallel agents for comprehensive coverage
  2. More agents = more API cost but better coverage; can adjust based on workflow budget
- **Reviewer Notes**: Reference implementation uses 5 agents; consider if fewer agents suffice for this project's scale

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Code Simplification Before Documentation (Priority: P1)

When the verify workflow runs after test fixes, the system automatically refines recently modified code for clarity, consistency, and maintainability before documentation synchronization.

**Why this priority**: Code quality directly impacts long-term maintainability. Running simplification before documentation ensures all code changes (including simplifications) are reflected in the documentation update.

**Independent Test**: Can be fully tested by implementing a feature with verbose code, then verifying the verify workflow simplifies it before updating documentation. Delivers cleaner code merged to main.

**Acceptance Scenarios**:

1. **Given** a ticket in BUILD stage with implementation code committed, **When** the ticket transitions to VERIFY and tests pass, **Then** the code simplifier step executes before documentation synchronization.
2. **Given** code changes on the feature branch that include verbose patterns (nested ternaries, redundant abstractions), **When** the code simplifier runs, **Then** it refactors for clarity while preserving all functionality.
3. **Given** the code simplifier makes changes, **When** documentation synchronization runs afterward, **Then** the documentation reflects the simplified code state.

---

### User Story 2 - Automated PR Code Review (Priority: P1)

After a pull request is created in the verify workflow, the system automatically reviews the PR for bugs, CLAUDE.md compliance, and constitution compliance, posting findings as a PR comment.

**Why this priority**: Automated code review catches issues before human review, improving code quality and reducing review burden. Equal priority with code simplification as both are core requirements.

**Independent Test**: Can be fully tested by creating a PR with intentional violations (e.g., missing type annotation, any type usage), then verifying the code review posts a comment listing the issues.

**Acceptance Scenarios**:

1. **Given** a PR is created by the verify workflow, **When** the code review step executes, **Then** it reads both CLAUDE.md and constitution.md for compliance checking.
2. **Given** the code review identifies issues with confidence >= 80, **When** the review completes, **Then** it posts a formatted comment on the PR listing all issues with file references.
3. **Given** the code review finds no issues (or all issues are below confidence threshold), **When** the review completes, **Then** it posts a comment indicating no issues found.

---

### User Story 3 - Constitution-Aware Confidence Scoring (Priority: P2)

The code review uses both CLAUDE.md guidelines and constitution principles to determine issue confidence scores, ensuring comprehensive compliance checking.

**Why this priority**: Builds on core code review functionality. Constitution provides non-negotiable rules (TypeScript strict, security, testing) that must be checked.

**Independent Test**: Can be tested by creating a PR with a constitution violation (e.g., `any` type usage) and verifying the review identifies it with appropriate confidence based on constitution rules.

**Acceptance Scenarios**:

1. **Given** the constitution specifies "No `any` types unless explicitly justified", **When** a PR introduces an unjustified `any` type, **Then** the review identifies this with high confidence (>=80).
2. **Given** the constitution specifies TypeScript strict mode requirements, **When** a PR has implicit any errors, **Then** the review flags these as compliance issues.
3. **Given** both CLAUDE.md and constitution have relevant guidelines for an issue, **When** the review posts findings, **Then** it references the specific guideline source (CLAUDE.md or constitution).

---

### Edge Cases

- What happens when code simplifier finds no improvements to make?
  - The step completes successfully with no changes; documentation sync proceeds normally.
- What happens when the constitution file does not exist?
  - Code review proceeds with CLAUDE.md only; logs a warning about missing constitution.
- What happens when PR creation fails before code review can run?
  - Code review step is skipped; workflow reports PR creation failure as the primary error.
- What happens when code review API calls timeout?
  - Review step fails gracefully; PR remains without review comment; workflow continues (non-blocking).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST execute code simplifier step after test fixes commit and before documentation synchronization in the verify workflow.
- **FR-002**: Code simplifier MUST preserve all existing functionality while improving code clarity and consistency.
- **FR-003**: Code simplifier MUST focus only on recently modified code (files changed in the feature branch).
- **FR-004**: Code simplifier MUST follow project coding standards from CLAUDE.md (ES modules, function keyword over arrows, explicit return types).
- **FR-005**: System MUST execute code review step after successful PR creation.
- **FR-006**: Code review MUST read CLAUDE.md (root and from modified directories) for compliance checking.
- **FR-007**: Code review MUST read constitution.md (`.specify/memory/constitution.md`) for compliance checking.
- **FR-008**: Code review MUST use parallel agents to check for: CLAUDE.md compliance, constitution compliance, obvious bugs, git history context, and code comment compliance.
- **FR-009**: Code review MUST assign confidence scores (0-100) to each identified issue.
- **FR-010**: Code review MUST filter issues below 80 confidence threshold before reporting.
- **FR-011**: Code review MUST post findings as a formatted Markdown comment on the PR.
- **FR-012**: Code review comment MUST link findings to specific file locations using full Git SHA references.
- **FR-013**: System MUST NOT run build/typecheck during code review (CI handles this).
- **FR-014**: System MUST use GitHub CLI (`gh`) for PR comment operations.

### Key Entities *(include if feature involves data)*

- **CodeSimplifierStep**: Workflow step that analyzes and refines code for clarity
  - Inputs: feature branch, list of modified files
  - Outputs: simplified code changes (committed to branch)
  - Constraints: must not alter functionality, focus on recently modified files only

- **CodeReviewStep**: Workflow step that reviews PR for compliance and bugs
  - Inputs: PR number, CLAUDE.md content, constitution.md content, PR diff
  - Outputs: PR comment with findings (or "no issues" message)
  - Constraints: confidence threshold 80, parallel agent execution

- **ReviewFinding**: Individual issue identified during code review
  - Attributes: description, file path, line reference, confidence score (0-100), guideline source (CLAUDE.md or constitution)
  - Constraints: only findings with confidence >= 80 are reported

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Code simplifier step executes successfully in 100% of verify workflow runs (when code changes exist).
- **SC-002**: Code simplifier reduces code complexity metrics (nested ternaries, redundant abstractions) in modified files without breaking tests.
- **SC-003**: Code review step executes successfully in 100% of verify workflow runs after PR creation.
- **SC-004**: Code review identifies constitution violations (e.g., `any` types, missing strict mode) with >= 80 confidence.
- **SC-005**: Code review posts formatted findings within the workflow execution time budget (no significant workflow delay).
- **SC-006**: False positive rate for code review findings remains below 20% (issues marked as false positives by human reviewers).
- **SC-007**: All constitution "non-negotiable rules" (TypeScript strict, security, testing patterns) are checked during code review.
