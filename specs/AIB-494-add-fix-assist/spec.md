# Feature Specification: Add /fix Assist Command to Address PR Review Findings

**Feature Branch**: `AIB-494-add-fix-assist`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Add /fix assist command to address PR review findings"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Effective clarification policy resolved from AUTO to CONSERVATIVE due to low heuristic confidence
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score 0.3 — netScore -1, absScore 1; internal/automation signals offset by neutral feature context)
- **Fallback Triggered?**: Yes — confidence < 0.5, insufficient signal strength to commit to PRAGMATIC
- **Trade-offs**:
  1. More thorough edge case handling and validation requirements than a PRAGMATIC approach would demand
  2. Slightly more effort during implementation to satisfy stricter acceptance criteria
- **Reviewer Notes**: The feature is internal automation tooling; PRAGMATIC may be appropriate if reviewer judges the risk profile is low enough

---

- **Decision**: Concurrent execution model — only one /fix job runs per ticket at a time
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — concurrent fix jobs on the same branch would cause git conflicts and data corruption
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents race conditions on branch state; users must wait for a running fix to complete
  2. No parallel speedup if user triggers multiple fix requests in quick succession
- **Reviewer Notes**: Standard pattern consistent with existing assist commands (iterate, verify)

---

- **Decision**: Maximum findings per run — no hard cap; process all pertinent findings from all sources
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — historical data shows ~5-10 findings per PR across all sources, manageable in a single pass
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Large PRs with many findings may produce long-running fix jobs
  2. A single commit groups all fixes, making rollback atomic but coarse-grained
- **Reviewer Notes**: If future PRs consistently exceed ~20 findings, consider batching or a configurable limit

---

- **Decision**: Spec update scope — only update specs in `specs/specifications/` when a fix directly contradicts a documented contract (field name, error code, response shape)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — historical data shows ~25% of findings need spec updates; limiting to direct contradictions avoids unnecessary spec churn
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents spec drift from accumulating minor undocumented behavior changes
  2. Some review findings that indirectly affect spec intent may not trigger spec updates
- **Reviewer Notes**: Monitor whether indirect spec impacts are missed; expand scope if needed

---

- **Decision**: Pertinence filtering for Codex/Copilot uses project-specific context (constitution + CLAUDE.md) to reject: documentation nitpicks, issues already caught by TypeScript/ESLint, overengineering suggestions, and false positives
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — historical data shows 49% of Copilot comments are non-actionable and 19% are false positives; filtering is essential to avoid noise
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Strict filtering may occasionally reject a valid Copilot/Codex suggestion
  2. All rejected findings are reported with reasons, so users can manually re-apply if desired
- **Reviewer Notes**: Review rejection reasons in early runs to calibrate filtering accuracy

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Fix All Review Findings (Priority: P1)

A project owner has a PR with code review comments from ai-board custom review, Codex, and Copilot. They want to apply all pertinent fixes automatically without reading each comment individually. They comment `@ai-board /fix` on the ticket to trigger the command.

**Why this priority**: This is the primary use case — the majority of users will want all actionable findings fixed in one pass. It delivers the core value proposition of automated review remediation.

**Independent Test**: Can be fully tested by creating a ticket with a PR that has review comments from at least one source, triggering `/fix`, and verifying that pertinent findings are addressed in a single commit pushed to the PR branch.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage with an open PR that has ai-board custom review findings, **When** the user comments `@ai-board /fix`, **Then** the system parses all review sources, applies fixes for pertinent findings, runs type-check and lint, pushes a single commit to the PR branch, and posts a summary comment on the ticket
2. **Given** a ticket with an open PR that has reviews from all three sources (ai-board, Codex, Copilot), **When** `/fix` is triggered, **Then** findings are deduplicated across sources using ai-board > Codex > Copilot priority, and each finding is processed exactly once
3. **Given** a ticket with an open PR where some Copilot findings are documentation nitpicks or overengineering, **When** `/fix` is triggered, **Then** those findings are rejected with documented reasons and reported in the summary, while actionable findings are still fixed

---

### User Story 2 — Fix Specific Findings by Number (Priority: P2)

