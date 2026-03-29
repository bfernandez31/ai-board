# Health Scan: Spec Sync

You are executing a **specification synchronization health scan** on this repository. Compare consolidated specifications against the actual implementation and identify drift.

## Arguments

Arguments are passed inline after the command name:
- `--base-commit <SHA>`: Optional. If provided, run an **incremental scan** — use `git diff <base-commit>..HEAD` to identify changed files, then determine which specs are impacted by those changes and only evaluate those specs.
- `--head-commit <SHA>`: Optional. The target commit reference.

If `--base-commit` is **not provided or empty**, perform a **full comparison** of all specs against the codebase.

**Edge case — base-commit not found**: If the provided `--base-commit` SHA does not exist in the repository (git rev-parse fails), **fall back to a full scan** and include a note in the report summary: "baseCommit not found, performed full scan".

## What to Scan

1. **Read specifications** from `specs/specifications/` directory (consolidated global specs)
2. **For each spec file**, extract the declared:
   - API endpoints (routes, methods, request/response schemas)
   - Data models (entities, fields, relationships)
   - UI components and behaviors
   - Acceptance criteria and business rules
3. **Search the codebase** for corresponding implementations
4. **Detect drift in both directions** (FR-013):
   - **Spec → Code**: Features specified in a spec but absent or modified in the codebase (unimplemented or diverged)
   - **Code → Spec**: Significant code features/endpoints not covered by any spec (undocumented)
5. **Determine status** for each spec:
   - `"synced"`: Implementation matches the spec
   - `"drifted"`: Implementation differs from or is missing relative to the spec

**Edge case — no specs directory**: If `specs/specifications/` does not exist or is empty, return:
- `score: 100`
- Empty `specs` array
- Summary: "No specifications found in specs/specifications/ — nothing to compare"

**Edge case — all specs synced**: Return score 100 with all specs marked as `"synced"`.

## Score Calculation

Calculate the score using this formula:

```
score = (synced_count / total_count) * 100
```

Where:
- `synced_count` = number of specs with status `"synced"`
- `total_count` = total number of spec files evaluated
- Round to nearest integer

## Output Format

You **MUST** output **ONLY** valid JSON to stdout. No other text, logs, markdown formatting, or code fences.

The JSON object must have this **exact** structure:

```json
{
  "score": 80,
  "issuesFound": 1,
  "issuesFixed": 0,
  "report": {
    "specs": [
      {
        "specPath": "specs/specifications/endpoints.md",
        "status": "synced"
      },
      {
        "specPath": "specs/specifications/schemas.md",
        "status": "drifted",
        "drift": "POST /api/health/scans endpoint exists in code but is not documented in the spec"
      }
    ],
    "summary": "Evaluated 5 specs: 4 synced, 1 drifted. Key drift: undocumented health scan endpoint."
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

### Field Requirements

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `score` | `number` | Yes | 0-100 integer, calculated per formula above |
| `issuesFound` | `number` | Yes | Must equal count of specs with `status: "drifted"` |
| `issuesFixed` | `number` | Yes | Always `0` for spec-sync scans |
| `report.specs` | `array` | Yes | List of SpecSyncEntry objects |
| `report.specs[].specPath` | `string` | Yes | Path to the spec file relative to repository root |
| `report.specs[].status` | `string` | Yes | `"synced"` or `"drifted"` |
| `report.specs[].drift` | `string` | No | Description of the drift (only when `status` is `"drifted"`) |
| `report.summary` | `string` | Yes | Brief summary with synced/drifted counts |
| `tokensUsed` | `number` | Yes | Tokens consumed (0 if unknown) |
| `costUsd` | `number` | Yes | Cost in USD (0 if unknown) |

**CRITICAL**: Output ONLY the JSON object. No explanatory text before or after.
