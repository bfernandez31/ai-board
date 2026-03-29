# Implementation Plan: Health Dashboard - Passive Modules (Quality Gate & Last Clean)

**Branch**: `AIB-374-health-dashboard-modules` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-374-health-dashboard-modules/spec.md`

## Summary

Add two passive Health Dashboard modules — **Quality Gate** and **Last Clean** — that display aggregated quality data from SHIP tickets and cleanup job history. Quality Gate calculates a 30-day average quality score with trend, dimension breakdown, and threshold distribution; it contributes 20% to the global Health Score. Last Clean shows the most recent cleanup job status with staleness detection and a history drawer. Both modules follow the existing passive module pattern (no scan trigger button, "passive" badge on card).

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5, shadcn/ui, Recharts 2.x, TailwindCSS 3.4
**Storage**: PostgreSQL 14+ via Prisma ORM — existing `Job`, `Ticket`, `HealthScore` models
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web (Next.js App Router)
**Project Type**: Web application (monorepo-style Next.js)
**Performance Goals**: Health Dashboard loads within 2 seconds (SC-001), card status visible within 1 second (SC-004)
**Constraints**: No new DB migrations — all data derived from existing `Job` model fields (`qualityScore`, `qualityScoreDetails`, `command='clean'`)
**Scale/Scope**: Per-project dashboard, typically <100 SHIP tickets per 30-day window

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| **I. TypeScript-First** | ✅ PASS | All new code in strict TypeScript; existing types in `lib/health/types.ts` already define `QualityGateReport`, `LastCleanReport`, `HealthModuleStatus` |
| **II. Component-Driven** | ✅ PASS | New components follow `components/health/` feature folder; shadcn/ui Sheet for drawers; Server Components default with `"use client"` only for interactive drawers |
| **III. Test-Driven** | ✅ PASS | Integration tests for new API aggregation logic; component tests for card/drawer rendering; extends existing `tests/integration/health/` and `tests/unit/components/` |
| **IV. Security-First** | ✅ PASS | Uses existing `verifyProjectAccess` auth; Prisma parameterized queries; no new user input beyond projectId (already validated) |
| **V. Database Integrity** | ✅ PASS | No schema migrations — all data derived from existing `Job` model via Prisma queries; read-only aggregation |
| **VI. AI-First Model** | ✅ PASS | No README/guide files; spec artifacts in `specs/AIB-374-health-dashboard-modules/` |

## Project Structure

### Documentation (this feature)

```
specs/AIB-374-health-dashboard-modules/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   └── health-api.md    # Extended health endpoint response
├── checklists/          # Existing checklists
└── tasks.md             # Phase 2 output (NOT created by /plan)
```

### Source Code (repository root)

```
# Modified files
app/api/projects/[projectId]/health/route.ts          # Extend GET to return 30-day QG aggregate + Last Clean details
lib/health/score-calculator.ts                          # Already includes qualityGate in global score calc
lib/health/types.ts                                     # Extend HealthModuleStatus, add QualityGateDetail types

# New files
lib/health/quality-gate.ts                              # 30-day QG aggregation: average, trend, dimensions, distribution
lib/health/last-clean.ts                                # Last Clean data derivation: date, files, issues, staleness, history
components/health/drawer/quality-gate-drawer-content.tsx # QG drawer: dimensions table, ticket list, trend chart
components/health/drawer/last-clean-drawer-content.tsx   # Last Clean drawer: summary + history list

# Test files
tests/integration/health/quality-gate.test.ts           # QG aggregation logic + API response
tests/integration/health/last-clean.test.ts             # Last Clean derivation + API response
tests/unit/components/quality-gate-drawer.test.tsx       # QG drawer rendering
tests/unit/components/last-clean-drawer.test.tsx         # Last Clean drawer rendering
```

**Structure Decision**: Extends existing `components/health/` and `lib/health/` directories. New server-side aggregation functions isolated in dedicated modules (`quality-gate.ts`, `last-clean.ts`) to keep the route handler clean.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|------------|-----------|----------|-----------|
| US1 - QG Card Overview | Integration | `tests/integration/health/quality-gate.test.ts` | DB aggregation + API response verification |
| US2 - QG Drawer Detail | Component | `tests/unit/components/quality-gate-drawer.test.tsx` | React rendering with mocked data |
| US3 - Last Clean Card | Integration | `tests/integration/health/last-clean.test.ts` | DB query + API response verification |
| US4 - Last Clean Drawer | Component | `tests/unit/components/last-clean-drawer.test.tsx` | React rendering with mocked data |
| US5 - Global Score Integration | Integration | `tests/integration/health/quality-gate.test.ts` | Extends existing global score tests |
| Edge Cases | Integration | Both integration test files | Empty states, malformed data, multiple verify jobs |

## Complexity Tracking

*No constitution violations. All changes extend existing patterns without introducing new abstractions.*
