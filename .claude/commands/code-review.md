---
command: "/code-review"
description: "Code review a pull request"
allowed-tools: ["Bash", "Read", "Glob", "Grep", "Task", "TodoWrite"]
---

# Code Review Command

Provide a code review for the given pull request.

## Context Discovery

Before starting the review, discover project-specific guidance:

1. **CLAUDE.md** (auto-loaded) → Project stack, commands, conventions
2. **Read `.specify/memory/constitution.md`** → Project principles, non-negotiable rules

Both files inform the confidence scoring and issue detection phases.

## Execution Steps

To do this, follow these steps precisely:

### Step 1: Eligibility Check

Use a Haiku agent to check if the pull request:
- (a) is closed
- (b) is a draft
- (c) does not need a code review (eg. because it is an automated pull request, or is very simple and obviously ok)
- (d) already has a code review from you from earlier

If so, do not proceed.

### Step 2: Guidance File Discovery

Use another Haiku agent to give you a list of file paths to (but not the contents of) any relevant guidance files from the codebase:
- The root CLAUDE.md file (if one exists)
- Any CLAUDE.md files in the directories whose files the pull request modified
- The `.specify/memory/constitution.md` file (project principles and non-negotiable rules)

### Step 3: PR Summary

Use a Haiku agent to view the pull request, and ask the agent to return a summary of the change.

### Step 4: Parallel Review Analysis

Launch 5 parallel Sonnet agents to independently code review the change. The agents should do the following, then return a list of issues and the reason each issue was flagged (eg. CLAUDE.md adherence, constitution violation, bug, historical git context, etc.):

a. **Agent #1 (CLAUDE.md + Constitution Compliance)**: Audit the changes to make sure they comply with the CLAUDE.md and `.specify/memory/constitution.md`. Note that CLAUDE.md is guidance for Claude as it writes code, so not all instructions will be applicable during code review. The constitution contains project principles and non-negotiable rules that must be followed.

b. **Agent #2 (Bug Detection)**: Read the file changes in the pull request, then do a shallow scan for obvious bugs. Avoid reading extra context beyond the changes, focusing just on the changes themselves. Focus on large bugs, and avoid small issues and nitpicks. Ignore likely false positives.

c. **Agent #3 (Historical Context)**: Read the git blame and history of the code modified, to identify any bugs in light of that historical context.

d. **Agent #4 (Previous PR Context)**: Read previous pull requests that touched these files, and check for any comments on those pull requests that may also apply to the current pull request.

e. **Agent #5 (Code Comment Compliance)**: Read code comments in the modified files, and make sure the changes in the pull request comply with any guidance in the comments.

### Step 5: Confidence Scoring

For each issue found in Step 4, launch a parallel Haiku agent that takes the PR, issue description, and list of guidance files (CLAUDE.md files and constitution from step 2), and returns a score to indicate the agent's level of confidence for whether the issue is real or false positive.

The agent should score each issue on a scale from 0-100:

- **0**: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
- **25**: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant CLAUDE.md or constitution.
- **50**: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the PR, it's not very important.
- **75**: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach in the PR is insufficient. The issue is very important and will directly impact the code's functionality, or it is an issue that is directly mentioned in the relevant CLAUDE.md or constitution.
- **100**: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.

For issues flagged due to CLAUDE.md or constitution instructions, the agent should double check that those files actually call out that issue specifically.

### Step 6: Filter Issues

Filter out any issues with a score less than 80. If there are no issues that meet this criteria, do not proceed.

### Step 7: Final Eligibility Check

Use a Haiku agent to repeat the eligibility check from Step 1, to make sure that the pull request is still eligible for code review.

### Step 8: Post Comment

Use the gh bash command to comment back on the pull request with the result.

When writing your comment, keep in mind to:
- Keep your output brief
- Avoid emojis
- Link and cite relevant code, files, and URLs

## False Positive Criteria

Examples of false positives for steps 4 and 5:

- Pre-existing issues
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues that a linter, typechecker, or compiler would catch (eg. missing or incorrect imports, type errors, broken tests, formatting issues, pedantic style issues like newlines). No need to run these build steps yourself -- it is safe to assume that they will be run separately as part of CI.
- General code quality issues (eg. lack of test coverage, general security issues, poor documentation), unless explicitly required in CLAUDE.md or constitution
- Issues that are called out in CLAUDE.md or constitution, but explicitly silenced in the code (eg. due to a lint ignore comment)
- Changes in functionality that are likely intentional or are directly related to the broader change
- Real issues, but on lines that the user did not modify in their pull request

## Important Notes

- Do not check build signal or attempt to build or typecheck the app. These will run separately, and are not relevant to your code review.
- Use `gh` to interact with Github (eg. to fetch a pull request, or to create inline comments), rather than web fetch
- Make a todo list first
- You must cite and link each bug (eg. if referring to a CLAUDE.md or constitution, you must link it)

## Output Format

For your final comment, follow the following format precisely:

### If issues were found (example with 3 issues):

```
### Code review

Found 3 issues:

1. <brief description of bug> (CLAUDE.md says "<...>")

<link to file and line with full sha1 + line range for context>

2. <brief description of bug> (constitution says "<...>")

<link to file and line with full sha1 + line range for context>

3. <brief description of bug> (bug due to <file and code snippet>)

<link to file and line with full sha1 + line range for context>

🤖 Generated with [Claude Code](https://claude.ai/code)

<sub>- If this code review was useful, please react with 👍. Otherwise, react with 👎.</sub>
```

### If no issues were found:

```
### Code review

No issues found. Checked for bugs and CLAUDE.md/constitution compliance.

🤖 Generated with [Claude Code](https://claude.ai/code)
```

## Link Format Requirements

When linking to code, follow the following format precisely, otherwise the Markdown preview won't render correctly:

`https://github.com/owner/repo/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15`

Requirements:
- Requires full git sha (commands like `$(git rev-parse HEAD)` will not work since comment is rendered in Markdown)
- Repo name must match the repo you're code reviewing
- `#` sign after the file name
- Line range format is `L[start]-L[end]`
- Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if commenting about lines 5-6, link to `L4-L7`)
