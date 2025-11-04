# Quick Start: Unified Deploy Preview Icon

**Feature**: Consolidate preview and deploy icons into single stateful icon
**Branch**: `084-1499-fix-deploy`
**Date**: 2025-11-04

## 📋 Overview

This feature consolidates two separate deploy preview icons (preview and deploy) into a single stateful icon that changes appearance based on ticket and job state. The icon provides clear visual feedback for preview access, deployment progress, and deploy actions.

## 🎯 What's Changing

### Before (Current State)

```tsx
// Two separate icons that can appear simultaneously
{ticket.previewUrl && <TicketCardPreviewIcon />}  // Green ExternalLink
{(deployJob || isDeployable) && <TicketCardDeployIcon />}  // Rocket
```

**Problem**: Icons can overlap when ticket has preview URL AND is deployable, creating visual clutter.

### After (New State)

```tsx
// Single unified icon with priority-based state resolution
{deployIconState !== 'hidden' && <UnifiedDeployIcon />}  // One icon, multiple states
```

**Solution**: Single icon with 4 states (preview, deploying, deployable, hidden) using priority logic.

## 🚀 Quick Implementation Guide

### Step 1: Add Icon State Logic (5 minutes)

**File**: `components/board/ticket-card.tsx`

```typescript
import { getDeployIconState } from '@/specs/084-1499-fix-deploy/contracts/component-interface';
import { ExternalLink, Rocket } from 'lucide-react';

// Inside TicketCard component, add memoized state computation
const deployIconState = React.useMemo(() => {
  return getDeployIconState(ticket, deployJob, isDeployable);
}, [ticket.previewUrl, deployJob?.status, isDeployable]);
```

### Step 2: Replace Icon Rendering (10 minutes)

**Find and replace** this section in `ticket-card.tsx` (lines 167-203):

```tsx
// OLD CODE (DELETE):
{ticket.previewUrl && (
  <TicketCardPreviewIcon previewUrl={ticket.previewUrl} ticketKey={ticket.ticketKey} />
)}

{deployJob ? (
  (deployJob.status === 'PENDING' || deployJob.status === 'RUNNING') ? (
    <JobStatusIndicator /* ... */ />
  ) : (
    <TicketCardDeployIcon onDeploy={() => setShowDeployModal(true)} /* ... */ />
  )
) : isDeployable ? (
  <TicketCardDeployIcon onDeploy={() => setShowDeployModal(true)} /* ... */ />
) : null}
```

**With this**:

```tsx
// NEW CODE (UNIFIED ICON):
{deployIconState === 'preview' && (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 w-6 p-0 hover:bg-[#313244] text-green-400 hover:text-green-300"
    onClick={(e) => {
      e.stopPropagation();
      window.open(ticket.previewUrl!, '_blank', 'noopener,noreferrer');
    }}
    aria-label={`Open preview deployment for ${ticket.ticketKey}`}
    title="Open preview deployment"
    data-testid="unified-deploy-icon"
  >
    <ExternalLink className="h-4 w-4" />
  </Button>
)}

{deployIconState === 'deploying' && (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 w-6 p-0 text-blue-400 cursor-not-allowed"
    disabled
    aria-label="Deployment in progress"
    title="Deployment in progress..."
    data-testid="unified-deploy-icon"
  >
    <Rocket className="h-4 w-4 animate-bounce" />
  </Button>
)}

{deployIconState === 'deployable' && (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 w-6 p-0 hover:bg-[#313244] text-[#a6adc8] hover:text-[#cdd6f4]"
    onClick={(e) => {
      e.stopPropagation();
      setShowDeployModal(true);
    }}
    aria-label={`Deploy preview for ${ticket.ticketKey}`}
    title={deployJob?.status === 'FAILED' || deployJob?.status === 'CANCELLED'
      ? 'Retry deployment'
      : 'Deploy preview'}
    data-testid="unified-deploy-icon"
  >
    <Rocket className="h-4 w-4" />
  </Button>
)}
```

### Step 3: Remove Deprecated Components (2 minutes)

