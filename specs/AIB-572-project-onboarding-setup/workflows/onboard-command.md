# Agent Command Specification: onboard

**Feature Branch**: `AIB-572-project-onboarding-setup`
**Date**: 2026-04-08

## Overview

The onboard agent command is executed during Phase 2 of the onboarding workflow. It receives the `analysis.json` from Phase 1 as context, browses the target repository's source code, and generates project-specific configuration files.

## Command Location

`.claude/commands/onboard.md` (in the ai-board repository, not the target repository)

## Invocation

```bash
# Claude Code
claude --print -p "$(cat .claude/commands/onboard.md)" \
  --context "$(cat .ai-board/analysis.json)"

# Codex (equivalent)
codex --quiet -p "$(cat .claude/commands/onboard.md)" \
  --context "$(cat .ai-board/analysis.json)"
```

## Command Prompt Structure

The command prompt instructs the agent to:

### Phase A: Repository Analysis
1. Read `analysis.json` to understand detected language, framework, package manager, services
2. Browse key source files to understand:
   - Project structure (directory layout)
   - Build/test commands (from package.json, Makefile, pyproject.toml, etc.)
   - Architecture patterns (monorepo, microservices, MVC, etc.)
   - Key dependencies and their usage
   - Testing patterns (test runner, test file locations, fixtures)
   - Data models (if applicable — ORM models, database schemas)

### Phase B: Generate CLAUDE.md
If `CLAUDE.md` does not already exist, generate it with these sections:
- **Tech Stack**: Language, framework, key dependencies with versions
- **Commands**: Build, test, lint, type-check, dev server commands
- **Project Structure**: Key directories and their purposes
- **Data Models**: Database models/schemas if present
- **Testing**: Test runner, test locations, testing patterns, how to run tests
- **Architecture**: Key design decisions, patterns used
- **API Patterns**: If web service, key endpoints and conventions

### Phase C: Generate constitution.md
Generate `.ai-board/memory/constitution.md` with principles derived from:
- Observed coding conventions (naming, formatting, patterns)
- Testing requirements (what's tested, what's not)
- Type safety level (strict, loose, none)
- Security practices observed in the code
- Performance patterns if notable

### Phase D: Create AGENTS.md symlink
```bash
ln -sf CLAUDE.md AGENTS.md
```

## Output Files

| File | Location | Condition |
|------|----------|-----------|
| `CLAUDE.md` | Repository root | Only if not already present |
| `AGENTS.md` | Repository root (symlink → CLAUDE.md) | Always |
| `.ai-board/memory/constitution.md` | `.ai-board/memory/` | Always (overwrite) |

## Quality Criteria

The generated `CLAUDE.md` must contain:
- At least 3 project-specific details (actual command names, framework patterns, or architecture conventions)
- No generic placeholder text like "TODO" or "REPLACE THIS"
- Accurate tech stack information matching `analysis.json`

## Error Handling

- If the agent times out (10 min default), the step fails → partial success
- If the agent cannot determine meaningful content, it should still generate a minimal but accurate file
- The agent should never modify existing source code — only create new files in designated locations
