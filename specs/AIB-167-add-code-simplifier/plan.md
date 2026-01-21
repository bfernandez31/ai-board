# Implementation Plan: Add Code Simplifier and PR Code Review

**Branch**: `AIB-167-add-code-simplifier` | **Date**: 2026-01-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/AIB-167-add-code-simplifier/spec.md`

## Summary

Add two new steps to the verify workflow: (1) a code simplifier that refines recently modified code for clarity and consistency after test fixes and before documentation sync, and (2) an automated PR code review that posts compliance findings as a PR comment using parallel agents to check CLAUDE.md compliance, constitution compliance, bugs, git history context, and code comments. Both steps use Claude Code CLI with dedicated command specifications.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Claude Code CLI (@anthropic-ai/claude-code), GitHub CLI (gh)
**Storage**: N/A (workflow steps only, no database changes)
**Testing**: Vitest (unit/integration), Playwright (E2E - browser-required only)
**Target Platform**: GitHub Actions runner (ubuntu-latest)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Code simplifier and code review should complete within workflow timeout (45 min total)
**Constraints**: Must not block workflow on review failures (non-blocking), confidence threshold 80 for issue filtering
**Scale/Scope**: Single repository workflows, 5 parallel review agents

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅ COMPLIANT
- No new TypeScript code required (workflow YAML and markdown command specs)
- Command specs use TypeScript interfaces in data-model.md for type definitions
- Any helper scripts will follow strict mode TypeScript patterns

### II. Component-Driven Architecture ✅ COMPLIANT
- No UI components involved (backend workflow only)

### III. Test-Driven Development ✅ COMPLIANT
- Integration tests for new workflow behavior (command execution verification)
- No E2E tests needed (not browser-required per Testing Trophy)
- Tests will verify command patterns and output formatting

### IV. Security-First Design ✅ COMPLIANT
- Uses existing workflow token authentication pattern (GH_PAT, WORKFLOW_API_TOKEN)
- GitHub CLI uses existing GH_PAT secret
- No new secrets or credentials exposed
- PR comments posted via authenticated GitHub CLI

### V. Database Integrity ✅ COMPLIANT
- No database changes required
- No Prisma schema modifications
- All data structures are transient (workflow execution only)

### VI. AI-First Development ✅ COMPLIANT
- New Claude commands in `.claude/commands/` (proper location)
- No README/tutorial files created
- Spec files in `specs/AIB-167-add-code-simplifier/` (proper location)
- Agent context updated via `update-agent-context.sh`

### Post-Design Re-Evaluation ✅ ALL GATES PASS

After Phase 1 design completion:
- **data-model.md**: Defines transient entities (no database impact)
- **contracts/**: Workflow step specifications align with existing patterns
- **quickstart.md**: Implementation guide for AI agents (not human tutorials)
- **research.md**: Technology decisions align with constitution requirements
- No constitution violations identified in design artifacts

## Project Structure

### Documentation (this feature)

```
specs/AIB-167-add-code-simplifier/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal - no database entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (workflow step contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# New Claude Code commands (workflow steps)
.claude/commands/
├── code-simplifier.md   # NEW: Code simplifier command spec
└── code-review.md       # NEW: PR code review command spec

# Workflow modifications
.github/workflows/
└── verify.yml           # MODIFY: Add code simplifier and code review steps

# Test coverage
tests/
├── unit/                # Unit tests for helper utilities (if any)
└── integration/         # Integration tests for command validation
```

**Structure Decision**: Extend existing `.claude/commands/` pattern with two new command specifications. Modify `verify.yml` workflow to add new steps between existing phases. No new directories required - follows established repository structure.

## Complexity Tracking

*No constitution violations identified. All requirements align with existing patterns.*

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| Code Simplifier | Single Claude command | Matches existing `/verify` pattern |
| Code Review | 5 parallel agents | Spec requires comprehensive coverage (constitution + CLAUDE.md + bugs + history + comments) |
| PR Comments | GitHub CLI (gh) | FR-014 mandates gh CLI, existing pattern in codebase |
