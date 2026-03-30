# Implementation Plan: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Branch**: `AIB-404-health-scan-metrics` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-404-health-scan-metrics/spec.md`

## Summary

Enrich the health scan dashboard with trend visualization and telemetry metrics. This involves: (1) a new trend API endpoint returning last-20 scores per active module, fetched once on mount; (2) enriching scan history lines with compact metric icons (issues, cost, tokens, duration); (3) sparkline mini-charts on active module cards; and (4) full area charts in module drawers following the Quality Gate drawer pattern. All changes build on existing Recharts, TanStack Query, and Prisma infrastructure.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Recharts 3.x, TanStack Query v5.95.2, shadcn/ui, lucide-react
**Storage**: PostgreSQL 14+ via Prisma 6.x (existing `HealthScan` model with `score`, `durationMs`, `tokensUsed`, `costUsd`, `issuesFound` fields)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web (browser), responsive down to 375px
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Trend endpoint < 200ms; sparklines render without layout shift; single additional network request on mount
**Constraints**: No polling for trend data (fetch once on mount); WCAG AA 4.5:1 contrast; no new dependencies
**Scale/Scope**: Up to 20 trend data points per module, 4 active modules, paginated scan history

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types, interfaces, and API responses will have explicit TypeScript types |
| II. Component-Driven | PASS | New components follow shadcn/ui patterns; sparkline and area chart use existing Recharts; feature files in `components/health/` |
| III. Test-Driven | PASS | Integration tests for trend API endpoint; component tests for sparkline and enriched history; extends existing test patterns |
| IV. Security-First | PASS | Trend endpoint uses existing `verifyProjectAccess`; no new user input beyond projectId; Prisma parameterized queries |
| V. Database Integrity | PASS | No schema changes required — `tokensUsed`, `costUsd`, `durationMs` already exist on `HealthScan` model; read-only queries |
| V. Spec Clarification | PASS | All auto-resolved decisions documented in spec with rationale and trade-offs |

**Gate Result**: PASS — No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-404-health-scan-metrics/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── trend-endpoint.md
└── tasks.md             # Phase 2 output (via /ai-board.tasks)
```

### Source Code (repository root)

```
# API (new endpoint + modification)
app/api/projects/[projectId]/health/trend/route.ts    # NEW: Trend data endpoint
app/api/projects/[projectId]/health/scans/route.ts    # MODIFY: Add tokensUsed, costUsd to select

# Hooks
app/lib/hooks/useHealthTrend.ts                       # NEW: Fetch trend data once on mount

# Types
lib/health/types.ts                                   # MODIFY: Add TrendResponse, TrendDataPoint types

# Query Keys
app/lib/query-keys.ts                                 # MODIFY: Add health.trend key

# Components (new)
components/health/sparkline.tsx                        # NEW: Mini sparkline component (~40px)
components/health/drawer/module-area-chart.tsx         # NEW: Area chart for module drawers

# Components (modified)
components/health/health-module-card.tsx               # MODIFY: Add sparkline to active module cards
components/health/drawer/drawer-history.tsx            # MODIFY: Enrich history lines with metric icons
components/health/scan-detail-drawer.tsx               # MODIFY: Add area chart section

# Tests
tests/integration/health/trend-endpoint.test.ts       # NEW: Trend API tests
tests/unit/components/sparkline.test.tsx               # NEW: Sparkline component tests
tests/unit/components/drawer-history-metrics.test.tsx  # NEW: Enriched history tests
```

**Structure Decision**: Follows existing feature-based layout under `components/health/` and `app/api/projects/[projectId]/health/`. New trend endpoint gets its own route file; visualization components are co-located with existing drawer components.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|-----------|-----------|----------|-----------|
| US1: Trend endpoint | Integration | `tests/integration/health/` | API + database query — Vitest integration |
| US2: Enriched history | Component | `tests/unit/components/` | React component with mock data — RTL |
| US3: Sparklines | Component | `tests/unit/components/` | React component rendering logic — RTL |
| US4: Area chart in drawers | Component | `tests/unit/components/` | React component following QG pattern — RTL |

**Critical decisions**:
- Trend endpoint tested as integration (DB query + auth)
- All UI components tested as unit/component tests (no E2E needed — no OAuth, drag-drop, or viewport-specific behavior)
- Extends existing health scan test patterns

## Complexity Tracking

*No constitution violations to justify — all gates pass.*
