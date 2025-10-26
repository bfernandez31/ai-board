# Quickstart: Living Workflow Section

**Feature**: Mini-Kanban animated demo for landing page
**Date**: 2025-10-26
**Prerequisites**: Node.js 22.20.0 LTS, Bun installed

## Quick Start (5 minutes)

### 1. Setup
```bash
# Install dependencies (if not already done)
bun install

# Start development server
bun run dev
```

### 2. View Demo
Open browser to `http://localhost:3000` and scroll to the workflow section. You should see the animated mini-Kanban demo.

### 3. Run Tests
```bash
# Unit tests (fast feedback)
bun run test:unit

# E2E tests (visual behavior)
bun run test:e2e

# Full test suite
bun test
```

## Development Workflow

### Test-Driven Development (TDD) - MANDATORY

**Order of Operations** (Constitution Principle III):
1. Write failing tests FIRST
2. Run tests to verify they fail (Red)
3. Write minimal implementation to make tests pass (Green)
4. Refactor while keeping tests green

**Example TDD Cycle**:
```bash
# 1. Create failing unit test
vim tests/unit/animation-helpers.test.ts

# Write test:
# describe('calculateNextColumn', () => {
#   it('wraps from 5 to 0', () => {
#     expect(calculateNextColumn(5)).toBe(0);
#   });
# });

# 2. Run test (should FAIL)
bun run test:unit tests/unit/animation-helpers.test.ts

# Expected output: ❌ FAIL - calculateNextColumn is not defined

# 3. Write minimal implementation
vim lib/utils/animation-helpers.ts

# export function calculateNextColumn(column: number): number {
#   return column < 5 ? column + 1 : 0;
# }

# 4. Run test again (should PASS)
bun run test:unit tests/unit/animation-helpers.test.ts

# Expected output: ✅ PASS - 1 test passed

# 5. Repeat for next test
```

### File Structure

```
components/landing/
├── mini-kanban-demo.tsx         # Main component (start here)
├── demo-ticket-card.tsx         # Ticket card component
└── workflow-column-card.tsx     # Column component

lib/
├── hooks/
│   ├── use-animation-state.ts   # Animation state machine hook
│   ├── use-reduced-motion.ts    # Accessibility hook
│   └── use-intersection-observer.ts  # Viewport detection hook
└── utils/
    └── animation-helpers.ts     # Pure utility functions

tests/
├── unit/
│   ├── animation-helpers.test.ts       # Vitest: Pure functions
│   ├── use-reduced-motion.test.ts      # Vitest: Hook logic
│   └── mini-kanban-animation.test.ts   # Vitest: State machine
└── e2e/
    └── landing-page-workflow.spec.ts   # Playwright: Visual behavior
```

## Testing Guide

### Unit Tests (Vitest)

**Run all unit tests**:
```bash
bun run test:unit
```

**Run specific test file**:
```bash
bun run test:unit tests/unit/animation-helpers.test.ts
```

**Run with UI (interactive)**:
```bash
bun run test:unit:ui
```

**Run in watch mode** (auto-rerun on file changes):
```bash
bun run test:unit:watch
```

**Writing unit tests**:
```typescript
// tests/unit/animation-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { calculateNextColumn } from '@/lib/utils/animation-helpers';

describe('calculateNextColumn', () => {
  it('increments column from 0 to 1', () => {
    expect(calculateNextColumn(0)).toBe(1);
  });

  it('wraps column from 5 to 0', () => {
    expect(calculateNextColumn(5)).toBe(0);
  });
});
```

**When to use Vitest**:
- Pure utility functions (no side effects)
- Business logic calculations
- Type transformations
- Hook logic (with `@testing-library/react-hooks`)

### E2E Tests (Playwright)

**Run all E2E tests**:
```bash
bun run test:e2e
```

**Run specific test file**:
```bash
npx playwright test tests/e2e/landing-page-workflow.spec.ts
```

**Run in headed mode** (see browser):
```bash
npx playwright test --headed
```

**Run in debug mode** (step through):
```bash
npx playwright test --debug
```

**View test report**:
```bash
npx playwright show-report
```

