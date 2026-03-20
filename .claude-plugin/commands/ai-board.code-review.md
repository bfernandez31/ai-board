---
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*)
description: Code review a pull request
disable-model-invocation: false
---

Provide a code review for the given pull request.

**Arguments**: The `--force` flag can be provided to skip check (d) below (existing review check), allowing re-reviews after code changes.

To do this, follow these steps precisely:

1. Use a Haiku agent to check if the pull request (a) is closed, (b) is a draft, (c) is very simple and obviously ok, or (d) already has a code review from you from earlier. **If the `--force` flag is provided in the arguments, skip check (d)** - this allows re-reviews when the user explicitly requests one. If any applicable check fails, do not proceed. Note: Automated PRs from bots (like ai-board[bot]) SHOULD be reviewed - they are not exempt.
2. Use another Haiku agent to give you a list of file paths to (but not the contents of) any relevant CLAUDE.md files from the codebase: the root CLAUDE.md file (if one exists), as well as any CLAUDE.md files in the directories whose files the pull request modified. **Additionally**, locate the project constitution file at `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md` which contains non-negotiable project principles.
3. Use a Haiku agent to view the pull request, and ask the agent to return a summary of the change
4. Then, launch 5 parallel Sonnet agents to independently code review the change. **Each agent MUST return both a list of issues AND a dimension quality score (0-100) for their area of review.** The dimension score should reflect the overall quality of the PR in that dimension (100 = excellent, no issues; 0 = critical problems). The agents should do the following, then return a list of issues, the reason each issue was flagged, and their dimension score:
   a. Agent #1 (Compliance, weight: 0.40): Audit the changes to make sure they comply with the CLAUDE.md **and** the constitution file (`${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md`). The constitution contains non-negotiable rules that MUST be followed. Note that CLAUDE.md is guidance for Claude as it writes code, so not all instructions will be applicable during code review. **Return a `dimensionScore` (0-100) for compliance quality.**
   b. Agent #2 (Bug Detection, weight: 0.30): Read the file changes in the pull request, then do a shallow scan for obvious bugs. Avoid reading extra context beyond the changes, focusing just on the changes themselves. Focus on large bugs, and avoid small issues and nitpicks. Ignore likely false positives. **Return a `dimensionScore` (0-100) for bug-free quality.**
   c. Agent #3 (Historical Context, weight: 0.10): Read the git blame and history of the code modified, to identify any bugs in light of that historical context. **Return a `dimensionScore` (0-100) for historical context quality.**
   d. Agent #4 (Spec Sync, weight: 0.00): Check if the PR modifies any spec files matching `specs/specifications/**/*.md`. If no spec files are modified, return dimensionScore 100 immediately. If spec files are modified, read the spec changes and code changes, then check for: (a) contradictions between spec content and code behavior, (b) gaps where specs document behavior absent from code or code adds behavior not in specs. **Return a `dimensionScore` (0-100) reflecting spec-code consistency.**
   e. Agent #5 (Code Comments, weight: 0.20): Read code comments in the modified files, and make sure the changes in the pull request comply with any guidance in the comments. **Return a `dimensionScore` (0-100) for code comment compliance quality.**
5. **Quality Score Consolidation**: After all 5 agents complete, collect their dimension scores and compute the weighted final quality score. **Print the quality score JSON as a single line to stdout**, prefixed with the marker `QUALITY_SCORE_JSON:`. This allows the verify workflow to parse the score from the agent's output. The JSON structure is:
   ```json
   {"version":1,"qualityScore":<rounded weighted sum>,"threshold":"<Excellent|Good|Fair|Poor>","dimensions":[{"name":"Compliance","agentId":"compliance","score":<agent1_score>,"weight":0.40,"weightedScore":<score*0.40>},{"name":"Bug Detection","agentId":"bug-detection","score":<agent2_score>,"weight":0.30,"weightedScore":<score*0.30>},{"name":"Code Comments","agentId":"code-comments","score":<agent5_score>,"weight":0.20,"weightedScore":<score*0.20>},{"name":"Historical Context","agentId":"historical-context","score":<agent3_score>,"weight":0.10,"weightedScore":<score*0.10>},{"name":"Spec Sync","agentId":"spec-sync","score":<agent4_score>,"weight":0.00,"weightedScore":0}],"computedAt":"<ISO8601 timestamp>"}
   ```
   Example output line (must be exactly this format — single line, no spaces between marker and JSON):
   ```
   QUALITY_SCORE_JSON:{"version":1,"qualityScore":83,"threshold":"Good","dimensions":[...],"computedAt":"2026-03-18T20:53:00.000Z"}
   ```
   Threshold derivation: 90-100 = "Excellent", 70-89 = "Good", 50-69 = "Fair", 0-49 = "Poor".
   The `qualityScore` is `round(sum(dimension.score * dimension.weight))` across all 5 dimensions.
   If any agent fails to return a dimension score, default to 50 for that dimension.
   **Important**: Do NOT attempt to write a file — this command does not have file write permissions. The stdout marker is the only mechanism for passing the score to the workflow.

