# Implementation Plan: Replace Header Navigation with Collapsible Icon Rail Sidebar + Cmd+K Command Palette

**Branch**: `AIB-357-replace-header-navigation` | **Date**: 2026-03-26 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/spec.md`

## Summary

Replace the desktop project-header icon navigation with a fixed icon rail and a project-wide command palette that groups navigation destinations with ticket matches, while preserving the existing mobile hamburger flow and protecting board workspace at 1280px+.

## Technical Context

**Language/Version**: TypeScript 5.6 strict, Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6, NextAuth.js, TanStack Query v5, shadcn/ui + Radix, lucide-react, Zod  
**Storage**: PostgreSQL 14+ via Prisma 6; no schema changes planned  
**Testing**: Vitest unit/component/integration tests, Playwright E2E for viewport and keyboard/browser-only flows  
**Target Platform**: Next.js web application for authenticated project pages on desktop and mobile browsers  
**Project Type**: Web application  
**Performance Goals**: Palette opens immediately from cached local state, search requests remain debounced at 300ms, grouped results render without blocking page transitions, board retains workable six-column layout at 1280px+  
**Constraints**: No new UI library beyond shadcn/Radix, no dynamic Tailwind classes, no hardcoded hex/rgb utility classes, preserve existing mobile menu behavior below 1024px, suppress conflicting project shortcuts while the palette is open  
**Scale/Scope**: Four project destinations, one shared desktop rail, one grouped command-palette API contract, one responsive project-shell update, automated coverage across component/integration/E2E layers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **TypeScript-First Development**: PASS. Planned changes are UI state, route handlers, and typed DTOs only; no `any` usage or untyped API contracts are required.
- **Component-Driven Architecture**: PASS. Use shadcn/Radix primitives already present in the repo (`Dialog`, `Tooltip`, `Sheet`) and keep feature logic in `components/layout`, `components/navigation`, `components/search`, and `app/api/projects/[projectId]`.
- **Test-Driven Development**: PASS. Plan covers component tests for header, rail, and palette behavior; integration tests for grouped search/auth; E2E only for responsive and keyboard flows that need a real browser.
- **Security-First Design**: PASS. Project access remains enforced server-side through `verifyProjectAccess`, palette search responses remain limited to authorized project scope, and query params will be validated with Zod.
- **Database Integrity**: PASS. No Prisma schema or migration changes are needed. Existing `Project` and `Ticket` records remain the source of truth.
- **Specification Clarification Guardrails**: PASS. Research resolves implementation unknowns without changing scope beyond the approved destinations.
- **AI-First Development Model**: PASS. Generated artifacts stay under `specs/AIB-357-replace-header-navigation/` and workflow-supporting `.specify/templates/`.

## Project Structure

### Documentation (this feature)

```text
specs/AIB-357-replace-header-navigation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── command-palette.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/projects/[projectId]/
│   ├── route.ts
│   ├── activity/route.ts
│   ├── analytics/route.ts
│   ├── command-palette/route.ts
│   └── tickets/search/route.ts
├── projects/[projectId]/
│   ├── activity/page.tsx
│   ├── analytics/page.tsx
│   ├── board/page.tsx
│   └── settings/page.tsx
└── lib/
    ├── hooks/queries/
    ├── query-keys.ts
    ├── schemas/
    └── types/

components/
├── layout/
│   ├── header.tsx
│   ├── mobile-menu.tsx
│   └── project-shell.tsx
├── navigation/
│   ├── desktop-project-rail.tsx
│   ├── project-destinations.ts
│   └── project-rail-tooltips.tsx
└── search/
    ├── command-palette.tsx
    ├── command-palette-results.tsx
    ├── command-palette-trigger.tsx
    ├── search-results.tsx
    └── ticket-search.tsx

lib/
├── db/
├── utils/
└── search/
    └── command-palette-ranking.ts

tests/
├── e2e/
├── integration/
│   └── navigation/
└── unit/
    ├── components/
    └── navigation/