```bash
# Delete old component files
rm components/board/ticket-card-preview-icon.tsx
rm components/board/ticket-card-deploy-icon.tsx

# Remove imports from ticket-card.tsx
# Delete these lines:
# import { TicketCardDeployIcon } from './ticket-card-deploy-icon';
# import { TicketCardPreviewIcon } from './ticket-card-preview-icon';
```

### Step 4: Run Tests (5 minutes)

```bash
# Search for existing tests first (REQUIRED by constitution)
npx grep -r "TicketCardPreviewIcon\|TicketCardDeployIcon" tests/

# Create unit tests for state logic
bun run test:unit tests/unit/unified-deploy-icon.test.ts

# Create integration tests for component behavior
bun run test:e2e tests/integration/board/unified-deploy-icon.spec.ts

# Run all tests to verify no regressions
bun test
```

## 🧪 Testing Checklist

### Unit Tests (Vitest)

**File**: `tests/unit/unified-deploy-icon.test.ts`

- [ ] State priority: Preview > Deploying > Deployable > Hidden
- [ ] Preview state when `ticket.previewUrl !== null`
- [ ] Deploying state when `deployJob.status === PENDING | RUNNING`
- [ ] Deployable state when `isDeployable === true`
- [ ] Deployable state when `deployJob.status === FAILED | CANCELLED`
- [ ] Hidden state when no conditions met
- [ ] Edge cases: null values, undefined jobs

### Integration Tests (Playwright)

**File**: `tests/integration/board/unified-deploy-icon.spec.ts`

- [ ] Green icon visible when ticket has preview URL
- [ ] Click green icon opens preview URL in new tab
- [ ] Rocket icon visible when ticket is deployable
- [ ] Click rocket icon opens deploy confirmation modal
- [ ] Blue bounce animation shows during deployment (PENDING/RUNNING)
- [ ] Icon disabled during deployment (no click events)
- [ ] Rocket icon reappears after FAILED/CANCELLED (retry)
- [ ] Icon hidden when ticket not deployable and no preview

## 📊 State Priority Reference

| Priority | State       | Condition                                      | Icon          | Color            | Clickable | Animation |
|----------|-------------|------------------------------------------------|---------------|------------------|-----------|-----------|
| 1        | Preview     | `ticket.previewUrl !== null`                   | ExternalLink  | Green            | ✅ Yes     | ❌ No      |
| 2        | Deploying   | `deployJob.status === PENDING \| RUNNING`      | Rocket        | Blue             | ❌ No      | ✅ Yes     |
| 3        | Deployable  | `isDeployable === true OR deployJob.status === FAILED \| CANCELLED` | Rocket | Neutral | ✅ Yes | ❌ No |
| 4        | Hidden      | None of above                                  | N/A           | N/A              | ❌ No      | ❌ No      |

## 🐛 Common Pitfalls

### ❌ Mistake 1: Not using priority logic

```tsx
// WRONG: Shows multiple icons
{ticket.previewUrl && <ExternalLink />}
{isDeployable && <Rocket />}
```

```tsx
// CORRECT: Single icon with priority
const state = getDeployIconState(ticket, deployJob, isDeployable);
{state !== 'hidden' && <UnifiedIcon state={state} />}
```

### ❌ Mistake 2: Missing disabled state during deployment

```tsx
// WRONG: Icon still clickable during deployment
{deployIconState === 'deploying' && (
  <Button onClick={handleClick}>  // Will create duplicate jobs!
    <Rocket />
  </Button>
)}
```

```tsx
// CORRECT: Icon disabled during deployment
{deployIconState === 'deploying' && (
  <Button disabled>  // Prevents duplicate deployments
    <Rocket className="animate-bounce" />
  </Button>
)}
```

### ❌ Mistake 3: Forgetting to search for existing tests

```tsx
// WRONG: Creating duplicate test files
// tests/integration/board/deploy-icon.spec.ts (new)
// tests/integration/board/ticket-card-deploy.spec.ts (existing)
```

```bash
# CORRECT: Search first, extend existing tests
npx grep -r "deploy.*icon" tests/
# Then update existing test file instead of creating new one
```

