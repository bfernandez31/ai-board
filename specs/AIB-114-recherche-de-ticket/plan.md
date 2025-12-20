# Implementation Plan: Ticket Search

**Branch**: `AIB-114-recherche-de-ticket` | **Date**: 2025-12-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-114-recherche-de-ticket/spec.md`

## Summary

Add a centered search input in the application header that allows users to quickly find tickets by key, title, or description within the current project. Search results display in a dropdown with keyboard navigation support, and clicking a result opens the ticket detail modal. This feature enhances navigation efficiency for users managing multiple tickets.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, shadcn/ui, lucide-react
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Ticket model)
**Testing**: Vitest (unit tests for utilities), Playwright (integration/E2E tests)
**Target Platform**: Web (Vercel deployment, responsive design)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Search results appear within 500ms of user stopping typing (SC-002)
**Constraints**: Debounce at 300ms, max 10 results displayed, minimum 2 character query
**Scale/Scope**: Single project scope per search, existing ticket data (no schema changes required)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check (Phase 0 Gate)

| Principle | Status | Compliance Notes |
|-----------|--------|------------------|
| I. TypeScript-First Development | ✅ PASS | All new code will use strict TypeScript with explicit types for SearchResult, SearchQuery interfaces |
| II. Component-Driven Architecture | ✅ PASS | Will use shadcn/ui Input, Popover components; feature folder at `/components/search/` |
| III. Test-Driven Development | ✅ PASS | Vitest for search utility functions, Playwright for keyboard navigation and modal opening flows |
| IV. Security-First Design | ✅ PASS | Search input will be sanitized, Prisma parameterized queries for search, no sensitive data exposure |
| V. Database Integrity | ✅ PASS | Read-only queries, no schema changes required, existing indexes on ticketKey support search |

**Gate Result**: ✅ PASSED - No violations, proceed to Phase 0

### Post-Design Re-Evaluation (Phase 1 Complete)

| Principle | Status | Design Verification |
|-----------|--------|---------------------|
| I. TypeScript-First | ✅ PASS | `SearchResult`, `SearchResponse`, `SearchParams` interfaces defined in data-model.md |
| II. Component Architecture | ✅ PASS | Uses existing Popover, Input, ScrollArea from shadcn/ui; no new dependencies required |
| III. Test-Driven | ✅ PASS | Test plan in quickstart.md covers unit (Vitest) and E2E (Playwright) scenarios |
| IV. Security-First | ✅ PASS | API uses `verifyProjectAccess()` auth helper; Prisma parameterized queries in contract |
| V. Database Integrity | ✅ PASS | Read-only search; no migrations needed; leverages existing `@@index([projectId])` |
| V. Clarification Guardrails | ✅ PASS | All AUTO decisions documented in spec.md with trade-offs |

**Post-Design Gate Result**: ✅ PASSED - Design complies with all constitution principles

## Project Structure

### Documentation (this feature)

```
specs/AIB-114-recherche-de-ticket/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js App Router web application structure

app/
├── api/
│   └── projects/[projectId]/
│       └── tickets/
│           └── search/
│               └── route.ts        # NEW: Search API endpoint
└── lib/
    ├── query-keys.ts               # Add search query key
    └── hooks/
        └── queries/
            └── useTicketSearch.ts  # NEW: Search hook with TanStack Query

components/
├── layout/
│   └── header.tsx                  # MODIFY: Add TicketSearch component
└── search/                         # NEW: Feature folder
    ├── ticket-search.tsx           # Main search input component
    └── search-results.tsx          # Dropdown results component

lib/
└── utils.ts                        # Add search utility functions if needed

tests/
├── unit/
│   └── search.test.ts              # Vitest: search utility functions
├── integration/
│   └── search/
│       └── search.spec.ts          # Playwright: component behavior
└── e2e/
    └── search.spec.ts              # Playwright: full user flow
```

**Structure Decision**: Next.js App Router web application. New components placed in `/components/search/` feature folder following existing patterns. API route at `/api/projects/[projectId]/tickets/search` for project-scoped search. Tests follow hybrid strategy (Vitest for utilities, Playwright for integration/E2E).

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No complexity violations. This feature:
- Uses existing UI components (no new dependencies)
- Follows established patterns (TanStack Query, Prisma, shadcn/ui)
- Requires no database schema changes
- Leverages existing auth helpers

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `./research.md` | ✅ Complete |
| Data Model | `./data-model.md` | ✅ Complete |
| API Contract | `./contracts/search-api.yaml` | ✅ Complete |
| Quickstart | `./quickstart.md` | ✅ Complete |

---

## Next Steps

Run `/speckit.tasks` to generate the implementation task list based on this plan.
