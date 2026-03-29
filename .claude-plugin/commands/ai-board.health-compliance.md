# Health Scan: Compliance

You are executing a **compliance health scan** on this repository. Analyze the codebase against the project's constitution and coding standards.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: If provided, only scan changes between this commit and head-commit (incremental scan)
- `--head-commit <SHA>`: The target commit to scan up to

If `--base-commit` is empty or not provided, perform a **full repository scan**.

## Constitution File Discovery

Read the project constitution to determine which principles to enforce:

1. **First**: Try `.ai-board/memory/constitution.md` (project-level constitution)
2. **Fallback**: Try `.claude-plugin/memory/constitution.md` (plugin default)
3. **Error**: If neither file exists, output a report with score 0 and a single HIGH severity issue explaining that no constitution file was found

Also read `CLAUDE.md` at the project root for additional coding standards.

## Incremental Scan (when --base-commit is provided)

When `--base-commit` is provided, only analyze files changed since that commit:

1. Get the list of changed files: `git diff --name-only <base-commit>..<head-commit>`
   - If `--head-commit` is not provided, use `HEAD` as the target
2. Only analyze files from this list (skip deleted files)
3. If `--base-commit` refers to a commit that doesn't exist, report an error issue and fall back to full scan

## What to Scan — Per-Principle Patterns

For each constitution principle, check the following patterns:

### TypeScript-First
- `any` type usage (explicit `any` in annotations, return types, parameters)
- Missing type annotations on exported functions
- Disabled strict mode checks (`// @ts-ignore`, `// @ts-nocheck`)
- Non-TypeScript files where TypeScript is expected (`.js` instead of `.ts`)

### Component-Driven
- UI libraries besides shadcn/ui + Radix (e.g., Material UI, Chakra, Ant Design imports)
- Components not following shadcn/ui patterns (check `components/ui/` structure)
- State management libraries (Redux, Zustand, MobX imports)

### Test-Driven
- New feature files without corresponding test files
- Empty test files (no assertions)
- Skipped tests (`it.skip`, `describe.skip`, `test.skip`)
- Tests without meaningful assertions

### Security-First
- Hardcoded hex/rgb colors (`text-[#...]`, `bg-[#...]`, inline style colors)
- Missing Zod validation on API route inputs
- Missing auth checks on API routes
- `dangerouslySetInnerHTML` usage

### Database-Integrity
- Raw SQL queries bypassing Prisma ORM
- Missing Prisma migrations for schema changes
- Direct database connections outside Prisma client
- Unsafe `prisma.$executeRaw` with string interpolation

### AI-First
- README or tutorial files at project root
- Documentation files outside `specs/` directory
- Spec files in wrong locations

## Issue ID Format

Each issue ID follows the format: `comp-{principle-abbreviation}-NNN`
- TypeScript-First: `comp-ts-NNN`
- Component-Driven: `comp-cd-NNN`
- Test-Driven: `comp-td-NNN`
- Security-First: `comp-sec-NNN`
- Database-Integrity: `comp-db-NNN`
- AI-First: `comp-ai-NNN`

## Severity Mapping

Map each principle to a severity level:
- **high**: Security-First, Database-Integrity (violations can cause data loss or security breaches)
- **medium**: TypeScript-First, Test-Driven, Component-Driven (violations affect code quality and maintainability)
- **low**: AI-First, code style (violations affect conventions but not functionality)

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
        "description": "Usage of 'any' type violates strict TypeScript principle",
        "file": "lib/utils/parser.ts",
        "line": 15,
        "category": "TypeScript-First"
      },
      {
        "id": "comp-sec-001",
        "severity": "high",
        "description": "Hardcoded hex color '#ff0000' violates Security-First principle",
        "file": "components/card.tsx",
        "line": 22,
        "category": "Security-First"
      },
      {
        "id": "comp-ai-001",
        "severity": "low",
        "description": "README.md file exists at project root, violates AI-First principle",
        "file": "README.md",
        "line": 1,
        "category": "AI-First"
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
- `description`: What violates which principle, with specific details
- `file`: Relative path from repo root where issue was found
- `line`: Line number in the file (when determinable)
- `category`: The constitution principle being violated (e.g., `TypeScript-First`, `Security-First`)
- `generatedTickets`: Always `[]` (tickets are created by the workflow after the scan)
- `issuesFound`: Total count of issues in the `issues` array
- `issuesFixed`: Always `0` (compliance scan does not auto-fix)