## 📝 Accessibility Notes

### Screen Reader Labels

```tsx
// Preview state
aria-label="Open preview deployment for ABC-123"
title="Open preview deployment"

// Deploying state
aria-label="Deployment in progress"
title="Deployment in progress..."

// Deployable state
aria-label="Deploy preview for ABC-123"
title="Deploy preview"  // or "Retry deployment" if failed
```

### Keyboard Navigation

- Tab focus moves to icon when clickable (preview, deployable states)
- Enter/Space activates icon action (open URL or modal)
- No focus when disabled (deploying state)
- Focus indicators match shadcn/ui button styles

### Color Contrast

- Green (text-green-400): ✅ Passes WCAG AA (contrast ratio 4.5:1)
- Blue (text-blue-400): ✅ Passes WCAG AA (contrast ratio 4.5:1)
- Icon shape changes (ExternalLink vs Rocket) provide non-color indicator

## 🔍 Debugging Tips

### Icon Not Showing?

1. Check `deployIconState` value in React DevTools
2. Verify `ticket.previewUrl`, `deployJob.status`, `isDeployable` values
3. Ensure `getDeployIconState()` function imported correctly

### Wrong Icon Showing?

1. Verify state priority order: Preview > Deploying > Deployable > Hidden
2. Check `deployJob?.status` is not undefined (use optional chaining)
3. Confirm `isDeployable` correctly computed from `isTicketDeployable()`

### Icon Not Clickable?

1. Check `deployIconState !== 'deploying'` (deploying state is disabled)
2. Verify `onClick` handler has `e.stopPropagation()` to prevent card click
3. Ensure button not conditionally disabled by parent component

## 📚 Related Files

### Implementation Files
- `components/board/ticket-card.tsx` - Primary implementation file
- `specs/084-1499-fix-deploy/contracts/component-interface.ts` - Type definitions and utility functions

### Reference Files
- `lib/utils/deploy-preview-eligibility.ts` - Deploy eligibility logic (no changes)
- `lib/utils/job-filtering.ts` - Job filtering helpers (no changes)
- `components/board/job-status-indicator.tsx` - Job status indicator pattern

### Test Files
- `tests/unit/unified-deploy-icon.test.ts` - Unit tests for state logic
- `tests/integration/board/unified-deploy-icon.spec.ts` - Integration tests for rendering

### Documentation
- `specs/084-1499-fix-deploy/spec.md` - Feature specification
- `specs/084-1499-fix-deploy/plan.md` - Implementation plan
- `specs/084-1499-fix-deploy/research.md` - Design decisions and research
- `specs/084-1499-fix-deploy/data-model.md` - Data model and state transitions

## ⏱️ Estimated Time

- **Implementation**: 20-30 minutes
  - Add icon state logic: 5 minutes
  - Replace icon rendering: 10 minutes
  - Remove deprecated components: 2 minutes
  - Manual testing: 5 minutes

- **Testing**: 30-40 minutes
  - Search for existing tests: 5 minutes
  - Write unit tests: 15 minutes
  - Write integration tests: 15 minutes
  - Run full test suite: 5 minutes

- **Total**: 50-70 minutes (Red-Green-Refactor cycle)

## ✅ Done Checklist

- [ ] Icon state logic added to TicketCard component
- [ ] Unified icon rendering replaces separate icons
- [ ] Deprecated components removed
- [ ] Imports updated
- [ ] Unit tests written and passing (Vitest)
- [ ] Integration tests written and passing (Playwright)
- [ ] Manual testing: All 4 icon states verified
- [ ] Manual testing: Click handlers work correctly
- [ ] Manual testing: Accessibility labels correct
- [ ] No regressions: Existing tests pass
- [ ] Code review: Constitution principles verified

## 🤝 Need Help?

- **Spec unclear?** Read `specs/084-1499-fix-deploy/spec.md` for detailed requirements
- **State logic confusing?** Check `data-model.md` for state transition diagrams
- **Testing questions?** See constitution.md Principle III for hybrid testing strategy
- **Found a bug?** Check existing issues or create new one with `[unified-deploy-icon]` tag
