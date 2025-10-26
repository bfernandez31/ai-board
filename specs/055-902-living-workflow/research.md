# Research: Living Workflow Section

**Feature**: Mini-Kanban animated demo for landing page
**Date**: 2025-10-26
**Status**: Complete

## Animation Technology Decision

### Decision
Use **CSS Animations + React State** (NOT Framer Motion)

### Rationale
1. **Zero bundle overhead** - Critical for landing page First Load JS metric
2. **No compatibility concerns** - Works natively with Next.js 15/React 19 without workarounds (Framer Motion has known React 19 compatibility issues)
3. **True GPU acceleration** - CSS `transform` and `opacity` animations run on compositor thread, better performance during page load
4. **Simpler accessibility** - Native `@media (prefers-reduced-motion: reduce)` support without JavaScript overhead
5. **Sufficient capability** - Simple column-to-column transitions don't require Framer Motion's advanced features (spring physics, complex gestures)

### Alternatives Considered
1. **Framer Motion (Full)**: Rejected due to 34KB bundle impact, React 19 compatibility concerns, and overkill for simple transitions
2. **Framer Motion (LazyMotion Optimized)**: Rejected due to 4.6KB minimum overhead, still faces React 19 issues, unnecessary complexity
3. **Pure CSS Animations (No React)**: Rejected because cannot implement 10-second timed progression or track ticket positions without JavaScript
4. **Web Animations API (WAAPI)**: Rejected as more complex than CSS animations for this use case, unnecessary JavaScript overhead

### Bundle Size Impact
| Approach | First Load JS Impact |
|----------|---------------------|
| **CSS Animations + React State** | 0KB |
| Framer Motion (Full) | +34KB |
| Framer Motion (LazyMotion) | +4.6KB |

Landing page context: Every KB matters for First Contentful Paint and Lighthouse score. CSS provides the functionality natively.

### Implementation Complexity
**CSS Animations + React State**: MEDIUM
- React state for ticket positions
- `useEffect` with `setInterval` for 10-second ticker
- Hover state management for pause/resume
- CSS `@keyframes` for smooth transitions
- `animation-play-state` toggle based on hover
- `@media (prefers-reduced-motion)` for accessibility

**Framer Motion**: MEDIUM-HIGH
- Requires learning Framer Motion API
- More abstracted but adds bundle weight and dependency risk
- Same state management complexity as CSS approach

### Performance Characteristics
- **CSS @keyframes with transform/opacity**: GPU-accelerated, runs off main thread, maintains 60fps even during heavy JS execution
- **Framer Motion**: Uses CSS variables under the hood (NOT GPU accelerated), can drop frames if main thread is busy
- **For landing page**: CSS animations more resilient during initial page load when JS is parsing/executing

### Accessibility (prefers-reduced-motion)
**CSS Approach**:
```css
@media (prefers-reduced-motion: reduce) {
  .ticket {
    animation: none;
    transition: opacity 0.3s ease; /* Gentle fade instead */
  }
}
```
- Zero JavaScript overhead
- Instant response (no React re-render)
- Browser-native implementation
- Works even if JS fails/blocks

**Framer Motion Approach**:
- Requires `useReducedMotion()` hook (+1KB bundle)
- Triggers React re-render on preference change
- Falls back to animated if JS fails to load

**Winner**: CSS approach is more robust and performant

### Browser Compatibility
- **CSS Animations (@keyframes)**: 100% support in modern browsers (Chrome/Edge/Firefox/Safari 2012+)
- **Framer Motion**: 98% (excludes no-JS scenarios and React 19 edge cases)

## Intersection Observer for Viewport Detection

### Decision
Use **Intersection Observer API** to pause animations when section not visible

### Rationale
1. **Performance**: Stops unnecessary animations when user scrolls past section or switches tabs
2. **Battery efficiency**: Reduces CPU/GPU usage when demo not visible
3. **Native browser support**: Excellent compatibility (95%+ browsers, polyfill available for older browsers)
4. **Simple implementation**: React hook pattern with `useEffect` cleanup

### Implementation Pattern
```typescript
// lib/hooks/use-intersection-observer.ts
import { useEffect, useState, RefObject } from 'react';

export function useIntersectionObserver(
  ref: RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, options]);

  return isVisible;
}
```

