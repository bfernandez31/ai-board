# Health Scan: Spec Sync

You are executing a **specification synchronization health scan** on this repository. Analyze whether implementation code matches its feature specifications.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: If provided, only scan specs impacted by changes between this commit and head-commit (incremental scan)
- `--head-commit <SHA>`: The target commit to scan up to

If `--base-commit` is empty or not provided, perform a **full repository scan**.

## Incremental Scan (when --base-commit is provided)

When `--base-commit` is provided, only check specs impacted by changed files:

1. Get the list of changed files: `git diff --name-only <base-commit>..<head-commit>`
   - If `--head-commit` is not provided, use `HEAD` as the target
2. Discover all spec files under `specs/specifications/` (recursively)
3. For each changed file, determine which discovered spec(s) it relates to based on the spec's content and subject matter (e.g., API-related specs for route changes, data model specs for schema changes, functional specs for component/logic changes)
4. Only evaluate the impacted specs (skip unrelated specs)
5. If `--base-commit` refers to a commit that doesn't exist, report an error issue and fall back to full scan

## What to Scan

### Spec Files to Compare

Dynamically discover all `.md` files under `specs/specifications/` (recursively). For each spec file found, read its content, determine what area of the codebase it documents, and compare against the corresponding implementation:

- **API/endpoint specs** → compare against `app/api/` routes (verify documented routes exist, methods match, request/response shapes align)
- **Schema specs** → compare against Prisma schema and Zod validation schemas (verify documented types match actual types)
- **Data model specs** → compare against `prisma/schema.prisma` (verify documented models, fields, and relationships match actual schema)
- **Functional specs** → compare against component code and API logic (verify documented behaviors are implemented)

Do NOT hardcode specific file paths — the directory structure within `specs/specifications/` may vary between projects.

### Bidirectional Drift Detection

Check drift in **both** directions:

1. **Spec without code** (documented but not implemented):
   - API endpoints described in spec but no corresponding route handler
   - Data model fields in spec but not in Prisma schema
   - Features described in functional specs but no corresponding code

2. **Code without spec** (implemented but not documented):
   - API routes that exist in `app/api/` but are not documented in any discovered spec
   - Prisma schema fields/models not documented in any discovered spec
   - Significant behaviors in code not described in any spec

3. **Behavioral divergence** (both exist but disagree):
   - Route accepts different HTTP methods than documented
   - Response shape differs from documented schema
   - Business logic differs from spec requirements

### Edge Cases

- If no spec files exist in `specs/specifications/`: Report score 100 with empty specs array (nothing to be out of sync)
- If a spec file is empty or malformed: Report it as drifted with a description of the issue

## Score Calculation

Start at 100, reduce proportionally per drifted spec:
- Formula: `score = Math.max(0, Math.round(100 * (1 - driftedCount / totalSpecsChecked)))`
- If no specs are checked, score is 100

## Output Format

You MUST output valid JSON to stdout with this exact structure. Output ONLY the JSON object, no other text.

```json
{
  "score": 75,
  "issuesFound": 2,
  "issuesFixed": 0,
  "report": {
    "type": "SPEC_SYNC",
    "specs": [
      {
        "specPath": "specs/specifications/api/endpoints.md",
        "status": "synced"
      },
      {
        "specPath": "specs/specifications/api/schemas.md",
        "status": "drifted",
        "drift": "Missing documentation for POST /api/health/scans endpoint added in AIB-370"
      },
      {
        "specPath": "specs/specifications/architecture/data-model.md",
        "status": "drifted",
        "drift": "Model 'HealthScore' exists in Prisma schema but is not documented in data-model spec"
      }
    ],
    "generatedTickets": []
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

**Field rules**:
- `specPath`: Relative path from repo root to the spec file
- `status`: `synced` (spec matches code) or `drifted` (spec and code disagree)
- `drift`: Description of the synchronization issue (only when `status` is `drifted`)
- `generatedTickets`: Always `[]` (tickets are created by the workflow after the scan)
- `issuesFound`: Count of specs with `status: "drifted"`
- `issuesFixed`: Always `0` (spec-sync never auto-fixes)
