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

### 2. Re-Review Override Mechanism

**Question**: How to instruct code-review skill to ignore previous reviews?

**Decision**: Add preamble instruction in /review command prompt that explicitly tells the code-review skill to skip the "already reviewed" check.

**Rationale**:
- The code-review skill uses Haiku agents that interpret natural language instructions
- Adding "This is a user-requested re-review. Skip step 1d (previous review check)" is cleaner than forking the skill
- Maintains single source of truth for code review logic

**Alternatives Considered**:
1. Fork code-review.md to code-review-forced.md - Rejected: Duplication
2. Add environment variable check in code-review.md - Rejected: Adds complexity to existing skill
3. Prepend override instruction when invoking skill - **Selected**: Non-invasive, user intent clear

**Source**: spec.md lines 23-32 (Decision 2), FR-004

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
| Re-review mechanism | Prepend instruction to skip step 1d | Non-invasive, clear intent |
| Stage validation | Workflow routing check | Early fail, good error message |
| PR lookup | `gh pr list --head $BRANCH` | Proven pattern from verify.yml |
| Output format | 1500 char summary to ticket, details to PR | Matches /compare pattern |
| Command file | `.claude/commands/review.md` | Standard skill location |

## Files to Modify

1. **`.github/workflows/ai-board-assist.yml`**: Add /review routing (after /compare block)
2. **`app/lib/data/ai-board-commands.ts`**: Add /review to autocomplete list
3. **`.claude/commands/review.md`**: Create command specification (NEW)

## Dependencies

- Existing `/code-review` skill (no modifications needed)
- `gh` CLI in GitHub Actions environment
- Standard workflow inputs (BRANCH, STAGE, USER_ID, USER, etc.)
