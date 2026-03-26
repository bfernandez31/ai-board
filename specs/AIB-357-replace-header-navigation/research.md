# Research: Replace Header Navigation with Collapsible Icon Rail Sidebar + Cmd+K Command Palette

## Decision: Use existing shadcn/Radix `Dialog` plus custom grouped result lists for the command palette

**Rationale**: The repo already ships `components/ui/dialog.tsx`, `Popover`, `Sheet`, and custom autocomplete list patterns, but it does not include `cmdk`. Reusing the existing primitives keeps the implementation inside the approved UI stack, matches current accessibility patterns, and avoids introducing a new dependency for a single feature.

**Alternatives considered**:
- Install `cmdk` and adopt a full command menu library. Rejected because it adds dependency and styling churn without solving a repo-wide need.
- Reuse the current `Popover`-based `TicketSearch` directly. Rejected because the palette must open globally from keyboard shortcuts, not only from a focused header input.

## Decision: Add a dedicated grouped palette endpoint at `GET /api/projects/{projectId}/command-palette`

**Rationale**: The command palette needs one response containing navigation and ticket groups. A dedicated endpoint keeps the grouped contract explicit, lets server-side auth and ranking live in one place, and avoids teaching the client to merge static destinations with a separate ticket API response while preserving keyboard ordering.

**Alternatives considered**:
- Reuse `GET /api/projects/{projectId}/tickets/search` and merge in local destinations on the client. Rejected because grouping, ranking, and empty-state behavior would be split across client and server.
- Expand the existing ticket-search response shape. Rejected because it would silently break the current `TicketSearch` consumer contract.

## Decision: Use deterministic lightweight fuzzy ranking implemented in local utilities

**Rationale**: The palette only searches four destinations plus a bounded set of project tickets. A local ranking helper can prioritize exact key matches, prefix matches, substring matches, and subsequence matches without adding `fuse.js` or another fuzzy-search dependency. This keeps results explainable and stable in tests.

**Alternatives considered**:
- Add a fuzzy-search package such as `fuse.js` or `match-sorter`. Rejected because the search space is small and the extra dependency is unnecessary.
- Rely on plain SQL `contains` matching only. Rejected because the spec requires approximate or partial matching.

## Decision: Introduce a fixed-width desktop project shell with a 56px icon rail

**Rationale**: The current project pages render independently and the board page already uses the full viewport height. A shared shell with a narrow 56px rail keeps board width loss predictable, makes active-state logic reusable, and gives all supported project pages the same navigation frame without turning the rail into an expandable sidebar.

**Alternatives considered**:
- Inject rail markup separately into each project page. Rejected because route matching, responsiveness, and active-state logic would drift across pages.
- Use a wider collapsible sidebar. Rejected because the spec explicitly forbids expansion for this iteration and requires board workspace protection.

## Decision: Keep `MobileMenu` as the only primary navigation below 1024px

**Rationale**: The spec says mobile and tablet should retain the existing hamburger navigation. Leaving `MobileMenu` in place avoids introducing a second small-screen navigation pattern and keeps current destinations reachable while desktop navigation moves into the rail.

**Alternatives considered**:
- Reuse the command palette as the main mobile navigation affordance. Rejected because the ticket does not require a new mobile trigger and that would expand scope.
- Show the rail at tablet widths. Rejected because FR-002 requires the rail to be hidden below 1024px.

## Decision: Add project-scoped keyboard handling for `Meta+K` and `Ctrl+K`, and suppress project shortcuts while the palette is open

**Rationale**: The existing `useKeyboardShortcuts` hook ignores modified keys and only runs board-specific shortcuts. The palette needs a separate project-level listener that works from any project page. When the palette is open, it should capture navigation keys and prevent board shortcuts from firing underneath it.

**Alternatives considered**:
- Extend the existing board-only hook to own command palette state. Rejected because the palette must work from Activity, Analytics, and Settings too.
- Bind the palette only to the desktop trigger button. Rejected because FR-010 requires keyboard opening from anywhere within a project.
