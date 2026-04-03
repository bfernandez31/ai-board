# Implementation Plan: Add /fix Assist Command

**Branch**: `AIB-494-add-fix-assist` | **Date**: 2026-04-03 | **Spec**: `specs/AIB-494-add-fix-assist/spec.md`
**Input**: Feature specification from `/specs/AIB-494-add-fix-assist/spec.md`

## Summary

Add a `/fix` assist command that automatically addresses PR review findings from three sources (ai-board custom review, Codex, Copilot). The command parses review comments, deduplicates across sources with priority ordering, filters for pertinence using project context, applies targeted code fixes, updates specs when contradictions are found, and pushes a single grouped commit. Implementation follows the existing assist command infrastructure (workflow routing via `ai-board-assist.yml`, command file in `.claude-plugin/commands/`, result file at `specs/$BRANCH/.ai-board-result.md`).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, GitHub API (`gh` CLI + Octokit)
**Storage**: PostgreSQL 14+ via Prisma (Job, Comment, Ticket models)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Linux server (GitHub Actions workflow environment)
**Project Type**: Web application (Next.js monorepo)
**Performance Goals**: Process all PR review findings in a single workflow run (<10 min)
**Constraints**: Single concurrent `/fix` job per ticket; comment output <2000 chars (DB limit), target <1500 chars
**Scale/Scope**: Typical PR has ~5-10 findings across all sources; max ~20 findings per run

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript; Review Finding and Fix Result entities will have TypeScript interfaces |
| II. Component-Driven Architecture | PASS | New command file follows `.claude-plugin/commands/` pattern; API routes follow Next.js conventions; no UI components needed (workflow-only) |
| III. Test-Driven Development | PASS | Integration tests for review parsing, deduplication, and pertinence filtering; unit tests for pure functions |
| IV. Security-First | PASS | Uses existing workflow token auth (`verifyWorkflowToken`); no new user input surfaces beyond existing comment routing; Zod validation on any new schemas |
| V. Database Integrity | PASS | No schema changes needed — Job.command is VARCHAR(50), "fix" is a new string value; uses existing Job state machine |
| V. Specification Clarification | PASS | Auto-resolved decisions documented in spec with trade-offs |

**Gate Result**: PASS — No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-494-add-fix-assist/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── fix-command.md   # Command contract definition
└── tasks.md             # Phase 2 output (NOT created by plan)
```

### Source Code (repository root)

```
# New files
.claude-plugin/commands/ai-board.fix.md          # Fix command definition (workflow-executed)

# Modified files
.github/workflows/ai-board-assist.yml            # Add /fix command routing (like /review, /compare)
app/lib/data/ai-board-commands.ts                 # Register /fix in autocomplete
```

**Structure Decision**: No new source directories needed. The `/fix` command is a workflow-executed Claude command file (`.claude-plugin/commands/ai-board.fix.md`) that follows the identical pattern as existing `/review` and `/compare` commands. All code execution happens within the Claude agent at workflow runtime — no compiled TypeScript modules are needed for the command itself.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|------------|-----------|----------|-----------|
| US1: Fix all findings | Integration | `tests/integration/assist/` | Tests review parsing + dedup logic; no browser needed |
| US2: Fix specific findings | Unit | `tests/unit/` | Pure filtering function on finding numbers |
| US3: Fix with spec updates | Integration | `tests/integration/assist/` | Needs file system access for spec detection |
| US4: Error handling | Integration | `tests/integration/assist/` | API-level error responses |
| Pertinence filtering | Unit | `tests/unit/` | Pure function: project context + finding → accept/reject |
| Deduplication | Unit | `tests/unit/` | Pure function: findings array → deduplicated array |
| Review comment parsing | Unit | `tests/unit/` | Pure function: raw comment text → structured findings |

**Notes**:
- API tests use Vitest, NOT Playwright
- E2E not needed — no browser-required features
- Search existing tests in `tests/integration/` before creating new test files

## Complexity Tracking

No constitution violations to justify.
