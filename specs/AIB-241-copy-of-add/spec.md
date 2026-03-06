# Feature Specification: Add Global TooltipProvider to Eliminate Per-Component Wrapping

**Feature Branch**: `AIB-241-copy-of-add`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "Add a single global TooltipProvider in the app layout and remove all local TooltipProvider wrappers from 8 components"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether the global TooltipProvider should include a custom `delayDuration` prop or use the default
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 0.3) - internal refactoring with no risk signals
- **Fallback Triggered?**: Yes - AUTO confidence was below 0.5, promoted to CONSERVATIVE
- **Trade-offs**:
  1. Using the default `delayDuration` keeps behavior consistent across all tooltips; one component (`mention-display.tsx`) currently uses `delayDuration={300}` which differs from the default
  2. The global provider should use the library default to avoid unexpected behavior changes; components needing custom delay can still override locally via their own `Tooltip` props
- **Reviewer Notes**: Verify that the mention-display tooltip delay behavior is acceptable with the global default. If not, a per-component `delayDuration` override on the `Tooltip` element (not the provider) may be needed.

---

- **Decision**: Placement of the global TooltipProvider within the existing provider hierarchy
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Placing it inside the existing provider chain (alongside QueryProvider, SessionProvider) keeps the layout consistent
  2. No performance or functional risk since TooltipProvider is a lightweight context provider
- **Reviewer Notes**: Confirm that TooltipProvider wraps all routes where tooltips are used. The root layout is the correct location since all 8 affected components render within it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tooltips Continue to Appear on Hover (Priority: P1)

A user hovers over any interactive element that has a tooltip (job status indicators, ticket card icons, close/trash zones, mentions, autocomplete items). The tooltip appears with the same content and timing as before the refactoring.

**Why this priority**: This is the core functional requirement - all existing tooltip behavior must be preserved after removing local providers.

**Independent Test**: Can be fully tested by hovering over each tooltip-enabled element and verifying the tooltip appears with correct content. Delivers the guarantee that the refactoring introduces no regressions.

**Acceptance Scenarios**:

1. **Given** a board view with tickets, **When** a user hovers over a job status indicator, **Then** the tooltip displays the job status details exactly as before
2. **Given** a board view with tickets, **When** a user hovers over the deploy icon or preview icon on a ticket card, **Then** the appropriate tooltip appears
3. **Given** the close zone or trash zone is visible during drag, **When** a user hovers over either zone, **Then** the tooltip describing the zone's action appears
4. **Given** a comment with @mentions, **When** a user hovers over a mention, **Then** the user tooltip appears with the expected delay
5. **Given** the user autocomplete dropdown is visible, **When** a user hovers over an autocomplete option, **Then** the tooltip appears with user details

---

### User Story 2 - Cleaner Component Code (Priority: P2)

After the refactoring, developers (AI agents) working on tooltip-enabled components no longer need to import or wrap with `TooltipProvider`. New components that use tooltips automatically inherit the global provider.

**Why this priority**: Improves maintainability and reduces boilerplate, but is secondary to preserving existing functionality.

**Independent Test**: Can be verified by inspecting the 8 affected component files and confirming `TooltipProvider` is no longer imported or used locally, and that the global layout includes the provider.

**Acceptance Scenarios**:

1. **Given** the app layout file, **When** inspected, **Then** it contains a single `TooltipProvider` wrapping the application content
2. **Given** any of the 8 previously affected component files, **When** inspected, **Then** `TooltipProvider` is not imported or used locally

### Edge Cases

- What happens if a component renders outside the root layout (e.g., in a modal portal)? Radix UI tooltips use portals by default and should still work as long as the provider is in the React tree ancestry.
- What happens if the `mention-display` component's custom `delayDuration={300}` behavior changes? The component may need a per-tooltip delay override if the global default differs noticeably.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST have exactly one global `TooltipProvider` in the root layout that serves all tooltip-enabled components
- **FR-002**: All 8 identified components MUST have their local `TooltipProvider` wrappers removed
- **FR-003**: All 8 identified components MUST have `TooltipProvider` removed from their imports
- **FR-004**: All existing tooltip functionality MUST continue to work identically after the change (content, positioning, show/hide behavior)
- **FR-005**: The global `TooltipProvider` MUST be placed in the component tree such that all tooltip-using components are descendants of it

### Affected Components

- `components/board/job-status-indicator.tsx`
- `components/board/ticket-card.tsx`
- `components/board/ticket-card-preview-icon.tsx`
- `components/board/ticket-card-deploy-icon.tsx`
- `components/board/close-zone.tsx`
- `components/board/trash-zone.tsx`
- `components/comments/mention-display.tsx`
- `components/comments/user-autocomplete.tsx`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All tooltip interactions across the application behave identically before and after the change (zero user-visible regressions)
- **SC-002**: The number of `TooltipProvider` instances in component files is reduced from 8 to 0 (one global instance remains in the layout)
- **SC-003**: All existing tests continue to pass without modification
- **SC-004**: No new `TooltipProvider` imports exist in any component file outside of the UI primitive definition and the root layout

### Assumptions

- The shadcn/ui `TooltipProvider` (Radix UI) supports a single global instance serving all descendant `Tooltip` components
- All tooltip-using components render within the root layout's React tree
- The default `delayDuration` of the Radix TooltipProvider is acceptable for all components (with the noted exception of `mention-display.tsx` which may need individual override)
