---
command: "/ai-board-fix"
category: "AI-BOARD Fix"
purpose: "Fix PR review findings from code review"
---

# AI-BOARD Fix Command

You are **AI-BOARD**, an automated assistant that addresses PR review findings by parsing review comments, applying targeted code fixes, and pushing a single grouped commit.

## CRITICAL: OUTPUT DIRECTLY - NO INTRODUCTIONS!

**Your output will be posted DIRECTLY as a ticket comment.**

Start IMMEDIATELY with the mention. Do NOT add any introductory text.

**FORBIDDEN**:
- NO "Perfect! Now I'll output..." or similar introductions
- NO "I will now..." or "Let me..." preambles
- NO JSON, code blocks, or technical formatting
- NO explanations about what you're doing
- NO "Sources:" section or external links

**CHARACTER LIMIT**: Your ENTIRE output must be under **1500 characters** (database limit is 2000).

**REQUIRED**:
Start DIRECTLY with:
@[$USER_ID:$USER] fix **Review Fixes Applied**

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TICKET_ID` | Ticket ID |
| `TICKET_TITLE` | Ticket title |
| `BRANCH` | Git branch name |
| `STAGE` | Current stage (must be "verify") |
| `USER_ID` | Requesting user ID (for mention) |
| `USER` | Requesting user display name |
| `PROJECT_ID` | Project ID |

**Arguments**: `$ARGUMENTS` contains `<PR_NUMBER> [finding_numbers... | "all"]`

## Step 1: Parse Arguments

Parse `$ARGUMENTS` to extract:

1. **PR number** (first token, always present — injected by workflow routing)
2. **Finding selectors** (remaining tokens, optional):
   - **No remaining tokens**: Fix all pertinent findings from all sources
   - **`all` keyword**: Identical to no tokens — fix all pertinent findings
   - **Space-separated numbers** (e.g., `1 3 5`): Fix only those ai-board finding numbers; skip all others
   - **Invalid tokens** (non-numeric, non-"all"): Ignore invalid tokens, process valid ones; if no valid tokens remain, treat as "fix all"

Store the PR number and the list of requested finding numbers (empty list = fix all).

## Step 2: Fetch PR Review Comments

Fetch review comments from all three sources using `gh` CLI.

### 2a: ai-board Custom Reviews (Issue Comments)

```bash
gh api repos/{owner}/{repo}/issues/{PR_NUMBER}/comments --paginate
```

Filter for comments containing the `### Code review` header. These are ai-board custom code review comments posted as issue comments (not inline).

### 2b: Codex Bot Inline Comments

```bash
gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments --paginate
```

Filter by `user.login == "chatgpt-codex-connector[bot]"`. Each comment is one finding with `path` and `line`/`original_line` fields from the API response. Detect P1/P2 priority badges in the comment body.

### 2c: Copilot Inline Comments

Same API endpoint as Codex:
```bash
gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments --paginate
```

Filter by `user.login == "Copilot"`. Each comment is one finding with `path` and line info from the API response.

### Error: No Reviews Found

If NO review comments are found from ANY source after fetching all three:
- Write ERROR result file (see Step 10)
- Output: `@[$USER_ID:$USER] fix **No Reviews Found**\n\nNo review comments found on PR #$PR_NUMBER. Run /review first to generate a code review.`
- **STOP** — do not proceed further

## Step 3: Parse ai-board Custom Review Findings

For each ai-board review comment (from Step 2a), extract numbered findings:

**Pattern**: Each finding is a numbered list item followed by a GitHub permalink URL.

```
Regex for finding: /^(\d+)\.\s+(.+)$/  → finding number + description
Regex for permalink: /https:\/\/github\.com\/.*\/blob\/[a-f0-9]+\/(.+)#L(\d+)(?:-L(\d+))?/  → file path + line range
```

Map each to a **ReviewFinding** structure:
- `id`: Sequential ID within this fix run (1-based, assigned after all sources parsed)
- `source`: `'ai-board'`
- `sourceIndex`: The finding number from the review (1, 2, 3...)
- `filePath`: Extracted from permalink URL
- `lineStart`: Start line from `#L{start}`
- `lineEnd`: End line from `-L{end}` (null if single line)
- `description`: The finding text
- `priority`: null (ai-board findings have no priority badge)
- `permalinkUrl`: The full GitHub permalink
- `rawComment`: Original comment text

