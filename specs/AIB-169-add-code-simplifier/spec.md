# Feature Specification: Add Code Simplifier and PR Review to Verify Workflow

**Feature Branch**: `AIB-169-add-code-simplifier`
**Created**: 2026-01-21
**Status**: Draft
**Input**: User description: "Add code simplifier and PR review steps to verify v2 workflow"

## Auto-Resolved Decisions

- **Decision**: Command file structure over agent approach for code simplifier
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score 9) - User explicitly requested "do a command" not an agent
- **Fallback Triggered?**: No - clear user directive
- **Trade-offs**:
  1. Commands are simpler to maintain than agents but may have less autonomous behavior
  2. Easier integration with existing workflow patterns
- **Reviewer Notes**: Verify command invocation syntax matches other workflow commands (e.g., `/cleanup`, `/verify`)

---

- **Decision**: Code review occurs after PR creation, not before
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score 9) - User explicitly stated "after the creation of the PR"
- **Fallback Triggered?**: No - clear user directive
- **Trade-offs**:
  1. Reviewing after PR creation allows review comments to be posted directly to the PR
  2. Any issues found require additional commits rather than preventing PR creation
- **Reviewer Notes**: This follows the pattern of the reference code-review plugin which reviews existing PRs

---

- **Decision**: Constitution file integration as reference only, not specification extraction
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score 9) - User explicitly stated "do not extract specifications from it, only make a reference"
- **Fallback Triggered?**: No - clear user directive
- **Trade-offs**:
  1. Each project's constitution remains unique and context-specific
  2. Review quality depends on constitution completeness per project
- **Reviewer Notes**: Constitution path (`.specify/memory/constitution.md`) should be loaded similarly to CLAUDE.md in review steps

## User Scenarios & Testing

### User Story 1 - Code Simplification Before Documentation (Priority: P1)

When the verify workflow runs and all tests pass, the system automatically simplifies recently modified code before documentation synchronization occurs. This ensures that the code being documented is clean, readable, and follows project standards.

**Why this priority**: Code simplification directly improves code quality and maintainability. Running before documentation ensures docs reflect the final, polished code state.

**Independent Test**: Can be fully tested by running the verify workflow on a branch with modified code and verifying that simplification improvements are applied before the documentation update step.

**Acceptance Scenarios**:

1. **Given** a feature branch with recently modified code and passing tests, **When** the verify workflow executes, **Then** a code simplifier command runs before the documentation synchronization step and after test fixes are committed.
2. **Given** modified code that has unnecessary complexity (e.g., nested ternaries, redundant abstractions), **When** the code simplifier runs, **Then** it refactors for clarity while preserving exact functionality.
3. **Given** code that already follows project standards, **When** the code simplifier runs, **Then** it makes no changes and the workflow continues normally.

---

### User Story 2 - PR Code Review After Creation (Priority: P1)

After a pull request is created by the verify workflow, the system automatically performs a code review that checks for bugs, compliance with CLAUDE.md guidelines, and alignment with the project's constitution principles.

**Why this priority**: Automated code review catches issues before human review, reducing review burden and improving code quality. Equally important as simplification.

**Independent Test**: Can be fully tested by creating a PR through the verify workflow and verifying that a code review comment is posted to the PR with findings or confirmation of no issues.

**Acceptance Scenarios**:

1. **Given** a PR has just been created by the verify workflow, **When** the code review step executes, **Then** it reviews the PR changes against CLAUDE.md and constitution guidelines.
2. **Given** the PR contains code that violates CLAUDE.md or constitution principles, **When** the code review completes, **Then** it posts a comment to the PR listing issues with confidence scores above the threshold.
3. **Given** the PR contains code with no issues, **When** the code review completes, **Then** it posts a comment confirming no issues were found.

---

### User Story 3 - Constitution-Aware Review Criteria (Priority: P2)

The code review step reads both CLAUDE.md files (root and directory-specific) and the project's constitution file to establish review criteria. This ensures reviews consider project-specific principles and non-negotiable rules.

**Why this priority**: Constitution awareness enhances review quality but builds on the core review functionality from Story 2.

**Independent Test**: Can be tested by verifying the review command loads constitution file and uses its principles when evaluating code compliance.

**Acceptance Scenarios**:

1. **Given** a project has a constitution file at `.specify/memory/constitution.md`, **When** the code review runs, **Then** it reads the constitution to understand project-specific principles.
2. **Given** code that violates a principle defined in the constitution (e.g., missing type annotations when constitution mandates TypeScript-First), **When** the code review runs, **Then** it flags the violation with reference to the constitution principle.
3. **Given** a project without a constitution file, **When** the code review runs, **Then** it proceeds with CLAUDE.md guidance only and does not fail.

---

### Edge Cases

- What happens when the code simplifier finds no code to simplify (no recent modifications)?
  - The step should complete successfully with no changes made
- What happens when the PR creation fails before code review can run?
  - The code review step should be skipped if no PR URL is available
- How does the system handle very large PRs that exceed review capacity?
  - The review should process what it can and note any limitations in the review comment
- What happens when constitution file is malformed or unreadable?
  - The review should fall back to CLAUDE.md-only review with a warning

## Requirements

### Functional Requirements

- **FR-001**: System MUST execute a code simplifier command after test fixes are committed and before documentation synchronization in the verify workflow
- **FR-002**: System MUST execute a code review command after the pull request is created in the verify workflow
- **FR-003**: Code simplifier MUST preserve all existing functionality while improving code clarity and consistency
- **FR-004**: Code simplifier MUST focus on recently modified code in the current branch (files changed since branch creation)
- **FR-005**: Code simplifier MUST follow project standards defined in CLAUDE.md (ES modules, function keyword preference, explicit types, React patterns)
- **FR-006**: Code review MUST read both CLAUDE.md files and the constitution file (`.specify/memory/constitution.md`) for review criteria
- **FR-007**: Code review MUST use confidence scoring (0-100 scale) to filter low-confidence issues
- **FR-008**: Code review MUST only report issues with confidence score at or above the established threshold (80)
- **FR-009**: Code review MUST post review findings as a comment on the pull request
- **FR-010**: Both commands MUST follow the existing command file pattern used by other workflow commands (`/cleanup`, `/verify`)
- **FR-011**: Code review MUST NOT extract specifications from the constitution file, only use it as reference for principles and rules
- **FR-012**: System MUST commit any changes made by the code simplifier before proceeding to documentation update

### Key Entities

- **Code Simplifier Command**: A command file that defines the code simplification behavior, focusing on clarity, consistency, and maintainability while preserving functionality
- **Code Review Command**: A command file that orchestrates multi-aspect code review with confidence-based filtering and PR commenting
- **Constitution Reference**: The project's constitution file containing core principles, testing strategy, and non-negotiable rules used as additional review criteria

## Success Criteria

### Measurable Outcomes

- **SC-001**: Verify workflow successfully executes code simplifier step without failures in 95% of runs where tests pass
- **SC-002**: Verify workflow successfully executes code review step and posts comment to PR in 95% of runs where PR is created
- **SC-003**: Code review identifies issues that would otherwise require human reviewer intervention, reducing review cycles
- **SC-004**: Code simplifier reduces code complexity (e.g., removes nested ternaries, consolidates redundant logic) when applicable
- **SC-005**: No functionality is broken by code simplifier changes (all tests continue to pass after simplification)
- **SC-006**: Code review false positive rate remains below 20% (issues reported with confidence ≥80 are genuine concerns)
- **SC-007**: Both new steps complete within reasonable time to not significantly extend workflow duration
