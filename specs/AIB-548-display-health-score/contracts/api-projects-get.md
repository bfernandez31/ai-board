# Contract: GET `/api/projects`

## Purpose

Extend the existing projects list response so each project card receives its health summary as part of the initial payload. This satisfies the no-per-card-fetch requirement for the project list.

## Authentication

- Existing behavior unchanged
- Session cookie or supported authenticated request context required

## Response 200

Each project object keeps its existing fields and adds `healthSummary`.

```json
[
  {
    "id": 12,
    "key": "AIB",
    "name": "AI Board",
    "description": "Project dashboard",
    "githubOwner": "openai",
    "githubRepo": "ai-board",
    "deploymentUrl": "https://ai-board.example.com",
    "updatedAt": "2026-04-07T12:30:00.000Z",
    "ticketCount": 18,
    "lastShippedTicket": {
      "id": 98,
      "ticketKey": "AIB-540",
      "title": "Ship review quality dashboard",
      "updatedAt": "2026-04-06T17:00:00.000Z"
    },
    "healthSummary": {
      "globalScore": 82,
      "label": "Good",
      "color": {
        "text": "text-ctp-blue",
        "bg": "bg-ctp-blue/10",
        "fill": "bg-ctp-blue"
      },
      "subScores": {
        "security": 88,
        "compliance": 91,
        "tests": 74,
        "specSync": 70,
        "qualityGate": 79,
        "reviewQuality": 82
      }
    }
  }
]
```

## Response 200 When No Health Data Exists

```json
[
  {
    "id": 12,
    "key": "AIB",
    "name": "AI Board",
    "description": "Project dashboard",
    "githubOwner": "openai",
    "githubRepo": "ai-board",
    "deploymentUrl": null,
    "updatedAt": "2026-04-07T12:30:00.000Z",
    "ticketCount": 0,
    "lastShippedTicket": null,
    "healthSummary": {
      "globalScore": null,
      "label": "No data yet",
      "color": {
        "text": "text-muted-foreground",
        "bg": "bg-muted",
        "fill": "bg-muted"
      },
      "subScores": {
        "security": null,
        "compliance": null,
        "tests": null,
        "specSync": null,
        "qualityGate": null,
        "reviewQuality": null
      }
    }
  }
]
```

## Field Rules

- `healthSummary.globalScore`
  - Whole number `0-100` or `null`
  - Computed from the same projected sub-scores returned in `healthSummary.subScores`

- `healthSummary.label`
  - `"Excellent"` for `90-100`
  - `"Good"` for `70-89`
  - `"Fair"` for `50-69`
  - `"Poor"` for `0-49`
  - `"No data yet"` when `globalScore` is `null`

- `healthSummary.color`
  - Derived from the existing score color helper
  - Must use complete static class strings, not dynamically constructed class names

- `healthSummary.subScores`
  - Contains exactly six fields: `security`, `compliance`, `tests`, `specSync`, `qualityGate`, `reviewQuality`
  - Each value is a whole number `0-100` or `null`
  - `null` indicates no completed score is currently available
  - `qualityGate` follows the existing passive-module aggregation semantics used by the health dashboard

## Non-Goals

- No active scan state, issue counts, trends, or last-scan timestamps are added to the projects list contract.
- No separate endpoint is introduced for project-card health details.
