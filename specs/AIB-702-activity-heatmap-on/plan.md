# Implementation Plan: Activity Heatmap on Projects Page

**Branch**: `AIB-702-activity-heatmap-on` | **Date**: 2026-04-20 | **Spec**: `/specs/AIB-702-activity-heatmap-on/spec.md`
**Input**: Feature specification for a GitHub-style activity heatmap on the projects page.

## Summary

Implement a contribution heatmap below the project cards grid on the `/projects` page. The heatmap will visualize AI activity (jobs) and shipped tickets over the past year or selected calendar years, with filtering capabilities by AI agent. Data will be server-rendered for initial load and dynamically updated via a new API route.

## Technical Context

**Language/Version**: TypeScript (Strict Mode), Next.js 15 (App Router)
**Primary Dependencies**: React, Tailwind CSS, Prisma, Zod, shadcn/ui, Lucide React
**Storage**: PostgreSQL (via Prisma)
**Testing**: Vitest (Integration for API/DB, Unit for logic), Playwright (E2E for UI)
**Target Platform**: Web
**Project Type**: Web application
**Performance Goals**: < 200ms for data aggregation, immediate render on page load (SSR).
**Constraints**: Zero new database models; adhere to Aurora visual theme.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **TypeScript strict mode**: Verified (project-wide setting).
- **Component-driven**: Using shadcn/ui and feature-based folder structure.
- **TDD**: Integration tests for aggregation logic and unit tests for date boundaries.
- **Security**: Authenticated access via `requireAuth`; all queries scoped to user.
- **Database**: No migrations needed; using existing `Job`, `Ticket`, and `Project` models.

## Project Structure

### Documentation (this feature)

```
specs/AIB-702-activity-heatmap-on/
├── plan.md              # This file
├── research.md          # Research findings and decisions
├── data-model.md        # API and internal data structures
└── contracts/
    └── activity-heatmap.md # API endpoint contract
```

### Source Code

```
app/
├── api/
│   └── activity/
│       └── heatmap/
│           └── route.ts        # GET /api/activity/heatmap
├── projects/
│   └── page.tsx                # Inject Heatmap component

components/
├── projects/
│   └── activity-heatmap/       # Feature folder
│       ├── activity-heatmap.tsx # Main entry point
│       ├── activity-heatmap-grid.tsx
│       ├── activity-heatmap-header.tsx
│       ├── activity-heatmap-cell.tsx
│       └── activity-heatmap-tooltip.tsx

lib/
├── db/
│   ├── activity.ts             # Heatmap data access layer
│   └── activity-utils.ts       # Date and "chipped" edge logic

tests/
├── integration/
│   └── activity/
│       └── heatmap-aggregation.test.ts
├── unit/
│   └── activity/
│       └── heatmap-logic.test.ts
```

**Structure Decision**: Single project structure with feature-based component organization.

## Complexity Tracking

*No constitution violations identified.*
