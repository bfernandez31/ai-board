# Implementation Plan: Add Telemetry Metrics to Ticket Comparison

**Branch**: `AIB-130-add-telemetry-metrics` | **Date**: 2026-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-130-add-telemetry-metrics/spec.md`

## Summary

Enable data-driven ticket comparison by integrating telemetry metrics (cost, duration, tokens) into the `/compare` command. The workflow fetches job telemetry via API before Claude executes, writes it to a context file, and the compare command reads this to populate metrics tables.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, GitHub Workflows (YAML)
**Storage**: PostgreSQL 14+ (job telemetry stored in Job model)
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests)
**Target Platform**: Linux server (GitHub Actions runners)
**Project Type**: Web application (Next.js monolith)
**Performance Goals**: Telemetry fetch <2s per ticket, no blocking on missing data
**Constraints**: Context file <100KB, graceful degradation when telemetry unavailable
**Scale/Scope**: 1-5 tickets per comparison, ~10 jobs per ticket max

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | Uses existing `TicketTelemetry` interface from `lib/types/comparison.ts` |
| II. Component-Driven | ✅ PASS | No UI changes - workflow and Claude command only |
| III. Test-Driven | ✅ PASS | Integration tests for API telemetry aggregation |
| IV. Security-First | ✅ PASS | Uses existing WORKFLOW_API_TOKEN authentication |
| V. Database Integrity | ✅ PASS | Read-only access to Job table, no schema changes |
| VI. AI-First Development | ✅ PASS | No human-oriented documentation created |

**Gate Result**: ✅ PASS - All principles satisfied, proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-130-add-telemetry-metrics/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Web application structure (Next.js)
app/
├── api/
│   └── projects/[projectId]/tickets/[id]/jobs/route.ts  # Existing - returns telemetry

lib/
├── types/
│   └── comparison.ts                                     # Existing TicketTelemetry type
└── telemetry/
    └── aggregate.ts                                      # NEW: Telemetry aggregation utils

.github/
├── workflows/
│   └── ai-board-assist.yml                              # MODIFY: Add telemetry fetch step
└── scripts/
    └── fetch-telemetry.sh                               # NEW: Workflow script

.claude/commands/
└── compare.md                                           # MODIFY: Read telemetry context

specs/$BRANCH/
└── .telemetry-context.json                              # NEW: Runtime artifact (git-ignored)

tests/
├── integration/
│   └── telemetry/
│       └── aggregate.test.ts                            # NEW: Integration tests
└── unit/
    └── telemetry/
        └── aggregate.test.ts                            # NEW: Unit tests
```

**Structure Decision**: Web application structure using Next.js App Router conventions. Changes span workflow (GitHub Actions), API integration (curl + jq), and Claude command (markdown). No database migrations required.

## Complexity Tracking

*No violations requiring justification - implementation is minimal and focused.*

## Post-Design Constitution Re-Check

*Re-evaluation after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. TypeScript-First | ✅ PASS | Reuses existing `TicketTelemetry` interface. Workflow uses bash/jq (appropriate for GitHub Actions). |
| II. Component-Driven | ✅ PASS | No UI components added. Workflow step follows existing patterns in `ai-board-assist.yml`. |
| III. Test-Driven | ✅ PASS | Integration tests planned for telemetry aggregation. No E2E needed (no browser features). |
| IV. Security-First | ✅ PASS | Uses existing `WORKFLOW_API_TOKEN` bearer auth. No new secrets or exposure. |
| V. Database Integrity | ✅ PASS | Read-only access to Job table via existing API. No migrations. |
| VI. AI-First Development | ✅ PASS | Artifacts in `specs/` directory. No human tutorials created. |

**Post-Design Gate Result**: ✅ PASS - Design maintains constitutional compliance.

## Generated Artifacts

| Artifact | Location | Purpose |
|----------|----------|---------|
| research.md | `specs/AIB-130-add-telemetry-metrics/research.md` | Phase 0: Technical decisions and rationale |
| data-model.md | `specs/AIB-130-add-telemetry-metrics/data-model.md` | Entity definitions and data flow |
| api-contracts.md | `specs/AIB-130-add-telemetry-metrics/contracts/api-contracts.md` | API endpoint specifications |
| quickstart.md | `specs/AIB-130-add-telemetry-metrics/quickstart.md` | Implementation guide and checklist |
