# Implementation Plan: Ticket Search in Header

**Branch**: `AIB-115-copy-of-recherche` | **Date**: 2025-12-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-115-copy-of-recherche/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a search input in the header center that enables users to quickly find tickets by key, title, or description. The search uses client-side filtering of already-loaded tickets with a dropdown displaying up to 10 matching results. Clicking a result opens the ticket detail modal. Supports keyboard navigation for accessibility.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, shadcn/ui, Radix Popover, TanStack Query v5.90.5
**Storage**: PostgreSQL 14+ via Prisma (existing Ticket model - no new schema)
**Testing**: Vitest (unit tests for search logic), Playwright (E2E tests for UI interactions)
**Target Platform**: Web (desktop and mobile responsive)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Search results within 100ms of typing (client-side filtering)
**Constraints**: Max 10 results displayed, minimum 1 character query length
**Scale/Scope**: <500 tickets per project (typical), client-side filtering adequate

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | Using strict mode, all types explicit |
| II. Component-Driven | ✅ PASS | Will use shadcn/ui Popover + Input components |
| III. Test-Driven | ✅ PASS | Vitest for search utils, Playwright for E2E |
| IV. Security-First | ✅ PASS | Client-side only, no user input to server (uses existing ticket data) |
| V. Database Integrity | ✅ PASS | No schema changes required |

### Technology Compliance

| Requirement | Compliance |
|-------------|------------|
| shadcn/ui components only | ✅ Using Popover, Input from shadcn/ui |
| TanStack Query for server state | ✅ Will access existing ticket cache |
| No additional state libraries | ✅ Using React hooks only |
| Hybrid testing strategy | ✅ Vitest for utils, Playwright for UI |

### Violation Justifications

None required - all principles satisfied.

## Project Structure

### Documentation (this feature)

```
specs/AIB-115-copy-of-recherche/
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
├── layout.tsx                    # Root layout (contains Header component)
└── providers/
    └── query-provider.tsx        # TanStack Query provider

components/
├── layout/
│   ├── header.tsx               # Header component (MODIFY: add search)
│   └── mobile-menu.tsx          # Mobile menu
├── search/                       # NEW: Search feature components
│   ├── ticket-search.tsx        # Main search component
│   └── ticket-search-result.tsx # Individual result item
└── ui/
    ├── input.tsx                # shadcn/ui Input
    └── popover.tsx              # shadcn/ui Popover

lib/
└── utils/
    └── ticket-search.ts         # NEW: Search utility functions

tests/
├── unit/
│   └── ticket-search.test.ts    # Vitest unit tests for search utils
├── e2e/
│   └── ticket-search.spec.ts    # Playwright E2E tests for search UI
└── integration/                 # (not needed - client-side only feature)
```

**Structure Decision**: Web application using Next.js App Router. New search components will be added to `components/search/` following the feature-based folder pattern. Search utility functions go in `lib/utils/`. Header component at `components/layout/header.tsx` will be modified to include the search.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First | ✅ PASS | All interfaces defined in data-model.md with explicit types |
| II. Component-Driven | ✅ PASS | Using shadcn/ui Input + Popover, feature folder structure |
| III. Test-Driven | ✅ PASS | Unit tests for searchTickets(), E2E for user interactions |
| IV. Security-First | ✅ PASS | No server endpoints, client-side only filtering |
| V. Database Integrity | ✅ PASS | No schema changes, uses existing Ticket model |

**Design Artifacts Produced**:
- `research.md`: Search filtering, keyboard nav, accessibility patterns
- `data-model.md`: TypeScript interfaces for search state and results
- `contracts/component-contracts.md`: Component props and behavior contracts
- `quickstart.md`: Implementation guide with code examples

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations - simple client-side feature with minimal complexity.
