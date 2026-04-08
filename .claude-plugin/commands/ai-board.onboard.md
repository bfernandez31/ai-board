# AI Board Onboard — Phase 2: LLM Content Generation

You are onboarding a new project into the AI Board system. Phase 1 (deterministic stack detection) has already completed and produced an `analysis.json` file with detected stack information.

Your job is to generate project-specific guidance files based on actual code analysis.

## Arguments

This command receives these arguments:
- `--analysis-json=<path>` (required): Path to Phase 1 analysis output
- `--skip-claude-md` (optional): Skip CLAUDE.md generation if the file already exists

## Instructions

### Step 1: Read Context

1. Parse the `analysis.json` file specified by `--analysis-json` to understand the detected stack
2. Browse key source files to understand:
   - Project architecture and directory structure
   - Code patterns and conventions (naming, error handling, imports)
   - Existing configuration files (linter configs, CI/CD, Docker)
   - Database schemas and data models
   - Test patterns and testing infrastructure

### Step 2: Generate CLAUDE.md (skip if `--skip-claude-md` is present)

Create a `CLAUDE.md` file in the repository root with project-specific content. This file guides AI agents working on the project.

**Required sections:**
- **Tech Stack**: Exact languages, frameworks, versions from analysis + observed code
- **Commands**: Build, test, lint, dev server commands extracted from manifests
- **Architecture**: Directory structure, key modules, data flow based on actual code
- **Data Models**: Database entities, schemas, relationships if ORM/schema files exist
- **Testing Patterns**: Test framework, test file locations, patterns observed in existing tests
- **Conventions**: Naming conventions, import style, error handling patterns observed in code

**Critical requirement**: Content MUST be derived from actual code analysis. A reviewer should be able to identify which project this file describes without seeing the repo name. No generic boilerplate.

### Step 3: Generate `.ai-board/memory/constitution.md`

Create `.ai-board/memory/constitution.md` with governance principles derived from the codebase.

**Required sections:**
- **Code Patterns**: Principles derived from observed patterns (e.g., strict TypeScript, functional style)
- **Testing Standards**: Standards based on detected test framework and observed test patterns
- **Security Practices**: Patterns based on observed practices (env var usage, auth, input validation)
- **Code Quality**: Standards from linter configs, type strictness, formatting rules
- **Governance**: Version control practices, commit conventions, review expectations

Ensure the directory `.ai-board/memory/` exists before writing.

### Step 4: Create AGENTS.md Symlink

```bash
ln -sf CLAUDE.md AGENTS.md
```

### Step 5: Clean Up

Remove `analysis.json` from the working directory — it is a working artifact and should not be committed.

## Output

Write files directly to the filesystem. No stdout output needed. Exit with code 0 on success.
