# Agent Command Specification: ai-board.onboard

**File**: `.claude-plugin/commands/ai-board.onboard.md`
**Invoked by**: `run-agent.sh` during Phase 2 of onboard workflow

## Purpose

LLM-powered command that reads a codebase and its `analysis.json` detection output to generate project-specific guidance files: `CLAUDE.md` and `.ai-board/memory/constitution.md`.

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--analysis-json=<path>` | Yes | Path to Phase 1 analysis output |
| `--skip-claude-md` | No | Skip CLAUDE.md generation (file already exists) |

## Expected Behavior

### 1. Read Context

- Parse `analysis.json` to understand detected stack (language, framework, services, commands, etc.)
- Browse key source files to understand architecture patterns, conventions, and structure
- Read existing `CLAUDE.md` if present (for context, even if `--skip-claude-md` is set)

### 2. Generate CLAUDE.md (unless `--skip-claude-md`)

Content requirements (FR-017):
- Project-specific tech stack with exact versions from analysis
- Available commands (build, test, lint, etc.) from detected commands
- Data models / database setup if ORM or schema files detected
- Architecture overview based on observed directory structure and patterns
- Testing patterns based on detected test framework and existing test files
- Key conventions observed in the codebase (naming, error handling, etc.)

Must NOT be generic boilerplate — a reviewer should be able to identify which project this describes without seeing the repo name.

### 3. Generate `.ai-board/memory/constitution.md`

Content requirements (FR-018):
- Principles derived from observed code patterns (e.g., if strict TypeScript is used, enforce it)
- Testing standards based on detected test framework and observed test patterns
- Security patterns based on observed practices (env var usage, auth patterns, etc.)
- Universal governance standards (version control, code review expectations)
- Code quality standards derived from linter configs, type strictness, etc.

### 4. Create AGENTS.md Symlink

```bash
ln -sf CLAUDE.md AGENTS.md
```

### 5. Clean Up

- Remove `analysis.json` from the working directory (it should not be committed)

## Output Format

The command writes files directly to the filesystem. No stdout output required. Exit code 0 on success, non-zero on failure.

## Error Behavior

If the agent fails or times out:
- Files that were already written to disk are preserved
- The workflow's partial success logic handles committing whatever was generated
- Exit code propagates to the workflow for error detection
