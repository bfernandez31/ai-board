# Implementation Plan: Global TooltipProvider Refactoring

**Feature Branch**: `AIB-241-copy-of-add`
**Created**: 2026-03-06
**Status**: Ready for Implementation

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Feature Type** | Frontend refactoring (no backend/DB changes) |
| **Affected Layer** | React component tree only |
| **Dependencies** | `@radix-ui/react-tooltip` (existing), `shadcn/ui` tooltip component |
| **Risk Level** | Low - pure refactoring, no behavior change |
| **Data Model Changes** | None |
| **API Changes** | None |
| **Migration Required** | No |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | No new types needed; removing code only |
| II. Component-Driven | PASS | Using shadcn/ui TooltipProvider; following feature-folder conventions |
| III. Test-Driven | PASS | Existing tests must continue passing; no new test files needed |
| IV. Security-First | N/A | No user input, API, or data handling changes |
| V. Database Integrity | N/A | No database changes |
| VI. AI-First Development | PASS | No documentation files created |

## Research Summary

See [research.md](./research.md) for detailed findings.

**Key decisions**:
- Single global `TooltipProvider` in `app/layout.tsx` inside `SessionProvider`
- Default `delayDuration` (700ms) from Radix UI
- `mention-display.tsx` preserves custom delay via `<Tooltip delayDuration={300}>`
- 8 component files to modify (remove local provider wrapping)
- 1 layout file to modify (add global provider)

## Implementation Strategy

### Step 1: Add Global TooltipProvider to Root Layout

**File**: `app/layout.tsx`

**Change**: Import `TooltipProvider` from `@/components/ui/tooltip` and wrap the content inside `SessionProvider`:

```tsx
// Before
<SessionProvider>
  <Header />
  {children}
  <Toaster />
  <PushOptInPrompt />
  <NotificationListener />
</SessionProvider>

// After
<SessionProvider>
  <TooltipProvider>
    <Header />
    {children}
    <Toaster />
    <PushOptInPrompt />
    <NotificationListener />
  </TooltipProvider>
</SessionProvider>
```

### Step 2: Remove Local TooltipProvider from 7 Standard Components

For each of these files, remove `TooltipProvider` from imports and remove the `<TooltipProvider>...</TooltipProvider>` wrapper:

1. `components/board/job-status-indicator.tsx` - Remove wrapper around Tooltip in compact mode render
2. `components/board/ticket-card.tsx` - Remove wrapper around agent badge Tooltip
3. `components/board/ticket-card-preview-icon.tsx` - Remove wrapper around preview Tooltip
4. `components/board/ticket-card-deploy-icon.tsx` - Remove wrapper around deploy Tooltip
5. `components/board/close-zone.tsx` - Remove wrapper around disabled zone Tooltip
6. `components/board/trash-zone.tsx` - Remove wrapper around disabled zone Tooltip
7. `components/comments/user-autocomplete.tsx` - Remove wrapper around autocomplete list

**Pattern** (same for all 7):
```tsx
// Before
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// ...
<TooltipProvider>
  <Tooltip>...</Tooltip>
</TooltipProvider>

// After
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// ...
<Tooltip>...</Tooltip>
```

### Step 3: Handle mention-display.tsx Custom Delay

**File**: `components/comments/mention-display.tsx`

This component uses `<TooltipProvider delayDuration={300}>`. The custom delay must be preserved by moving it to the `Tooltip` component:

```tsx
// Before
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// ...
<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger>...</TooltipTrigger>
    <TooltipContent>...</TooltipContent>
  </Tooltip>
</TooltipProvider>

// After
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// ...
<Tooltip delayDuration={300}>
  <TooltipTrigger>...</TooltipTrigger>
  <TooltipContent>...</TooltipContent>
</Tooltip>
```

### Step 4: Verify

1. Run `bun run type-check` to verify no TypeScript errors
2. Run `bun run lint` to verify no lint errors
3. Run `bun run test:unit` to verify existing tests pass
4. Verify no remaining `TooltipProvider` imports in component files (only in `ui/tooltip.tsx` and `app/layout.tsx`)

## File Change Summary

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `app/layout.tsx` | Add TooltipProvider import + wrapper | +3 |
| `components/board/job-status-indicator.tsx` | Remove TooltipProvider import + wrapper | -3 |
| `components/board/ticket-card.tsx` | Remove TooltipProvider import + wrapper | -3 |
| `components/board/ticket-card-preview-icon.tsx` | Remove TooltipProvider import + wrapper | -3 |
| `components/board/ticket-card-deploy-icon.tsx` | Remove TooltipProvider import + wrapper | -3 |
| `components/board/close-zone.tsx` | Remove TooltipProvider import + wrapper | -3 |
| `components/board/trash-zone.tsx` | Remove TooltipProvider import + wrapper | -3 |
| `components/comments/user-autocomplete.tsx` | Remove TooltipProvider import + wrapper | -3 |
| `components/comments/mention-display.tsx` | Remove TooltipProvider, move delay to Tooltip | -3 |
| **Total** | 9 files modified | ~-21 net lines |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tooltip stops appearing | Low | High | Global provider ensures all descendants have context |
| mention-display delay changes | Low | Medium | Explicitly set `delayDuration={300}` on `<Tooltip>` |
| Tests fail | Low | Medium | No test logic changes; provider is transparent to tests |
| Component renders outside layout | Very Low | Medium | All 8 components render within root layout tree |
