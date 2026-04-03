# API Contracts: Health Scan — Review Quality Analysis

**Ticket**: AIB-497
**Date**: 2026-04-03

---

## Modified Endpoints

### GET /api/projects/{projectId}/health

**Change**: Add `reviewQuality` module to `modules` response object.

```jsonc
{
  "modules": {
    // ... existing modules ...
    "reviewQuality": {
      "score": 72,                    // or null if never scanned
      "label": "Good",               // or null
      "lastScanDate": "2026-04-03T00:30:00Z",
      "scanStatus": "COMPLETED",
      "issuesFound": 8,
      "passive": false,
      "summary": "8 missed findings across 3 PRs",
      "trend": "up",
      "trendDelta": 5,
      "distribution": { "excellent": 2, "good": 5, "fair": 1, "poor": 0 }
    }
  }
}
```

### POST /api/projects/{projectId}/health/scans

**Change**: Accept `"REVIEW_QUALITY"` as valid `scanType` value.

```jsonc
// Request
{ "scanType": "REVIEW_QUALITY" }

// Response (201) — unchanged shape
{
  "id": 42,
  "scanType": "REVIEW_QUALITY",
  "status": "PENDING",
  "createdAt": "2026-04-03T00:30:00Z"
}
```

### PATCH /api/projects/{projectId}/health/scans/{scanId}/status

**Change**: Accept `REVIEW_QUALITY` report JSON in `report` field.

```jsonc
// Request — workflow reports results
{
  "status": "COMPLETED",
  "score": 72,
  "issuesFound": 8,
  "issuesFixed": 0,
  "durationMs": 45000,
  "tokensUsed": 12000,
  "costUsd": 0.36,
  "report": {
    "type": "REVIEW_QUALITY",
    "summary": {
      "prsAnalyzed": 3,
      "totalMissedFindings": 8,
      "coverageScore": 72,
      "scoreBreakdown": {
        "base": 100,
        "highPenalty": -15,
        "mediumPenalty": -8,
        "lowPenalty": -6
      }
    },
    "missedFindings": [
      {
        "id": "f1a2b3c4",
        "prNumber": 360,
        "source": "codex",
        "category": "error-handling",
        "severity": "high",
        "description": "Missing error boundary for async state update",
        "file": "src/components/dashboard.tsx",
        "line": 142,
        "sourceCommentUrl": "https://github.com/org/repo/pull/360#discussion_r123"
      }
    ],
    "cumulativeAnalysis": {
      "windowDays": 30,
      "reportsAnalyzed": 5,
      "recurringPatterns": [
        {
          "category": "error-handling",
          "occurrences": 4,
          "prNumbers": [355, 358, 360, 362],
          "suggestedRule": "All async operations in React components must be wrapped in error boundaries",
          "target": "constitution",
          "alreadyTicketed": false
        }
      ]
    },
    "generatedTickets": [
      { "ticketKey": "AIB-501", "stage": "INBOX" }
    ]
  }
}
```

### GET /api/projects/{projectId}/health/scans

**Change**: Accept `"REVIEW_QUALITY"` as `type` query parameter filter.

```
GET /api/projects/3/health/scans?type=REVIEW_QUALITY&limit=10&includeReport=true
```

### GET /api/projects/{projectId}/health/trends

**Change**: Include `REVIEW_QUALITY` key in trends response.

```jsonc
{
  "trends": {
    // ... existing types ...
    "REVIEW_QUALITY": [
      { "date": "2026-03-20", "score": 65 },
      { "date": "2026-03-27", "score": 72 },
      { "date": "2026-04-03", "score": 78 }
    ]
  }
}
```

---

## Generated Ticket Contract

Tickets created for recurring patterns via `POST /api/projects/{projectId}/tickets`:

```jsonc
{
  "title": "[Review Gap] Add rule for error handling",  // max 100 chars
  "description": "Health scan detected a recurring review gap pattern...\n\n**Category**: error-handling\n**Occurrences**: 4 PRs (#355, #358, #360, #362)\n\n**Evidence**:\n- PR #355: Missing try-catch in async handler\n- PR #358: Unhandled promise rejection\n...\n\n**Suggested Rule**:\n> All async operations in React components must be wrapped in error boundaries\n\n**Target**: constitution",
  "stage": "INBOX",
  "workflowType": "QUICK"
}
```

---

## Scan Command Contract

The Claude command `ai-board.health-review-quality` receives these inputs via environment:

| Input | Source | Description |
|-------|--------|-------------|
| `INPUT_SCAN_ID` | Workflow env | Health scan record ID |
| `INPUT_PROJECT_ID` | Workflow env | Project ID |
| `INPUT_SCAN_TYPE` | Workflow env | Always `REVIEW_QUALITY` |
| `APP_URL` | Workflow env | Base URL for API calls |
| `WORKFLOW_API_TOKEN` | Workflow secret | Auth token for API calls |
| `GITHUB_TOKEN` | Workflow env | Token for GitHub API (PR comments) |

**Output**: JSON to `/tmp/health-scan-result.json` matching the PATCH status endpoint contract above.
