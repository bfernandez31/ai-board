# Implementation Plan: Add Code Simplifier and PR Review to Verify Workflow

**Branch**: `AIB-169-add-code-simplifier` | **Date**: 2026-01-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-169-add-code-simplifier/spec.md`

## Summary

Add two new automated steps to the verify workflow: (1) a code simplifier command that runs after test fixes are committed and before documentation update, simplifying recently modified code while preserving functionality; and (2) a PR code review command that runs after PR creation, reviewing changes against CLAUDE.md guidelines and constitution principles with confidence-based filtering (threshold ≥80).

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Claude Code CLI, GitHub CLI (`gh`), Next.js 16, GitHub Actions
**Storage**: N/A (no database changes)
**Testing**: Vitest (unit + integration), Playwright (E2E) - existing test infrastructure
**Target Platform**: GitHub Actions (ubuntu-latest), Linux server
**Project Type**: Web application with GitHub Actions workflows
**Performance Goals**: Both commands should complete within workflow timeouts (<45 min total)
**Constraints**: Must not break existing workflow, must preserve all code functionality
**Scale/Scope**: Two new command files, one workflow modification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | Command files are Markdown (no TS code to add). Workflow changes are YAML. |
| II. Component-Driven | ✅ N/A | No UI components involved - command files and workflow only. |
| III. Test-Driven | ✅ PASS | Integration tests will verify workflow behavior. Commands produce verifiable outputs. |
| IV. Security-First | ✅ PASS | No user input processing; commands operate on existing branch code only. |
| V. Database Integrity | ✅ N/A | No database schema changes required. |
| VI. AI-First Development | ✅ PASS | Following established command patterns from `/cleanup` and `/verify`. No human documentation. |

**Pre-Design Gate**: ✅ PASSED - All applicable principles satisfied.

### Post-Design Gate (Phase 1 Complete)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | No new TypeScript files; existing strict mode config applies. Runtime interfaces in data-model.md are documentation only. |
| II. Component-Driven | ✅ N/A | No UI changes; commands and workflows only. |
| III. Test-Driven | ✅ PASS | Integration tests planned for workflow verification. Commands use existing test infrastructure (impacted tests pattern). |
| IV. Security-First | ✅ PASS | Commands operate on branch code with existing permissions. No new secrets or user inputs introduced. |
| V. Database Integrity | ✅ N/A | No database changes; data-model.md confirms runtime-only artifacts. |
| VI. AI-First Development | ✅ PASS | Implementation guide (quickstart.md) addresses AI agents only. Command files follow existing patterns. |

**Post-Design Gate**: ✅ PASSED - Design artifacts comply with constitution. Ready for task generation.

## Project Structure

### Documentation (this feature)

```
specs/AIB-169-add-code-simplifier/
├── plan.md              # This file
├── research.md          # Phase 0 output (research findings)
├── data-model.md        # Phase 1 output (not applicable for this feature)
├── quickstart.md        # Phase 1 output (implementation guide)
├── contracts/           # Phase 1 output (not applicable - no new APIs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
.claude/commands/
├── code-simplifier.md   # NEW: Code simplification command
└── code-review.md       # NEW: PR code review command

.github/workflows/
└── verify.yml           # MODIFIED: Add code-simplifier and code-review steps

tests/integration/
└── workflows/           # Integration tests for workflow behavior
```

**Structure Decision**: This feature adds two new command files following the existing pattern in `.claude/commands/` (matching `/cleanup.md` and `/verify.md`), and modifies the existing `verify.yml` workflow to invoke these commands at the appropriate points.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations identified. Implementation follows existing command patterns.