### Browser Support
- Chrome 51+ (2016)
- Firefox 55+ (2017)
- Safari 12.1+ (2019)
- Edge 15+ (2017)
- Polyfill: Available for older browsers (<5% global usage)

## Visual Design Matching Strategy

### Decision
Extract existing design tokens from `/components/board/` components and reuse in mini-Kanban

### Rationale
1. **Brand consistency**: Guarantees visual match with actual product (FR-009 requirement)
2. **Maintainability**: Design changes to main board automatically reflect in demo
3. **No duplication**: Single source of truth for colors, shadows, border-radius
4. **TailwindCSS integration**: Reuse existing utility classes

### Implementation Approach
1. **Inspect existing components**:
   - `/components/board/board.tsx` - Column styling
   - `/components/board/ticket-card.tsx` - Card shadows, borders, colors
   - `/components/ui/card.tsx` - shadcn/ui Card primitives

2. **Extract design tokens** (from inspection):
   - Column background: `bg-gray-50` / `bg-gray-100`
   - Ticket card shadow: `shadow-sm` / `shadow-md`
   - Border radius: `rounded-lg`
   - Column border: `border border-gray-200`
   - Ticket hover state: `hover:shadow-lg transition-shadow`

3. **Create shared design constants** (if needed):
   ```typescript
   // lib/constants/board-design.ts
   export const BOARD_DESIGN = {
     column: {
       bg: 'bg-gray-50',
       border: 'border border-gray-200',
       rounded: 'rounded-lg',
     },
     ticket: {
       shadow: 'shadow-sm hover:shadow-lg',
       rounded: 'rounded-lg',
       transition: 'transition-shadow duration-200',
     },
   } as const;
   ```

### Testing Visual Consistency
- Playwright visual regression tests comparing mini-Kanban to actual board
- Color value assertions (SC-006: 95%+ match requirement)
- Screenshot comparison between demo and real board

## Drag Affordance without Functional Drag

### Decision
Use **cursor change + visual highlight** (NOT full drag-and-drop implementation)

### Rationale
1. **Spec requirement**: "drag (sans effet)" - visual feedback only, no functional reordering
2. **Simpler implementation**: No need for dnd-kit integration or drag state management
3. **Performance**: Avoids heavy drag-and-drop library overhead for pure demo
4. **Clear UX**: Hover cursor change (`cursor-grab`) signals draggability, but no complex gesture handling needed

### Implementation Pattern
```css
.demo-ticket {
  cursor: grab;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.demo-ticket:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.demo-ticket:active {
  cursor: grabbing;
  transform: translateY(0);
}
```

### Accessibility Consideration
- **No keyboard interaction needed** (demo is purely visual)
- **Not announced as interactive** to screen readers (no `role="button"` or `tabIndex`)
- **Visual-only affordance** - does not mislead users about functionality

## Ticket Content Strategy

### Decision
Use **2-3 hardcoded example tickets** with generic, representative titles

### Rationale
1. **Spec requirement**: "2-3 example tickets" (FR-002)
2. **Marketing context**: Content should demonstrate typical workflow progression
3. **No real data needed**: Static demo, no API fetching or database queries
4. **Refinable post-launch**: Titles can be updated based on marketing messaging without code changes

### Example Tickets
```typescript
const DEMO_TICKETS = [
  { id: 1, title: 'Add user authentication', column: 1 }, // SPECIFY
  { id: 2, title: 'Fix mobile layout bug', column: 3 },   // BUILD
  { id: 3, title: 'Implement dark mode', column: 0 },     // INBOX
] as const;
```

### Ticket Progression Pattern
- Each ticket progresses through all 6 columns (INBOX → SHIP)
- When reaching SHIP, ticket cycles back to INBOX for continuous demo
- Staggered starting positions create visual variety
- Complete journey within 60 seconds (6 columns × 10 seconds)

## Animation Timing and Easing

### Decision
Use **cubic-bezier(0.4, 0, 0.2, 1)** easing (Material Design "standard" curve)

### Rationale
1. **Natural motion**: Acceleration/deceleration mimics physical objects
2. **Proven UX**: Material Design standard curve widely tested and familiar
3. **Not too fast, not too slow**: 1-second transition duration feels "smooth and subtle" (FR-004)
4. **TailwindCSS default**: `ease-in-out` maps to this curve, consistent with existing animations