**Writing E2E tests**:
```typescript
// tests/e2e/landing-page-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('demo tickets progress through columns', async ({ page }) => {
  await page.goto('/');

  const ticket = page.locator('[data-ticket-id="1"]');
  const initialColumn = await ticket.getAttribute('data-column');

  // Wait for 10-second interval
  await page.waitForTimeout(10500);

  const newColumn = await ticket.getAttribute('data-column');
  expect(Number(newColumn)).toBe(Number(initialColumn) + 1);
});
```

**When to use Playwright**:
- Visual behavior and rendering
- User interactions (hover, click)
- Animation timing and transitions
- Accessibility features (reduced-motion)
- Cross-browser compatibility

## Component Development

### Creating the Main Component

**File**: `components/landing/mini-kanban-demo.tsx`

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { DemoTicketCard } from './demo-ticket-card';
import { WorkflowColumnCard } from './workflow-column-card';
import { useAnimationState } from '@/lib/hooks/use-animation-state';
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer';

const DEMO_TICKETS = [
  { id: 1, title: 'Add user authentication', column: 1 },
  { id: 2, title: 'Fix mobile layout bug', column: 3 },
  { id: 3, title: 'Implement dark mode', column: 0 },
] as const;

interface MiniKanbanDemoProps {
  className?: string;
  animationInterval?: number;
  transitionDuration?: number;
  autoStart?: boolean;
}

export function MiniKanbanDemo({
  className = '',
  animationInterval = 10000,
  transitionDuration = 1000,
  autoStart = true,
}: MiniKanbanDemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef, { threshold: 0.1 });

  const {
    tickets,
    isPaused,
    prefersReducedMotion,
    togglePause,
    setVisible,
  } = useAnimationState(DEMO_TICKETS, animationInterval);

  useEffect(() => {
    setVisible(isVisible);
  }, [isVisible, setVisible]);

  return (
    <div
      ref={containerRef}
      className={`mini-kanban-demo ${className}`}
      onMouseEnter={togglePause}
      onMouseLeave={togglePause}
    >
      {/* Render columns and tickets */}
    </div>
  );
}
```

### Implementing Animation Hooks

**File**: `lib/hooks/use-animation-state.ts`

```typescript
import { useState, useEffect } from 'react';
import { useReducedMotion } from './use-reduced-motion';
import { calculateNextColumn, shouldAnimate } from '@/lib/utils/animation-helpers';

interface DemoTicket {
  id: number;
  title: string;
  column: number;
}

export function useAnimationState(
  initialTickets: DemoTicket[],
  interval: number = 10000
) {
  const [tickets, setTickets] = useState(initialTickets);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!shouldAnimate(isPaused, isVisible, prefersReducedMotion)) {
      return;
    }

    const timer = setInterval(() => {
      setTickets(prev =>
        prev.map(ticket => ({
          ...ticket,
          column: calculateNextColumn(ticket.column),
        }))
      );
    }, interval);

    return () => clearInterval(timer);
  }, [isPaused, isVisible, prefersReducedMotion, interval]);

  return {
    tickets,
    isPaused,
    isVisible,
    prefersReducedMotion,
    togglePause: () => setIsPaused(prev => !prev),
    setVisible: (visible: boolean) => setIsVisible(visible),
  };
}
```

**File**: `lib/hooks/use-reduced-motion.ts`

```typescript
import { useState, useEffect } from 'react';

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}
```

### Creating Utility Functions

**File**: `lib/utils/animation-helpers.ts`

```typescript
export type ColumnIndex = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Calculates the next column index for a ticket.
 * Wraps around to INBOX (0) after SHIP (5).
 */
export function calculateNextColumn(currentColumn: number): number {
  return currentColumn < 5 ? currentColumn + 1 : 0;
}

/**
 * Checks if animations should run based on pause state,
 * visibility, and user accessibility preferences.
 */
export function shouldAnimate(
  isPaused: boolean,
  isVisible: boolean,
  prefersReducedMotion: boolean
): boolean {
  return !isPaused && isVisible && !prefersReducedMotion;
}

/**
 * Maps column index (0-5) to workflow stage name.
 */
