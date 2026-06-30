---
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*)
description: Code review a pull request
disable-model-invocation: false
---

Provide a code review for the given pull request.

**Arguments**: The `--force` flag can be provided to skip check (d) below (existing review check), allowing re-reviews after code changes.

To do this, follow these steps precisely:

1. Use a Haiku agent to check if the pull request (a) is closed, (b) is a draft, (c) is very simple and obviously ok, or (d) already has a code review from you from earlier. **If the `--force` flag is provided in the arguments, skip check (d)** - this allows re-reviews when the user explicitly requests one. If any applicable check fails, do not proceed. Note: Automated PRs from bots (like ai-board[bot]) SHOULD be reviewed - they are not exempt.
2. Use another Haiku agent to give you a list of file paths to (but not the contents of) any relevant CLAUDE.md files from the codebase: the root CLAUDE.md file (if one exists), as well as any CLAUDE.md files in the directories whose files the pull request modified. **Additionally**, locate the project constitution.md at `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md` which contains non-negotiable project principles.
3. Use a Haiku agent to view the pull request, and ask the agent to return a summary of the change
4. Then, launch 5 parallel Sonnet agents to independently code review the change. Each agent MUST return a list of issues found with reasons:
   a. **Compliance**: Audit the changes to make sure they comply with the CLAUDE.md **and** the constitution.md (`${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md`). The constitution contains non-negotiable rules that MUST be followed. Note that CLAUDE.md is guidance for Claude as it writes code, so not all instructions will be applicable during code review.
   b. **Bug Detection**: Read the file changes in the pull request and scan for bugs in code that IS written — defects where the code produces a wrong result at runtime. Trace data flow within the diff: a mutation followed by code that uses the pre-mutation object, a failure path that returns success, a read-then-write without a concurrency guard, or test mocks that don't match the code's actual imports. **Additionally, for each newly introduced or substantially modified exported symbol in the diff (functions, classes, types, components, routes, schemas), run a repository-wide grep for its references to (a) verify the symbol is actually consumed by real callers and (b) extend the data-flow trace into those call sites when relevant. If a symbol has zero references outside the diff itself, flag it as "introduced but not referenced anywhere".** Scope: "the code as written is wrong", not "the code is incomplete".
   c. **Historical Context (Regression Detector)**: For each hunk that DELETES or MODIFIES code, run `git log -S'<deleted snippet>' --oneline --all` to find the commit that introduced it. If the introducing commit message contains `fix`, `security`, `bug`, `regression`, `CVE`, or references a ticket/issue, record a candidate with: deleted snippet, original sha, original message. Do NOT decide whether the removal is justified — output raw candidates only; the verifier in step 5 will decide. Do NOT do general history exploration beyond this regression check.
   d. **Product Contract Sync**: Perform up to three independent checks, each with graceful fallback (skip the check and contribute no issues if the relevant file is absent):
      (1) If the PR modifies `specs/specifications/**/*.md`, check for (a) contradictions between spec content and code behavior, (b) gaps where specs document behavior absent from code or code adds behavior not in specs.
      (2) If `specs/{branch}/spec.md` exists, extract its Acceptance Criteria section only. For each criterion, check whether the diff implements it. Flag unmet or partially met criteria.
      (3) If `specs/{branch}/plan.md` exists and lists planned files (section "Files to modify" or equivalent), compute (changed_files ∩ planned) / changed_files. If the ratio is below 0.7, flag the out-of-scope files.
      Keep the context minimal: load only the sections described above, not the full spec documents.
   e. **Edge Cases & Failure Modes**: Review the diff for inputs, states, or failure paths the author did NOT handle. Look for missing branches when inputs are empty, invalid, partial, out-of-range, duplicated, or filtered to zero; when async updates overlap; or when downstream calls fail. Focus on user-visible inconsistencies, silent data loss, stuck loading/empty/error states, and absent recovery paths. Scope: "what did the author forget to handle?", not "is the written code correct?".
5. For each issue found in #4, launch a parallel Haiku agent that takes the PR, issue description, and list of CLAUDE.md files + constitution.md (from step 2), and returns a score to indicate the agent's level of confidence for whether the issue is real or false positive. To do that, the agent should score each issue on a scale from 0-100, indicating its level of confidence. For issues that were flagged due to CLAUDE.md or constitution instructions, the agent should double check that the CLAUDE.md or constitution actually calls out that issue specifically.

   **Apply category-specific verification before scoring** — use the check matching the issue's source dimension:
   - **Compliance**: verify the cited rule exists verbatim in the referenced CLAUDE.md or constitution. Rule exists and the diff violates it → 90+. Citation is fabricated or paraphrased incorrectly → 0.
   - **Historical Context / regression candidates**: check whether the removal is justified by (a) the PR description, (b) a commit message in this PR, (c) an equivalent call appearing elsewhere in the same diff (grep the diff for the deleted function/call name). Justified by any of those → 0-20. Not justified by any → 80+. Ambiguous → 50-70.
   - **Product Contract Sync unmet criteria**: confirm the cited contract text exists in the relevant specification document and that the diff genuinely does not address it. Confirmed not addressed or contradicted by the diff → 80+. Addressed elsewhere in the diff → 0-20.
   - **Bug Detection**: trace the bug's behavioral path using the diff and the repository references of newly introduced or modified symbols cited in the issue. If you can point to a concrete scenario (input/state → incorrect output, inconsistent UI, wrong count, broken recovery, or failure — or a newly exported symbol that the PR description/spec implies should be wired yet has no call sites) → 80+. If the bug depends on unseen external state beyond those references → 50-70. If you cannot construct a plausible failure scenario → 0-30.
   - **Edge Cases & Failure Modes**: check whether the diff leaves a realistic edge case or failure path with incorrect behavior, inconsistent state, or no recovery path. If you can describe a concrete scenario that is likely in practice and leads to wrong behavior → 80+. If the scenario is plausible but depends on assumptions outside the diff → 50-70. If the edge case is speculative or already handled in the diff → 0-30.

   The scale is (give this rubric to the agent verbatim):
   a. 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
   b. 25: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant CLAUDE.md or constitution.
   c. 50: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the PR, it's not very important.
   d. 75: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach in the PR is insufficient. The issue is very important and will directly impact the code's functionality, or it is an issue that is directly mentioned in the relevant CLAUDE.md or constitution.
   e. 100: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.
