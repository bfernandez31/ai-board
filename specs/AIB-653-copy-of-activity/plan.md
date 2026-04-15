# Implementation Plan: Copy of Activity Heatmap on Projects Page

**Branch**: `AIB-653-copy-of-activity` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-653-copy-of-activity/spec.md`

## Summary

Add a GitHub-style annual activity heatmap to the shared projects page below the project cards grid. The page should server-render the initial heatmap state for the active URL filters, expose a user-scoped aggregation API for period and agent changes, reuse existing job and ticket data without schema changes, and preserve visible content during 15-second background refreshes.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16.2.1 (App Router), React 18.3.1, Prisma 6.19.2, TanStack Query 5.95.2, shadcn/ui + Radix, lucide-react, date-fns 4.1.0, Zod 4.3.6  
**Storage**: PostgreSQL 14+ via Prisma; derive aggregates from `User`, `Project`, `ProjectMember`, `Ticket`, and `Job`  
**Testing**: Vitest unit + integration tests, Playwright E2E browser coverage  
**Target Platform**: Web application, authenticated projects page, responsive from mobile through desktop  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: Stable first render/empty state within 2 seconds, background refresh without clearing existing heatmap content, responsive horizontal scrolling on narrow screens  
**Constraints**: No new database models; shipped counts only from successful `ship` jobs; agent filter uses effective agent resolution; URL must encode period and agent; no out-of-period padding cells; keep project page vertically scrollable  
**Scale/Scope**: One aggregate heatmap covering all projects accessible to the current user for a rolling 12-month window or calendar-year window, up to 366 day cells and a small set of derived agent options

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | New server and client code will remain strict-typed with explicit response and view-model types. |
| II. Component-Driven Architecture | PASS | Server-rendered projects page will compose a new heatmap section/component and use shadcn/ui primitives for filter and tooltip interactions. |
| III. Test-Driven Development | PASS | Existing projects, analytics, agent-resolution, and heatmap-adjacent tests were identified for extension before any new test file is introduced. |
| IV. Security-First Design | PASS | Aggregation is user-scoped through authenticated data access or a protected API route; no secrets or cross-user data exposure. |
| V. Database Integrity | PASS | Feature is read-only over existing tables and preserves shipped-count semantics tied to successful `ship` jobs. |

**Gate Result**: PASS

### Post-Design Check

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First Development | PASS | `data-model.md` defines typed derived entities and the API contract documents a concrete JSON response shape. |
| II. Component-Driven Architecture | PASS | The structure keeps server fetching in `app/projects/page.tsx`, feature UI in `components/projects/`, and derived aggregation logic in a shared lib module. |
| III. Test-Driven Development | PASS | The testing strategy extends existing integration and component suites first, with E2E limited to URL-restoration/mobile behavior. |
| IV. Security-First Design | PASS | The contract requires authenticated access and owner/member filtering identical to existing project queries. |
| V. Database Integrity | PASS | Design reuses Prisma reads and effective-agent derivation without schema changes or unsafe raw SQL. |

**Gate Result**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/AIB-653-copy-of-activity/
├── plan.md
├── research.md
├── data-model.md
└── contracts/
    └── projects-activity-heatmap-api.md
```

### Source Code (repository root)

```text
app/
├── api/projects/
│   ├── route.ts
│   └── activity/
│       └── route.ts                  # NEW: cross-project heatmap aggregate API
├── lib/
│   ├── types/project.ts              # EXTEND: heatmap response and derived UI types
│   └── utils/agent-resolution.ts     # REUSE: effective agent resolution
└── projects/page.tsx                 # EXTEND: parse URL filters and server-render initial heatmap state

components/
└── projects/
    ├── projects-container.tsx        # EXTEND: remove fixed-height scrolling wrapper and append heatmap section
    ├── project-card.tsx              # REUSE: existing cards stay above the new section
    ├── projects-activity-heatmap.tsx # NEW: client component for controls, grid, legend, and tooltip behavior
    └── projects-activity-tooltip.tsx # NEW if extraction is needed after implementation review

lib/
└── db/projects.ts                    # EXTEND or pair with new lib helper: authenticated aggregate query over accessible projects

tests/
├── integration/
│   ├── projects/crud.test.ts         # EXTEND: verify aggregate payload shape and filter handling if route remains colocated
│   ├── projects/projects-with-health.test.ts
│   └── activity/api.test.ts          # REFERENCE ONLY: parallel query + protected route patterns
├── unit/
│   ├── agent-resolution.test.ts      # EXTEND: cover heatmap-facing effective-agent expectations if helper changes
│   └── components/
│       └── comparison-compliance-heatmap.test.tsx # REFERENCE ONLY: sticky axis and cell rendering patterns
└── e2e/
    └── activity.spec.ts              # REFERENCE ONLY for mobile/timeline conventions; likely add or extend a projects-focused spec
```