export function getColumnName(index: number): string {
  const stages = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'];
  return stages[index] || 'UNKNOWN';
}
```

## Styling Guide

### CSS Animations

**File**: `components/landing/mini-kanban-demo.tsx` (or separate CSS module)

```css
.demo-ticket {
  transition: transform 1000ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.demo-ticket:hover {
  cursor: grab;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.demo-ticket:active {
  cursor: grabbing;
  transform: translateY(0);
}

/* Accessibility: Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .demo-ticket {
    transition: opacity 300ms ease !important;
    transform: none !important;
  }

  .demo-ticket.changing-column {
    opacity: 0;
  }

  .demo-ticket:not(.changing-column) {
    opacity: 1;
  }
}
```

### Tailwind Classes

**Recommended classes** (matching existing board design):

```typescript
// Column styling
const columnClasses = 'bg-gray-50 border border-gray-200 rounded-lg p-4';

// Ticket card styling
const ticketClasses = 'bg-white shadow-sm hover:shadow-lg rounded-lg p-3 transition-shadow';

// Column headers
const headerClasses = 'text-sm font-medium text-gray-700 mb-2';
```

### Extracting Design Tokens from Existing Board

```bash
# Inspect existing board components
cat components/board/board.tsx | grep className
cat components/board/ticket-card.tsx | grep className

# Reuse existing shadcn/ui Card component
# Import: import { Card } from '@/components/ui/card';
```

## Debugging

### Animation Not Running

**Check**:
1. Is component visible in viewport? (Intersection Observer)
2. Is mouse hovering? (Pauses animation)
3. Is `prefers-reduced-motion` enabled? (Disables position animations)
4. Are there console errors?

**Debug**:
```typescript
// Add debug logging
useEffect(() => {
  console.log('Animation state:', {
    isPaused,
    isVisible,
    prefersReducedMotion,
    shouldRun: shouldAnimate(isPaused, isVisible, prefersReducedMotion),
  });
}, [isPaused, isVisible, prefersReducedMotion]);
```

### Animations Stuttering

**Common causes**:
1. Animating non-GPU properties (use `transform` and `opacity` only)
2. Missing `will-change: transform` hint
3. Too many re-renders (check React DevTools Profiler)
4. Heavy JavaScript on main thread

**Fix**:
```css
/* Ensure GPU acceleration */
.demo-ticket {
  transform: translateZ(0); /* Force GPU layer */
  will-change: transform;
}
```

### Tests Failing

**Unit test failures**:
```bash
# Run in watch mode to see errors
bun run test:unit:watch

# Check test file has correct imports
import { describe, it, expect } from 'vitest';
```

**E2E test failures**:
```bash
# Run in headed mode to see what's happening
npx playwright test --headed

# Increase timeouts if animations are slow
await page.waitForTimeout(11000); // 10s interval + 1s buffer
```

## Performance Monitoring

### Lighthouse Audit

```bash
# Build production version
bun run build

# Start production server
bun run start

# Run Lighthouse (Chrome DevTools)
# Open Chrome DevTools → Lighthouse → Generate Report

# Target metrics (from spec SC-006):
# - Performance Score: > 90
# - First Contentful Paint: < 1.5s
# - Largest Contentful Paint: < 2.5s
```

### Animation FPS Monitoring

**Chrome DevTools**:
1. Open DevTools → More Tools → Rendering
2. Enable "Frame Rendering Stats"
3. Scroll to mini-Kanban demo
4. Verify FPS stays at 60fps during animations

**Expected**:
- **60fps** during smooth column transitions
- **No layout shifts** (Layout Shift Regions should be empty)
- **GPU acceleration active** (green indicators in Rendering → Paint Flashing)

## Accessibility Testing

### Reduced Motion Testing

**macOS**:
```bash
# Enable reduced motion
# System Preferences → Accessibility → Display → Reduce Motion

# Or use Playwright emulation
```

**Playwright emulation**:
```typescript
test('respects prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  // Verify no transform animations
  const ticket = page.locator('.demo-ticket').first();
  const transform = await ticket.evaluate(el =>
    window.getComputedStyle(el).transform
  );
  expect(transform).toBe('none');
});
```

### Screen Reader Testing

**Note**: This demo is intentionally NOT screen-reader accessible (it's a visual-only marketing demo). If making it accessible:

```typescript
// Add ARIA labels
<div
  role="region"
  aria-label="Workflow demonstration"
  aria-live="off" // Do not announce automatic updates
>
  {/* Demo content */}
</div>
```

## Common Tasks

### Change Animation Timing

**Edit**: `components/landing/mini-kanban-demo.tsx`

```typescript
<MiniKanbanDemo
  animationInterval={8000}  // 8 seconds instead of 10
  transitionDuration={750}  // 750ms instead of 1000ms
/>
```

### Add New Demo Ticket

**Edit**: `components/landing/mini-kanban-demo.tsx`

```typescript
const DEMO_TICKETS = [
  { id: 1, title: 'Add user authentication', column: 1 },
  { id: 2, title: 'Fix mobile layout bug', column: 3 },
  { id: 3, title: 'Implement dark mode', column: 0 },
  { id: 4, title: 'Add search feature', column: 2 }, // NEW
] as const;
```

**Important**: Update tests to account for new ticket count.

### Change Column Colors

**Edit**: `components/landing/workflow-column-card.tsx`

```typescript
const WORKFLOW_STAGES = [
  { index: 0, name: 'INBOX', label: 'Inbox', color: 'bg-slate-100' },
  { index: 1, name: 'SPECIFY', label: 'Specify', color: 'bg-sky-100' },
  // etc.
];
```

**Important**: Ensure colors match existing board design (extract from `components/board/board.tsx`).

### Disable Animations Entirely

**Edit**: `lib/utils/animation-helpers.ts`

```typescript
export function shouldAnimate(...args: any[]): boolean {
  return false; // Disable all animations
}
```

**OR** set `autoStart={false}` prop:

```typescript
<MiniKanbanDemo autoStart={false} />
```

## Troubleshooting

### "Module not found" errors

```bash
# Check tsconfig.json has path aliases
cat tsconfig.json | grep "@/*"

# Should see:
# "paths": {
#   "@/*": ["./*"]
# }

# If missing, add and restart dev server
```

### Tailwind classes not working

```bash
# Ensure component directory is in Tailwind config
cat tailwind.config.ts | grep content

# Should include:
# content: ['./components/**/*.{ts,tsx}', ...]

# If missing, add and rebuild
```

### Tests can't find component

```bash
# Check test file imports use @ alias
import { MiniKanbanDemo } from '@/components/landing/mini-kanban-demo';

# NOT relative paths (less reliable):
import { MiniKanbanDemo } from '../../../components/landing/mini-kanban-demo';
```

## Next Steps

After quickstart setup:

1. **Read documentation**:
   - `spec.md` - Feature requirements and acceptance criteria
   - `data-model.md` - TypeScript interfaces and state management
   - `research.md` - Technology decisions and rationale

2. **Write tests first** (TDD):
   - Start with unit tests for `animation-helpers.ts`
   - Then hook tests for `use-animation-state.ts`
   - Finally E2E tests for visual behavior

3. **Implement components**:
   - `lib/utils/animation-helpers.ts` (pure functions)
   - `lib/hooks/use-reduced-motion.ts` (accessibility)
   - `lib/hooks/use-animation-state.ts` (state machine)
   - `components/landing/mini-kanban-demo.tsx` (main component)

4. **Verify success criteria**:
   - SC-002: 60fps animation (Chrome DevTools → Rendering)
   - SC-003: <100ms hover response (manual testing)
   - SC-007: Complete journey in 60s (6 columns × 10s = 60s)

## Resources

### Documentation
- [Next.js 15 Docs](https://nextjs.org/docs)
- [React 18 Docs](https://react.dev)
- [Vitest Docs](https://vitest.dev)
- [Playwright Docs](https://playwright.dev)
- [TailwindCSS Docs](https://tailwindcss.com/docs)

### Browser APIs
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [Media Queries: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [CSS Animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations)

### Project-Specific
- Constitution: `.specify/memory/constitution.md`
- CLAUDE.md: Agent guidance (auto-updated with technology decisions)
- Spec-kit workflows: `.specify/templates/`

## Getting Help

**Before asking**:
1. Check error messages in terminal
2. Review test output for failures
3. Check browser DevTools console
4. Verify all dependencies installed (`bun install`)

**Common issues**:
- "Port 3000 already in use" → `killall node` or use `bun run dev -- -p 3001`
- "Module not found" → Check `tsconfig.json` path aliases
- "Tests fail" → Run in watch mode to see real-time errors
- "Animations stuttering" → Check GPU acceleration (transform/opacity only)
