# Implementation Plan: Redesign Comparisons Hub as Vertical List with Inline Expand

**Branch**: `AIB-365-redesign-comparisons-hub` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-365-redesign-comparisons-hub/spec.md`

## Summary

Replace the current 2-column sidebar+detail layout of the comparisons hub with a single-column vertical list of compact cards. Each card shows winner info, score, and date. Clicking a card expands the full comparison dashboard inline below it (accordion-style, single expand). Replace page-based pagination with a "Load More" append pattern. Support deep linking via `?comparisonId=X` query parameter. Reuse all existing sub-components (HeroCard, ParticipantGrid, StatCards, UnifiedMetrics, DecisionPoints, ComplianceHeatmap) without modification.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, shadcn/ui, TailwindCSS 3.4, lucide-react
**Storage**: PostgreSQL 14+ via Prisma 6.x (no schema changes needed — this is a UI-only redesign)
**Testing**: Vitest (unit + component + integration), Playwright (E2E)
**Target Platform**: Web (desktop + mobile, 320px+ viewports)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Smooth expand/collapse animation, no layout jank on detail render
**Constraints**: Single scroll context (no nested ScrollArea), must reuse all 6 existing sub-components unmodified
**Scale/Scope**: Single page redesign, ~3 files modified, ~1 new component

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code will be TypeScript strict, explicit types for props/state |
| II. Component-Driven Architecture | PASS | Reusing shadcn/ui primitives, feature-based folder structure in `components/comparison/` |
| III. Test-Driven Development | PASS | Component tests for new accordion behavior, integration test for Load More + deep link |
| IV. Security-First | PASS | No new user inputs or API endpoints; existing auth/validation unchanged |
| V. Database Integrity | PASS | No database changes — purely UI refactor |
| V. Spec Clarification Guardrails | PASS | Auto-resolved decisions documented in spec with trade-offs |
| VI. AI-First Development Model | PASS | No documentation files created outside spec directory |

**Gate result**: ALL PASS — proceeding to Phase 0.

### Post-Design Re-Evaluation (after Phase 1)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | `ComparisonCardProps`, `winnerScore` field, infinite query hook — all explicitly typed |
| II. Component-Driven Architecture | PASS | New `ComparisonCard` uses Radix Collapsible (shadcn/ui), lives in `components/comparison/` |
| III. Test-Driven Development | PASS | Component test for card, integration tests for Load More + deep link planned |
| IV. Security-First | PASS | `winnerScore` is read-only from DB, no new user inputs. Existing Zod validation on API params unchanged |
| V. Database Integrity | PASS | No schema changes. One additional `select` field in existing Prisma query |
| V. Spec Clarification Guardrails | PASS | All research decisions documented with rationale and alternatives |
| VI. AI-First Development Model | PASS | All artifacts in `specs/` directory only |

**Post-design gate result**: ALL PASS — ready for task generation.

## Project Structure

### Documentation (this feature)

```
specs/AIB-365-redesign-comparisons-hub/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (separate command)
```

### Source Code (repository root)

```
components/comparison/
├── project-comparisons-page.tsx    # MODIFY — replace 2-col grid with vertical accordion list
├── comparison-viewer.tsx           # MODIFY — remove ScrollArea wrapper from ComparisonDashboard
├── comparison-card.tsx             # NEW — compact card + inline expand container
├── types.ts                        # MODIFY — add ComparisonCardProps interface
├── comparison-hero-card.tsx        # UNCHANGED
├── comparison-participant-grid.tsx # UNCHANGED
├── comparison-stat-cards.tsx       # UNCHANGED
├── comparison-unified-metrics.tsx  # UNCHANGED
├── comparison-decision-points.tsx  # UNCHANGED
├── comparison-compliance-heatmap.tsx # UNCHANGED
└── project-comparison-launch-sheet.tsx # UNCHANGED

hooks/
└── use-comparisons.ts              # MODIFY — add useProjectComparisonListInfinite hook

app/projects/[projectId]/comparisons/
└── page.tsx                        # UNCHANGED (already passes comparisonId from search params)

tests/
├── unit/components/
│   └── comparison-card.test.tsx    # NEW — accordion expand/collapse behavior
└── integration/comparisons/
    └── comparisons-hub.test.ts     # NEW or EXTEND — Load More accumulation, deep link
```

**Structure Decision**: Next.js App Router web application. All changes confined to existing `components/comparison/` feature folder plus one hook modification. No new API routes or database changes required.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|------------|-----------|----------|-----------|
| US1: Browse Recent Comparisons | Component test | `tests/unit/components/comparison-card.test.tsx` | Tests card rendering with mock data, no API needed |
| US2: Expand Detail Inline | Component test | `tests/unit/components/comparison-card.test.tsx` | Tests accordion click behavior, expand/collapse state |
| US3: Load More | Integration test | `tests/integration/comparisons/comparisons-hub.test.ts` | Requires API pagination logic verification |
| US4: Deep Link | Integration test | `tests/integration/comparisons/comparisons-hub.test.ts` | Requires URL param parsing + auto-expand logic |
| US5: Launch New Comparison | No new tests | — | Existing launch flow unchanged; existing tests cover it |

## Complexity Tracking

*No constitution violations — table not needed.*