**Structure Decision**: Keep initial render on the server in `app/projects/page.tsx` so the first visit satisfies FR-022 without a client-side loading gap, then let a dedicated projects heatmap client component manage URL-synced filter changes and background refresh against a new authenticated aggregate endpoint.

## Phase 0: Research Outcomes

- Reuse the projects page server-render pattern from `app/projects/page.tsx` and the analytics page URL-validation pattern from `app/projects/[projectId]/analytics/page.tsx`.
- Add a new cross-project aggregate endpoint at `app/api/projects/activity/route.ts` instead of overloading `GET /api/projects`, so the existing projects list response stays stable and the heatmap can refetch independently.
- Centralize aggregation in a shared authenticated query helper so the server page and API route cannot drift on shipped-count and agent-resolution rules.
- Keep the projects list visually above the heatmap, but remove the current `max-h-[calc(100vh-200px)] overflow-y-auto` wrapper from `components/projects/projects-container.tsx` because it blocks the required page-level vertical scrolling.

## Phase 1: Design

### Data Model

See [data-model.md](./data-model.md) for the derived entities, validation rules, and period/filter state.

### Contracts

- [contracts/projects-activity-heatmap-api.md](./contracts/projects-activity-heatmap-api.md) defines the authenticated aggregate endpoint used by client-side period/agent changes and background refresh.

### Workflow / Agent Artifacts

No new workflow or internal agent artifact is required. The feature is a read-only UI and API addition on the existing projects page.

## Implementation Phases

1. Add a shared aggregation query that:
   reads accessible projects for the current user,
   derives effective agent per ticket using `resolveEffectiveAgent`,
   counts daily jobs from `Job.startedAt`,
   counts shipped tickets only from `Job.command === "ship"` with `status === "COMPLETED"` on `completedAt`,
   computes optional daily `costUsd` totals,
   and emits fixed-boundary day cells plus distinct agent options for the selected period.
2. Add `GET /api/projects/activity` with authenticated query parsing and structured error handling for `period` and `agent`.
3. Update `app/projects/page.tsx` to parse search params, fetch the initial heatmap payload on the server, and pass it alongside the project list.
4. Update `components/projects/projects-container.tsx` to allow page-level scrolling and render the heatmap section under the project grid.
5. Build the projects heatmap client component with static Tailwind classes, horizontal scroll, sticky day labels, legend, empty state, and touch/pointer tooltip behavior.
6. Extend existing tests first, then add the minimal new component/E2E coverage needed for URL restoration and mobile scroll behavior.

## Testing Strategy

- Extend `tests/integration/projects/crud.test.ts` or add a sibling projects integration test only if the new endpoint would make that file too mixed; cover owner/member scoping, `period` validation, agent filtering, shipped-count semantics, and empty-state payloads there.
- Reuse `tests/unit/agent-resolution.test.ts` for any helper-level effective-agent behavior instead of creating a duplicate agent test file.
- Add a dedicated component test under `tests/unit/components/` only for the new heatmap component, using `comparison-compliance-heatmap.test.tsx` as the rendering pattern reference for sticky labels, heatmap cells, and empty states.
- Limit Playwright to the behaviors integration tests cannot prove well: URL restoration on the projects page and mobile horizontal scrolling with pinned day labels.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
