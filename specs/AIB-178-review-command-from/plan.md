# Implementation Plan: /review Command for AI-Board Assistance

**Branch**: `AIB-178-review-command-from` | **Date**: 2026-01-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-178-review-command-from/spec.md`

## Summary

Add a `/review` command to the AI-BOARD assistance system that allows users in VERIFY stage to trigger an on-demand code review via ticket comments. The command will find the associated PR from the ticket's branch and invoke the existing `/code-review` skill, with the key enhancement of performing a new review even if a previous review exists.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), GitHub CLI (`gh`), Claude Code CLI
**Storage**: PostgreSQL 14+ via Prisma ORM (for Job records)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Linux server (GitHub Actions runner)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Command dispatch < 5 seconds, response within 2 minutes
**Constraints**: Output < 1500 characters (ticket comment limit), VERIFY stage only
**Scale/Scope**: Single command addition to existing ai-board-assist infrastructure

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate (Initial Check)

| Principle | Status | Compliance Notes |
|-----------|--------|------------------|
| I. TypeScript-First | ✅ Pass | Feature modifies TypeScript files only (workflow YAML, command MD, `ai-board-commands.ts`). All new code uses explicit types. |
| II. Component-Driven | ✅ N/A | No UI components added - workflow routing and CLI command only. |
| III. Test-Driven | ✅ Required | Integration test for command routing; verify `/review` command dispatches correctly. |
| IV. Security-First | ✅ Pass | Uses existing workflow token auth pattern; no new user inputs beyond command pattern. |
| V. Database Integrity | ✅ Pass | No schema changes; uses existing Job model via API. |
| VI. AI-First | ✅ Pass | No human-oriented docs; follows existing command patterns in `.claude/commands/`. |

**Gate Result**: ✅ PASS - All applicable principles satisfied or N/A.

## Project Structure

### Documentation (this feature)

```
specs/AIB-178-review-command-from/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command) - MINIMAL (no new entities)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Files to MODIFY (existing)
.github/workflows/ai-board-assist.yml    # Add /review command routing
app/lib/data/ai-board-commands.ts        # Add /review to autocomplete list

# Files to CREATE
.claude/commands/review.md               # /review command specification

# Test Files
tests/integration/commands/              # Integration tests for command routing
tests/unit/ai-board-commands.test.ts     # Unit tests for command filtering
```

**Structure Decision**: Web application structure (Next.js full-stack). This feature modifies:
1. GitHub workflow for command routing
2. Claude command specification
3. Static data file for UI autocomplete
4. Tests follow existing patterns in `tests/` directory

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

**Notes**: This feature has minimal complexity - it reuses existing infrastructure:
- Existing `/code-review` skill handles the actual review logic
- Existing ai-board-assist workflow handles command routing
- Existing PR lookup pattern (`gh pr list --head $BRANCH`)
- No new database schema or UI components required

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design completion.*

### Design Artifacts Review

| Artifact | Status | Constitution Compliance |
|----------|--------|------------------------|
| research.md | ✅ Complete | Decisions documented with rationale and alternatives |
| data-model.md | ✅ Complete | No new entities - reuses existing Job/Comment models |
| contracts/review-command.md | ✅ Complete | Clear input/output contracts defined |
| quickstart.md | ✅ Complete | Implementation checklist for AI agent |

### Post-Design Gate

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. TypeScript-First | ✅ Pass | `ai-board-commands.ts` modification uses existing typed interface. No new types needed. |
| II. Component-Driven | ✅ N/A | Confirmed: No UI components. Command is workflow + CLI only. |
| III. Test-Driven | ✅ Required | Tests identified: unit test for command list, integration test for routing. |
| IV. Security-First | ✅ Pass | Uses existing auth (workflow token). Stage validation prevents misuse. |
| V. Database Integrity | ✅ Pass | No schema changes. Uses existing Job creation via API. |
| VI. AI-First | ✅ Pass | Design artifacts in specs/ folder only. Command file follows `.claude/commands/` pattern. |

**Post-Design Gate Result**: ✅ PASS - Design maintains constitution compliance.

## Generated Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Plan | `specs/AIB-178-review-command-from/plan.md` | This file - implementation strategy |
| Research | `specs/AIB-178-review-command-from/research.md` | Technical decisions and rationale |
| Data Model | `specs/AIB-178-review-command-from/data-model.md` | Entity documentation (minimal) |
| Contract | `specs/AIB-178-review-command-from/contracts/review-command.md` | Command interface specification |
| Quickstart | `specs/AIB-178-review-command-from/quickstart.md` | Implementation checklist |
