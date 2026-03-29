# Implementation Plan: Health Dashboard — Scan Detail Drawer

**Branch**: `AIB-371-health-dashboard-drawer` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-371-health-dashboard-drawer/spec.md`

## Summary

Implement a right-side slide-over drawer on the Health Dashboard that displays full scan reports, module-specific grouped issues, generated ticket links, and paginated scan history when a user clicks any module card. Uses the existing shadcn/ui Sheet component with a wider variant, a new `ScanReport` discriminated union type with Zod validation for the `HealthScan.report` JSON field, and TanStack Query for data fetching. No database migrations required — all data comes from the existing `HealthScan` model.

**Technical Approach**:
- Extend `lib/health/types.ts` with per-module report type definitions and Zod schemas
- Add optional `includeReport` query param to existing scan history GET endpoint
- Build drawer with shadcn/ui Sheet (right side, `sm:max-w-lg`) controlled by selected module state
- Create module-specific renderers dispatched by `scanType` for grouped issue display
- Add `useScanReport` hook for latest scan report fetching with TanStack Query

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, shadcn/ui Sheet (Radix Dialog), Zod, lucide-react
**Storage**: PostgreSQL 14+ via Prisma ORM — no new models, reads existing `HealthScan.report` field
**Testing**: Vitest (unit for report parsing, component for drawer states), Integration (API with report field)
**Target Platform**: Web application (Next.js App Router)
**Performance Goals**: Drawer open < 200ms (local state), report load < 1s, history pagination < 2s (SC-005)
**Constraints**: Semantic color tokens only, WCAG AA 4.5:1, Aurora theme, responsive 375px–2560px (SC-006)
**Scale/Scope**: 6 module types, 4 drawer states, per-module grouping strategies, cursor-based history pagination

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All report types use discriminated union with explicit interfaces; Zod schemas enforce runtime type safety |
| II. Component-Driven Architecture | ✅ PASS | shadcn/ui Sheet primitive; feature components in `components/health/drawer/`; Client Component (interactivity required) |
| III. Test-Driven Development | ✅ PASS | Unit tests for report parsing, component tests for drawer states and module renderers, integration tests for API extension |
| IV. Security-First | ✅ PASS | Zod validation on report JSON; existing `verifyProjectAccess()` on API endpoints; no raw SQL |
| V. Database Integrity | ✅ PASS | No schema changes; reads existing fields only; no migrations needed |
| V. Spec Clarification Guardrails | ✅ PASS | All 5 auto-resolved decisions documented with policies, trade-offs, and reviewer notes in spec |
| VI. AI-First Development | ✅ PASS | No README/tutorial files; all artifacts in `specs/AIB-371-health-dashboard-drawer/` |

**Gate Result**: ALL PASS — proceed.

**Post-Design Re-check**: ALL PASS — no violations introduced during Phase 1 design. Report type system uses strict TypeScript discriminated unions. No new dependencies added. Testing covers all layers per the Testing Trophy.

## Project Structure

### Documentation (this feature)

```
specs/AIB-371-health-dashboard-drawer/
├── plan.md                    # This file
├── spec.md                    # Feature specification
├── research.md                # Phase 0 — research findings
├── data-model.md              # Phase 1 — data model (client-side types)
├── quickstart.md              # Phase 1 — implementation quickstart
├── contracts/
│   ├── scan-detail-drawer.md  # Drawer component contract
│   └── report-schema.md       # Report JSON schema contract
└── tasks.md                   # Phase 2 output (NOT created by plan)
```

### Source Code Changes

```
# New files
lib/health/report-schemas.ts                           # Zod schemas + parseScanReport()
components/health/scan-detail-drawer.tsx                # Main drawer component
components/health/drawer/drawer-header.tsx              # Module header section
components/health/drawer/drawer-issues.tsx              # Module-specific grouped issues
components/health/drawer/drawer-tickets.tsx             # Generated tickets section
components/health/drawer/drawer-history.tsx             # Paginated scan history
components/health/drawer/drawer-states.tsx              # Empty/scanning/failed states
app/lib/hooks/useScanReport.ts                         # TanStack Query hook for report fetch

