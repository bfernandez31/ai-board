# Implementation Plan: Comparisons Hub Page

**Branch**: `AIB-358-comparisons-hub-page` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-358-comparisons-hub-page/spec.md`

## Summary

Add a dedicated Comparisons hub page at `/projects/[projectId]/comparisons` accessible via sidebar navigation. The page lists all project comparisons (DB-backed via ComparisonRecord) with inline detail expansion reusing existing ComparisonViewer sub-components, and provides a "New Comparison" launcher to select VERIFY-stage tickets and trigger the comparison workflow. Cursor-based "Load More" pagination, responsive layout, and empty states are included.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5, shadcn/ui, Prisma 6.x, lucide-react
**Storage**: PostgreSQL 14+ via Prisma (ComparisonRecord, ComparisonParticipant, DecisionPointEvaluation, ComplianceAssessment)
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests)
**Target Platform**: Web (desktop + mobile responsive, 375px–1920px)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: First page load < 2s (SC-002), inline detail expand < 1s
**Constraints**: Reuse 100% of existing comparison sub-components (SC-005), no new UI libraries
**Scale/Scope**: Projects with 0–100+ comparisons, paginated at 20 per page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TS with explicit types |
| II. Component-Driven Architecture | PASS | Reuses shadcn/ui + existing comparison components; new page follows App Router conventions; feature folder at `components/comparisons/` |
| III. Test-Driven Development | PASS | Integration tests for new API endpoint; component tests for new UI; extends existing comparison test suite |
| IV. Security-First | PASS | Uses `verifyProjectAccess()` for authorization; Zod validation on query params; Prisma parameterized queries |
| V. Database Integrity | PASS | Read-only queries against existing ComparisonRecord model; no schema changes needed |
| V. Specification Guardrails | PASS | Auto-resolved decisions documented in spec with trade-offs |
| VI. AI-First Model | PASS | No README or tutorial files created |

**Gate Result**: PASS — No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-358-comparisons-hub-page/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── comparisons-hub-api.md
└── tasks.md             # Phase 2 output (NOT created by /plan)
```

### Source Code (repository root)

```
# New files
app/projects/[projectId]/comparisons/
└── page.tsx                          # Server component — Comparisons hub page

components/comparisons/
├── comparisons-page.tsx              # Client component — main page orchestrator
├── comparison-list-item.tsx          # Summary card for each comparison in list
├── comparison-inline-detail.tsx      # Inline detail wrapper reusing existing sub-components
└── new-comparison-launcher.tsx       # "New Comparison" button + ticket selection dialog

hooks/
└── use-project-comparisons.ts        # TanStack Query hook for project-level comparison list

# Modified files
components/navigation/nav-items.ts    # Add "Comparisons" nav item
app/api/projects/[projectId]/comparisons/route.ts  # Rewrite to use DB-backed queries
```

**Structure Decision**: Next.js App Router with feature-based component folder (`components/comparisons/`). New page route at `app/projects/[projectId]/comparisons/page.tsx`. Dedicated hooks file for project-level comparison queries separate from existing ticket-level hooks.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|-----------|-----------|----------|-----------|
| US-1: Browse comparisons | Integration | `tests/integration/comparisons/comparisons-hub-api.test.ts` | API endpoint with DB queries |
| US-1: Empty state | Component | `tests/unit/components/comparisons-page.test.tsx` | React component rendering |
| US-2: Inline detail expand | Component | `tests/unit/components/comparison-inline-detail.test.tsx` | React component interaction |
| US-3: Launch comparison | Integration | `tests/integration/comparisons/new-comparison-launch.test.ts` | Workflow dispatch via API |
| US-3: Ticket selection UI | Component | `tests/unit/components/new-comparison-launcher.test.tsx` | React component with form state |
| US-4: Sidebar navigation | Component | `tests/unit/components/nav-items.test.ts` | Unit test for nav config |
| US-5: Responsive layout | E2E | `tests/e2e/comparisons-hub.spec.ts` | Viewport-dependent rendering requires browser |

**Critical rules applied**:
- API tests use Vitest, NOT Playwright
- E2E only for viewport-dependent responsive test (US-5)
- Extends existing comparison test suite — no duplication of persistence/detail tests

## Complexity Tracking

*No constitution violations — table not needed.*