A project owner has reviewed the ai-board custom code review and wants to apply only certain findings (e.g., findings #1 and #3 but not #2). They comment `@ai-board /fix 1 3` to selectively fix only those items.

**Why this priority**: Selective fixing gives users fine-grained control when they disagree with some findings or want to address issues incrementally. It builds on the core fix loop with targeted filtering.

**Independent Test**: Can be tested by triggering `/fix 1 3` on a ticket whose PR has at least 3 ai-board custom findings, and verifying only findings 1 and 3 are addressed while finding 2 is untouched.

**Acceptance Scenarios**:

1. **Given** a ticket with an open PR that has ai-board custom review with 3+ numbered findings, **When** the user comments `@ai-board /fix 1 3`, **Then** only findings #1 and #3 are fixed, and the summary reports which were fixed and which were skipped
2. **Given** the user specifies finding numbers that don't exist (e.g., `@ai-board /fix 1 7` when only 3 findings exist), **When** the command runs, **Then** finding #1 is fixed, finding #7 is reported as not found, and the summary reflects both outcomes
3. **Given** `@ai-board /fix all` is used, **When** the command runs, **Then** it behaves identically to `@ai-board /fix` with no arguments (fixes all pertinent findings)

---

### User Story 3 — Fix Findings with Spec Updates (Priority: P2)

A review finding identifies a mismatch between the code and the documented API contract in `specs/specifications/`. The `/fix` command should update both the code and the spec to maintain consistency.

**Why this priority**: Spec-code consistency is critical for maintaining project integrity. Without this, fixes could silently diverge from documented behavior, causing confusion in future development cycles.

**Independent Test**: Can be tested by creating a PR with a review finding that contradicts a spec (e.g., wrong error code), triggering `/fix`, and verifying both the code file and the relevant spec file are updated in the commit.

**Acceptance Scenarios**:

1. **Given** a review finding that identifies a field name mismatch between code and `specs/specifications/`, **When** `/fix` is triggered, **Then** the system updates both the code and the spec file, and the summary reports "M specs updated"
2. **Given** a review finding that requires a code change but does not contradict any spec, **When** `/fix` is triggered, **Then** only the code is changed and no spec files are modified

---

### User Story 4 — Error Handling for Missing PR or Reviews (Priority: P3)

A user triggers `/fix` on a ticket that either has no open PR or has a PR with no review comments. The system should provide clear error guidance.

**Why this priority**: Error handling ensures a graceful user experience and prevents confusion. While not the primary flow, it is essential for robustness.

**Independent Test**: Can be tested by triggering `/fix` on a ticket without a PR and verifying the error comment is posted.

**Acceptance Scenarios**:

1. **Given** a ticket with no open PR, **When** `/fix` is triggered, **Then** the system posts an error comment indicating no PR was found
2. **Given** a ticket with an open PR but no review comments from any source, **When** `/fix` is triggered, **Then** the system posts an error comment suggesting the user run `/review` first
3. **Given** all findings from all sources are rejected as non-actionable after pertinence filtering, **When** the fix process completes, **Then** no commit is made, no code is changed, and the summary reports all findings as rejected with individual reasons

---

### Edge Cases

- What happens when two review sources report the same issue on the same file and line? The system deduplicates using source priority (ai-board > Codex > Copilot), keeping only the highest-priority source's version
- What happens when a fix for one finding conflicts with another finding? Findings are processed sequentially; if a later fix would conflict with an already-applied fix, the later finding is reported as "conflict with higher-priority fix" and skipped
- What happens when the PR branch has diverged from the local state? The system operates on the current branch HEAD; if the branch has new commits since the review, findings referencing stale line numbers are resolved using the file path and surrounding code context
- What happens when type-check or lint fails after applying fixes? The system attempts to fix the introduced errors; if unresolvable, it reports the failure and does not push the commit
- What happens when the only findings are from Codex/Copilot (no ai-board custom review)? The command still works but applies stricter pertinence filtering since the primary source of truth is absent

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `/fix` command routable via `@ai-board /fix [args]` in ticket comments
- **FR-002**: System MUST accept three invocation forms: no arguments (fix all), specific finding numbers (e.g., `1 3`), and the `all` keyword
- **FR-003**: System MUST parse PR review comments from three sources: ai-board custom reviews (issue comments matching `### Code review`), Codex bot inline comments (`chatgpt-codex-connector[bot]`), and Copilot inline comments (`Copilot`)
- **FR-004**: System MUST deduplicate findings across sources using priority order: ai-board custom > Codex > Copilot, ensuring each unique issue is processed exactly once
- **FR-005**: System MUST filter Codex and Copilot findings for pertinence using project context (constitution + CLAUDE.md), rejecting documentation nitpicks, issues already caught by TypeScript/ESLint, overengineering suggestions, and false positives
- **FR-006**: System MUST apply minimal, targeted code fixes for each pertinent finding, respecting project patterns and conventions
- **FR-007**: System MUST check `specs/specifications/` for affected routes/features and update spec files when a fix creates a direct contradiction with the documented contract (field names, error codes, response shapes)
- **FR-008**: System MUST track all findings evaluated, recording whether each was fixed, required a spec update, or was rejected (with reason: overengineering, duplicate, false positive, conflict)
- **FR-009**: System MUST run type-check and lint after applying all fixes and resolve any introduced errors before committing
- **FR-010**: System MUST create a single grouped commit with the message format `fix(review): address N review findings`
- **FR-011**: System MUST push the fix commit to the PR branch
- **FR-012**: System MUST post a summary comment on the ticket mentioning the requesting user, with counts: N findings fixed, M specs updated, K findings rejected (with individual reasons)
- **FR-013**: System MUST create a result file at `specs/$BRANCH/.ai-board-result.md` following the standard assist result format
- **FR-014**: System MUST return an error comment when no open PR exists for the ticket
- **FR-015**: System MUST return an error comment suggesting `/review` when a PR exists but has no review comments
- **FR-016**: When specific finding numbers are requested but some don't exist, the system MUST fix what exists and report missing IDs in the summary
- **FR-017**: When conflicting findings exist between sources, the system MUST prioritize the higher-priority source and mention the conflict in the summary
- **FR-018**: System MUST enforce that only one `/fix` job runs per ticket at a time

### Key Entities

- **Review Finding**: A single actionable item from a code review, with attributes: source (ai-board/Codex/Copilot), finding number (within source), file path, line range, description, severity/priority, and resolution status (fixed/rejected/skipped)
- **Fix Result**: The outcome of processing all findings, with attributes: findings fixed count, specs updated count, findings rejected count, rejection reasons, commit SHA, and any errors encountered
- **Review Source**: One of the three parseable review providers, with attributes: identifier, priority rank, and parsing rules

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can remediate all pertinent PR review findings with a single comment command, reducing manual fix time from minutes-per-finding to a single automated pass
- **SC-002**: At least 90% of ai-board custom review findings are successfully fixed without manual intervention (based on historical 100% actionability rate)
- **SC-003**: At least 60% of Codex findings are fixed (based on historical 69% actionability rate), with the remainder correctly rejected with documented reasons
- **SC-004**: At least 40% of Copilot findings are fixed (based on historical 49% actionability rate, minus 19% false positive rate), with non-actionable findings correctly filtered out
- **SC-005**: Zero false fixes — no fix introduces a type-check or lint failure that wasn't present before the fix command ran
- **SC-006**: Spec consistency is maintained — when a fix changes a documented contract, the corresponding spec file is updated in the same commit
- **SC-007**: The summary comment provides complete transparency: every finding from every source is accounted for as either fixed, spec-updated, or rejected with a reason

## Assumptions

- The ticket is in a stage that has an associated PR branch (typically VERIFY, but also BUILD for iterate scenarios)
- The user triggering `/fix` has appropriate project access (owner or member)
- GitHub API access is available via `GH_TOKEN` for reading PR comments and pushing commits
- The ai-board custom review format (`### Code review` with numbered findings and permalinks) is stable and parseable
- Codex bot comments are identifiable by the `chatgpt-codex-connector[bot]` author and contain P1/P2 badges
- Copilot comments are identifiable by the `Copilot` author
- The fix command operates on the same repository where the PR exists (supports both self-managed and external repos via `githubRepository` input)

## Dependencies

- Existing ai-board assist infrastructure (command routing, job system, workflow dispatch)
- GitHub API for reading PR comments and reviews
- Existing `/review` command output format (for parsing ai-board custom findings)
- Project constitution and CLAUDE.md (for pertinence filtering context)
- `specs/specifications/` directory (for spec contradiction detection)
- `bun run type-check` and `bun run lint` commands (for post-fix validation)