5b. **Compute dimension scores post-vote.** For each of the 5 dimensions, compute its `dimensionScore` using the confidence scores from step 5. Start from a base score of 100 and apply penalties for each issue belonging to that dimension, based on the issue's confidence score:
   - Confidence 0-29: 0 pts penalty (false positive, ignore)
   - Confidence 30-59: -1 pt penalty (weak signal)
   - Confidence 60-79: -5 pts penalty (almost real, deserves attention)
   - Confidence 80-89: -8 pts penalty (confirmed moderate bug)
   - Confidence 90-100: -15 pts penalty (confirmed serious bug)
   - Floor the result at 0 (score cannot go negative).
   - If a dimension had zero issues found in step 4, its score is 100.
   - Example: Bug Detection with issues scored at 75, 75, and 0 → `100 - 3 - 3 - 0 = 94`.
6. Filter out any issues with a score less than 70. If there are no issues that meet this criteria, do not proceed.
7. Use a Haiku agent to repeat the eligibility check from #1, to make sure that the pull request is still eligible for code review.
8. Use the gh bash command to comment back on the pull request with the result. When writing your comment, keep in mind to:
   a. Keep your output brief
   b. Avoid emojis
   c. Link and cite relevant code, files, and URLs

Examples of false positives, for steps 4 and 6:

- Pre-existing issues
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues that a linter, typechecker, or compiler would catch (eg. missing or incorrect imports, type errors, broken tests, formatting issues, pedantic style issues like newlines). No need to run these build steps yourself -- it is safe to assume that they will be run separately as part of CI.
- General code quality issues not explicitly mandated by the project's constitution or CLAUDE.md. Mandates in those documents take precedence over this general rule — before dismissing a quality concern, check whether the constitution or CLAUDE.md makes it mandatory.
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

No issues found. Checked for bugs, compliance, product contract alignment, and edge cases.

🤖 Generated with [Claude Code](https://claude.ai/code)

- When linking to code, follow the following format precisely, otherwise the Markdown preview won't render correctly: https://github.com/anthropics/claude-cli-internal/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15
  - Requires full git sha
  - You must provide the full sha. Commands like `https://github.com/owner/repo/blob/$(git rev-parse HEAD)/foo/bar` will not work, since your comment will be directly rendered in Markdown.
  - Repo name must match the repo you're code reviewing
  - # sign after the file name
  - Line range format is L[start]-L[end]
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to `L4-7`)

**Layer Decomposition Output (AIB-879)**: Just **before** the mandatory final quality-score line below, emit a layer-decomposition snapshot of the PR — the in-app PR diff viewer groups files by these semantic layers. This reuses the change understanding you already built (no extra analysis cost):
- Group the PR's changed files into ordered semantic layers, typically by dependency: schema/contracts → business logic → call sites → front-end → tests. Each file belongs to at most one layer.
- Order layers by dependency (`order` 1..N, ascending, unique). Give each a short `id` slug, a `title`, and a one-line `summary`.
- Output exactly one line of plain text (no tool calls, no Bash — just text), on its own line, immediately before the `QUALITY_SCORE_JSON:` line:
  `LAYER_DECOMPOSITION_JSON:{"version":1,"computedAt":"<ISO8601>","layers":[{"id":"foundations","title":"Foundations (schema & contracts)","summary":"<one-line>","order":1,"files":["path/one.ts","path/two.ts"]}]}`
- If decomposition is unavailable or fails, emit **no** `LAYER_DECOMPOSITION_JSON:` line (the viewer falls back to a flat Files list). Never block the review, and never alter the position of the `QUALITY_SCORE_JSON:` line — it MUST remain the absolute-last output.

**MANDATORY final step — Quality Score Output**: After all steps above are complete, compute and output the quality score as your **absolute last output** (no text, summary, or commentary after it). Using the 5 dimension scores computed in step 5b:
- Weighted score: `round(compliance*0.30 + bugDetection*0.30 + productContractSync*0.20 + edgeCasesFailureModes*0.15 + historicalContext*0.05)`
- Threshold: 90-100 = "Excellent", 70-89 = "Good", 50-69 = "Fair", 0-49 = "Poor"
- Output exactly one line of plain text (no tool calls, no Bash — just text):
  `QUALITY_SCORE_JSON:{"version":1,"qualityScore":<score>,"threshold":"<threshold>","dimensions":[{"name":"Compliance","agentId":"compliance","score":<s1>,"weight":0.30,"weightedScore":<s1*0.30>},{"name":"Bug Detection","agentId":"bug-detection","score":<s2>,"weight":0.30,"weightedScore":<s2*0.30>},{"name":"Product Contract Sync","agentId":"product-contract-sync","score":<s4>,"weight":0.20,"weightedScore":<s4*0.20>},{"name":"Edge Cases & Failure Modes","agentId":"edge-cases-failure-modes","score":<s5>,"weight":0.15,"weightedScore":<s5*0.15>},{"name":"Historical Context","agentId":"historical-context","score":<s3>,"weight":0.05,"weightedScore":<s3*0.05>}],"computedAt":"<ISO8601>"}`
