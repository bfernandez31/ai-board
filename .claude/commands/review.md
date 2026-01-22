---
command: "/review"
category: "Code Review"
purpose: "Request a code review on the current branch's pull request"
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*)
disable-model-invocation: false
---

# /review - Code Review Command

## ⛔ MANDATORY: ALWAYS REGENERATE - NO EXCEPTIONS

**YOU MUST ALWAYS CREATE A NEW CODE REVIEW. NEVER SKIP.**

Before doing ANYTHING else, understand these rules:
1. **NEVER** check if a code review already exists first and use that as a reason to skip
2. **NEVER** read or check `.ai-board-result.md` files to see existing reviews
3. **NEVER** say "Code Review Already Available" or similar
4. **ALWAYS** do a fresh analysis from scratch
5. **ALWAYS** post a new review comment

If you find yourself thinking "this code review was already done", STOP and do it anyway. The user explicitly requested a new code review.

---

## ⚠️ CRITICAL: OUTPUT DIRECTLY - NO INTRODUCTIONS!

**Your output will be posted DIRECTLY as a ticket comment.**

Start IMMEDIATELY with the mention. Do NOT add any introductory text.

**CHARACTER LIMIT**: Your ENTIRE output must be under **1500 characters** (database limit is 2000).

**REQUIRED**:
Start DIRECTLY with:
@[$USER_ID:$USER] ✅ **Code Review Complete**

## Inputs

**Environment Variables**:
- `TICKET_ID`: Current ticket ID
- `STAGE`: Current stage (should be VERIFY for code review)
- `BRANCH`: Git branch name for this ticket
- `USER_ID`: User ID who requested the review
- `USER`: Display name who requested the review
- `PROJECT_ID`: Project ID

**Arguments**: `$ARGUMENTS` may contain an optional PR number (e.g., "123" or "#123")

## Execution Process

### Step 1: Find the Pull Request

First, find the PR for the current branch:

```bash
# If PR number provided in arguments, use it
# Otherwise, find PR for current branch
PR_NUMBER=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number')

if [ -z "$PR_NUMBER" ]; then
  # Try to find by searching with ticket ID
  PR_NUMBER=$(gh pr list --search "$TICKET_ID" --json number --jq '.[0].number')
fi
```

**Validation Gate**: A PR MUST exist. If no PR found, report error.

### Step 2: Check PR Eligibility

Use a Haiku agent to check if the pull request:
- (a) is closed
- (b) is a draft
- (c) does not need a code review (eg. because it is an automated pull request, or is very simple and obviously ok)

**IMPORTANT**: If there is a previous code review from you, DO NOT skip. The user explicitly requested a new review, so proceed with a fresh analysis. This is different from the workflow-triggered code review.

If the PR is closed or is a draft, do not proceed.

### Step 3: Locate Configuration Files

Use another Haiku agent to give you a list of file paths to (but not the contents of) any relevant CLAUDE.md files from the codebase: the root CLAUDE.md file (if one exists), as well as any CLAUDE.md files in the directories whose files the pull request modified.

**Additionally**, locate the project constitution file at `.specify/memory/constitution.md` which contains non-negotiable project principles.

### Step 4: Get PR Summary

Use a Haiku agent to view the pull request, and ask the agent to return a summary of the change.

### Step 5: Parallel Code Review

Launch 5 parallel Sonnet agents to independently code review the change. The agents should do the following, then return a list of issues and the reason each issue was flagged (eg. CLAUDE.md adherence, constitution compliance, bug, historical git context, etc.):

a. **Agent #1**: Audit the changes to make sure they comply with the CLAUDE.md **and** the constitution file (`.specify/memory/constitution.md`). The constitution contains non-negotiable rules that MUST be followed. Note that CLAUDE.md is guidance for Claude as it writes code, so not all instructions will be applicable during code review.

b. **Agent #2**: Read the file changes in the pull request, then do a shallow scan for obvious bugs. Avoid reading extra context beyond the changes, focusing just on the changes themselves. Focus on large bugs, and avoid small issues and nitpicks. Ignore likely false positives.

c. **Agent #3**: Read the git blame and history of the code modified, to identify any bugs in light of that historical context.

d. **Agent #4**: Read previous pull requests that touched these files, and check for any comments on those pull requests that may also apply to the current pull request.

e. **Agent #5**: Read code comments in the modified files, and make sure the changes in the pull request comply with any guidance in the comments.

### Step 6: Score Issues

For each issue found in Step 5, launch a parallel Haiku agent that takes the PR, issue description, and list of CLAUDE.md files + constitution file, and returns a score to indicate the agent's level of confidence for whether the issue is real or false positive.

