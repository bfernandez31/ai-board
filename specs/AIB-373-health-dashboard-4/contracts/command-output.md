# Command Output Contract

**Branch**: `AIB-373-health-dashboard-4` | **Date**: 2026-03-29

All 4 health scan commands MUST output a single JSON object to stdout with no other text. The workflow parses this output via `jq`.

## Top-Level Wrapper (all commands)

```json
{
  "score": <number 0-100>,
  "issuesFound": <number>,
  "issuesFixed": <number>,
  "report": <ScanReport>,
  "tokensUsed": <number | omit>,
  "costUsd": <number | omit>
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `score` | `number` | Yes | Health score 0-100 (100 = no issues) |
| `issuesFound` | `number` | Yes | Total number of issues detected |
| `issuesFixed` | `number` | Yes | Number of auto-fixed issues (0 for non-test commands) |
| `report` | `object` | Yes | Typed report matching the scan type (see below) |
| `tokensUsed` | `number` | No | Token usage telemetry |
| `costUsd` | `number` | No | Cost telemetry |

## health-security Report

```json
{
  "type": "SECURITY",
  "issues": [
    {
      "id": "sec-001",
      "severity": "high",
      "description": "SQL injection vulnerability in raw query",
      "file": "lib/db/queries.ts",
      "line": 42,
      "category": "injection"
    }
  ],
  "generatedTickets": []
}
```

**Categories**: `injection`, `authentication`, `sensitive-data`, `access-control`, `misconfiguration`, `dependencies`, `cryptography`

## health-compliance Report

```json
{
  "type": "COMPLIANCE",
  "issues": [
    {
      "id": "comp-ts-001",
      "severity": "high",
      "description": "Usage of 'any' type violates strict TypeScript principle",
      "file": "lib/utils/parser.ts",
      "line": 15,
      "category": "TypeScript-First"
    }
  ],
  "generatedTickets": []
}
```

**Categories** (map to constitution principles): `TypeScript-First`, `Component-Driven`, `Test-Driven`, `Security-First`, `Database-Integrity`, `AI-First`

**Severity mapping**:
- `high`: Security-First, Database-Integrity violations
- `medium`: TypeScript-First, Test-Driven, Component-Driven violations
- `low`: AI-First, code style violations

## health-tests Report

```json
{
  "type": "TESTS",
  "autoFixed": [
    {
      "id": "test-fix-001",
      "severity": "medium",
      "description": "Fixed outdated assertion in calculateTotal test",
      "file": "tests/unit/calc.test.ts",
      "line": 25
    }
  ],
  "nonFixable": [
    {
      "id": "test-fail-001",
      "severity": "high",
      "description": "Integration test requires database seed data not present",
      "file": "tests/integration/api.test.ts",
      "line": 10
    }
  ],
  "generatedTickets": []
}
```

**Notes**:
- `issuesFound` = `autoFixed.length + nonFixable.length`
- `issuesFixed` = `autoFixed.length`
- Each auto-fix MUST be committed individually before being listed in `autoFixed`

## health-spec-sync Report

```json
{
  "type": "SPEC_SYNC",
  "specs": [
    {
      "specPath": "specs/specifications/technical/api/endpoints.md",
      "status": "synced"
    },
    {
      "specPath": "specs/specifications/technical/architecture/data-model.md",
      "status": "drifted",
      "drift": "Model 'HealthScore' exists in Prisma schema but is not documented in data-model spec"
    }
  ],
  "generatedTickets": []
}
```

**Notes**:
- `issuesFound` = count of specs with `status: "drifted"`
- `issuesFixed` = 0 (spec-sync never auto-fixes)

## Validation

Reports are validated by `parseScanReport()` in `lib/health/report-schemas.ts` using Zod. Invalid reports are discarded (return `null`), causing the scan to appear as having no report data in the dashboard.

## Consumers

1. **Workflow** (`health-scan.yml`): Extracts `score`, `issuesFound`, `issuesFixed`, `report` via `jq`
2. **Status API** (`PATCH .../status`): Stores `report` as JSON string in `HealthScan.report`
3. **Frontend** (`parseScanReport()`): Parses stored JSON, validates against Zod, renders in drawer
4. **Ticket Creation** (`groupIssuesIntoTickets()`): Groups report issues into remediation tickets
