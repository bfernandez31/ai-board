# Data Model: Health Scan Commands

**Branch**: `AIB-378-copy-of-health` | **Date**: 2026-03-29

## Overview

The health scan commands do not introduce new database models. They produce JSON output that flows through existing models (`HealthScan`, `HealthScore`, `Ticket`) via the workflow. This document defines the **output data structures** each command produces.

## Entities

### ScanCommandOutput (all commands)

The top-level JSON object every command must produce on stdout.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `score` | `number` | Yes | Health score 0-100 (100 = no issues) |
| `issuesFound` | `number` | Yes | Total issues detected |
| `issuesFixed` | `number` | Yes | Issues auto-fixed (0 for non-test scans) |
| `report` | `object` | Yes | Scan-specific report payload (see below) |
| `tokensUsed` | `number` | Yes | Tokens consumed during scan (0 if unknown) |
| `costUsd` | `number` | Yes | Cost in USD (0 if unknown) |

### SecurityReportPayload (health-security)

The `report` field for security scans.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issues` | `SecurityIssue[]` | Yes | List of security findings |
| `summary` | `string` | Yes | Brief summary of findings |

#### SecurityIssue

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `severity` | `"high" \| "medium" \| "low"` | Yes | Issue severity |
| `file` | `string` | Yes | Affected file path |
| `line` | `number` | Yes | Line number of the issue |
| `description` | `string` | Yes | What the vulnerability is |
| `category` | `string` | Yes | OWASP category (e.g., "injection", "authentication") |

### ComplianceReportPayload (health-compliance)

The `report` field for compliance scans.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issues` | `ComplianceIssue[]` | Yes | List of compliance violations |
| `summary` | `string` | Yes | Brief summary of findings |

#### ComplianceIssue

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | `string` | Yes | Constitution principle violated |
| `file` | `string` | Yes | Affected file path |
| `line` | `number` | Yes | Line number of violation |
| `description` | `string` | Yes | What violates the principle |

### TestsReportPayload (health-tests)

The `report` field for test scans.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issues` | `TestIssue[]` | Yes | Tests that were auto-fixed |
| `nonFixable` | `NonFixableTest[]` | Yes | Tests that could not be fixed |
| `summary` | `string` | Yes | Brief summary of test health |

#### TestIssue (auto-fixed)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `string` | Yes | Test file path |
| `description` | `string` | Yes | What was wrong and how it was fixed |
| `status` | `"fixed"` | Yes | Always "fixed" for this array |

#### NonFixableTest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `string` | Yes | Test file path |
| `description` | `string` | Yes | What the failure is |
| `reason` | `string` | Yes | Why auto-fix was not possible |

### SpecSyncReportPayload (health-spec-sync)

The `report` field for spec sync scans.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `specs` | `SpecSyncEntry[]` | Yes | Per-spec synchronization status |
| `summary` | `string` | Yes | Brief summary of sync findings |

#### SpecSyncEntry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `specPath` | `string` | Yes | Path to the spec file |
| `status` | `"synced" \| "drifted"` | Yes | Sync status |
| `drift` | `string` | No | Description of drift (only when drifted) |

## Mapping to Existing Types

The workflow transforms command output into the existing `ScanReport` types in `lib/health/types.ts`:

| Command Output | → | Stored Report Type | Transformation |
|---------------|---|-------------------|----------------|
| SecurityReportPayload | → | `SecurityReport` | Add `type: 'SECURITY'`, add `id` to each issue, add `generatedTickets` (severity already lowercase) |
| ComplianceReportPayload | → | `ComplianceReport` | Add `type: 'COMPLIANCE'`, add `severity` from category mapping, add `id`, add `generatedTickets` |
| TestsReportPayload | → | `TestsReport` | Add `type: 'TESTS'`, map `issues` → `autoFixed`, keep `nonFixable`, add `id`/`severity`, add `generatedTickets` |
| SpecSyncReportPayload | → | `SpecSyncReport` | Add `type: 'SPEC_SYNC'`, pass `specs` through, add `generatedTickets` |

## Validation Rules

- `score` must be integer 0-100
- `issuesFound` must equal total issue count across all arrays
- `issuesFixed` must equal length of auto-fixed array (tests) or 0 (others)
- All file paths must be relative to repository root
- Line numbers must be positive integers
- Severity values are case-sensitive (lowercase in command output, matching Zod schema)

## State Transitions

No state transitions — commands are stateless. The workflow manages `HealthScan.status` transitions (`PENDING → RUNNING → COMPLETED/FAILED`).