### Timing Values
| Animation Aspect | Duration | Easing |
|------------------|----------|--------|
| **Column-to-column transition** | 1000ms | cubic-bezier(0.4, 0, 0.2, 1) |
| **Hover shadow change** | 200ms | ease |
| **Reduced-motion fade** | 300ms | ease |

### CSS Implementation
```css
.ticket {
  transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform; /* GPU acceleration hint */
}

.ticket:hover {
  transition: box-shadow 200ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .ticket {
    transition: opacity 300ms ease;
  }
}
```

## State Management Approach

### Decision
Use **React useState + useEffect** (NOT Zustand, Redux, or Context)

### Rationale
1. **Constitution requirement**: "No state management libraries for client state—use React hooks"
2. **Local component state**: Animation state isolated to MiniKanban component, no global sharing needed
3. **Simple state shape**: `{ tickets: DemoTicket[], isPaused: boolean, isVisible: boolean }`
4. **No performance concerns**: 2-3 tickets, no complex computations or re-render optimization needed

### State Shape
```typescript
interface DemoTicket {
  id: number;
  title: string;
  column: number; // 0-5 (INBOX to SHIP)
}

interface AnimationState {
  tickets: DemoTicket[];
  isPaused: boolean;
  isVisible: boolean;
}
```

### State Transitions
1. **Every 10 seconds** (if not paused and visible):
   - Increment each ticket's `column` by 1
   - Reset to 0 if column === 5 (cycle back to INBOX)

2. **On hover**:
   - Set `isPaused = true`

3. **On mouse leave**:
   - Set `isPaused = false`

4. **On visibility change** (Intersection Observer):
   - Set `isVisible = true/false`

## Testing Strategy

### Decision
**Hybrid approach**: Vitest for pure functions, Playwright for visual behavior

### Unit Tests (Vitest)
**File**: `tests/unit/animation-helpers.test.ts`
- `calculateNextColumn(currentColumn: number): number` - Column cycling logic
- `shouldAnimate(isPaused: boolean, isVisible: boolean, prefersReducedMotion: boolean): boolean` - Animation guard
- `getColumnName(index: number): string` - Index to stage name mapping

**File**: `tests/unit/use-reduced-motion.test.ts`
- Hook returns `true` when `prefers-reduced-motion: reduce` media query matches
- Hook returns `false` otherwise
- Hook updates when preference changes

### E2E Tests (Playwright)
**File**: `tests/e2e/landing-page-workflow.spec.ts`
- **Visual regression**: Screenshot comparison of mini-Kanban vs. actual board
- **Animation behavior**: Ticket moves after 10 seconds
- **Hover pause**: Animation pauses when hovering over board
- **Accessibility**: Animations disabled with `prefers-reduced-motion: reduce` emulation
- **Responsive layout**: Renders correctly on mobile (320px) and desktop (2560px)
- **Complete journey**: Ticket cycles through all 6 columns within 60 seconds

### Visual Regression Strategy
```typescript
// Playwright visual regression test
test('mini-Kanban matches actual board design', async ({ page }) => {
  await page.goto('/');

  const miniKanban = page.locator('.mini-kanban-demo');
  await expect(miniKanban).toHaveScreenshot('mini-kanban.png', {
    maxDiffPixels: 100, // Allow minor rendering differences
  });

  // Navigate to actual board for comparison
  await page.goto('/projects/3/board');
  const realBoard = page.locator('.kanban-board');

  // Compare column colors, shadows, borders (extract computed styles)
  const miniStyle = await miniKanban.evaluate(el =>
    window.getComputedStyle(el.querySelector('.column')!)
  );
  const realStyle = await realBoard.evaluate(el =>
    window.getComputedStyle(el.querySelector('.column')!)
  );

  expect(miniStyle.backgroundColor).toBe(realStyle.backgroundColor);
  expect(miniStyle.borderRadius).toBe(realStyle.borderRadius);
});
```

## Reduced Motion Handling

### Decision
Implement **two-tier degradation** based on user preference

### Tier 1: Full Animations (Default)
- Smooth column-to-column transitions (1s cubic-bezier)
- Hover shadow changes (200ms ease)
- Complete ticket journey visible

### Tier 2: Reduced Motion (prefers-reduced-motion: reduce)
- **No position animations** - Tickets fade out/in instead of sliding
- **No hover effects** - Static appearance
- **Cross-fade transition** (300ms) when ticket changes column
- **Position changes still occur** - Workflow progression still visible, just less motion

