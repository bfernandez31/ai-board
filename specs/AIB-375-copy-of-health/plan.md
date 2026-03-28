# Implementation Plan: Health Dashboard - Page, Sidebar, Score Global, Data Model and API

**Branch**: `AIB-375-copy-of-health` | **Date**: 2026-03-28 | **Spec**: `specs/AIB-375-copy-of-health/spec.md`
**Input**: Feature specification from `/specs/AIB-375-copy-of-health/spec.md`

## Summary

Build a Project Health Dashboard with a global health score (0-100), 6 module cards (Security, Compliance, Tests, Spec Sync, Quality Gate, Last Clean), a new data model (HealthScan + HealthScore), REST API endpoints, sidebar navigation entry, and workflow dispatch for triggering scans. The system reuses existing quality score thresholds (Excellent/Good/Fair/Poor), polling patterns (15s), and Aurora B+ theme styling.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, Prisma 6.x, shadcn/ui, lucide-react (HeartPulse icon), Recharts 2.x (optional for future trend charts)
**Storage**: PostgreSQL 14+ via Prisma ORM — two new models (HealthScan, HealthScore)
**Testing**: Vitest (unit + integration), Playwright (E2E for sidebar nav only)
**Target Platform**: Web application (Next.js on Vercel)
**Project Type**: Web application (existing monorepo)
**Performance Goals**: Health page loads cached scores within standard page load time; API responses < 200ms for cached data
**Constraints**: No hardcoded colors (Aurora theme tokens only), WCAG AA 4.5:1 contrast, polling-based updates (no WebSockets)
**Scale/Scope**: Per-project health tracking, 6 module types, incremental scan support

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅ PASS
- All new models will have corresponding TypeScript interfaces
- Zod schemas for all API request/response validation
- Strict mode enforced, no `any` types
- HealthScanType, HealthScanStatus enums typed in Prisma + TypeScript

### II. Component-Driven Architecture ✅ PASS
- Health page as Server Component (data fetching), client components only for interactive cards
- shadcn/ui components for cards, badges, buttons, spinners
- Feature folder: `components/health/` for all dashboard components
- API routes: `app/api/projects/[projectId]/health/` namespace

### III. Test-Driven Development ✅ PASS
- Integration tests for all API endpoints (Vitest)
- Component tests for module cards and score display (Vitest + RTL)
- E2E test for sidebar navigation only (Playwright)
- No feature shipped without passing tests

### IV. Security-First Design ✅ PASS
- `verifyProjectAccess()` on all health endpoints
- Zod validation on all inputs (projectId, scanType, pagination)
- No sensitive data exposed in API responses
- Workflow token auth for scan status updates

### V. Database Integrity ✅ PASS
- Schema changes via Prisma migration
- Foreign key constraints (HealthScan → Project, HealthScore → Project)
- Unique constraint on HealthScore per project
- Concurrent scan prevention at application level with DB-backed check

### VI. AI-First Development Model ✅ PASS
- No README or tutorial files created
- All artifacts in `specs/AIB-375-copy-of-health/`

**Gate Result**: ALL PASS — proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-375-copy-of-health/
├── plan.md              # This file
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: HealthScan + HealthScore models
├── quickstart.md        # Phase 1: implementation quickstart
├── contracts/           # Phase 1: API contracts
│   ├── health-score-api.yaml
│   └── health-scan-api.yaml
└── tasks.md             # Phase 2 output (NOT created by plan)
```

### Source Code (repository root)

```
prisma/
└── schema.prisma                          # + HealthScan, HealthScore models, HealthScanType/Status enums

app/
├── projects/[projectId]/health/
│   └── page.tsx                           # Health Dashboard page (Server Component)
└── api/projects/[projectId]/health/
    ├── route.ts                           # GET health score
    └── scans/
        ├── route.ts                       # GET scan history, POST trigger scan
        └── [scanId]/
            └── status/
                └── route.ts               # PATCH scan status (workflow callback)

components/
└── health/
    ├── health-dashboard.tsx               # Main dashboard layout (Client Component)
    ├── global-score-card.tsx              # Global score display with sub-badges
    ├── module-card.tsx                    # Individual module card (4 states)
    └── scan-action-button.tsx             # Scan trigger button with spinner

lib/
├── health/
│   ├── types.ts                           # TypeScript interfaces
│   ├── queries.ts                         # Prisma queries for health data
│   ├── score-calculator.ts                # Global score weighted average logic
│   └── constants.ts                       # Module configs, scan type mappings
└── hooks/
    └── useHealthPolling.ts                # TanStack Query hook with 15s polling

components/navigation/
└── nav-items.ts                           # + Health entry after Comparisons

tests/
├── unit/
│   └── health/
│       └── score-calculator.test.ts       # Pure function tests
├── unit/components/
│   └── health/
│       ├── module-card.test.tsx            # Component state tests
│       └── global-score-card.test.tsx      # Score display tests
├── integration/
│   └── health/
│       ├── health-score-api.test.ts        # GET /health endpoint
│       ├── health-scan-api.test.ts         # GET/POST /health/scans
│       └── scan-status-api.test.ts         # PATCH scan status
└── e2e/
    └── health-navigation.spec.ts           # Sidebar nav to Health page
```

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|-----------|-----------|----------|-----------|
| US1 - View Health Overview | Component (RTL) | `tests/unit/components/health/` | UI rendering with mocked data, no browser required |
| US1 - Global Score Calculation | Unit | `tests/unit/health/score-calculator.test.ts` | Pure function, no dependencies |
| US2 - Trigger Scan | Integration | `tests/integration/health/health-scan-api.test.ts` | API + DB operation |
| US2 - Scan State Transitions | Component (RTL) | `tests/unit/components/health/module-card.test.tsx` | 4 visual states |
| US3 - Incremental Scanning | Integration | `tests/integration/health/health-scan-api.test.ts` | DB logic for base/head commit tracking |
| US4 - Sidebar Navigation | E2E | `tests/e2e/health-navigation.spec.ts` | Requires browser for full nav flow |
| US5 - Scan History API | Integration | `tests/integration/health/health-scan-api.test.ts` | API + pagination + filtering |
| Edge: Concurrent scan prevention | Integration | `tests/integration/health/health-scan-api.test.ts` | DB constraint check |

## Complexity Tracking

*No constitution violations to justify.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Progress Tracking

- [x] Phase 0: Research (research.md)
- [x] Phase 1: Design & Contracts (data-model.md, contracts/, quickstart.md)
- [ ] Phase 2: Tasks (tasks.md) — *generated by /ai-board.tasks command*
