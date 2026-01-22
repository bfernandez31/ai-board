# Research: /review Command Implementation

**Date**: 2026-01-22
**Branch**: AIB-178-review-command-from

## Research Questions Resolved

### 1. PR State Handling

**Question**: How does the existing code-review skill handle different PR states?

**Decision**: Maintain existing PR state checks (closed, draft) but override "already reviewed" check.

**Rationale**:
- The code-review skill checks for closed/draft PRs in Step 1 and Step 7 via Haiku agents
- These checks protect against invalid operations (can't review closed/draft PRs)
- The "already reviewed" check is the only one that needs overriding per FR-004

**Alternatives Considered**:
1. Skip all eligibility checks entirely - Rejected: Would waste resources on closed/draft PRs
2. Create a separate modified code-review-forced skill - Rejected: Duplication, maintenance burden
3. Pass a flag/instruction to code-review to skip review detection - **Selected**: Minimal change, clear intent

**Source**: `.claude/commands/code-review.md` lines 10-11, spec FR-004

---

### 2. Re-Review Override Mechanism (Updated per user feedback)

**Question**: How to instruct code-review skill to ignore previous reviews?

**Decision**: Add `--force` argument to existing code-review.md. When `--force` is provided, the skill skips step 1d (previous review check). The `/review` command in ai-board-assist always invokes code-review with `--force`.

**Rationale**:
- User explicitly requested `--force` flag rather than a new command file
- Reuses existing code-review.md - no duplication
- Explicit flag makes intent clear and opt-in
- Default behavior preserved (without `--force`, existing review check remains)

**Alternatives Considered**:
1. Create new review.md command file - Rejected: User explicitly requested reusing code-review.md
2. Always force re-review - Rejected: User wanted explicit `--force` flag for control
3. Add `--force` flag to code-review.md - **Selected**: Per user request, maintains single command with explicit opt-in

**Implementation**:
- Modify code-review.md to check for `--force` in arguments
- When `--force` present: Skip step 1d (previous review check)
- When `--force` absent: Maintain existing behavior (skip if already reviewed)

**Source**: User feedback (AI-BOARD comment), spec.md Decision 2, FR-004

---

### 3. Output Format & Character Limits

**Question**: What are the exact constraints for ticket comment output?

**Decision**: Limit output to 1500 characters with mention format `@[$USER_ID:$USER_NAME]`.

**Rationale**:
- Database hard limit: 2000 characters (`@db.VarChar(2000)` in Prisma schema)
- Validation enforces: `.max(2000, ...)` in Zod schema
- Buffer recommended: 1500 chars (matches /compare command pattern)
- Mention cleanup happens in workflow (lines 387-410 of ai-board-assist.yml)

**Alternatives Considered**:
1. Use full 2000 limit - Rejected: No buffer for workflow transformations
2. Post truncated message - Rejected: Loses important review context
3. Post summary with link to PR - **Selected**: Detailed findings go to PR, brief summary to ticket

**Source**:
- `prisma/schema.prisma` line 164
- `app/lib/schemas/comment-validation.ts` line 24
- `.claude/commands/compare.md` line 53

---

### 4. Stage Validation Strategy

**Question**: How to restrict /review to VERIFY stage only?

**Decision**: Implement stage check in workflow routing before invoking skill.

**Rationale**:
- General ai-board availability already checks valid stages (SPECIFY, PLAN, BUILD, VERIFY)
- /review needs stricter check: VERIFY only (PRs only exist after PR creation in VERIFY)
- Check stage early in workflow, return friendly error if not VERIFY
- Pattern: Same routing location as /compare command (lines 220-230 of ai-board-assist.yml)

**Alternatives Considered**:
1. Let code-review fail if no PR - Rejected: Poor UX, unclear error
2. Add stage check to code-review.md - Rejected: code-review is general-purpose
3. Check stage in workflow routing - **Selected**: Clear separation, early fail with good error

**Source**:
- `app/lib/utils/ai-board-availability.ts` lines 52-58
- spec.md lines 10-20, 89-91

---

### 5. PR Number Resolution

**Question**: How to find the PR for a ticket's branch?

**Decision**: Use existing pattern from verify.yml: `gh pr list --head "$BRANCH" --json number --jq '.[0].number'`

**Rationale**:
- Already proven pattern in verify.yml lines 440-450
- Returns empty if no PR (enables clean error handling)
- Uses gh CLI which is available in workflow environment
- Branch name is provided as workflow input

**Alternatives Considered**:
1. Query GitHub API directly with curl - Rejected: gh CLI is simpler
2. Store PR number in database - Rejected: Not currently tracked, overkill
3. Use gh pr list by branch - **Selected**: Simple, proven, available

**Source**: `.github/workflows/verify.yml` lines 440-446

---

## Technology Decisions Summary

| Decision | Choice | Key Reason |
|----------|--------|------------|
| Re-review mechanism | Add `--force` flag to code-review.md | User requested explicit flag, reuses existing command |
| Stage validation | Workflow routing check | Early fail, good error message |
| PR lookup | `gh pr list --head $BRANCH` | Proven pattern from verify.yml |
| Output format | 1500 char summary to ticket, details to PR | Matches /compare pattern |
| Command file | Modify `.claude/commands/code-review.md` | No new file - extend existing per user request |

## Files to Modify

1. **`.github/workflows/ai-board-assist.yml`**: Add /review routing (after /compare block)
2. **`app/lib/data/ai-board-commands.ts`**: Add /review to autocomplete list
3. **`.claude/commands/code-review.md`**: Add `--force` flag support (MODIFY existing, not create new)

## Dependencies

- Existing `/code-review` skill (no modifications needed)
- `gh` CLI in GitHub Actions environment
- Standard workflow inputs (BRANCH, STAGE, USER_ID, USER, etc.)
