# Health Scan: Spec Sync

You are executing a **specification synchronization health scan** on this repository. Analyze whether implementation code matches its feature specifications.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: If provided, only scan changes between this commit and head-commit (incremental scan)
- `--head-commit <SHA>`: The target commit to scan up to

If `--base-commit` is empty or not provided, perform a **full repository scan**.

## What to Scan

1. **Read specifications** from `specs/specifications/` (consolidated global specs)
2. **Compare implementation** against spec requirements:
   - API endpoints match documented contracts (schemas, routes, methods)
   - Data models match documented schemas (Prisma schema vs spec data models)
   - UI components implement specified user stories
   - Acceptance criteria are met by existing code
3. **Identify drift** — places where implementation has diverged from spec:
   - New endpoints not documented in specs
   - Spec requirements not yet implemented
   - Behavior changes not reflected in specs

## Output Format

You MUST output valid JSON to stdout with this exact structure:

```json
{
  "score": 80,
  "issuesFound": 3,
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
        "drift": "Missing documentation for POST /api/health/scans endpoint added in AIB-370"
      }
    ],
    "summary": "Brief summary of spec sync findings"
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

- `score`: 0-100 (100 = fully synchronized)
- `status`: "synced" or "drifted"
- `drift`: Description of the synchronization issue (only for drifted specs)
- Output ONLY the JSON object, no other text
