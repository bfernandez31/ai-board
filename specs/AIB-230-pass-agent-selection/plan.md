# Implementation Plan: Pass Agent Selection Through Workflow Dispatch Pipeline

**Branch**: `AIB-230-pass-agent-selection` | **Date**: 2026-03-05 | **Spec**: `specs/AIB-230-pass-agent-selection/spec.md`
**Input**: Feature specification from `/specs/AIB-230-pass-agent-selection/spec.md`

## Summary

Pass the resolved agent selection (ticket override > project default > CLAUDE fallback) through all workflow dispatch calls so each workflow invokes the correct agent CLI. Uses a mixed strategy: embed agent in existing JSON payloads for speckit.yml and quick-impl.yml, add discrete `agent` input for verify, cleanup, ai-board-assist, and iterate workflows.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, Octokit REST, @prisma/client
**Storage**: PostgreSQL 14+ via Prisma ORM (no schema changes required)
**Testing**: Vitest (integration tests for dispatch logic)
**Target Platform**: Linux server (GitHub Actions runners), Vercel (Next.js)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: N/A (workflow dispatch is asynchronous, not latency-sensitive)
**Constraints**: GitHub Actions 10-input limit per workflow_dispatch
**Scale/Scope**: 6 workflow YAML files, 4 TypeScript dispatch files, 1 utility function

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All changes in TypeScript strict mode. `Agent` enum from Prisma provides type safety. `resolveEffectiveAgent()` has explicit parameter and return types. |
| II. Component-Driven Architecture | PASS | No UI changes. API/workflow code follows existing patterns. |
| III. Test-Driven Development | PASS | Integration tests planned for agent resolution and dispatch payload construction. |
| IV. Security-First Design | PASS | Agent values come from database (Prisma enum-validated), not user input at dispatch time. No injection risk. |
| V. Database Integrity | PASS | No schema changes. Existing `Agent` enum and fields are sufficient. |
| VI. AI-First Development | PASS | No documentation files created at project root. All specs in `specs/AIB-230-pass-agent-selection/`. |

**Gate Result**: ALL PASS - proceed with implementation.

**Post-Design Re-Check**: ALL PASS confirmed. Mixed dispatch strategy respects GitHub Actions 10-input limit (ai-board-assist.yml reaches exactly 10). No new dependencies or schema changes.

## Project Structure

### Documentation (this feature)

```
specs/AIB-230-pass-agent-selection/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── workflow-dispatch.md  # API contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```
lib/workflows/
└── transition.ts            # resolveEffectiveAgent() + payload modifications

app/lib/workflows/
└── dispatch-ai-board.ts     # AIBoardWorkflowInputs interface + dispatch update

app/api/projects/[projectId]/
└── clean/route.ts           # Cleanup dispatch update

.github/workflows/
├── verify.yml               # Add agent input + forward to iterate
├── cleanup.yml              # Add agent input
├── ai-board-assist.yml      # Add agent input
└── iterate.yml              # Add agent input

tests/integration/
└── tickets/                 # Agent dispatch tests
```

**Structure Decision**: Existing web application structure. All changes modify existing files -- no new source files except potentially one test file.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
