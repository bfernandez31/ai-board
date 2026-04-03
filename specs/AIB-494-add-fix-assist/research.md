# Research: /fix Assist Command

**Branch**: `AIB-494-add-fix-assist` | **Date**: 2026-04-03

## R1: Command Routing Pattern

**Decision**: Route `/fix` via the same `ai-board-assist.yml` workflow routing block that handles `/compare` and `/review`, with dedicated `elif` branch.

**Rationale**: The workflow already uses `grep -qE "/command\b"` pattern matching on the `$COMMENT` variable. Adding `/fix` follows the identical pattern. The command needs VERIFY stage validation (like `/review`) since PRs only exist in VERIFY stage, plus PR number lookup via `gh pr list --head "$BRANCH"`.

**Alternatives Considered**:
- Separate workflow file (like `iterate.yml`): Rejected — `/fix` is comment-triggered, not dispatched by another workflow. The assist workflow already handles comment-routed commands.
- Route through `ai-board.assist.md` general handler: Rejected — `/fix` needs specialized PR comment fetching and stage validation that the general handler doesn't provide.

## R2: PR Review Comment Parsing

**Decision**: Parse three distinct comment formats using `gh` CLI within the Claude command file (not compiled TypeScript).

**Rationale**: The command executes in a GitHub Actions workflow where `gh` is available. Parsing happens at Claude agent runtime, not in the Next.js app.

### Source Formats

**ai-board custom review** (issue comments on PR):
```
### Code review

Found N issues:

1. <description> (CLAUDE.md says "<...>")
<github-permalink-url#L{start}-L{end}>

2. <description> (constitution says "<...>")
<github-permalink-url#L{start}-L{end}>
```
- Posted by: `ai-board[bot]` or the code-review agent
- Location: PR issue comments (not inline)
- Parsing: Regex on `### Code review` header, numbered list items, permalink URLs

**Codex bot** (inline PR review comments):
- Author: `chatgpt-codex-connector[bot]`
- Contains P1/P2 priority badges
- Location: Inline review comments on specific lines
- Parsing: `gh api repos/{owner}/{repo}/pulls/{pr}/comments` filtered by author

**Copilot** (inline PR review comments):
- Author: `Copilot`
- No priority badges
- Location: Inline review comments on specific lines
- Parsing: Same API endpoint, filtered by author

**Alternatives Considered**:
- Octokit in TypeScript module: Rejected — command runs in workflow shell, not Next.js runtime
- Single unified parser: Rejected — formats are too different; each source needs dedicated parsing

## R3: Deduplication Strategy

**Decision**: Deduplicate by (file_path, line_range_overlap) tuple with priority ai-board > Codex > Copilot. When two findings reference the same file and overlapping line ranges, keep only the highest-priority source.

**Rationale**: The spec requires priority ordering (FR-004). Line-range overlap is the most reliable signal for duplicate findings, since different tools describe the same issue differently.

**Alternatives Considered**:
- Semantic similarity matching: Rejected — over-engineered; line overlap is sufficient for dedup
- No deduplication: Rejected — spec explicitly requires it (FR-004)

## R4: Pertinence Filtering for Codex/Copilot

**Decision**: Use Claude agent reasoning at runtime to evaluate each Codex/Copilot finding against project context (constitution + CLAUDE.md). Reject findings matching four categories: documentation nitpicks, TypeScript/ESLint-caught issues, overengineering suggestions, false positives.

**Rationale**: The Claude agent executing the `/fix` command already has access to the project context files. LLM-based filtering is the right tool here since the categories require semantic understanding (e.g., distinguishing a "documentation nitpick" from an actionable documentation bug).

**Alternatives Considered**:
- Rule-based keyword filtering: Rejected — too brittle; can't distinguish nuance
- No filtering (fix everything): Rejected — spec data shows 49% of Copilot comments are non-actionable

## R5: Spec Update Detection

**Decision**: After applying each code fix, check if the changed code involves a route/feature documented in `specs/specifications/`. If the fix changes a field name, error code, or response shape that contradicts the spec, update the spec file in the same commit.

**Rationale**: The spec requires this (FR-007) and scopes it narrowly to "direct contradictions" with documented contracts. The Claude agent can read the spec files and detect contradictions during fix application.

**Alternatives Considered**:
- Always update specs: Rejected — creates unnecessary churn
- Never update specs: Rejected — violates FR-007 and causes spec drift

## R6: Commit and Push Strategy

**Decision**: Apply all fixes, run `bun run type-check && bun run lint`, resolve any introduced errors, then create a single commit with message `fix(review): address N review findings` and push to the PR branch.

**Rationale**: Single commit makes rollback atomic (spec decision). Running type-check/lint after all fixes (not per-fix) is more efficient and catches cross-fix interactions.

**Alternatives Considered**:
- One commit per finding: Rejected — noisy git history, harder to rollback
- Skip type-check/lint: Rejected — violates FR-009 and SC-005

## R7: Result File and Summary Comment

**Decision**: Create `specs/$BRANCH/.ai-board-result.md` with SUCCESS/ERROR status and post a summary comment on the ticket via the existing workflow comment posting mechanism.

**Rationale**: Follows the established `.ai-board-result.md` pattern (used by `/compare`, `/assist`). The workflow already reads this file to determine job status and extract modified files for commit tracking.

**Summary Comment Format**:
```
@[$USER_ID:$USER] fix **Review Fixes Applied**

N findings fixed, M specs updated, K findings rejected

**Fixed**: #1 (ai-board), #2 (Codex), ...
**Rejected**: #3 (Copilot) — documentation nitpick, #5 (Codex) — false positive
```

## R8: Concurrency Control

**Decision**: Rely on the existing job system — only one job runs per ticket at a time (enforced by `checkAIBoardAvailability` in the comment creation flow).

**Rationale**: The spec requires one `/fix` job per ticket (FR-018). The existing infrastructure already enforces this via the availability check before dispatching workflows.

**Alternatives Considered**:
- Additional locking mechanism: Rejected — existing job system already handles this
