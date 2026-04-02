# Implementation Plan: Project Config in DB + Dynamic Workflow Dispatch

**Branch**: `AIB-478-project-config-in` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-478-project-config-in/spec.md`

## Summary

Store each project's `.ai-board/config.yml` as structured JSON in the database and replace the hardcoded service inputs in `getProjectServiceInputs()` with dynamic lookups. Add a config sync API endpoint, auto-refresh on stale config before workflow dispatch, and a read-only config display card in project settings.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, Zod, Octokit, TanStack Query v5
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Linux server (Node.js 22.20.0)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Config sync < 5s (SC-002), dispatch latency negligible increase
**Constraints**: Backward-compatible — null config = current defaults; no breaking changes
**Scale/Scope**: Multi-project platform, ~dozens of projects

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TS; `ProjectConfig` type from Zod inference; explicit types on all functions |
| II. Component-Driven | PASS | New `ConfigCard` in `components/settings/`; Server Component default, `"use client"` only for sync button interaction; shadcn/ui components only |
| III. Test-Driven | PASS | Unit tests for config→service-input mapping; integration tests for sync API + dispatch; no E2E needed (no browser-only features) |
| IV. Security-First | PASS | Zod validation on all config input; authorization via `verifyProjectAccess`; no secrets stored in config JSON; `env` section from config.yml excluded from DB storage |
| V. Database Integrity | PASS | Prisma migration for new fields; nullable `config` (Json?) + `configSyncedAt` (DateTime?); no breaking schema changes |
| V. Spec Guardrails | PASS | Auto-resolved decisions documented with CONSERVATIVE fallbacks; trade-offs listed |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-478-project-config-in/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── config-sync-api.md
└── tasks.md             # Phase 2 output (NOT created by /plan)
```

### Source Code (affected files)

```
prisma/
└── schema.prisma                          # Add config fields to Project model

lib/
├── workflows/service-inputs.ts            # Dynamic config → service inputs mapping
├── workflows/transition.ts                # Pass config through all dispatch paths
├── validations/config.ts                  # Already exists — reuse for sync validation
├── config-loader.ts                       # Adapt for GitHub fetch (currently filesystem)
└── config-sync.ts                         # NEW: fetch config from GitHub + validate + store

app/
├── api/projects/[projectId]/
│   ├── route.ts                           # Extend PATCH for config fields (if needed)
│   └── config/
│       └── sync/route.ts                  # NEW: POST endpoint for manual config sync
├── lib/schemas/clarification-policy.ts    # Extend projectUpdateSchema if needed
└── lib/workflows/dispatch-ai-board.ts     # Add service inputs to AI-board dispatch

.github/
├── scripts/setup-environment.sh           # Centralize ORM setup (prisma generate + migrate)
└── workflows/                             # Remove hardcoded Prisma steps from all workflows
    ├── health-scan.yml
    ├── speckit.yml
    ├── quick-impl.yml
    ├── verify.yml
    └── iterate.yml

components/
└── settings/
    └── config-card.tsx                    # NEW: read-only config display + sync button

tests/
├── unit/
│   └── service-inputs.test.ts             # NEW: config→inputs mapping tests
├── integration/
│   └── projects/
│       └── config-sync.test.ts            # NEW: sync API + dispatch integration tests
```

> **Note on dispatch inputs**: `package_manager` is NOT a dispatch input. `setup-environment.sh` reads `runtime.manager` directly from the cloned repo's `config.yml`. Dispatch only passes service container flags (`needs_*`, `*_version`). ORM commands (prisma generate/migrate) are centralized in `setup-environment.sh` — not hardcoded per-workflow.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|-----------|-----------|----------|-----------|
| US1: Dynamic dispatch | Unit | `tests/unit/service-inputs.test.ts` | Pure function mapping config→inputs |
| US1: Default fallback | Unit | `tests/unit/service-inputs.test.ts` | Pure function with null input |
| US2: Config sync API | Integration | `tests/integration/projects/config-sync.test.ts` | API + DB operation |
| US2: Invalid YAML rejection | Integration | `tests/integration/projects/config-sync.test.ts` | API validation |
| US3: Config display | Component | `tests/unit/components/config-card.test.tsx` | React component with mocked data |
| US4: Auto-import on create | Integration | Extend existing project creation tests | DB operation on project create |
| Auto-refresh staleness | Integration | `tests/integration/projects/config-sync.test.ts` | Time-based logic + DB |

## Complexity Tracking

No constitution violations — this section intentionally empty.
