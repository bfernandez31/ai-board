# Feature Specification: Review Command for AI-Board Assistance

**Feature Branch**: `AIB-178-review-command-from`
**Created**: 2026-01-22
**Status**: Draft
**Input**: User description: "add a new command for the ai-board assistance like the /compare - you should be able to do a /review that will launch the command code review like the one on the verify workflow - should add to the prompt a specification to tell to do the review if there is a previous review"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Stage Availability

- **Decision**: The `/review` command will be available in VERIFY stage only (where PRs exist)
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (0.6) - Clear pattern from `/compare` command and verify workflow; code review requires a PR which only exists in VERIFY
- **Fallback Triggered?**: No - internal tooling with clear precedent
- **Trade-offs**:
  1. Scope limited to VERIFY stage reduces complexity; users in other stages see clear error message
  2. Implementation faster by reusing existing routing pattern from `/compare`
- **Reviewer Notes**: Verify that PR existence check provides meaningful error message if no PR found

---

### Decision 2: Re-Review Behavior Default

- **Decision**: The `/review` command will always force a new review, ignoring any previous reviews
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: High (0.8) - User explicitly requested ability to review when previous review exists; aligns with `/compare` regeneration behavior
- **Fallback Triggered?**: No - explicit user requirement
- **Trade-offs**:
  1. Users can request re-reviews on demand; may generate duplicate review comments
  2. Simpler implementation; no need to detect or manage review state
- **Reviewer Notes**: Consider if rate limiting is needed to prevent excessive re-reviews (out of scope for this ticket)

---

### Decision 3: Output Format and Character Limit

- **Decision**: Follow the same output pattern as `/compare` - brief summary comment (< 1500 chars) with mention format
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: High (0.9) - Consistency with existing ai-board-assist patterns ensures predictable UX
- **Fallback Triggered?**: No - clear precedent from existing commands
- **Trade-offs**:
  1. Consistent user experience across AI-BOARD commands
  2. Brief summary means detailed findings posted to PR (existing code-review behavior)
- **Reviewer Notes**: Verify the code-review skill's PR comment fits within GitHub comment limits

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request Code Review via Comment (Priority: P1)

A user working on a ticket in VERIFY stage wants to request an additional code review. They mention @ai-board with the `/review` command in a comment. The system finds the associated PR and runs the code review, posting results to the PR and a summary to the ticket comment.

**Why this priority**: This is the core functionality requested - triggering code review from ticket comments.

**Independent Test**: Can be fully tested by posting a comment "@ai-board /review" on a VERIFY stage ticket with an existing PR and verifying the code review executes.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage with an associated PR, **When** user posts "@ai-board /review", **Then** the system finds the PR and executes the code review skill
2. **Given** a ticket in VERIFY stage with an associated PR, **When** code review completes, **Then** a summary comment is posted to the ticket mentioning the requesting user
3. **Given** a ticket in VERIFY stage with an associated PR, **When** code review finds issues, **Then** detailed findings are posted as a comment on the PR

---

### User Story 2 - Re-Review After Previous Review (Priority: P2)

A user has already received one code review but wants another review after making changes. They use `/review` to trigger a fresh review that ignores the existence of previous reviews.

**Why this priority**: Explicitly requested by user - the current code-review command skips PRs with existing reviews.

**Independent Test**: Can be tested by requesting `/review` on a PR that already has a code review comment, verifying a new review is generated.

**Acceptance Scenarios**:

1. **Given** a PR with an existing code review comment, **When** user posts "@ai-board /review", **Then** the system performs a new code review regardless of previous reviews
2. **Given** a PR reviewed previously, **When** new review completes, **Then** new findings are posted as a fresh comment (not an edit to previous)

---

### User Story 3 - Error Handling for Missing PR (Priority: P3)

A user tries to use `/review` on a ticket that doesn't have an associated PR (e.g., in SPECIFY stage or before PR creation). The system provides a helpful error message.

**Why this priority**: Error handling ensures good user experience when command is misused.

**Independent Test**: Can be tested by posting "@ai-board /review" on a SPECIFY stage ticket or VERIFY ticket without PR.

**Acceptance Scenarios**:

1. **Given** a ticket NOT in VERIFY stage, **When** user posts "@ai-board /review", **Then** system responds with error explaining command is only available in VERIFY stage
2. **Given** a VERIFY stage ticket without an associated PR, **When** user posts "@ai-board /review", **Then** system responds with error explaining no PR was found for review

### Edge Cases

- What happens when PR is already merged? System should still attempt review on the merge commit or provide appropriate message
- What happens when PR is closed without merging? System should indicate PR is closed and cannot be reviewed
- What happens when the code-review skill finds no issues? System posts "No issues found" summary to ticket

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST recognize `/review` command in ai-board-assist workflow comment routing
- **FR-002**: System MUST find the PR number associated with the ticket's branch before executing review
- **FR-003**: System MUST execute the code-review skill with the found PR number
- **FR-004**: System MUST instruct the code-review skill to perform review even if a previous review exists
- **FR-005**: System MUST post a summary comment to the ticket upon completion, mentioning the requesting user
- **FR-006**: System MUST provide clear error messages when review cannot be performed (no PR, wrong stage)
- **FR-007**: System MUST follow the output format conventions of existing ai-board-assist commands (< 1500 chars, proper mention format)

### Key Entities *(include if feature involves data)*

- **Command**: The `/review` command parsed from user's comment in ai-board-assist workflow
- **Pull Request**: The GitHub PR associated with the ticket's branch, identified by branch name matching

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can trigger code review from ticket comments in under 5 seconds (command dispatch)
- **SC-002**: 100% of `/review` commands in VERIFY stage with valid PRs result in code review execution
- **SC-003**: Users receive response within 2 minutes indicating review started or error
- **SC-004**: Error rate for command routing is 0% (command always reaches correct handler)
