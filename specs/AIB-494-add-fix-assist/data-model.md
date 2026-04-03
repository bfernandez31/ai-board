# Data Model: /fix Assist Command

**Branch**: `AIB-494-add-fix-assist` | **Date**: 2026-04-03

## Entities

### ReviewFinding

Represents a single actionable item parsed from a PR review comment. This is a runtime-only entity (not persisted to database) — it exists during command execution to track findings through the fix pipeline.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Sequential ID within the fix run (1-based, used for selective fixing) |
| `source` | `'ai-board' \| 'codex' \| 'copilot'` | Review source (determines priority and filtering rules) |
| `sourceIndex` | `number` | Original finding number within its source (e.g., finding #2 in ai-board review) |
| `filePath` | `string` | Relative path to the affected file |
| `lineStart` | `number \| null` | Start line number (null if not available from source) |
| `lineEnd` | `number \| null` | End line number (null if same as start or not available) |
| `description` | `string` | Finding description/recommendation text |
| `priority` | `'P1' \| 'P2' \| null` | Priority badge (Codex only; null for ai-board and Copilot) |
| `permalinkUrl` | `string \| null` | GitHub permalink to the code location (ai-board only) |
| `rawComment` | `string` | Original comment text for context |

### FindingResolution

Tracks the outcome of processing each finding. Runtime-only entity used to generate the summary comment.

| Field | Type | Description |
|-------|------|-------------|
| `findingId` | `number` | References `ReviewFinding.id` |
| `status` | `'fixed' \| 'rejected' \| 'skipped' \| 'conflict' \| 'not_found'` | Resolution outcome |
| `reason` | `string \| null` | Explanation when status is not `fixed` (e.g., "documentation nitpick", "duplicate of #1", "conflict with higher-priority fix") |
| `filesModified` | `string[]` | Files changed to address this finding |
| `specFilesUpdated` | `string[]` | Spec files updated due to contract contradiction |

### FixResult

Aggregate outcome of the entire fix run. Used to generate the result file and summary comment.

| Field | Type | Description |
|-------|------|-------------|
| `status` | `'SUCCESS' \| 'ERROR' \| 'NO_FINDINGS'` | Overall result |
| `findings` | `ReviewFinding[]` | All parsed findings |
| `resolutions` | `FindingResolution[]` | Resolution for each finding |
| `fixedCount` | `number` | Count of findings with status `fixed` |
| `specsUpdatedCount` | `number` | Count of unique spec files updated |
| `rejectedCount` | `number` | Count of findings with status `rejected` |
| `commitSha` | `string \| null` | SHA of the fix commit (null if no fixes applied) |
| `errorMessage` | `string \| null` | Error description if status is `ERROR` |

## State Transitions

### Finding Processing Pipeline

```
Raw Comment → [Parse] → ReviewFinding → [Deduplicate] → ReviewFinding (unique)
  → [Filter Pertinence] → ReviewFinding (pertinent) | FindingResolution (rejected)
  → [Apply Fix] → FindingResolution (fixed) | FindingResolution (conflict/skipped)
  → [Check Spec] → FindingResolution (specFilesUpdated populated)
```

### Resolution Status Transitions

| From | To | Trigger |
|------|----|---------|
| (new) | `rejected` | Pertinence filter rejects finding (Codex/Copilot only) |
| (new) | `rejected` | Finding is duplicate of higher-priority source |
| (new) | `not_found` | Selective fix requested finding ID that doesn't exist |
| (new) | `skipped` | Selective fix mode — finding not in requested set |
| (new) | `fixed` | Code fix successfully applied |
| (new) | `conflict` | Fix conflicts with already-applied higher-priority fix |

## Relationships

```
FixResult 1──* ReviewFinding    (findings)
FixResult 1──* FindingResolution (resolutions)
FindingResolution *──1 ReviewFinding (via findingId)
```

## Existing Database Entities Used (no changes)

| Entity | Usage |
|--------|-------|
| `Job` | Created with `command: "fix"` via existing job creation API; status tracked via job state machine |
| `Ticket` | Parent entity; provides `branch`, `stage` for validation |
| `Comment` | `/fix` command posted as comment; result posted as ai-board comment |
| `Project` | Provides `githubRepository` for API access |

## Validation Rules

- `ReviewFinding.source` must be one of the three recognized sources
- `ReviewFinding.filePath` must be a valid relative path within the repository
- `FindingResolution.reason` is required when `status` is not `fixed`
- `FixResult.commitSha` is null only when no fixes were applied
- When selective fix mode is used, findings not in the requested set get `status: 'skipped'`
