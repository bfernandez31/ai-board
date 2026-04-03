# Health Scan: Review Quality

You are a **senior code review analyst** executing a review quality health scan. Analyze merged PRs to identify review gaps — issues caught by external reviewers (Codex, Copilot) that ai-board's custom review missed — and produce a structured JSON report.

## Inputs

Environment variables (set by the workflow):
- `INPUT_SCAN_ID`: Health scan record ID
- `INPUT_PROJECT_ID`: Project ID
- `INPUT_SCAN_TYPE`: Always `REVIEW_QUALITY`
- `APP_URL`: Base URL for API calls
- `WORKFLOW_API_TOKEN`: Auth token for API calls
- `GITHUB_TOKEN`: Token for GitHub API (PR comments)

## Execution Steps

### Step 1 — PR Discovery

1. Query the ai-board API for tickets with FULL workflow in SHIP stage:
   ```bash
   curl -s "${APP_URL}/api/projects/${INPUT_PROJECT_ID}/tickets?stage=SHIP&workflowType=FULL" \
     -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}"
   ```
2. For each ticket's branch, use GitHub API to find the merged PR
3. Determine the last REVIEW_QUALITY scan timestamp by querying:
   ```bash
   curl -s "${APP_URL}/api/projects/${INPUT_PROJECT_ID}/health/scans?type=REVIEW_QUALITY&limit=1&status=COMPLETED" \
     -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}"
   ```
4. Filter to PRs merged AFTER the last scan timestamp
5. If no qualifying PRs found, write an empty report and exit

### Step 2 — Comment Collection (per PR)

For each qualifying PR, collect review comments from three sources:

**Source 1: ai-board custom review**
- Fetch issue comments: `GET /repos/{owner}/{repo}/issues/{pr_number}/comments`
- Filter for comments containing `### Code review`
- Parse each section into individual findings with file/line references

**Source 2: Codex bot**
- Fetch review comments: `GET /repos/{owner}/{repo}/pulls/{pr_number}/comments`
- Filter by author: `chatgpt-codex-connector[bot]`
- Each comment has `path` and `line` from the GitHub API

**Source 3: Copilot bot**
- Fetch review comments: `GET /repos/{owner}/{repo}/pulls/{pr_number}/comments`
- Filter by author: `Copilot`
- Each comment has `path` and `line` from the GitHub API

### Step 3 — Cross-Referencing

For each Codex/Copilot finding with file+line:
1. Check if ai-board has a finding on the SAME file within +/-5 lines
2. If no match found = **missed finding**
3. Filter out (do NOT include in missed findings):
   - Doc/spec staleness issues (comments about outdated docs, README, spec files)
   - Issues that TypeScript or ESLint would catch (type errors, lint violations)
   - Duplicate findings across Codex and Copilot (same file + overlapping line range within 5 lines — keep only one)

### Step 4 — Classification

Assign each missed finding a category from these 9:
- `state-lifecycle`: React state management, component lifecycle issues
- `edge-case-validation`: Missing input validation, boundary conditions
- `test-quality`: Insufficient test coverage, weak assertions
- `error-handling`: Missing try-catch, unhandled rejections, error boundaries
- `ui-ux-state`: Loading/empty/error states, accessibility
- `ci-workflow`: Build/deploy/CI configuration issues
- `api-contract`: Request/response shape mismatches, missing validation
- `security`: Auth, injection, secrets exposure
- `performance`: N+1 queries, unnecessary re-renders, memory leaks

### Step 5 — Severity Assessment

Assess each missed finding's severity based on runtime impact:
- **high**: Could cause data loss, security vulnerability, or crash in production
- **medium**: Could cause incorrect behavior, poor UX, or performance degradation
- **low**: Code quality issue, missing optimization, or minor edge case

### Step 6 — Coverage Scoring

Calculate the coverage score:
```
coverageScore = max(0, 100 - (highCount * 15) - (mediumCount * 8) - (lowCount * 3))
```

### Step 7 — Cumulative Analysis (30-day window)

1. Fetch the last 30 days of REVIEW_QUALITY scan reports:
   ```bash
   curl -s "${APP_URL}/api/projects/${INPUT_PROJECT_ID}/health/scans?type=REVIEW_QUALITY&limit=30&includeReport=true" \
     -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}"
   ```
2. Parse each report's `missedFindings` and aggregate by category across DISTINCT PRs
3. Flag categories with 3+ distinct PR occurrences as **recurring patterns**
4. For each recurring pattern:
   - Generate a suggested rule (one sentence, actionable)
   - Determine target: `constitution` (for architectural/design patterns) or `review-prompt` (for code-level checks)
5. Check for existing `[Review Gap]` tickets to avoid duplicates:
   ```bash
   curl -s "${APP_URL}/api/projects/${INPUT_PROJECT_ID}/tickets?search=[Review Gap]" \
     -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}"
   ```
6. Set `alreadyTicketed: true` and include `ticketKey` for patterns with existing tickets

### Step 8 — Output

Write the structured JSON report to `/tmp/health-scan-result.json`:

```json
{
  "score": <coverageScore>,
  "issuesFound": <totalMissedFindings>,
  "issuesFixed": 0,
  "report": {
    "type": "REVIEW_QUALITY",
    "summary": {
      "prsAnalyzed": <number>,
      "totalMissedFindings": <number>,
      "coverageScore": <number>,
      "scoreBreakdown": {
        "base": 100,
        "highPenalty": <negative number>,
        "mediumPenalty": <negative number>,
        "lowPenalty": <negative number>
      }
    },
    "missedFindings": [
      {
        "id": "<uuid>",
        "prNumber": <number>,
        "source": "codex" | "copilot",
        "category": "<one of 9 categories>",
        "severity": "high" | "medium" | "low",
        "description": "<what the reviewer flagged>",
        "file": "<file path>",
        "line": <line number>,
        "sourceCommentUrl": "<link to GitHub comment>"
      }
    ],
    "cumulativeAnalysis": {
      "windowDays": 30,
      "reportsAnalyzed": <number>,
      "recurringPatterns": [
        {
          "category": "<category>",
          "occurrences": <number >= 3>,
          "prNumbers": [<pr numbers>],
          "suggestedRule": "<actionable rule>",
          "target": "constitution" | "review-prompt",
          "alreadyTicketed": <boolean>,
          "ticketKey": "<optional ticket key>"
        }
      ]
    },
    "generatedTickets": []
  }
}
```

**IMPORTANT**: The `generatedTickets` array should be empty — ticket creation is handled by the workflow's remediation step, not by this command.

## Edge Cases

- **No qualifying PRs**: Write report with `prsAnalyzed: 0`, `coverageScore: 100`, empty arrays. Set `score: 100` in the top-level result.
- **PR has no review comments from any source**: Report zero missed findings for that PR.
- **Rate limiting**: Process PRs sequentially. If rate-limited, report partial results with available data.
- **Ambiguous comments (no file/line)**: Exclude from cross-referencing, log for diagnostics.
- **Malformed historical reports**: Skip in cumulative aggregation, proceed with available reports.
- **Multiple issues in one `### Code review` section**: Treat each distinct issue as a separate finding.
