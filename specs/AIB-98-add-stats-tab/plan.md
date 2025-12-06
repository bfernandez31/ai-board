# Implementation Plan: Add Stats Tab to Ticket Detail Modal

**Branch**: `AIB-98-add-stats-tab` | **Date**: 2025-12-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-98-add-stats-tab/spec.md`

## Summary

Add a fourth "Stats" tab to the ticket detail modal that displays aggregated telemetry metrics from all workflow jobs associated with the ticket. The tab shows summary cards (Total Cost, Total Duration, Total Tokens, Cache Efficiency), a chronological job timeline with expandable token breakdowns, and aggregated tool usage statistics. Implementation leverages existing job polling (2s interval) and reuses analytics aggregation patterns.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TailwindCSS 3.4, shadcn/ui, TanStack Query v5, Recharts 2.x
**Storage**: PostgreSQL 14+ via Prisma 6.x (Job model already has all required telemetry fields)
**Testing**: Playwright (E2E), Vitest (unit tests for aggregation utilities)
**Target Platform**: Web (modern browsers, desktop viewport)
**Project Type**: Web application (Next.js monorepo)
**Performance Goals**: Stats tab render <100ms when job data available; expandable rows <200ms interaction response
**Constraints**: <2s for complete job telemetry visibility; summary metrics visible without scrolling on 1024px viewport
**Scale/Scope**: Single ticket context; typically 1-20 jobs per ticket

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All code in strict TS; explicit types for aggregation functions, TicketJob interface expansion |
| II. Component-Driven | ✅ PASS | Uses shadcn/ui components (Card, Tabs, Collapsible); feature folder at `/components/ticket/` |
| III. Test-Driven | ✅ PASS | Vitest for aggregation utilities, Playwright for component integration |
| IV. Security-First | ✅ PASS | No new user input; data from existing authenticated API routes |
| V. Database Integrity | ✅ PASS | No schema changes; Job model already has telemetry fields |
| V. Clarification Guardrails | ✅ PASS | Spec includes Auto-Resolved Decisions section |

**Pre-Phase 0 Gate**: ✅ PASSED

### Post-Phase 1 Re-check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | `TicketJobWithStats`, `TicketStats`, `ToolUsageCount` types defined in data-model.md; Zod validation schema in contracts |
| II. Component-Driven | ✅ PASS | Component hierarchy defined: StatsTab → SummaryCards + JobTimeline + ToolsUsage; all using shadcn/ui primitives |
| III. Test-Driven | ✅ PASS | Test plan: Vitest unit tests for `calculateTicketStats()`, Playwright E2E for tab interaction |
| IV. Security-First | ✅ PASS | API extends existing authenticated route; no new attack surface |
| V. Database Integrity | ✅ PASS | No schema changes; read-only access to existing Job fields |
| V. Clarification Guardrails | ✅ PASS | All research decisions documented with rationale and alternatives |

**Post-Phase 1 Gate**: ✅ PASSED

## Project Structure

### Documentation (this feature)

```
specs/AIB-98-add-stats-tab/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js Web Application Structure
app/
├── api/
│   └── projects/[projectId]/
│       └── tickets/[id]/
│           └── jobs/route.ts        # Extend to include telemetry fields

components/
├── board/
│   └── ticket-detail-modal.tsx      # Add 4th tab, keyboard shortcut Ctrl+4
├── ticket/
│   ├── stats-tab.tsx                # NEW: Main stats tab component
│   ├── stats-summary-cards.tsx      # NEW: Summary metrics display
│   ├── job-timeline.tsx             # NEW: Chronological job list
│   ├── job-timeline-row.tsx         # NEW: Expandable job row
│   └── tools-usage-section.tsx      # NEW: Aggregated tool counts

lib/
├── analytics/
│   └── aggregations.ts              # Reuse existing formatters
├── types/
│   └── job-types.ts                 # Extend TicketJob interface

tests/
├── unit/
│   └── stats-aggregation.test.ts    # Vitest: aggregation calculations
└── e2e/
    └── stats-tab.spec.ts            # Playwright: tab interaction, display
```

**Structure Decision**: Next.js web application structure. New components follow feature-folder pattern under `/components/ticket/`. Existing analytics aggregation utilities reused. No new API routes needed; existing `/api/projects/[projectId]/tickets/[id]/jobs` route extended to include telemetry fields.

## Complexity Tracking

*No constitution violations requiring justification.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | — | — |
