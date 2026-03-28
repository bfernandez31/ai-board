# Implementation Plan: Health Dashboard - Page, Sidebar, Score Global, Data Model and API

**Branch**: `AIB-370-health-dashboard-page` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-370-health-dashboard-page/spec.md`

## Summary

Implement a Health Dashboard page at `/projects/[projectId]/health` with a global health score (weighted average of 5 modules at 20% each), 6 module cards in a 2-column grid, scan triggering via workflow dispatch, real-time polling, and sidebar navigation entry. Requires two new Prisma models (HealthScan, HealthScore), three API endpoints (health score, trigger scan, scan history), and a client-side dashboard with TanStack Query polling.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, Prisma 6.x, shadcn/ui, lucide-react (HeartPulse icon), Recharts 2.x (if trend charts needed)
**Storage**: PostgreSQL 14+ via Prisma ORM — two new models (HealthScan, HealthScore)
**Testing**: Vitest (unit + integration), Playwright (E2E for sidebar nav only)
**Target Platform**: Web application (Next.js App Router)
**Performance Goals**: Health page load < 2s (SC-001), scan trigger response < 1s (SC-002)
**Constraints**: Semantic color tokens only (no hardcoded hex/rgb), WCAG AA 4.5:1 contrast, Aurora theme utilities
**Scale/Scope**: Per-project health data; 6 module cards; 5 contributing scan types + 1 informational

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All new models, API routes, hooks, and components will use strict TypeScript with explicit types |
| II. Component-Driven Architecture | ✅ PASS | shadcn/ui primitives, feature folder at `components/health/`, Server Component page with Client Component dashboard |
| III. Test-Driven Development | ✅ PASS | Integration tests for API endpoints, component tests for cards/score display, E2E for sidebar navigation |
| IV. Security-First | ✅ PASS | Zod validation on all inputs, `verifyProjectAccess()` on all endpoints, no raw SQL |
| V. Database Integrity | ✅ PASS | Prisma migrations for new models, unique constraints, foreign keys, proper indexes |
| V. Spec Clarification Guardrails | ✅ PASS | All 5 auto-resolved decisions documented with policies, trade-offs, and reviewer notes |
| VI. AI-First Development | ✅ PASS | No README/tutorial files; all artifacts in `specs/AIB-370-health-dashboard-page/` |

**Gate Result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-370-health-dashboard-page/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── health-score.md
│   ├── trigger-scan.md
│   └── scan-history.md
└── tasks.md             # Phase 2 output (NOT created by plan)
```

### Source Code (repository root)

```
# Next.js App Router structure (existing project)
app/
├── projects/[projectId]/health/
│   └── page.tsx                          # Server component — page entry
├── api/projects/[projectId]/health/
│   ├── route.ts                          # GET health score aggregate
│   ├── scans/
│   │   ├── route.ts                      # POST trigger scan, GET scan history
│   │   └── [scanId]/
│   │       └── status/route.ts           # PATCH scan status (workflow callback)

components/health/
├── health-dashboard.tsx                  # Client component — main dashboard
├── health-hero.tsx                       # Global score hero zone
├── health-module-card.tsx                # Individual module card
└── health-sub-score-badge.tsx            # Compact sub-score badge

lib/health/
├── types.ts                              # HealthScan, HealthScore types & enums
├── score-calculator.ts                   # Weighted average calculation
└── scan-dispatch.ts                      # Workflow dispatch for scans

app/lib/hooks/
├── useHealthPolling.ts                   # TanStack Query hook with 2s polling
└── mutations/useTriggerScan.ts           # Mutation hook for scan trigger

components/navigation/nav-items.ts        # Add Health nav entry (modify existing)

prisma/schema.prisma                      # Add HealthScan + HealthScore models
```

**Structure Decision**: Follows existing Next.js App Router patterns (analytics, comparisons). Feature components in `components/health/`, library code in `lib/health/`, API routes under `app/api/projects/[projectId]/health/`.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|-----------|-----------|----------|-----------|
| US1 - View Health Overview | Integration | `tests/integration/health/health-score.test.ts` | API + DB, no browser needed |
| US1 - Score calculation | Unit | `tests/unit/health/score-calculator.test.ts` | Pure function, no dependencies |
| US2 - Trigger scan | Integration | `tests/integration/health/trigger-scan.test.ts` | API + DB + workflow dispatch |
| US2 - Scan status update | Integration | `tests/integration/health/scan-status.test.ts` | API + DB state transition |
| US3 - Sidebar navigation | E2E | `tests/e2e/health-navigation.spec.ts` | Requires browser for nav click |
| US4 - Incremental scanning | Integration | `tests/integration/health/incremental-scan.test.ts` | DB logic for commit cursors |
| US5 - Scan history | Integration | `tests/integration/health/scan-history.test.ts` | API + DB with filtering |
| Module card states | Component | `tests/unit/components/health-module-card.test.tsx` | React component with 4 states |
| Hero score display | Component | `tests/unit/components/health-hero.test.tsx` | React component with thresholds |

## Complexity Tracking

*No constitution violations requiring justification.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | — | — |
