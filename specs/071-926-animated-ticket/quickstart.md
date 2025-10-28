# Quickstart: Animated Ticket Background

**Feature**: 071-926-animated-ticket
**Estimated Time**: 30-45 minutes
**Difficulty**: Beginner

## Overview

Add a premium floating ticket animation to the landing page hero section. This guide walks through implementation from TailwindCSS configuration to component integration, following TDD principles.

---

## Prerequisites

- Node.js 22.20.0 LTS installed
- Bun package manager
- Existing Next.js 15 project with TailwindCSS 3.4
- Basic understanding of React Server Components
- Playwright and Vitest configured

---

## Step 1: Write Failing Tests (RED Phase)

### 1.1 Create E2E Test File

**File**: `tests/e2e/landing-animation.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Landing Page Animated Background', () => {
  test('renders ticket cards on landing page', async ({ page }) => {
    await page.goto('/');

    const ticketCards = page.locator('.ticket-card');
    await expect(ticketCards).toHaveCount(18);
  });

  test('shows 18 tickets on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    const visibleTickets = page.locator('.ticket-card:visible');
    await expect(visibleTickets).toHaveCount(18);
  });

  test('shows 12 tickets on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1024 });
    await page.goto('/');

    const visibleTickets = page.locator('.ticket-card:visible');
    await expect(visibleTickets).toHaveCount(12);
  });

  test('shows 8 tickets on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const visibleTickets = page.locator('.ticket-card:visible');
    await expect(visibleTickets).toHaveCount(8);
  });

  test('tickets have pointer-events disabled', async ({ page }) => {
    await page.goto('/');

    const firstTicket = page.locator('.ticket-card').first();
    const pointerEvents = await firstTicket.evaluate((el) =>
      getComputedStyle(el).pointerEvents
    );

    expect(pointerEvents).toBe('none');
  });

  test('tickets are hidden from screen readers', async ({ page }) => {
    await page.goto('/');

    const firstTicket = page.locator('.ticket-card').first();
    await expect(firstTicket).toHaveAttribute('aria-hidden', 'true');
  });

  test('respects prefers-reduced-motion setting', async ({ page, context }) => {
    // Emulate user preference for reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const firstTicket = page.locator('.ticket-card').first();
    const hasAnimation = await firstTicket.evaluate((el) => {
      const styles = getComputedStyle(el);
      return styles.animationName !== 'none';
    });

    expect(hasAnimation).toBe(false);
  });
});
```

### 1.2 Run Tests (Should Fail)

```bash
bun run test:e2e tests/e2e/landing-animation.spec.ts
```

**Expected Result**: All tests fail (no `.ticket-card` elements found)

---

## Step 2: Configure TailwindCSS (GREEN Phase Start)

### 2.1 Extend Tailwind Configuration

**File**: `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  // ... existing config
  theme: {
    extend: {
      // Add custom keyframes for ticket drift animation
      keyframes: {
        'ticket-drift': {
          '0%': {
            transform: 'translateX(-100px)',
          },
          '100%': {
            transform: 'translateX(calc(100vw + 100px))',
          },
        },
      },

      // Add custom animation
      animation: {
        'ticket-drift': 'ticket-drift linear infinite',
      },

      // Add Catppuccin color palette
      colors: {
        catppuccin: {
          mauve: '#cba6f7',
          blue: '#89b4fa',
          sapphire: '#74c7ec',
          green: '#a6e3a1',
          yellow: '#f9e2af',
        },
      },
    },
  },
};

export default config;
```

---

## Step 3: Create Component (GREEN Phase)

### 3.1 Create AnimatedTicketBackground Component

**File**: `app/(landing)/components/animated-ticket-background.tsx`

```typescript
import { type CSSProperties } from 'react';

// Catppuccin color palette for ticket borders
const TICKET_COLORS = ['mauve', 'blue', 'sapphire', 'green', 'yellow'] as const;
type TicketColor = (typeof TICKET_COLORS)[number];

interface TicketCardProps {
  index: number;
  color: TicketColor;
  duration: number; // seconds
  delay: number; // seconds
  verticalPosition: number; // percentage
  rotation: number; // degrees
}

/**
 * Generates deterministic animation properties based on ticket index
 */
function getTicketProps(index: number): TicketCardProps {
  // Use simple deterministic randomization based on index
  const seed = index + 1;
  const pseudoRandom = (multiplier: number) => ((seed * multiplier) % 97) / 97;

  return {
    index,
    color: TICKET_COLORS[index % TICKET_COLORS.length],
    duration: 40 + pseudoRandom(13) * 20, // 40-60s
    delay: pseudoRandom(17) * 60, // 0-60s
    verticalPosition: pseudoRandom(23) * 100, // 0-100%
    rotation: -10 + pseudoRandom(31) * 20, // -10 to +10 degrees
  };
}

/**
 * Individual animated ticket card component
 */
function TicketCard({ color, duration, delay, verticalPosition, rotation }: TicketCardProps) {
  const style: CSSProperties = {
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
    top: `${verticalPosition}%`,
    transform: `rotate(${rotation}deg)`,
  };

  return (
    <div
      className={`
        ticket-card absolute w-16 h-10 rounded border-2
        border-catppuccin-${color}/10 backdrop-blur-sm
        pointer-events-none
        motion-safe:animate-ticket-drift motion-reduce:animate-none
      `}
      style={style}
      aria-hidden="true"
    >
      {/* Decorative content (simulated ticket text lines) */}
      <div className="p-2 space-y-1">
        <div className={`h-1 w-8 rounded bg-catppuccin-${color}/20`} />
        <div className={`h-1 w-6 rounded bg-catppuccin-${color}/20`} />
      </div>
    </div>
  );
}

/**
 * Animated ticket background component for landing page hero section
 * Renders 18 floating ticket cards with responsive visibility
 */
export default function AnimatedTicketBackground({ className = '' }: { className?: string }) {
  const tickets = Array.from({ length: 18 }, (_, i) => getTicketProps(i));

  return (
    <div className={`animated-ticket-background absolute inset-0 overflow-hidden ${className}`}>
      {tickets.map((props) => (
        <TicketCard key={props.index} {...props} />
      ))}
    </div>
  );
}
```

### 3.2 Add Responsive CSS

**File**: `app/globals.css`

Add the following CSS for responsive ticket hiding:

```css
/* Responsive ticket visibility */
@layer utilities {
  /* Mobile (<768px): Show only first 8 tickets */
  @media (max-width: 767px) {
    .ticket-card:nth-child(n+9) {
      @apply hidden;
    }
  }

  /* Tablet (768-1023px): Show only first 12 tickets */
  @media (min-width: 768px) and (max-width: 1023px) {
    .ticket-card:nth-child(n+13) {
      @apply hidden;
    }
  }

  /* Desktop (≥1024px): Show all 18 tickets (default) */
}
```

---

## Step 4: Integrate with Landing Page

### 4.1 Update Landing Page

**File**: `app/(landing)/page.tsx`

```typescript
import AnimatedTicketBackground from './components/animated-ticket-background';

export default function LandingPage() {
  return (
    <main>
      {/* Hero Section with Animated Background */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
        {/* Animated background layer (behind content) */}
        <AnimatedTicketBackground className="absolute inset-0 -z-10" />

        {/* Hero content (above background) */}
        <div className="relative z-10 text-center px-4">
          <h1 className="text-6xl font-bold text-white mb-4">
            Your Hero Headline
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Compelling subtext that explains your value proposition
          </p>
          <button className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Get Started
          </button>
        </div>
      </section>
    </main>
  );
}
```

---

## Step 5: Verify Tests Pass (GREEN Phase Complete)

### 5.1 Run E2E Tests

```bash
bun run test:e2e tests/e2e/landing-animation.spec.ts
```

**Expected Result**: All 7 tests pass ✅

### 5.2 Manual Visual Verification

```bash
bun run dev
```

Open `http://localhost:3000` and verify:
- ✅ 18 semi-transparent tickets drift left-to-right
- ✅ Tickets use Catppuccin colors (purple, blue, green, yellow)
- ✅ Animation is smooth (60fps)
- ✅ Hero text is fully readable (no interference)
- ✅ Clicking text/buttons works (no pointer event blocking)

### 5.3 Test Responsive Breakpoints

**Desktop (1920x1080)**: 18 tickets visible
```bash
# In browser DevTools, set viewport to 1920x1080
```

**Tablet (800x1024)**: 12 tickets visible
```bash
# Set viewport to 800x1024
```

**Mobile (375x667)**: 8 tickets visible
```bash
# Set viewport to 375x667
```

### 5.4 Test Accessibility

**Reduced Motion Test**:
1. Open Chrome DevTools → Rendering tab
2. Enable "Emulate CSS media feature prefers-reduced-motion"
3. Reload page → Animation should stop ✅

**Screen Reader Test**:
1. Open browser inspector
2. Verify all `.ticket-card` elements have `aria-hidden="true"` ✅

---

## Step 6: Performance Validation

### 6.1 Measure Frame Rate

**Chrome DevTools Performance**:
1. Open DevTools → Performance tab
2. Click Record, scroll page, stop recording
3. Check FPS chart → Should be stable 60fps ✅

### 6.2 Measure Page Load Impact

**Lighthouse Audit**:
```bash
# Run Lighthouse in DevTools
# Compare "Performance" score before/after animation
# Acceptable: <200ms load time increase
```

---

## Step 7: Refactor (REFACTOR Phase)

### 7.1 Extract Constants (Optional)

If configuration needs to be reusable, extract to a separate file:

**File**: `app/(landing)/components/animated-ticket-config.ts`

```typescript
export const ANIMATION_CONFIG = {
  totalTickets: 18,
  ticketSize: { width: 64, height: 40 }, // 16px * 4 = 64px (w-16)
  timing: {
    minDuration: 40,
    maxDuration: 60,
    maxDelay: 60,
  },
  visual: {
    minRotation: -10,
    maxRotation: 10,
  },
  breakpoints: {
    mobile: { maxWidth: 767, visibleTickets: 8 },
    tablet: { minWidth: 768, maxWidth: 1023, visibleTickets: 12 },
    desktop: { minWidth: 1024, visibleTickets: 18 },
  },
} as const;
```

**Update component** to import `ANIMATION_CONFIG` instead of hardcoded values.

### 7.2 Re-run Tests

```bash
bun run test:e2e tests/e2e/landing-animation.spec.ts
```

**Expected Result**: All tests still pass ✅ (refactor preserves behavior)

---

## Troubleshooting

### Issue: Tickets not animating

**Cause**: Tailwind config not applied or animation class missing

**Fix**:
1. Verify `tailwind.config.ts` has `keyframes` and `animation` extensions
2. Ensure `motion-safe:animate-ticket-drift` class is present
3. Check browser doesn't have `prefers-reduced-motion` enabled

---

### Issue: Tickets visible on mobile (should be 8, showing 18)

**Cause**: Responsive CSS not loaded or media query incorrect

**Fix**:
1. Verify `app/globals.css` has responsive `:nth-child` rules
2. Check Tailwind `@layer utilities` wraps the rules
3. Clear Next.js cache: `rm -rf .next && bun run dev`

---

### Issue: Tests fail with "ticket-card not found"

**Cause**: Component not imported in landing page or CSS class mismatch

**Fix**:
1. Verify `app/(landing)/page.tsx` imports `AnimatedTicketBackground`
2. Ensure component is rendered: `<AnimatedTicketBackground />`
3. Check component uses `ticket-card` class (not `animated-ticket` or other name)

---

### Issue: Animation is janky (<60fps)

**Cause**: GPU acceleration not enabled or too many `will-change` properties

**Fix**:
1. Verify component uses `transform` (not `top/left` positioning)
2. Check `will-change: transform` is applied (inspect in DevTools)
3. Reduce ticket count on mobile (already 8, can reduce to 6 if needed)

---

## Verification Checklist

Before considering feature complete:

- ✅ All 7 E2E tests pass (`bun run test:e2e`)
- ✅ Visual verification: 18 tickets drift smoothly on desktop
- ✅ Responsive: 12 tickets on tablet, 8 on mobile
- ✅ Accessibility: Animation stops with `prefers-reduced-motion`
- ✅ Accessibility: All tickets have `aria-hidden="true"`
- ✅ Performance: 60fps framerate on desktop (Chrome DevTools)
- ✅ Performance: <200ms page load impact (Lighthouse)
- ✅ TypeScript: No compilation errors (`bun run type-check`)
- ✅ Linting: No ESLint errors (`bun run lint`)

---

## Next Steps

### Enhancement Ideas (Future Iterations)

1. **Ticket Content Variation**: Add randomized ticket "states" (TODO, IN PROGRESS, DONE)
2. **Dark/Light Mode**: Adapt colors based on theme preference
3. **User Interaction**: Add subtle parallax effect on mouse move
4. **Performance Monitoring**: Add analytics to track FPS in production

### Related Features

- Landing page hero section redesign (if planned)
- Brand color system documentation
- Animation library for other landing page elements

---

## Resources

- [TailwindCSS Animation Docs](https://tailwindcss.com/docs/animation)
- [Catppuccin Palette](https://github.com/catppuccin/palette)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [Playwright Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

---

**Estimated Total Time**: 30-45 minutes (15 min tests, 20 min implementation, 10 min verification)