Score each issue on a scale from 0-100:
- **0**: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
- **25**: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant CLAUDE.md or constitution.
- **50**: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the PR, it's not very important.
- **75**: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach in the PR is insufficient. The issue is very important and will directly impact the code's functionality, or it is an issue that is directly mentioned in the relevant CLAUDE.md or constitution.
- **100**: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.

For issues flagged due to CLAUDE.md or constitution instructions, double check that the CLAUDE.md or constitution actually calls out that issue specifically.

### Step 7: Filter Issues

Filter out any issues with a score less than 80. If there are no issues that meet this criteria, report "No issues found".

### Step 8: Re-check Eligibility

Use a Haiku agent to repeat the eligibility check from Step 2, to make sure that the pull request is still eligible for code review.

### Step 9: Post Review Comment

Use the gh bash command to comment back on the pull request with the result.

When writing your comment:
- Keep your output brief
- Avoid emojis
- Link and cite relevant code, files, and URLs

**Examples of false positives** to filter out:
- Pre-existing issues
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues that a linter, typechecker, or compiler would catch
- General code quality issues, unless explicitly required in CLAUDE.md or constitution
- Issues called out in CLAUDE.md or constitution, but explicitly silenced in the code
- Changes in functionality that are likely intentional
- Real issues, but on lines that the user did not modify

### Step 10: Create Result File

Write result file at `specs/$BRANCH/.ai-board-result.md`:

```markdown
# AI-BOARD Assist Result

## Status
SUCCESS

## Message
@{USER} Code review completed for PR #{PR_NUMBER}

## Files Modified
- None (review comment posted to PR)

## Summary
Code review posted to PR #{PR_NUMBER}
Issues found: {count}
```

### Step 11: Output Summary

Output a concise ticket comment (< 1500 chars) with:
- **Review status** clearly identified
- Key issues found (if any)
- Link to the PR

## Output Format

**Success Example (with issues)**:
```markdown
@[cm47j3m31817281:Benoît Fernandez] ✅ **Code Review Complete**

Reviewed PR #42 for branch `AIB-179-copy-of-review`

### Found 2 issues:

1. **Missing error handling** (CLAUDE.md says "handle errors properly")
   - [src/api/handler.ts#L15-L20](link)

2. **Potential null reference** (bug detected in new code)
   - [src/utils/parser.ts#L42-L45](link)

→ **Review posted to PR #42**

📄 [View PR](https://github.com/owner/repo/pull/42)
```

**Success Example (no issues)**:
```markdown
@[cm47j3m31817281:Benoît Fernandez] ✅ **Code Review Complete**

Reviewed PR #42 for branch `AIB-179-copy-of-review`

### No issues found

Checked for bugs, CLAUDE.md compliance, and constitution compliance.

→ **Review posted to PR #42**

📄 [View PR](https://github.com/owner/repo/pull/42)
```

**Error Example**:
```markdown
@[cm47j3m31817281:Benoît Fernandez] ❌ **Code Review Failed**

Could not find pull request for branch `AIB-179-copy-of-review`.

Please ensure a PR exists for this branch.
```

## Important Rules

1. **ALWAYS do a fresh review**: Even if a previous review exists, create a new one
2. **Find the PR automatically**: Use branch name to locate the PR if not provided
3. **Keep output brief**: Under 1500 characters
4. **Post to PR**: The code review comment goes on the PR, not just the ticket
5. **Make a todo list first**: Track your progress through the review steps

## Error Handling

- **No PR found**: "Please ensure a PR exists for branch `$BRANCH`"
- **PR is closed**: "PR #{number} is already closed"
- **PR is draft**: "PR #{number} is a draft - code review skipped"

## Notes

- Do not check build signal or attempt to build or typecheck the app
- Use `gh` to interact with Github
- Cite and link each bug (if referring to CLAUDE.md or constitution, link it)
- Follow the comment format from the code-review.md command precisely

## PR Comment Format

For your final PR comment, follow this format:

---

### Code review

Found {N} issues:

1. <brief description of bug> (CLAUDE.md says "<...>")

<link to file and line with full sha1 + line range>

2. <brief description of bug> (constitution says "<...>")

<link to file and line with full sha1 + line range>

🤖 Generated with [Claude Code](https://claude.ai/code)

<sub>- If this code review was useful, please react with 👍. Otherwise, react with 👎.</sub>

---

Or, if no issues found:

---

### Code review

No issues found. Checked for bugs, CLAUDE.md compliance, and constitution compliance.

🤖 Generated with [Claude Code](https://claude.ai/code)

---

**Link format**: `https://github.com/owner/repo/blob/{full-sha}/path/to/file.ts#L10-L15`
- Requires full git sha
- # sign after the file name
- Line range format is L[start]-L[end]
- Provide at least 1 line of context before and after