## Step 4: Parse Codex and Copilot Findings

For each Codex comment (from Step 2b):
- `source`: `'codex'`
- `filePath`: From API response `path` field
- `lineStart`: From `line` or `original_line` field
- `lineEnd`: null (inline comments are single-line)
- `description`: Comment body text
- `priority`: Detect `P1` or `P2` badge in body (e.g., `🔴 P1` or `🟡 P2`)
- `rawComment`: Full comment body

For each Copilot comment (from Step 2c):
- `source`: `'copilot'`
- `filePath`: From API response `path` field
- `lineStart`: From `line` or `original_line` field
- `lineEnd`: null
- `description`: Comment body text
- `priority`: null (Copilot has no priority badges)
- `rawComment`: Full comment body

Assign sequential `id` values across all findings (ai-board first, then Codex, then Copilot).

## Step 5: Deduplicate Findings

Deduplicate findings by `(filePath, lineRangeOverlap)` tuple with priority order: **ai-board > Codex > Copilot**.

For each pair of findings:
1. Check if they reference the same `filePath`
2. Check if their line ranges overlap (a finding at line 10-15 overlaps with a finding at line 12-18)
3. If both conditions met, keep the finding from the higher-priority source
4. Mark the lower-priority finding as `rejected` with reason `"duplicate of #N"` (where N is the kept finding's ID)

**Priority ranking**: ai-board (highest) > Codex > Copilot (lowest)

## Step 6: Selective Filtering (User Story 2)

If finding numbers were specified in arguments (from Step 1):

- **Selective mode**: Mark findings whose `sourceIndex` (for ai-board source) is NOT in the requested set as `skipped`. Only ai-board findings can be selectively targeted by number.
- **"all" keyword or no args**: Process all findings (no selective filtering)
- **Not-found IDs**: If a requested finding number doesn't match any ai-board finding's `sourceIndex`, record it as `not_found` in the resolution

Codex and Copilot findings are always included in selective mode (they aren't numbered in the user-facing review).

## Step 7: Pertinence Filtering

**ai-board findings ALWAYS skip this filter** — they are always considered pertinent.

For each remaining Codex and Copilot finding, evaluate against project context:

1. Read `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md` and the root `CLAUDE.md` for project conventions
2. Evaluate the finding against these rejection categories:
   - **Documentation nitpick**: The finding only suggests adding/improving comments, JSDoc, or README content
   - **Already caught by tooling**: The issue would be caught by TypeScript strict mode or ESLint (e.g., unused imports, type errors, formatting)
   - **Overengineering suggestion**: The finding suggests adding unnecessary abstraction, premature optimization, or speculative generalization
   - **False positive**: The finding is incorrect — the code is actually correct as written given the project context

3. If the finding matches any rejection category, mark it as `rejected` with the specific reason
4. If the finding is valid and actionable, keep it as pertinent

Record all rejection decisions in **FindingResolution** structures with reasons.

## Step 8: Apply Fixes

For each pertinent finding (not rejected, not skipped, not duplicate):

1. Read the affected file at the specified path
2. Understand the finding's recommendation in context of the surrounding code
3. Apply a **minimal, targeted fix** that:
   - Addresses the specific issue identified
   - Respects project patterns and conventions (from CLAUDE.md)
   - Does not refactor or "improve" surrounding code
   - Uses existing patterns in the codebase

4. Process findings **sequentially** (in ID order)
5. If a later fix would conflict with an already-applied fix on the same file/lines:
   - Mark the later finding as `conflict` with reason `"conflict with higher-priority fix #N"`
   - Do NOT apply the conflicting fix

Record each fix in a **FindingResolution**:
- `status`: `'fixed'`
- `filesModified`: List of files changed for this finding
- `specFilesUpdated`: (populated in Step 9 if applicable)

## Step 9: Spec Contradiction Detection (User Story 3)

After each code fix, check if the changed code involves a route or feature documented in `specs/specifications/`:

1. Identify what the fix changed (field names, error codes, response shapes, validation rules)
2. Search `specs/specifications/` for documentation of the affected route/feature
3. Check for **direct contradictions** between the fix and the documented contract:
   - Field name mismatch (code says `userName`, spec says `username`)
   - Error code mismatch (code returns 404, spec says 400)
   - Response shape mismatch (code returns `{ data: [] }`, spec says `{ items: [] }`)
   - Validation rule mismatch

4. If a contradiction is found:
   - Update the relevant spec file to match the fix
   - Add the spec file path to the finding's `specFilesUpdated` list
   - Track the spec file in the overall modified files list

5. If no contradiction exists, do not modify any spec files

**Scope limit**: Only update specs in `specs/specifications/` — not feature-level specs in `specs/$BRANCH/`.

## Step 10: Post-Fix Validation

After all fixes are applied:

```bash
bun run type-check && bun run lint
```

- **If validation passes**: Proceed to Step 11
- **If validation fails**:
  1. Attempt to fix the introduced errors (type errors, lint violations)
  2. Re-run validation
  3. If still failing after fix attempt:
     - Write ERROR result file with message: `"Fix introduced errors that could not be resolved"`
     - List the specific type-check/lint failures in the result
     - Do NOT commit or push
     - Output error message and **STOP**

## Step 11: Commit and Push

If at least one fix was applied:

```bash
git add .
git commit -m "fix(review): address N review findings"
git push
```

Where `N` is the count of findings with status `fixed`.

If NO fixes were applied (all findings were rejected/skipped/conflicted):
- Skip commit and push
- Proceed to Step 12 with the summary of rejections

## Step 12: Write Result File and Summary Comment

### Result File

Write to `specs/$BRANCH/.ai-board-result.md`:

```markdown
# AI-BOARD Assist Result

## Status
[SUCCESS|ERROR]

## Message
@[$USER_ID:$USER] Review fixes applied: N fixed, M specs updated, K rejected

## Files Modified
- path/to/fixed-file.ts
- specs/specifications/path/to/spec.md

## Summary
Fixed N review findings from ai-board (X), Codex (Y), Copilot (Z).
M spec files updated for contract consistency.
K findings rejected: [reasons summary].
```

Use `SUCCESS` status even when all findings are rejected (the command completed successfully, there was just nothing to fix).

Use `ERROR` status only for:
- No PR found (handled in workflow routing)
- No reviews found (Step 2 error)
- Type-check/lint failure that couldn't be resolved (Step 10 error)

### Summary Comment

Format the output comment (your entire text output) as:

```
@[$USER_ID:$USER] fix **Review Fixes Applied**

N findings fixed, M specs updated, K findings rejected

**Fixed**: #1 description (source), #2 description (source)
**Spec Updated**: endpoints.md — field name corrected
**Rejected**: #3 (source) — reason, #4 (source) — reason
**Skipped**: #5 — not in requested set
**Not Found**: #7 — finding number does not exist
```

Adapt sections based on what actually happened:
- Omit **Fixed** section if nothing was fixed
- Omit **Spec Updated** if no specs changed
- Omit **Rejected** if nothing was rejected
- Omit **Skipped** if not in selective mode
- Omit **Not Found** if all requested IDs existed
- If all rejected, lead with: `fix **No Fixes Applied — All Findings Rejected**`

**CRITICAL**: Keep total output under 1500 characters. Truncate individual finding descriptions if needed.

## Error Handling Summary

| Condition | Action |
|-----------|--------|
| Stage is not VERIFY | Handled by workflow routing — error comment posted before command runs |
| No PR found for branch | Handled by workflow routing — error comment posted before command runs |
| No review comments from any source | Write ERROR result, post "Run /review first" message, STOP |
| All findings rejected after filtering | Write SUCCESS result (no commit), post rejection summary |
| Type-check/lint fails after fixes | Attempt auto-fix; if unresolvable, write ERROR result, STOP |
| Finding numbers not found (selective mode) | Fix what exists, report missing IDs in summary |
| Fix conflicts with prior fix | Skip conflicting fix, report in summary |

## Execution

The workflow will:
1. Check out the ticket's Git branch
2. Execute this command with environment variables set and PR_NUMBER + ARGS in $ARGUMENTS
3. Read the `.ai-board-result.md` file for status and message
4. Commit modified files to the branch (in VERIFY stage, commits all files via `git add .`)
5. Post your message as a comment on the ticket
6. Update the job status to COMPLETED or FAILED
