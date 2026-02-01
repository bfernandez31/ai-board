# Implementation Plan: AI-Board Claude Code Plugin Package

**Branch**: `AIB-203-copy-of-create` | **Date**: 2026-02-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-203-copy-of-create/spec.md`

## Summary

Package all ai-board commands, scripts, and templates as a Claude Code plugin for installation on managed projects. The plugin will provide all ai-board workflow commands (specify, plan, implement, verify, etc.) under the `ai-board.*` namespace, with scripts and templates accessible via plugin-relative paths. This enables external projects to use ai-board automated workflows without copying files manually.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Bash 5.x (scripts)
**Primary Dependencies**: Claude Code Plugin System, GitHub Actions
**Storage**: N/A (file-based plugin packaging)
**Testing**: Vitest (unit + integration)
**Target Platform**: Claude Code CLI (cross-platform: Linux, macOS, Windows)
**Project Type**: Plugin package (single project structure)
**Performance Goals**: N/A (one-time installation)
**Constraints**: Must work in GitHub Actions CI/CD environment, must use `${CLAUDE_PLUGIN_ROOT}` for portable paths
**Scale/Scope**: 16 commands, 10 bash scripts, 3 JS scripts, 6 templates, 1 skill

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- **Status**: ✅ PASS
- **Rationale**: Plugin packaging primarily involves Markdown command files, Bash scripts, and JSON manifests. No new TypeScript code required. Existing scripts use TypeScript where applicable.

### II. Component-Driven Architecture
- **Status**: ✅ PASS
- **Rationale**: Not applicable - this feature creates a plugin package structure, not UI components.

### III. Test-Driven Development
- **Status**: ✅ PASS
- **Rationale**: Per spec, integration tests for plugin installation validation and unit tests for path resolution utilities will follow Testing Trophy patterns.

### IV. Security-First Design
- **Status**: ✅ PASS
- **Rationale**: Plugin contains no user input handling. Scripts already use Zod validation where needed. No secrets exposed in plugin package.

### V. Database Integrity
- **Status**: ✅ N/A
- **Rationale**: No database changes required for plugin packaging.

### VI. Specification Clarification Guardrails
- **Status**: ✅ PASS
- **Rationale**: Spec includes Auto-Resolved Decisions section with documented trade-offs per constitution requirements.

### VII. AI-First Development Model
- **Status**: ✅ PASS
- **Rationale**: No README or tutorial files will be created. Plugin structure follows Claude Code conventions. All guidance remains in CLAUDE.md and constitution.

## Project Structure

### Documentation (this feature)

```
specs/AIB-203-copy-of-create/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output (completed)
├── data-model.md        # Phase 1 output (completed)
├── quickstart.md        # Phase 1 output (completed)
├── contracts/           # Phase 1 output (completed)
│   ├── plugin-manifest.schema.json
│   ├── hooks.schema.json
│   └── command-file.schema.json
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
.claude-plugin/                    # NEW: Plugin metadata directory
└── plugin.json                   # Plugin manifest

commands/                          # NEW: Plugin commands (renamed from .claude/commands/)
├── ai-board.specify.md           # Renamed from speckit.specify.md
├── ai-board.clarify.md
├── ai-board.plan.md
├── ai-board.tasks.md
├── ai-board.implement.md
├── ai-board.checklist.md
├── ai-board.analyze.md
├── ai-board.constitution.md
├── ai-board.quick-impl.md        # Renamed from quick-impl.md
├── ai-board.cleanup.md           # Renamed from cleanup.md
├── ai-board.verify.md
├── ai-board.iterate-verify.md
├── ai-board.code-review.md
├── ai-board.code-simplifier.md
├── ai-board.compare.md
└── ai-board.sync-specifications.md

skills/                            # Copied from .claude/skills/
└── testing/
    ├── SKILL.md
    └── patterns/
        ├── unit.md
        ├── component.md
        ├── frontend-integration.md
        ├── backend-integration.md
        └── e2e.md

scripts/                           # Copied from .specify/scripts/
├── bash/
│   ├── common.sh                 # MODIFIED: Add get_plugin_root()
│   ├── create-new-feature.sh
│   ├── check-prerequisites.sh
│   ├── setup-plan.sh
│   ├── setup-constitution.sh     # NEW: Post-install hook script
│   ├── create-pr-and-transition.sh
│   ├── create-pr-only.sh
│   ├── prepare-images.sh
│   ├── detect-incomplete-implementation.sh
│   ├── auto-ship-tickets.sh
│   ├── transition-to-verify.sh
│   └── update-agent-context.sh
├── analyze-slow-tests.js
├── analyze-test-duplicates.js
└── generate-test-report.js

templates/                         # Copied from .specify/templates/
├── spec-template.md
├── plan-template.md
├── tasks-template.md
├── checklist-template.md
├── summary-template.md
└── agent-file-template.md

memory/                            # Copied from .specify/memory/
└── constitution.md

hooks/                             # NEW: Plugin hooks
└── hooks.json

.github/workflows/                 # MODIFIED: Update command references
├── speckit.yml
├── quick-impl.yml
├── verify.yml
├── cleanup.yml
├── iterate.yml
└── ai-board-assist.yml           # No change needed

tests/
├── unit/
│   └── plugin/                   # NEW: Unit tests
│       └── path-resolution.test.ts
└── integration/
    └── plugin/                   # NEW: Integration tests
        └── installation.test.ts
```

**Structure Decision**: Plugin structure at repository root with `.claude-plugin/plugin.json` manifest. Commands directory at root level (not inside `.claude-plugin/`) per Claude Code plugin conventions. Scripts, templates, and skills directories parallel the plugin structure for portability.

## Constitution Check (Post-Design Re-evaluation)

*Verified after Phase 1 design completion*

### I. TypeScript-First Development
- **Status**: ✅ PASS (unchanged)
- **Rationale**: New test files will use TypeScript. Plugin scripts remain Bash (existing pattern).

### II. Component-Driven Architecture
- **Status**: ✅ PASS (unchanged)
- **Rationale**: No UI components involved.

### III. Test-Driven Development
- **Status**: ✅ PASS (unchanged)
- **Rationale**: Test locations defined in structure: `tests/unit/plugin/`, `tests/integration/plugin/`

### IV. Security-First Design
- **Status**: ✅ PASS (unchanged)
- **Rationale**: No new attack surface introduced. Hooks use only local scripts.

### V. Database Integrity
- **Status**: ✅ N/A (unchanged)

### VI. Specification Clarification Guardrails
- **Status**: ✅ PASS (unchanged)

### VII. AI-First Development Model
- **Status**: ✅ PASS (unchanged)
- **Rationale**: No documentation files created. Plugin enables AI-first development in target projects.

## Complexity Tracking

*No violations - all constitution gates passed*

N/A - No complexity violations to track.