```

**Structure Decision**: Keep the existing Next.js monorepo layout. Add a project-shell/navigation slice instead of duplicating rail logic per page, and add a dedicated grouped palette endpoint rather than overloading the legacy ticket-search response shape.

## Phase 0: Research Summary

- Use existing shadcn/Radix primitives and repo autocomplete patterns instead of introducing `cmdk`.
- Introduce a dedicated grouped command-palette route so destinations and tickets share one typed response contract.
- Use deterministic lightweight fuzzy scoring in local utilities instead of adding a search dependency.
- Preserve mobile by keeping `MobileMenu` as the only sub-desktop primary navigation.
- Reserve a fixed desktop rail width of 56px so the board layout impact is predictable and testable.

See `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/research.md` for full decisions and alternatives.

## Phase 1: Design

### Data Model

- No Prisma entities change.
- Add typed view models for:
  - `ProjectNavigationDestination`
  - `CommandPaletteResult`
  - `CommandPaletteResponse`
  - `DesktopRailItemState`
- Extend search schema/types with grouped results and palette query validation.

See `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/data-model.md`.

### API Contracts

- Add `GET /api/projects/{projectId}/command-palette` for grouped navigation and ticket results.
- Keep `GET /api/projects/{projectId}/tickets/search` intact unless implementation later consolidates internals behind shared ranking helpers.

See `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/contracts/command-palette.openapi.yaml`.

### UI Design Direction

- Desktop pages adopt a shared shell with a fixed left rail and content pane.
- Header removes analytics/activity icon buttons and inline ticket search; desktop header uses a palette trigger button styled as the new search affordance.
- Rail stays icon-only with hover/focus tooltip labels and bottom-anchored settings entry.
- Palette behaves as a modal dialog with grouped results, keyboard navigation, and shortcut suppression while open.

### Agent Context Update

- Run `/home/runner/work/ai-board/ai-board/target/.claude-plugin/scripts/bash/update-agent-context.sh claude` after plan artifacts are written.

## Phase 2: Implementation Strategy

1. Add shared destination metadata and active-route helpers for Board, Activity, Analytics, and Settings.
2. Create a desktop project shell that renders the fixed rail only at `lg` and leaves existing mobile navigation unchanged below `lg`.
3. Replace header inline `TicketSearch` usage with a palette trigger and wire a project-wide keyboard listener for `Meta+K` / `Ctrl+K`.
4. Add the grouped palette endpoint with validated query params, project access checks, destination filtering, ticket lookup, and deterministic fuzzy ranking.
5. Build palette UI and keyboard interactions on top of existing dialog/list patterns.
6. Extend automated coverage for desktop rail visibility, header simplification, grouped search results, shortcut suppression, and responsive fallback.

## Testing Strategy

- **Unit**: Ranking helpers, active-destination matching, shortcut conflict guards, route parsing helpers.
- **Component**: `Header`, desktop rail, palette trigger/results, and keyboard interactions using `renderWithProviders()` and accessibility-first RTL queries.
- **Integration**: `GET /api/projects/[projectId]/command-palette` auth, grouping, fuzzy matching, empty states, and project scoping with Vitest + Prisma fixtures.
- **E2E**: One responsive browser flow confirming rail on desktop, hidden rail on mobile, and keyboard-driven palette navigation because viewport changes and global shortcuts require a real browser.
- **Search Existing Tests First**: Extend `tests/unit/components/header.test.tsx`, `tests/unit/components/ticket-search.test.tsx`, and `tests/integration/comments/autocomplete.test.ts` instead of duplicating patterns.

## Post-Design Constitution Check

- **TypeScript-First Development**: PASS. Design artifacts define typed DTOs and helper boundaries.
- **Component-Driven Architecture**: PASS. Design centralizes navigation behavior into reusable feature components rather than per-page duplication.
- **Test-Driven Development**: PASS. Each user story maps to an explicit test layer.
- **Security-First Design**: PASS. Grouped search remains project-scoped and authenticated.
- **Database Integrity**: PASS. No schema changes introduced by design.
- **AI-First Development Model**: PASS. Only workflow artifacts and implementation-facing docs were generated.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