# Modified files
lib/health/types.ts                                    # Add ScanReport union + sub-types
app/api/projects/[projectId]/health/scans/route.ts     # Add includeReport query param to GET
components/health/health-dashboard.tsx                  # Add selectedModule state + render drawer
components/health/health-module-card.tsx                # Add onClick prop, cursor-pointer, stopPropagation on scan button

# Test files
tests/unit/health/report-schemas.test.ts               # Unit: Zod parsing tests
tests/unit/components/scan-detail-drawer.test.tsx       # Component: drawer state tests
tests/unit/components/drawer-issues.test.tsx            # Component: module-specific grouping
tests/integration/health/scan-history.test.ts           # Integration: extend for includeReport param
```

**Structure Decision**: Drawer sub-components in `components/health/drawer/` directory to keep the health feature folder organized. Follows the existing pattern of feature-based folders. Report schemas in `lib/health/` alongside existing types.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|-----------|-----------|----------|-----------|
| US1 — View scan report | Component | `tests/unit/components/scan-detail-drawer.test.tsx` | React component with conditional rendering, mocked hooks |
| US2 — Module-specific grouping | Component | `tests/unit/components/drawer-issues.test.tsx` | Tests 6 grouping strategies with mock data |
| US2 — Report parsing | Unit | `tests/unit/health/report-schemas.test.ts` | Pure Zod schema validation, no dependencies |
| US3 — Scan history pagination | Integration | `tests/integration/health/scan-history.test.ts` (extend) | API + DB with cursor pagination and includeReport param |
| US4 — Non-standard states | Component | `tests/unit/components/scan-detail-drawer.test.tsx` | Tests never_scanned, scanning, failed states |
| Edge — Malformed report | Unit | `tests/unit/health/report-schemas.test.ts` | Zod safeParse returns null on invalid JSON |
| Edge — Card click vs scan button | Component | `tests/unit/components/scan-detail-drawer.test.tsx` | Verifies stopPropagation on scan button |

## Complexity Tracking

*No constitution violations requiring justification.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | — | — |

## Phase 0: Outline & Research

**Completed** — see [research.md](./research.md)

Key decisions:
1. Report JSON uses discriminated union typed per module (not flat array)
2. Sheet width overridden to `sm:max-w-lg` for content density
3. Card click opens drawer (not a separate button), scan button uses stopPropagation
4. "Load more" button for history pagination (not infinite scroll)
5. Drawer shares existing `useHealthPolling` data, adds `useScanReport` for report content
6. Passive modules (Quality Gate, Last Clean) derive data from existing endpoints
7. Zod safeParse for report validation with graceful fallback

## Phase 1: Design & Contracts

**Completed** — see:
- [data-model.md](./data-model.md) — Client-side type definitions (no DB changes)
- [contracts/scan-detail-drawer.md](./contracts/scan-detail-drawer.md) — Drawer component interface and layout
- [contracts/report-schema.md](./contracts/report-schema.md) — Report JSON schema per module type
- [quickstart.md](./quickstart.md) — Implementation quickstart guide

## Phase 2: Task Planning Approach

Task generation will create an ordered task list covering:
1. **Types & Schemas** — Report types and Zod schemas (foundation for all other tasks)
2. **API Extension** — Add `includeReport` param to scan history GET endpoint
3. **Data Fetching** — `useScanReport` hook
4. **Drawer Shell** — Main drawer component with Sheet, controlled state
5. **Drawer Sections** — Header, issues (6 renderers), tickets, history, state displays
6. **Dashboard Integration** — Wire drawer into dashboard, make cards clickable
7. **Tests** — Unit, component, and integration tests

Estimated: 8-12 tasks with clear dependency ordering.
