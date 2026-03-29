# Health Scan: Spec Sync

You are a **senior technical writer** executing a specification synchronization health scan on this repository. Analyze whether implementation code matches its feature specifications and produce a structured JSON report.

**This is NOT a documentation generator.** You compare existing specs against existing code to detect drift — nothing more.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: If provided, only scan specs impacted by changes between this commit and head-commit (incremental scan)
- `--head-commit <SHA>`: The target commit to scan up to

If `--base-commit` is empty or not provided, perform a **full repository scan**.

## Analysis Methodology

### Phase 1 — Project Context Discovery

Before scanning for drift, understand the project:

1. **Read `CLAUDE.md`** at the project root to understand the tech stack, directory structure, key architecture decisions, and where code lives
2. **Read any project constitution** (`.ai-board/memory/constitution.md` or `.claude-plugin/memory/constitution.md`) for additional context
3. **Identify the implementation structure** — where route handlers, models/schemas, components, and business logic live in this specific project

### Phase 2 — Spec Discovery

Discover all `.md` files under `specs/specifications/` recursively. Each project may organize this directory differently (flat files, subdirectories by domain, functional vs technical split, etc.).

For each spec file found:
1. **Read its content** to understand what area of the codebase it documents
2. **Classify its subject** — does it describe API endpoints, data models, UI behavior, architecture, schemas, workflows, or something else?
3. **Map it to implementation files** — based on the spec's content and the project structure discovered in Phase 1, identify which source files correspond to this spec

### Phase 3 — Drift Detection

For each spec-to-code mapping, check for drift in **both directions**:

#### Spec without code (documented but not implemented)
- Endpoints, routes, or handlers described in spec but absent from the codebase
- Data model fields or entities in spec but not in the actual schema/ORM
- Features or behaviors described in spec but no corresponding implementation

#### Code without spec (implemented but not documented)
- Routes, handlers, or APIs that exist in code but are not described in any discovered spec
- Schema fields, models, or entities not reflected in any spec
- Significant behaviors or features in code with no spec coverage

#### Behavioral divergence (both exist but disagree)
- Route accepts different methods, parameters, or returns different shapes than documented
- Data model has fields, types, or relationships that differ from the spec
- Business logic or workflow differs from spec requirements

### Incremental Scan (when --base-commit is provided)

When `--base-commit` is provided, narrow the scan scope:

1. Get the list of changed files: `git diff --name-only <base-commit>..<head-commit>`
   - If `--head-commit` is not provided, use `HEAD` as the target
2. For each changed file, determine which discovered spec(s) it relates to (based on the Phase 2 mapping)
3. Also check if any spec files themselves were changed
4. Only evaluate impacted specs (skip unrelated ones)
5. If `--base-commit` refers to a commit that doesn't exist, report an error issue and fall back to full scan

## Edge Cases

- **No spec files** in `specs/specifications/`: Report score 100 with empty specs array (nothing to be out of sync)
- **Empty or malformed spec**: Report it as drifted with a description of the issue
- **Spec covers deleted/removed feature**: Report as drifted — "spec documents feature X which no longer exists in code"
- **Multiple specs cover the same code area**: Evaluate each independently

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
        "specPath": "specs/specifications/technical/api/endpoints.md",
        "status": "synced"
      },
      {
        "specPath": "specs/specifications/technical/api/schemas.md",
        "status": "drifted",
        "drift": "Missing documentation for POST /api/health/scans endpoint"
      },
      {
        "specPath": "specs/specifications/technical/architecture/data-model.md",
        "status": "drifted",
        "drift": "Model 'HealthScore' exists in schema but is not documented in data-model spec"
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
- `drift`: Concise description of the synchronization issue (only when `status` is `drifted`). Include what is missing or what diverges — be specific enough that a developer can act on it without re-reading the entire spec.
- `generatedTickets`: Always `[]` (tickets are created by the workflow after the scan)
- `issuesFound`: Count of specs with `status: "drifted"`
- `issuesFixed`: Always `0` (spec-sync never auto-fixes)

## Final Reminder

Do NOT assume a specific project structure. Read `CLAUDE.md` and the actual codebase to understand where things live. A spec about "API endpoints" could map to `app/api/`, `src/routes/`, `handlers/`, `cmd/server/`, or anything else depending on the project.