### CSS Implementation
```css
.ticket {
  transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .ticket {
    transition: opacity 300ms ease !important;
    transform: none !important;
  }

  .ticket.changing-column {
    opacity: 0;
  }

  .ticket:not(.changing-column) {
    opacity: 1;
  }
}
```

### Testing Reduced Motion
```typescript
// Playwright test with reduced motion emulation
test('respects prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const ticket = page.locator('.demo-ticket').first();

  // Wait for column change
  await page.waitForTimeout(10500);

  // Verify fade transition (not position change)
  const transform = await ticket.evaluate(el =>
    window.getComputedStyle(el).transform
  );
  expect(transform).toBe('none'); // No transform applied
});
```

## Performance Optimization Checklist

### GPU Acceleration
- ✅ Use `transform` and `opacity` for animations (GPU-accelerated properties)
- ✅ Add `will-change: transform` hint (but only on animating elements)
- ✅ Avoid animating `width`, `height`, `top`, `left` (trigger layout recalculation)

### Animation Cleanup
- ✅ Clear `setInterval` in `useEffect` cleanup function
- ✅ Disconnect Intersection Observer in cleanup
- ✅ Remove event listeners on unmount

### Render Optimization
- ✅ Memoize ticket data with `useMemo` if needed (unlikely with 2-3 tickets)
- ✅ Use CSS Grid layout (no JavaScript layout calculations)
- ✅ Avoid inline style objects (use Tailwind classes for better caching)

### Bundle Optimization
- ✅ No external animation libraries (CSS only)
- ✅ Tree-shake unused shadcn/ui components
- ✅ Dynamic imports NOT needed (feature is above fold, needs immediate render)

## Responsive Design Strategy

### Decision
**Mobile-first approach** with CSS Grid auto-fit columns

### Breakpoints
| Viewport Width | Column Layout | Ticket Size |
|----------------|---------------|-------------|
| **320px-640px** (mobile) | 2 columns × 3 rows (INBOX/SPECIFY, PLAN/BUILD, VERIFY/SHIP) | Smaller cards, compact spacing |
| **640px-1024px** (tablet) | 3 columns × 2 rows | Medium cards |
| **1024px+** (desktop) | 6 columns × 1 row (horizontal Kanban) | Full-size cards |

### CSS Grid Implementation
```css
.mini-kanban {
  display: grid;
  gap: 1rem;

  /* Mobile: 2 columns */
  grid-template-columns: repeat(2, 1fr);
}

@media (min-width: 640px) {
  .mini-kanban {
    /* Tablet: 3 columns */
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .mini-kanban {
    /* Desktop: 6 columns (full Kanban) */
    grid-template-columns: repeat(6, 1fr);
  }
}
```

### Animation Adjustments for Mobile
- Shorter transition duration on mobile (750ms vs 1000ms desktop)
- Simpler easing curve (ease-out vs cubic-bezier)
- Smaller hover lift effect (1px vs 2px)

## Research Summary

### Key Unknowns Resolved
1. ✅ **Animation library**: CSS Animations + React State (not Framer Motion)
2. ✅ **Viewport detection**: Intersection Observer API
3. ✅ **Visual design**: Extract from existing `/components/board/` components
4. ✅ **Drag affordance**: Cursor change + visual highlight (no functional drag)
5. ✅ **Ticket content**: 2-3 hardcoded examples with generic titles
6. ✅ **Animation timing**: 1s cubic-bezier(0.4, 0, 0.2, 1) for transitions
7. ✅ **State management**: React useState + useEffect (no libraries)
8. ✅ **Testing approach**: Vitest for pure functions, Playwright for visual behavior
9. ✅ **Reduced motion**: Two-tier degradation (fade instead of slide)
10. ✅ **Responsive strategy**: Mobile-first CSS Grid with 2/3/6 column layouts

### Next Steps (Phase 1)
1. Generate `data-model.md` - Define TypeScript interfaces for DemoTicket, AnimationState, etc.
2. Generate `contracts/` - No API contracts needed (pure frontend feature)
3. Generate `quickstart.md` - Development setup and testing instructions
4. Update agent context (`CLAUDE.md`) with animation technology decision
