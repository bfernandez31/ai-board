# Research: Global TooltipProvider Refactoring

## R-001: Radix UI TooltipProvider Singleton Support

**Decision**: A single global `TooltipProvider` can serve all descendant `Tooltip` components.

**Rationale**: Radix UI's `TooltipProvider` is a lightweight React context provider. It manages tooltip timing coordination (e.g., skip delay when moving between tooltips). A single provider at the root is the recommended pattern per Radix UI documentation. Multiple providers work but are redundant.

**Alternatives Considered**:
- Keep per-component providers (current state): Unnecessary boilerplate, no benefit
- Multiple grouped providers: Adds complexity without value

## R-002: Default delayDuration Behavior

**Decision**: Use the Radix UI default `delayDuration` (700ms) for the global provider. Override per-tooltip where needed.

**Rationale**: The Radix UI default `delayDuration` is 700ms. Currently, 8 of 9 usages rely on this default. Only `mention-display.tsx` uses `delayDuration={300}`. Per-tooltip delay can be set on the `Tooltip` component itself (not only on the provider), so `mention-display.tsx` can use `<Tooltip delayDuration={300}>` to preserve its custom timing.

**Alternatives Considered**:
- Set global `delayDuration={300}`: Would change behavior for all other tooltips
- Set global `delayDuration={0}`: Too aggressive for all components

## R-003: Provider Placement in Layout

**Decision**: Place `TooltipProvider` inside the existing provider chain in `app/layout.tsx`, wrapping the content alongside `QueryProvider` and `SessionProvider`.

**Rationale**: All 8 affected components render within the root layout's React tree. `TooltipProvider` is a lightweight context provider with no side effects. Placing it inside `SessionProvider` (innermost existing provider) ensures all tooltip-using components are descendants.

**Alternatives Considered**:
- Separate providers wrapper component: Over-engineering for adding one provider
- Outside `<body>`: Invalid HTML structure

## R-004: Portal Behavior with Global Provider

**Decision**: No special handling needed for portal-rendered tooltips.

**Rationale**: Radix UI tooltips render content via portals by default, but the context (provider) relationship is based on the React component tree, not DOM hierarchy. As long as the `Tooltip` component is a React descendant of `TooltipProvider`, the portal-rendered content will work correctly.

## R-005: Affected Files Inventory

**9 files** currently import `TooltipProvider`:

| # | File | Custom Props | Notes |
|---|------|-------------|-------|
| 1 | `components/board/job-status-indicator.tsx` | None | Default delay |
| 2 | `components/board/ticket-card.tsx` | None | Agent badge tooltip |
| 3 | `components/board/ticket-card-preview-icon.tsx` | None | Preview link tooltip |
| 4 | `components/board/ticket-card-deploy-icon.tsx` | None | Deploy button tooltip |
| 5 | `components/board/close-zone.tsx` | None | Disabled zone tooltip |
| 6 | `components/board/trash-zone.tsx` | None | Disabled zone tooltip |
| 7 | `components/comments/mention-display.tsx` | `delayDuration={300}` | Must preserve custom delay |
| 8 | `components/comments/user-autocomplete.tsx` | None | Default delay |
| 9 | `components/ui/tooltip.tsx` | N/A | Component definition (export only) |

**Note**: The spec lists 8 components. File #9 (`tooltip.tsx`) is the UI primitive definition and only exports `TooltipProvider` - it does not use it. The 8 consumer components match the spec exactly.
