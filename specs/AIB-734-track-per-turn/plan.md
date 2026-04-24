# Implementation Plan: Track Per-Turn Context Size On Jobs To Analyze Context Rot Impact On Quality

**Branch**: `AIB-734-track-per-turn` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-734-track-per-turn/spec.md`

## Summary

Extend the existing job telemetry pipeline so supported turn-level agent telemetry can persist `peakContextSize`, `averageContextSize`, and `turnCount` on `Job`, expose those fields through the ticket jobs API, and add project analytics slices that chart peak-context distribution by command type, workflow type, and quality-score bucket. Unsupported agents and historical jobs remain unchanged with null context metrics and explicit empty-state handling.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5.95.2, Recharts 3.x, Zod, shadcn/ui, lucide-react
**Storage**: PostgreSQL 14+ via Prisma ORM (`Job` telemetry fields and analytics queries over `Job` + `Ticket`)
**Testing**: Vitest unit + integration tests, Playwright available but not required for this feature
**Target Platform**: Web application (Next.js App Router)
**Project Type**: Web
**Performance Goals**: Preserve existing job-completion flow with no extra manual runner instrumentation; analytics refresh remains on the current 15s cadence; ticket timeline still renders job rows without blocking on missing context metrics
**Constraints**: No fabricated zero values for unsupported/historical jobs, project-access rules must remain unchanged, use semantic Tailwind tokens only, keep telemetry ingestion tolerant of partial provider payloads, do not weaken existing idempotent job-status and telemetry merge behavior
**Scale/Scope**: Per-project analytics for completed jobs in scope; three new nullable job metrics; new analytics filters/groupings for command type, workflow type, and quality-score bucket; initial support only for agent telemetry formats that already emit per-turn context measurements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Prisma schema, API route payloads, analytics types, and UI props all extend existing strict TypeScript surfaces |
| II. Component-Driven Architecture | PASS | UI work stays in `components/ticket/` and `components/analytics/`; API work stays in existing App Router routes and `lib/analytics/` helpers |
| III. Test-Driven Development | PASS | Existing telemetry, ticket jobs, analytics route, quality-score analytics, and dashboard tests will be extended rather than duplicated |
| IV. Security-First | PASS | Existing `verifyProjectAccess()` and workflow-token auth stay authoritative; Zod-validated analytics filters remain the public contract |
| V. Database Integrity | PASS | New persisted metrics are nullable `Job` columns added via Prisma migration; telemetry persistence follows existing merge/update patterns and must not alter unsupported jobs |
| V. Spec Clarification Guardrails | PASS | Spec already records auto-resolved decisions and preserves conservative missing-data behavior |

**Gate Result**: PASS. No constitution violations identified before research.

## Project Structure

### Documentation (this feature)

```text
specs/AIB-734-track-per-turn/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   ├── project-context-analytics.yaml
│   └── ticket-job-context-metrics.yaml
├── workflows/
│   ├── job-context-metrics-ingestion.md
│   └── project-context-analytics.md
└── tasks.md            # Phase 2 output, not created by this command
```

### Source Code (repository root)

```text
app/
├── api/projects/[projectId]/analytics/route.ts
├── api/projects/[projectId]/tickets/[id]/jobs/route.ts
└── projects/[projectId]/analytics/page.tsx

components/
├── analytics/
│   ├── analytics-dashboard.tsx
│   ├── context-peak-distribution-chart.tsx
│   ├── context-quality-bucket-chart.tsx
│   ├── empty-state.tsx
│   └── [existing analytics chart components reused where possible]
└── ticket/
    └── jobs-timeline.tsx

lib/
├── analytics/
│   ├── aggregations.ts
│   ├── context-metrics.ts
│   ├── queries.ts
│   ├── types.ts
│   └── [existing analytics helpers]
├── telemetry/
│   └── otlp-processor.ts
└── types/
    └── job-types.ts

prisma/
├── schema.prisma
└── migrations/[new migration]/

tests/
├── integration/analytics/
│   ├── analytics-route.test.ts
│   └── quality-score.test.ts
├── integration/jobs/
│   └── ticket-jobs.test.ts
├── integration/telemetry/
│   └── agent-agnostic.test.ts
└── unit/components/
    └── analytics-dashboard.test.tsx
```

**Structure Decision**: Reuse the existing telemetry ingestion, ticket jobs API, and analytics stack. Add narrowly scoped files only where discovery found no existing owner for context-risk classification or new analytics visualizations.

## Phase 0: Research Output

Phase 0 produces [research.md](./research.md) with:

- existing-file inventory for telemetry ingestion, ticket jobs API, timeline UI, analytics queries/types/dashboard, and all relevant tests
- resolved decisions for supported telemetry handling, null semantics, risk-band thresholds, analytics grouping design, and empty-state behavior
- concrete implementation patterns to follow for telemetry merging, auth/validation, idempotent state transitions, and analytics filtering

## Phase 1: Design Output

Phase 1 produces:

- [data-model.md](./data-model.md)
- [contracts/ticket-job-context-metrics.yaml](./contracts/ticket-job-context-metrics.yaml)
- [contracts/project-context-analytics.yaml](./contracts/project-context-analytics.yaml)
- [workflows/job-context-metrics-ingestion.md](./workflows/job-context-metrics-ingestion.md)
- [workflows/project-context-analytics.md](./workflows/project-context-analytics.md)

## Testing Strategy

| Scope | Existing file to extend | Why |
|------|--------------------------|-----|
| Telemetry ingestion of turn-level context data | `tests/integration/telemetry/agent-agnostic.test.ts` | Already validates provider-specific OTLP ingestion and null-safe accumulation rules |
| Ticket jobs API response shape | `tests/integration/jobs/ticket-jobs.test.ts` | Already verifies job telemetry fields and missing-data behavior for pending/unsupported jobs |
| Analytics route filters and empty-state semantics | `tests/integration/analytics/analytics-route.test.ts` | Already covers outcome/agent/range filters, `hasData`, and mixed-provider telemetry |
| Quality-score analytics interplay | `tests/integration/analytics/quality-score.test.ts` | Already seeds scored vs unscored verify jobs and dimension aggregations |
| Analytics dashboard filter/render behavior | `tests/unit/components/analytics-dashboard.test.tsx` | Existing harness already mocks charts and verifies filter state/empty-state UI |

Additional new test files should only be introduced if a context-specific helper is added and no existing file covers that domain cleanly.

## Post-Design Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Design adds explicit nullable fields and API contracts instead of ad hoc JSON |
| II. Component-Driven Architecture | PASS | Design keeps API, analytics, and UI logic in their existing feature folders |
| III. Test-Driven Development | PASS | Planned test coverage extends the current integration/component suites first |
| IV. Security-First | PASS | No new auth surface; all route changes remain inside protected project APIs |
| V. Database Integrity | PASS | Nullable columns + existing atomic update patterns preserve integrity for unsupported and historical jobs |
| V. Spec Clarification Guardrails | PASS | Design keeps conservative null semantics and tunable thresholds without inventing telemetry |

**Post-Design Gate Result**: PASS. Proceed to Phase 2 task planning.

## Complexity Tracking

No constitution violations require justification.
