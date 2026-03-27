# Research: Replace Header Navigation with Icon Rail Sidebar + Command Palette

**Branch**: `AIB-356-replace-header-navigation` | **Date**: 2026-03-26

## Research Tasks

### 1. Command Palette Implementation Approach

**Decision**: Use shadcn/ui `Command` component (wraps `cmdk` library) for the command palette.

**Rationale**:
- shadcn/ui provides a `Command` component built on top of `cmdk` by Paco Coursey — this is the standard approach in the shadcn/ui ecosystem
- `cmdk` provides built-in fuzzy matching, keyboard navigation (arrow keys, Enter, Escape), grouped results, and empty state handling
- Constitution mandates using shadcn/ui components exclusively for UI primitives
- `cmdk` is lightweight (~3.5KB gzipped) and composable with Radix Dialog for modal behavior
- The existing `@radix-ui/react-dialog` dependency is already installed, which `cmdk` + shadcn Command Dialog uses

**Alternatives considered**:
- Custom implementation with Popover + Input: More work, less accessible, reinvents keyboard navigation
- `kbar`: Heavier, more opinionated, not part of shadcn/ui ecosystem
- Plain Dialog + custom search: Lacks built-in fuzzy matching and keyboard navigation patterns

**Action**: Install `cmdk` dependency and add shadcn/ui `Command` component (`npx shadcn@latest add command`)

### 2. Icon Rail Sidebar Layout Strategy

**Decision**: Create a project-level layout (`app/projects/[projectId]/layout.tsx`) that renders the icon rail alongside page content, using CSS Grid with a responsive breakpoint at `lg` (1024px).

**Rationale**:
- No project-level layout currently exists — this is the natural place to add project-scoped UI like the sidebar
- CSS Grid (`grid-cols-[48px_1fr]`) provides precise width control for the 48px rail
- The rail only applies to project pages, not global pages (projects list, billing, auth)
- The root layout (`app/layout.tsx`) renders Header globally — the sidebar slots below the header within project pages only
- Using `hidden lg:grid` ensures the rail is completely absent on mobile (< 1024px)

**Alternatives considered**:
- Modify root layout: Would show sidebar on non-project pages — violates spec requirement
- Absolute/fixed positioning: Would not participate in document flow, causing overlap with board content
- Flexbox: Works but CSS Grid provides more explicit column sizing

### 3. Fuzzy Matching Strategy for Navigation Items

**Decision**: Use `cmdk`'s built-in fuzzy matching for navigation items (client-side) and the existing ticket search API for ticket results (server-side with debounce).

**Rationale**:
- Navigation items are a static list of 4 items — no need for external search infrastructure
- `cmdk` provides built-in `filter` prop with customizable fuzzy matching
- The existing `/api/projects/[projectId]/tickets/search` endpoint already handles ticket search with relevance scoring
- The existing `useTicketSearch` hook provides debounced search with TanStack Query caching
- Two-source approach: instant navigation filtering + async ticket search with loading state

**Alternatives considered**:
- Unified client-side search (preload all tickets): Not scalable for projects with many tickets
- New unified search API: Unnecessary — existing endpoint is sufficient
- fuse.js or fuzzysort: Adds a dependency when cmdk already has built-in filtering

### 4. Keyboard Shortcut Coexistence

**Decision**: Add a global `Cmd+K`/`Ctrl+K` listener in the command palette component. When the palette is open, it captures all keyboard input in its search field. The existing `useKeyboardShortcuts` hook already guards against firing when focus is in an INPUT element (line 16 of `use-keyboard-shortcuts.ts`), so no modification needed.

**Rationale**:
- The existing keyboard shortcut hook checks `isEditableElement(event.target)` and skips shortcuts when user is in an input — the command palette's search input qualifies
- The existing hook also checks `event.metaKey || event.ctrlKey` and returns early — so `Cmd+K` won't conflict with existing shortcuts
- The `Cmd+K` listener needs `metaKey`/`ctrlKey` check, which is the opposite guard from existing shortcuts
- Modal open state already prevents interaction with background elements

**Alternatives considered**:
- Modifying `useKeyboardShortcuts` to accept a "disabled" override: Unnecessary given existing guards
- Global keyboard context provider: Over-engineering for a single new shortcut

### 5. Modal Stacking Prevention

**Decision**: Check for open modals before allowing command palette to open. Use a data attribute (`[data-state="open"]`) on Radix Dialog elements to detect open modals.

**Rationale**:
- Radix Dialog sets `data-state="open"` on dialog overlays when active
- A simple DOM query `document.querySelector('[role="dialog"][data-state="open"]')` detects any open Radix dialog
- This prevents z-index conflicts and focus trap issues per spec edge case
- The command palette itself uses a Dialog, so we check before opening it

**Alternatives considered**:
- React context for modal state tracking: More complex, requires wrapping all modals
- CSS-only z-index layering: Doesn't solve focus trap conflicts

### 6. Search Bar Transformation

**Decision**: Replace the inline `TicketSearch` component in the header with a static "search trigger" button that opens the command palette. The trigger displays a search icon, placeholder text, and a `⌘K` keyboard shortcut badge.

**Rationale**:
- The spec explicitly states: "Search bar click opens the command palette instead of inline search"
- The existing `TicketSearch` component's search logic (debounce, API call, result rendering) moves into the command palette
- The trigger button is simpler than the current component — just a styled button with no state
- The `⌘K` badge serves as discoverability affordance per FR-012

**Alternatives considered**:
- Keep TicketSearch and add palette on top: Redundant UX, confusing two search mechanisms
- Remove search bar entirely: Loses visual affordance for discovering search/palette

### 7. Icon Selection for Navigation Rail

**Decision**: Use existing lucide-react icons already imported in the codebase:
- Board: `LayoutDashboard` (kanban-style icon)
- Activity: `Activity` (already used in header)
- Analytics: `BarChart3` (already used in header)
- Settings: `Settings` (standard gear icon)

**Rationale**:
- lucide-react is already the project's icon library
- `Activity` and `BarChart3` are already imported in `header.tsx` and `mobile-menu.tsx`
- Consistent icon language with existing UI
- All icons render well at 20-24px size suitable for 48px rail

**Alternatives considered**:
- Custom SVG icons: Unnecessary when lucide-react provides appropriate options
- Different icon set: Would violate consistency with existing UI
