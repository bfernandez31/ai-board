# Quickstart: Replace Header Navigation with Icon Rail Sidebar + Command Palette

**Branch**: `AIB-356-replace-header-navigation` | **Date**: 2026-03-26

## Prerequisites

1. Install `cmdk` dependency:
   ```bash
   bun add cmdk
   ```

2. Add shadcn/ui Command component:
   ```bash
   bunx shadcn@latest add command
   ```
   This creates `components/ui/command.tsx` wrapping `cmdk` with project styling.

## Implementation Order

### Step 1: Add Command Component (shadcn/ui)
- Install cmdk + add shadcn command component
- Verify `components/ui/command.tsx` is generated

### Step 2: Create Icon Rail Sidebar Component
- New file: `components/navigation/icon-rail-sidebar.tsx`
- Uses `usePathname()` for active state detection
- Renders lucide-react icons with shadcn Tooltip on hover
- Hidden below `lg` breakpoint (1024px)

### Step 3: Create Command Palette Component
- New file: `components/navigation/command-palette.tsx`
- Uses shadcn Command + Dialog for modal overlay
- Two result groups: "Navigation" (static, client-side) and "Tickets" (async, server-side via `useTicketSearch`)
- `Cmd+K`/`Ctrl+K` global listener
- Modal stacking prevention check

### Step 4: Create Search Trigger Component
- New file: `components/navigation/search-trigger.tsx`
- Replaces inline `TicketSearch` in header
- Static button with search icon + `⌘K` badge
- Clicks open the command palette

### Step 5: Create Project Layout
- New file: `app/projects/[projectId]/layout.tsx`
- CSS Grid layout: `grid-cols-[48px_1fr]` on `lg:` breakpoint
- Renders IconRailSidebar + children
- Renders CommandPalette (global within project context)

### Step 6: Modify Header
- Remove Specs (FileText), Analytics (BarChart3), Activity icons from desktop header
- Replace `TicketSearch` with `SearchTrigger`
- Keep: logo, project name, search trigger, notification bell, user avatar, mobile menu

### Step 7: Update Mobile Menu
- Keep all navigation items in hamburger menu (Board, Activity, Analytics, Settings)
- Add Board link if not already present
- Remove Specs icon (external GitHub link)

### Step 8: Keyboard Shortcut Integration
- Existing `useKeyboardShortcuts` hook needs no changes (already guards against meta keys and input focus)
- Command palette handles its own `Cmd+K` listener
- S/slash shortcut in board redirects to open command palette instead of focusing old search

## Key Files Modified

| File | Change |
|------|--------|
| `components/layout/header.tsx` | Remove nav icons, replace search with trigger |
| `components/layout/mobile-menu.tsx` | Remove Specs icon, ensure Board link exists |
| `components/board/board.tsx` | Update `onFocusSearch` to open command palette |
| `app/projects/[projectId]/layout.tsx` | **NEW** — project layout with sidebar + palette |
| `components/navigation/icon-rail-sidebar.tsx` | **NEW** — icon rail component |
| `components/navigation/command-palette.tsx` | **NEW** — command palette component |
| `components/navigation/search-trigger.tsx` | **NEW** — header search trigger button |
| `components/ui/command.tsx` | **NEW** — shadcn/ui command component (auto-generated) |

## Verification

```bash
bun run type-check    # TypeScript compilation
bun run lint          # ESLint check
bun run test:unit     # Unit tests for new components
bun run dev           # Visual verification at 1280px and 768px
```
