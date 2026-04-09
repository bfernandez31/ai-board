# Data Model: Generic Health Tests

## Overview

This feature reuses existing persisted entities. No Prisma migration is required. The functional data change is an expanded shape inside `Project.config` plus new allowed semantics for `HealthScan` rows of type `TESTS`.

## Entities

### 1. Project Configuration

**Backing field**: `Project.config` (`prisma/schema.prisma:69-96`)

**Purpose**: Stores the sanitized, validated workflow configuration that ai-board reads after config sync.

**Relevant fields**:

| Field | Type | Notes |
|------|------|------|
| `version` | literal `1` | Existing schema version |
| `project.name` | string | Existing required field |
| `project.language` | enum/null | Existing detected language |
| `project.framework` | enum | Existing detected framework |
| `runtime.manager` | enum | Existing package/runtime manager |
| `services[]` | array | Existing service provisioning inputs |
| `commands.install` | string | Existing required command |
| `commands.lint` | string optional | Existing optional field; now populated by detection when confident |
| `commands.type_check` | string optional | Existing optional field; now populated by detection when confident |
| `commands.test_unit` | string optional | Existing optional field; now populated by detection when confident |
| `commands.test_integration` | string optional | Existing optional field; now populated by detection when confident |
| `commands.test_e2e` | string optional | Existing optional field; now populated by detection when confident |
| `testCapabilities.framework` | string/null | New logical field proposed for config to persist detected framework classification |
| `testCapabilities.hasE2E` | boolean/null | New logical field proposed for config to persist E2E coverage signal |
| `testCapabilities.primaryCommandKey` | enum/null | New logical field identifying which configured test command the generic TESTS scan should run first |

**Validation rules**:
- Config remains versioned and strict under Zod
- Command strings remain optional except `install`
- Test capability fields must be derived from deterministic evidence only; ambiguous values remain null/absent
- No credentials or env secrets are stored in `Project.config`

### 2. Test Capability Profile

**Backing location**: Sanitized configuration stored inside `Project.config`

**Purpose**: Represents what the repository can run for automated tests and related quality checks.

**Fields**:

| Field | Type | Meaning |
|------|------|---------|
| `framework` | nullable enum/string | Detected test framework such as `vitest`, `jest`, `pytest`, `cargo-test` |
| `primaryCommandKey` | nullable enum | The preferred test command key among `test_unit`, `test_integration`, `test_e2e` |
| `hasE2E` | nullable boolean | Whether the repo advertises E2E coverage |
| `lintCommandPresent` | boolean | Derived from `commands.lint` |
| `typeCheckCommandPresent` | boolean | Derived from `commands.type_check` |

**State rules**:
- `primaryCommandKey = null` means TESTS scan cannot execute and must skip
- `hasE2E = false` is informational only and must not cause failure

### 3. HealthScan (`scanType = TESTS`)

**Backing model**: `HealthScan` (`prisma/schema.prisma:502-539`)

**Purpose**: Persists the lifecycle and result of a single test scan run.

**Relevant fields**:

| Field | Type | Notes |
|------|------|------|
| `scanType` | enum | Must be `TESTS` for this feature |
| `status` | enum | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED` |
| `score` | int nullable | First-run score for completed scans; null for skipped/failed |
| `report` | string nullable | Serialized `TestsReport` JSON, optionally augmented with skip metadata at the envelope/persistence layer |
| `issuesFound` | int nullable | Count of auto-fixed + non-fixable issues for executed runs |
| `issuesFixed` | int nullable | Count of auto-fixed issues |
| `errorMessage` | string nullable | Failure details for orchestration errors |
| `startedAt` / `completedAt` | datetime nullable | Execution timestamps |

**Validation rules**:
- `COMPLETED` requires a score
- `SKIPPED` must not persist a score
- `skipReason` is required whenever the scan skips
- `HealthScore.testsScore` is updated only on `COMPLETED`, never on `SKIPPED`

### 4. TESTS Health Scan Result

**Backing artifacts**:
- `/tmp/health-scan-result.json` workflow envelope
- `report` field inside `HealthScan`

**Workflow envelope fields**:

| Field | Type | Meaning |
|------|------|---------|
| `score` | number/null | First-run score, null for skipped |
| `issuesFound` | number | Count of identified issues |
| `issuesFixed` | number | Count of auto-fixed issues |
| `report` | `TestsReport` | Stored report payload |
| `skipped` | boolean optional | Indicates no runnable command was available |
| `skipReason` | string optional | Human-readable skip reason |

**Report body fields**:

| Field | Type | Meaning |
|------|------|---------|
| `type` | literal `TESTS` | Discriminator |
| `autoFixed[]` | issue array | Fixed test problems |
| `nonFixable[]` | issue array | Remaining issues after retries |
| `generatedTickets[]` | array | Remediation ticket references |

## State Transitions

### TESTS scan lifecycle

```text
PENDING -> RUNNING -> COMPLETED
PENDING -> RUNNING -> FAILED
PENDING -> RUNNING -> SKIPPED
```

Rules:
- `RUNNING -> SKIPPED` is valid when no runnable automated test command exists
- `SKIPPED` is terminal
- `SKIPPED` preserves the prior `HealthScore.testsScore`
- `COMPLETED` recalculates aggregates using the existing global-score logic
