# Contract: Scan Report JSON Schema

**Type**: Data Contract (HealthScan.report field)
**Producer**: Scan workflows (health-scan.yml)
**Consumer**: Scan Detail Drawer UI

## Overview

The `HealthScan.report` field stores a JSON string that the drawer parses for display. This contract defines the expected shapes per module type.

## Common Structures

### ReportIssue

```json
{
  "id": "sec-001",
  "severity": "high",
  "description": "SQL injection vulnerability in user input handler",
  "file": "app/api/users/route.ts",
  "line": 42,
  "category": "injection"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique issue identifier within the report |
| `severity` | `"high"` \| `"medium"` \| `"low"` | Yes | Issue severity level |
| `description` | string | Yes | Human-readable issue description |
| `file` | string | No | Affected file path (relative to repo root) |
| `line` | number | No | Line number in affected file |
| `category` | string | No | Module-specific grouping key |

### GeneratedTicket

```json
{
  "ticketKey": "AIB-123",
  "stage": "INBOX"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticketKey` | string | Yes | Ticket key in `{KEY}-{NUM}` format |
| `stage` | string | Yes | Current ticket stage |

## Module Report Schemas

### SECURITY

```json
{
  "type": "SECURITY",
  "issues": [
    { "id": "sec-001", "severity": "high", "description": "...", "file": "...", "line": 42 }
  ],
  "generatedTickets": [
    { "ticketKey": "AIB-123", "stage": "INBOX" }
  ]
}
```

**Grouping**: Issues grouped by `severity` (high → medium → low).

### COMPLIANCE

```json
{
  "type": "COMPLIANCE",
  "issues": [
    { "id": "comp-001", "severity": "medium", "description": "...", "category": "TypeScript-First Development" }
  ],
  "generatedTickets": []
}
```

**Grouping**: Issues grouped by `category` (constitution principle name).

### TESTS

```json
{
  "type": "TESTS",
  "autoFixed": [
    { "id": "test-001", "severity": "low", "description": "Fixed failing assertion in..." }
  ],
  "nonFixable": [
    { "id": "test-002", "severity": "high", "description": "Cannot resolve test dependency..." }
  ],
  "generatedTickets": []
}
```

**Grouping**: Two distinct arrays — `autoFixed` and `nonFixable`.

### SPEC_SYNC

```json
{
  "type": "SPEC_SYNC",
  "specs": [
    { "specPath": "specs/AIB-370/spec.md", "status": "synced" },
    { "specPath": "specs/AIB-371/spec.md", "status": "drifted", "drift": "Missing FR-005 implementation" }
  ],
  "generatedTickets": []
}
```

**Grouping**: Specs listed with sync status badges.

### QUALITY_GATE (Passive)

```json
{
  "type": "QUALITY_GATE",
  "dimensions": [
    { "name": "Compliance", "score": 92 },
    { "name": "Bug Detection", "score": 88 },
    { "name": "Code Comments", "score": 75 },
    { "name": "Historical Context", "score": 90 },
    { "name": "Spec Sync", "score": 85 }
  ],
  "recentTickets": [
    { "ticketKey": "AIB-350", "score": 87 },
    { "ticketKey": "AIB-360", "score": 91 }
  ]
}
```

**Display**: Dimension breakdown table + recent SHIP tickets with scores.

### LAST_CLEAN (Passive)

```json
{
  "type": "LAST_CLEAN",
  "filesCleaned": 12,
  "remainingIssues": 3,
  "summary": "Removed unused imports across 12 files. 3 issues require manual intervention."
}
```

**Display**: Summary card with metrics.

## Validation

- All report JSON MUST be validated with Zod schemas at parse time
- Invalid/null reports render a fallback message, never crash the UI
- Legacy scans (pre-structured format) display as: "Report data unavailable — scan predates structured reporting"
