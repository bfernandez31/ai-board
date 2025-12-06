# Implementation Plan: Add Stats Tab to Ticket Detail Modal

**Branch**: `AIB-99-add-stats-tab` | **Date**: 2025-12-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-99-add-stats-tab/spec.md`

## Summary

Add a fourth "Stats" tab to the ticket detail modal that displays aggregated telemetry metrics from all workflow jobs associated with the ticket. The tab will show summary cards (total cost, duration, tokens, cache efficiency), a chronological jobs timeline with expandable token breakdowns, and aggregated tool usage statistics. The Stats tab will only be visible when the ticket has at least one associated job.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, shadcn/ui, Recharts 2.x
**Storage**: PostgreSQL 14+ via Prisma 6.x (existing Job model with telemetry fields)
**Testing**: Playwright (E2E), Vitest (unit) - hybrid testing strategy per constitution
**Target Platform**: Web (responsive: mobile full-screen, desktop modal)
**Project Type**: Web application
**Performance Goals**: Stats display within 1 second of modal open, updates within 2 seconds via polling
**Constraints**: Must reuse existing 2-second job polling infrastructure, no additional API endpoints required
**Scale/Scope**: Single feature addition to existing ticket detail modal component

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status |
|-----------|-------------|--------|
| **I. TypeScript-First** | Explicit types for all components, props, hooks | ✅ PASS |
| **II. Component-Driven** | Use shadcn/ui components exclusively | ✅ PASS |
| **III. Test-Driven** | E2E test with Playwright, unit tests for pure functions with Vitest | ✅ PASS |
| **IV. Security-First** | No new user inputs to validate; reads existing Job data | ✅ PASS |
| **V. Database Integrity** | No schema changes; reads existing telemetry fields | ✅ PASS |

**Technology Compliance**:
- ✅ TanStack Query v5 for server state (existing job polling)
- ✅ shadcn/ui for UI primitives (Card, Badge, Collapsible, etc.)
- ✅ Existing formatting utilities in `lib/analytics/aggregations.ts`
- ✅ Recharts available for any visualizations (optional)

## Project Structure

### Documentation (this feature)

```
specs/AIB-99-add-stats-tab/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
components/
├── board/
│   └── ticket-detail-modal.tsx    # MODIFY: Add Stats tab (4th tab)
├── ticket/
│   ├── ticket-stats.tsx           # NEW: Stats tab content component
│   └── jobs-timeline.tsx          # NEW: Chronological jobs list with expand
└── ui/                            # Existing shadcn/ui components

lib/
├── analytics/
│   └── aggregations.ts            # REUSE: formatCost, formatDuration, formatPercentage, formatAbbreviatedNumber
├── hooks/
│   └── use-ticket-stats.ts        # NEW: Hook to compute stats from jobs
└── types/
    └── job-types.ts               # EXTEND: Add TicketJobWithTelemetry type

tests/
├── e2e/
│   └── tickets/
│       └── stats-tab.spec.ts      # NEW: E2E tests for Stats tab
└── unit/
    └── ticket-stats.test.ts       # NEW: Unit tests for stats aggregation functions
```

**Structure Decision**: Web application using Next.js App Router with feature-based component folders. New components follow existing patterns: stats logic in `components/ticket/`, hooks in `lib/hooks/`, types extended in `lib/types/`.

## Complexity Tracking

*No violations identified - all constitution principles satisfied.*

No complexity tracking needed. This feature:
- Uses existing data model (no schema changes)
- Reuses existing formatting utilities
- Follows established component patterns
- No new API endpoints required (uses existing job polling)

---

## Post-Design Constitution Re-Check

*Verified after Phase 1 design completion.*

| Principle | Post-Design Assessment | Status |
|-----------|------------------------|--------|
| **I. TypeScript-First** | `TicketJobWithTelemetry` and `TicketStats` interfaces defined | ✅ PASS |
| **II. Component-Driven** | Components use shadcn/ui (Card, Badge, Collapsible, Tabs) | ✅ PASS |
| **III. Test-Driven** | Test files defined: `tests/unit/ticket-stats.test.ts`, `tests/e2e/tickets/stats-tab.spec.ts` | ✅ PASS |
| **IV. Security-First** | Read-only data access, no user input validation needed | ✅ PASS |
| **V. Database Integrity** | No migrations, uses existing Job telemetry fields | ✅ PASS |

**Design Artifacts Generated**:
- ✅ `research.md` - All decisions documented
- ✅ `data-model.md` - Types and aggregations defined
- ✅ `contracts/job-telemetry.yaml` - Extended job data contract
- ✅ `quickstart.md` - Implementation guide with verification checklist
- ✅ Agent context updated (CLAUDE.md)

**Ready for Phase 2**: `/speckit.tasks` to generate implementation tasks
