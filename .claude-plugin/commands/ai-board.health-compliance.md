# Health Scan: Compliance

You are executing a **compliance health scan** on this repository. Analyze the codebase against the project's constitution and coding standards.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: If provided, only scan changes between this commit and head-commit (incremental scan)
- `--head-commit <SHA>`: The target commit to scan up to

If `--base-commit` is empty or not provided, perform a **full repository scan**.

## What to Scan

Read the project constitution (`.ai-board/memory/constitution.md` or `.claude-plugin/memory/constitution.md`) and CLAUDE.md, then verify compliance:
- **TypeScript-First**: Strict mode enabled, no `any` types, proper typing
- **Component-Driven**: UI follows shadcn/ui patterns, no forbidden libraries
- **Test-Driven**: Tests exist for new features, proper test structure
- **Security-First**: No hardcoded colors, proper auth patterns, Zod validation
- **Database Integrity**: Prisma patterns followed, proper migrations
- **AI-First**: No README files at root, specs in correct locations
- **Code Style**: Tailwind semantic tokens only, no dynamic class construction

## Output Format

You MUST output valid JSON to stdout with this exact structure:

```json
{
  "score": 90,
  "issuesFound": 2,
  "issuesFixed": 0,
  "report": {
    "issues": [
      {
        "category": "TypeScript-First",
        "file": "path/to/file.ts",
        "line": 15,
        "description": "Usage of 'any' type violates strict TypeScript principle"
      }
    ],
    "summary": "Brief summary of compliance findings"
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

- `score`: 0-100 (100 = fully compliant)
- `category`: The constitution principle being violated
- Output ONLY the JSON object, no other text
