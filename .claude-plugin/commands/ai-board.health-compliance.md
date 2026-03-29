# Health Scan: Compliance

You are executing a **compliance health scan** on this repository. Dynamically read the project's constitution and evaluate the codebase against each declared principle.

## Arguments

Arguments are passed inline after the command name:
- `--base-commit <SHA>`: Optional. If provided, run an **incremental scan** — use `git diff <base-commit>..HEAD` to identify changed files and limit analysis to those files only.
- `--head-commit <SHA>`: Optional. The target commit reference.

If `--base-commit` is **not provided or empty**, perform a **full repository scan** of all source files.

**Edge case — base-commit not found**: If the provided `--base-commit` SHA does not exist in the repository (git rev-parse fails), **fall back to a full repository scan** and include a note in the report summary: "baseCommit not found, performed full scan".

## Constitution Discovery

Read the project's constitution by checking these paths **in order** (use the first one found):

1. `.ai-board/memory/constitution.md`
2. `.claude-plugin/memory/constitution.md`
3. `CLAUDE.md`

**Edge case — no constitution found**: If none of these files exist, return immediately with:
- `score: 0`
- Empty `issues` array
- Summary: "No constitution found — cannot evaluate compliance. Checked: .ai-board/memory/constitution.md, .claude-plugin/memory/constitution.md, CLAUDE.md"

## What to Scan

After loading the constitution, extract each declared principle and evaluate the codebase against it. For each principle:

1. **Identify** the principle's name and requirements
2. **Search** the codebase for code that relates to the principle
3. **Evaluate** compliance as one of:
   - **pass**: Code fully complies with the principle (no violations found)
   - **partial**: Some code complies but violations exist
   - **fail**: Significant non-compliance detected
4. **Record violations** as issues with the principle name as the `category`

**Edge case — principle with no corresponding code**: If a principle references patterns/behaviors that have no corresponding code in the repository (e.g., a database principle in a project with no database), mark it as **pass** (no violations detected).

**Edge case — full compliance**: If all principles pass with no violations, return score 100, empty issues array, and summary noting full compliance with all principles.

## Score Calculation

Calculate the score using this formula:

```
score = ((pass_count + partial_count * 0.5) / total_count) * 100
```

Where:
- `pass_count` = number of principles with **pass** status
- `partial_count` = number of principles with **partial** status (each counts as half a pass)
- `total_count` = total number of principles evaluated
- Round to the nearest integer
- If `total_count` is 0, return score 100

This formula is normalized to the number of principles (consistent with health-tests and health-spec-sync scoring) and scales proportionally regardless of how many principles a project defines.

## Output Format

You **MUST** output **ONLY** valid JSON to stdout. No other text, logs, markdown formatting, or code fences.

The JSON object must have this **exact** structure:

```json
{
  "score": 90,
  "issuesFound": 2,
  "issuesFixed": 0,
  "report": {
    "issues": [
      {
        "category": "TypeScript-First",
        "file": "lib/utils/parser.ts",
        "line": 15,
        "description": "Usage of 'any' type violates strict TypeScript principle — use a specific type or 'unknown'"
      }
    ],
    "summary": "Evaluated 6 principles: 4 pass, 1 partial, 1 fail. Key violation: 'any' types in utility files."
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

### Field Requirements

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `score` | `number` | Yes | 0-100 integer, calculated per formula above |
| `issuesFound` | `number` | Yes | Must equal `report.issues.length` |
| `issuesFixed` | `number` | Yes | Always `0` for compliance scans |
| `report.issues` | `array` | Yes | List of ComplianceIssue objects |
| `report.issues[].category` | `string` | Yes | Constitution principle name being violated |
| `report.issues[].file` | `string` | Yes | File path relative to repository root |
| `report.issues[].line` | `number` | Yes | Positive integer line number |
| `report.issues[].description` | `string` | Yes | What violates the principle and how to fix it |
| `report.summary` | `string` | Yes | Brief summary with per-principle pass/partial/fail counts |
| `tokensUsed` | `number` | Yes | Tokens consumed (0 if unknown) |
| `costUsd` | `number` | Yes | Cost in USD (0 if unknown) |

**CRITICAL**: Output ONLY the JSON object. No explanatory text before or after.