6. For each issue found in #4, launch a parallel Haiku agent that takes the PR, issue description, and list of CLAUDE.md files + constitution file (from step 2), and returns a score to indicate the agent's level of confidence for whether the issue is real or false positive. To do that, the agent should score each issue on a scale from 0-100, indicating its level of confidence. For issues that were flagged due to CLAUDE.md or constitution instructions, the agent should double check that the CLAUDE.md or constitution actually calls out that issue specifically. The scale is (give this rubric to the agent verbatim):
   a. 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
   b. 25: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant CLAUDE.md or constitution.
   c. 50: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the PR, it's not very important.
   d. 75: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach in the PR is insufficient. The issue is very important and will directly impact the code's functionality, or it is an issue that is directly mentioned in the relevant CLAUDE.md or constitution.
   e. 100: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.
7. Filter out any issues with a score less than 80. If there are no issues that meet this criteria, do not proceed.
8. Use a Haiku agent to repeat the eligibility check from #1, to make sure that the pull request is still eligible for code review.
9. Finally, use the gh bash command to comment back on the pull request with the result. When writing your comment, keep in mind to:
   a. Keep your output brief
   b. Avoid emojis
   c. Link and cite relevant code, files, and URLs

Examples of false positives, for steps 4 and 5:

- Pre-existing issues
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues that a linter, typechecker, or compiler would catch (eg. missing or incorrect imports, type errors, broken tests, formatting issues, pedantic style issues like newlines). No need to run these build steps yourself -- it is safe to assume that they will be run separately as part of CI.
- General code quality issues (eg. lack of test coverage, general security issues, poor documentation), unless explicitly required in CLAUDE.md or constitution
- Issues that are called out in CLAUDE.md or constitution, but explicitly silenced in the code (eg. due to a lint ignore comment)
- Changes in functionality that are likely intentional or are directly related to the broader change
- Real issues, but on lines that the user did not modify in their pull request

Notes:

- Do not check build signal or attempt to build or typecheck the app. These will run separately, and are not relevant to your code review.
- Use `gh` to interact with Github (eg. to fetch a pull request, or to create inline comments), rather than web fetch
- Make a todo list first
- You must cite and link each bug (eg. if referring to a CLAUDE.md or constitution, you must link it)
- For your final comment, follow the following format precisely (assuming for this example that you found 3 issues):

---

### Code review

Found 3 issues:

1. <brief description of bug> (CLAUDE.md says "<...>")

<link to file and line with full sha1 + line range for context, note that you MUST provide the full sha and not use bash here, eg. https://github.com/anthropics/claude-code/blob/1d54823877c4de72b2316a64032a54afc404e619/README.md#L13-L17>

2. <brief description of bug> (constitution says "<...>")

<link to file and line with full sha1 + line range for context>

3. <brief description of bug> (bug due to <file and code snippet>)

<link to file and line with full sha1 + line range for context>

🤖 Generated with [Claude Code](https://claude.ai/code)

<sub>- If this code review was useful, please react with 👍. Otherwise, react with 👎.</sub>

---

- Or, if you found no issues:

---

### Code review

No issues found. Checked for bugs, CLAUDE.md compliance, and constitution compliance.

🤖 Generated with [Claude Code](https://claude.ai/code)

- When linking to code, follow the following format precisely, otherwise the Markdown preview won't render correctly: https://github.com/anthropics/claude-cli-internal/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15
  - Requires full git sha
  - You must provide the full sha. Commands like `https://github.com/owner/repo/blob/$(git rev-parse HEAD)/foo/bar` will not work, since your comment will be directly rendered in Markdown.
  - Repo name must match the repo you're code reviewing
  - # sign after the file name
  - Line range format is L[start]-L[end]
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to `L4-7`)
