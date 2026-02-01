# Implementation Plan: Create ai-board Claude Code Plugin Package

**Branch**: `AIB-197-create-ai-board` | **Date**: 2026-02-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-197-create-ai-board/spec.md`

## Summary

Package all ai-board commands, scripts, and templates as a Claude Code plugin for installation on managed projects. The plugin consolidates all `speckit.*` commands under the `ai-board.*` namespace and provides a standard plugin structure with manifest, commands, scripts, and templates that can be installed via Claude Code's plugin system.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0, Bash 5.x
**Primary Dependencies**: Claude Code Plugin System, existing `.specify/` scripts and templates
**Storage**: File-based (markdown templates, bash/JS scripts, JSON manifest)
**Testing**: Manual plugin installation verification, workflow execution tests
**Target Platform**: Claude Code CLI (cross-platform: Linux, macOS, Windows)
**Project Type**: Plugin (Claude Code plugin package)
**Performance Goals**: Plugin installation < 30 seconds, command execution latency unchanged
**Constraints**: Must maintain backwards compatibility with existing workflow behavior
**Scale/Scope**: 17 commands, 11 bash scripts, 3 JS scripts, 6 templates, 1 constitution

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | N/A | Plugin is primarily markdown/bash/JSON - no TypeScript code in plugin package |
| II. Component-Driven Architecture | N/A | Plugin structure, not UI components |
| III. Test-Driven Development | ⚠️ PARTIAL | Plugin validation via workflow execution; no unit tests for manifest/commands |
| IV. Security-First Design | ✅ PASS | No secrets in plugin; scripts use parameterized inputs |
| V. Database Integrity | N/A | No database changes |
| VI. AI-First Development Model | ✅ PASS | Plugin designed for AI agent consumption, no human-oriented documentation |

**Gate Assessment**: PASS - No constitution violations requiring justification.

## Project Structure

### Documentation (this feature)

```
specs/AIB-197-create-ai-board/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (plugin structure)

```
.claude-plugin/                    # Plugin manifest directory
└── plugin.json                   # Required: Plugin manifest with metadata

commands/                          # Skill/command files (at plugin root)
├── ai-board.specify.md           # Renamed from speckit.specify.md
├── ai-board.plan.md              # Renamed from speckit.plan.md
├── ai-board.tasks.md             # Renamed from speckit.tasks.md
├── ai-board.implement.md         # Renamed from speckit.implement.md
├── ai-board.clarify.md           # Renamed from speckit.clarify.md
├── ai-board.checklist.md         # Renamed from speckit.checklist.md
├── ai-board.constitution.md      # Renamed from speckit.constitution.md
├── ai-board.analyze.md           # Renamed from speckit.analyze.md
├── ai-board.verify.md            # Renamed from verify.md
├── ai-board.cleanup.md           # Renamed from cleanup.md
├── ai-board.quick-impl.md        # Renamed from quick-impl.md
├── ai-board.iterate-verify.md    # Renamed from iterate-verify.md
├── ai-board.code-review.md       # Renamed from code-review.md
├── ai-board.code-simplifier.md   # Renamed from code-simplifier.md
├── ai-board.compare.md           # Renamed from compare.md
├── ai-board.sync-specifications.md  # Renamed from sync-specifications.md
└── ai-board-assist.md            # Kept as-is (already ai-board namespace)

skills/                            # Agent skills (at plugin root)
└── testing/                      # Existing testing skill
    ├── SKILL.md
    └── patterns/
        ├── unit.md
        ├── component.md
        ├── frontend-integration.md
        ├── backend-integration.md
        └── e2e.md

agents/                            # Placeholder for AIB-199
└── .gitkeep

memory/                            # Plugin memory/templates
└── constitution.md               # Template for new installations

scripts/                           # Utility scripts
├── bash/                         # Bash scripts from .specify/scripts/bash/
│   ├── common.sh
│   ├── create-new-feature.sh
│   ├── check-prerequisites.sh
│   ├── setup-plan.sh
│   ├── update-agent-context.sh
│   ├── create-pr-and-transition.sh
│   ├── create-pr-only.sh
│   ├── detect-incomplete-implementation.sh
│   ├── prepare-images.sh
│   ├── transition-to-verify.sh
│   └── auto-ship-tickets.sh
├── analyze-slow-tests.js
├── analyze-test-duplicates.js
└── generate-test-report.js

templates/                         # Markdown templates
├── spec-template.md
├── plan-template.md
├── tasks-template.md
├── checklist-template.md
├── summary-template.md
└── agent-file-template.md
```

**Structure Decision**: Claude Code plugin structure with `.claude-plugin/` containing only `plugin.json` and all components (commands, skills, agents, scripts, templates) at plugin root level per the Claude Code plugin specification.

## Complexity Tracking

*No constitution violations requiring justification.*

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | N/A | Plugin package contains no TypeScript - only markdown, bash, JSON |
| II. Component-Driven | N/A | Plugin structure follows Claude Code conventions, not UI components |
| III. Test-Driven | ⚠️ ACCEPTABLE | Plugin validates via existing workflow tests; no new test files needed |
| IV. Security-First | ✅ PASS | All scripts use parameterized inputs; no hardcoded secrets |
| V. Database Integrity | N/A | No database changes in plugin package |
| VI. AI-First | ✅ PASS | No README or human-oriented docs; plugin serves AI agents |

**Post-Design Assessment**: PASS - Design adheres to constitution. The partial test coverage is acceptable because:
1. Plugin functionality is validated through existing workflow execution
2. No new application logic that requires unit testing
3. Plugin structure validated against Claude Code schema

## Implementation Notes

### Critical Path Items
1. Create `.claude-plugin/plugin.json` manifest
2. Move and rename 17 command files to `commands/` with `ai-board.*` namespace
3. Update all internal command references from `speckit.*` to `ai-board.*`
4. Update all script paths to use `${CLAUDE_PLUGIN_ROOT}`
5. Update 5 GitHub workflow files with new command names
6. Create `memory/constitution.md` template
7. Add first-run constitution check to ai-board.specify and ai-board.plan

### Dependency Order
```
1. Create plugin structure (directories)
2. Create plugin.json manifest
3. Copy and rename command files
4. Update command frontmatter
5. Update script path references in commands
6. Copy scripts and templates
7. Create memory/constitution.md
8. Update GitHub workflows
9. Validate plugin structure
```
