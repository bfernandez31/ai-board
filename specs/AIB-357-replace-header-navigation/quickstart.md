# Quickstart: Replace Header Navigation with Collapsible Icon Rail Sidebar + Cmd+K Command Palette

## Implementation Sequence

1. Add static destination metadata and active-route helpers for Board, Activity, Analytics, and Settings.
2. Create the shared desktop project shell and fixed icon rail, then wrap supported project pages with it.
3. Replace the desktop header ticket search with a palette trigger and remove redundant analytics/activity header buttons.
4. Add the grouped command-palette API route with query validation, auth checks, and ranking helpers.
5. Build the command palette dialog, grouped result rendering, and project-wide keyboard shortcut handling.
6. Extend tests across unit, component, integration, and one browser-level responsive flow.

## Suggested File Order

- `/home/runner/work/ai-board/ai-board/target/components/navigation/project-destinations.ts`
- `/home/runner/work/ai-board/ai-board/target/components/layout/project-shell.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/layout/header.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/search/command-palette.tsx`
- `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/command-palette/route.ts`
- `/home/runner/work/ai-board/ai-board/target/lib/search/command-palette-ranking.ts`

## Validation Commands

```bash
bun run test:unit
bun run test:integration
bun run test:e2e
bun run type-check
bun run lint
```

## Manual Verification

1. Open `/projects/{id}/board` at a desktop viewport `>=1024px` and confirm the left rail is visible, icon-only, and highlights Board.
2. Navigate to Activity, Analytics, and Settings from the rail and verify each destination becomes active without using header icon buttons.
3. Press `Cmd+K` on macOS or `Ctrl+K` on non-macOS from Board, Activity, Analytics, and Settings and confirm the palette opens with focus in the search input.
4. Search for a destination and for a ticket key/title, then verify grouped results and keyboard selection with Arrow keys + Enter.
5. Press `Escape` while the palette is open and confirm it closes without navigation and without firing other project shortcuts.
6. Resize below `1024px` and confirm the rail disappears while the existing hamburger menu still exposes project navigation.
7. Check the board at `1280px` width and confirm six columns remain workable after the rail is added.
