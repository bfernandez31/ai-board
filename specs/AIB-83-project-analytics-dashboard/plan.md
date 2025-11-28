# Implementation Plan: Project Analytics Dashboard

**Branch**: `AIB-83-project-analytics-dashboard` | **Date**: 2025-11-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-83-project-analytics-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a project analytics dashboard accessible from the project dropdown menu that visualizes Claude telemetry data (tokens, cost, duration, tools) to monitor project health and activity. The dashboard includes 4 overview cards (total cost, success rate, avg duration, tickets shipped) and 7 charts (cost over time, cost by stage, token usage, top tools, cache efficiency, workflow distribution, velocity). Uses existing Job telemetry fields for all metrics without requiring database schema changes.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 15 (App Router), React 18, TanStack Query v5.90.5, Prisma 6.x, shadcn/ui, TailwindCSS 3.4
**Storage**: PostgreSQL 14+ (existing schema - Job model with telemetry fields already present)
**Testing**: Vitest (unit tests for aggregation utilities), Playwright (integration tests for UI and API)
**Target Platform**: Web (Vercel deployment), responsive desktop/tablet/mobile
**Project Type**: Web application (Next.js App Router with API routes)
**Performance Goals**: Page load <2 seconds for projects with 500 jobs, chart rendering <500ms
**Constraints**: No database migrations (use existing Job telemetry fields), authorization via verifyProjectAccess, responsive Bento Grid layout
**Scale/Scope**: Support projects with 100-1000 jobs, 7 chart types, 4 overview metrics, aggregation queries optimized with Prisma indexes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: TypeScript-First Development
- **Status**: PASS
- **Evidence**: All code will use TypeScript strict mode with explicit types
- **Action**: Create TypeScript interfaces for analytics API responses and aggregation results

### ✅ Principle II: Component-Driven Architecture
- **Status**: PASS
- **Evidence**: Will use shadcn/ui components (Card, Chart primitives via Recharts integration)
- **Action**: Feature folder structure: `/components/analytics/` for dashboard components
- **API Convention**: GET `/api/projects/[projectId]/analytics` following existing patterns

### ✅ Principle III: Test-Driven Development
- **Status**: PASS
- **Evidence**: Hybrid testing strategy with Vitest + Playwright
- **Action**: Search for existing test files first, then:
  - Vitest unit tests for aggregation functions (cost calculations, success rate, token metrics)
  - Playwright integration tests for analytics page rendering and API responses
- **Test Discovery**: Use `npx grep -r "analytics" tests/` before creating new test files

### ✅ Principle IV: Security-First Design
- **Status**: PASS
- **Evidence**: Authorization via `verifyProjectAccess()`, Zod schema validation for API
- **Action**: Validate projectId input, use Prisma parameterized queries, no sensitive data exposure

### ✅ Principle V: Database Integrity
- **Status**: PASS
- **Evidence**: No schema changes required - uses existing Job model telemetry fields
- **Action**: Use existing indexes on Job table (projectId, startedAt, status, ticketId) for query optimization

### ✅ Principle VI: Specification Clarification Guardrails
- **Status**: PASS
- **Evidence**: AUTO policy applied with 3 auto-resolved decisions documented in spec
- **Action**: Review pragmatic trade-offs (30-day default, no caching, daily granularity) before implementation

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── analytics/
│               └── route.ts              # GET endpoint for aggregated analytics data
└── (authenticated)/
    └── project/
        └── [projectKey]/
            └── analytics/
                └── page.tsx              # Analytics dashboard page

components/
└── analytics/
    ├── overview-cards.tsx                # Four metric cards (cost, success rate, duration, velocity)
    ├── cost-over-time-chart.tsx          # Area chart with daily/weekly toggle
    ├── cost-by-stage-chart.tsx           # Horizontal bar chart
    ├── token-usage-chart.tsx             # Stacked/grouped bar chart
    ├── top-tools-chart.tsx               # Horizontal bar chart
    ├── cache-efficiency-chart.tsx        # Donut/ring chart
    ├── workflow-distribution-chart.tsx   # Donut chart
    └── velocity-chart.tsx                # Bar chart

lib/
├── analytics/
│   ├── aggregations.ts                   # Pure functions for cost, token, tool aggregations
│   ├── calculations.ts                   # Success rate, duration, cache efficiency formulas
│   └── types.ts                          # TypeScript interfaces for analytics data
└── db/
    └── analytics-queries.ts              # Prisma queries for Job/Ticket analytics data

tests/
├── unit/
│   └── analytics/
│       ├── aggregations.test.ts          # Vitest tests for aggregation functions
│       └── calculations.test.ts          # Vitest tests for metric calculations
└── integration/
    └── analytics/
        ├── api.spec.ts                   # Playwright API tests
        └── dashboard.spec.ts             # Playwright UI tests
```

**Structure Decision**: Next.js App Router web application structure. Analytics feature uses:
- **API Layer**: `/app/api/projects/[projectId]/analytics/route.ts` follows existing project API patterns
- **Page Layer**: `/app/(authenticated)/project/[projectKey]/analytics/page.tsx` matches existing authenticated project routes
- **Component Layer**: `/components/analytics/` feature folder with chart components
- **Library Layer**: `/lib/analytics/` for pure functions (Vitest tested) and `/lib/db/analytics-queries.ts` for Prisma queries
- **Test Layer**: Hybrid approach with `/tests/unit/analytics/` (Vitest) and `/tests/integration/analytics/` (Playwright)

## Complexity Tracking

*No violations detected. All constitution principles satisfied.*

---

## Phase 1 Re-Evaluation

**Constitution Check Status**: ✅ ALL GATES PASS

All design artifacts (research.md, data-model.md, contracts, quickstart.md) have been generated and reviewed:

### ✅ Principle I: TypeScript-First Development
- **Re-check**: PASS
- **Evidence**: Complete TypeScript interfaces defined in data-model.md and contracts
- **Implementation Ready**: All types documented in `lib/analytics/types.ts` section

### ✅ Principle II: Component-Driven Architecture
- **Re-check**: PASS
- **Evidence**: Component structure defined in quickstart.md using shadcn/ui primitives
- **Implementation Ready**: 8 chart components + overview cards component planned

### ✅ Principle III: Test-Driven Development
- **Re-check**: PASS
- **Evidence**: Quickstart.md follows TDD workflow (write tests first, then implement)
- **Implementation Ready**: Unit test structure (Vitest) and integration test structure (Playwright) documented

### ✅ Principle IV: Security-First Design
- **Re-check**: PASS
- **Evidence**: API contract specifies Zod validation and verifyProjectAccess authorization
- **Implementation Ready**: Security pattern matches existing API routes

### ✅ Principle V: Database Integrity
- **Re-check**: PASS
- **Evidence**: No schema migrations required; uses existing Job/Ticket models with existing indexes
- **Implementation Ready**: Query patterns leverage existing Prisma indexes for performance

### ✅ Principle VI: Specification Clarification Guardrails
- **Re-check**: PASS
- **Evidence**: All PRAGMATIC trade-offs documented in research.md with rationale
- **Implementation Ready**: 30-day default, no caching, daily granularity decisions justified

---

## Design Completeness

**Phase 0 Artifacts**: ✅ research.md (12 technical decisions documented)
**Phase 1 Artifacts**: ✅ data-model.md, contracts/analytics-api.yaml, quickstart.md
**Agent Context**: ✅ CLAUDE.md updated with analytics technology stack
**Implementation Ready**: ✅ All unknowns resolved, contracts defined, implementation path documented

**Next Step**: Run `/speckit.tasks` to generate tasks.md for implementation tracking
