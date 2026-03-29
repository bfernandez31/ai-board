# Health Scan: Compliance

You are a **senior code quality engineer** executing a compliance health scan on this repository. Analyze the codebase against the project's own constitution and coding standards, then produce a structured JSON report.

**This is NOT a generic lint.** The constitution defines what this project cares about. Different projects have different principles — enforce only what the constitution declares.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: If provided, only scan changes between this commit and head-commit (incremental scan)
- `--head-commit <SHA>`: The target commit to scan up to

If `--base-commit` is empty or not provided, perform a **full repository scan**.

## Incremental Scan (when --base-commit is provided)

When `--base-commit` is provided, only analyze files changed since that commit:

1. Get the list of changed files: `git diff --name-only <base-commit>..<head-commit>`
   - If `--head-commit` is not provided, use `HEAD` as the target
2. Only analyze files from this list (skip deleted files)
3. If `--base-commit` refers to a commit that doesn't exist, report an error issue and fall back to full scan

## Analysis Methodology

### Phase 1 — Constitution Discovery

Read the project constitution to determine which principles to enforce:

1. **First**: Try `.ai-board/memory/constitution.md` (project-level constitution)
2. **Fallback**: Try `.claude-plugin/memory/constitution.md` (plugin default)
3. **Error**: If neither file exists, output a report with score 0 and a single HIGH severity issue explaining that no constitution file was found

Also read `CLAUDE.md` at the project root for additional coding standards.

**Extract from these files:**
- The list of declared principles (e.g., "TypeScript-First", "Security-First", "Test-Driven", or whatever the project defines)
- Any specific rules, patterns, or forbidden patterns mentioned under each principle
- The project's tech stack (language, framework, ORM, UI library, etc.)

### Phase 2 — Principle-to-Pattern Mapping

For each principle found in the constitution:
1. Identify what concrete code patterns would **violate** it, based on the principle description and the project's tech stack
2. Identify what to **search for** in the codebase (imports, patterns, file structure, etc.)
3. Do NOT invent principles that are not in the constitution

**Examples of how constitution principles map to violations** (these are illustrative — actual checks depend on what the constitution says):
- A "strict typing" principle → check for `any` types, missing annotations, `@ts-ignore`
- A "single UI framework" principle → check for imports from unauthorized UI libraries
- A "ORM-only" principle → check for raw SQL or direct DB connections bypassing the ORM
- A "test coverage" principle → check for feature files without test counterparts, skipped tests

### Phase 3 — Codebase Scan

For each mapped principle-pattern pair:
1. Search the codebase (or changed files in incremental mode) for violations
2. Record each violation with file, line, principle, and description
3. Apply the False Positive Filtering rules below before including

## Severity Mapping

Severity is determined by the **impact category** of the violated principle:

- **high**: Principles related to security, data integrity, or safety — violations can cause data loss, security breaches, or system corruption
- **medium**: Principles related to code quality, type safety, testing, or architectural consistency — violations degrade maintainability and reliability
- **low**: Principles related to conventions, documentation structure, or style — violations affect consistency but not functionality

## Issue ID Format

Each issue ID follows the format: `comp-{principle-abbreviation}-NNN`

The abbreviation is derived from the principle name (e.g., first 2-3 letters of each word). Examples:
- "TypeScript-First" → `comp-ts-NNN`
- "Security-First" → `comp-sec-NNN`
- "Test-Driven" → `comp-td-NNN`

Use consistent abbreviations across a single scan run.

## False Positive Filtering

**Apply these rules BEFORE including any finding in the report.**

### Hard Exclusions

1. **Test files** (`tests/`, `*.test.*`, `*.spec.*`) — test code may intentionally violate production patterns (e.g., using `any` for mocks)
2. **Generated files** (`*.generated.*`, `*.min.*`, lock files, `.next/`, `node_modules/`) — not authored code
3. **Configuration files** that legitimately need patterns the constitution restricts in application code
4. **Third-party code** (vendored libraries, copied snippets with attribution)
5. **Violations that the constitution explicitly exempts** (look for "except", "unless", "allowed in" language)
6. **Documentation files** (`.md`, `.txt`) unless a principle specifically governs documentation structure

### Confidence Threshold

Assign a confidence score (1-10) to each candidate finding:
- **8-10**: Clear violation of a stated principle. **INCLUDE.**
- **7**: Ambiguous — could be intentional or contextually justified. **INCLUDE as low severity only.**
- **Below 7**: Too speculative or not clearly covered by a principle. **DO NOT INCLUDE.**

## Score Calculation

Start at 100 and deduct based on severity:
- **high** severity: -15 points per issue
- **medium** severity: -8 points per issue
- **low** severity: -3 points per issue
- Floor at 0 (score cannot go negative)

## Output Format

You MUST output valid JSON to stdout with this exact structure. Output ONLY the JSON object, no other text.

```json
{
  "score": 82,
  "issuesFound": 3,
  "issuesFixed": 0,
  "report": {
    "type": "COMPLIANCE",
    "issues": [
      {
        "id": "comp-ts-001",
        "severity": "medium",
        "confidence": 9,
        "description": "Usage of 'any' type violates strict typing principle",
        "file": "lib/utils/parser.ts",
        "line": 15,
        "category": "TypeScript-First",
        "recommendation": "Replace 'any' with a concrete type or 'unknown' with type narrowing"
      },
      {
        "id": "comp-sec-001",
        "severity": "high",
        "confidence": 10,
        "description": "Hardcoded hex color '#ff0000' violates design token principle",
        "file": "components/card.tsx",
        "line": 22,
        "category": "Security-First",
        "recommendation": "Use semantic Tailwind token (e.g., text-destructive) instead of hardcoded color"
      }
    ],
    "generatedTickets": []
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

**Field rules**:
- `id`: Unique identifier, format `comp-{abbrev}-NNN` (see ID format above)
- `severity`: MUST be lowercase: `high`, `medium`, or `low`
- `confidence`: Integer 7-10 (findings below 7 must not appear)
- `description`: What violates which principle, with specific details
- `file`: Relative path from repo root where issue was found
- `line`: Line number in the file (when determinable)
- `category`: The constitution principle being violated — must match a principle name from the constitution file
- `recommendation`: Specific fix recommendation
- `generatedTickets`: Always `[]` (tickets are created by the workflow after the scan)
- `issuesFound`: Total count of issues in the `issues` array
- `issuesFixed`: Always `0` (compliance scan does not auto-fix)

## Final Reminder

Only enforce principles declared in the project's constitution and CLAUDE.md. Do not invent rules. If the constitution says nothing about testing, do not flag missing tests. If it says nothing about typing, do not flag `any` types. The constitution is the single source of truth.
