# Component API Contract: AnimatedTicketBackground

**Feature**: 071-926-animated-ticket
**Component Type**: React Server Component
**Date**: 2025-10-28

## Overview

This document defines the public API contract for the `AnimatedTicketBackground` component. Since this is a frontend-only feature with no REST/GraphQL APIs, the "contract" defines the component's props interface, CSS classes, and integration points.

---

## Component Interface

### AnimatedTicketBackground

**Description**: Server Component that renders floating ticket card animations in the landing page hero section background.

**Import Path**: `@/app/(landing)/components/animated-ticket-background`

**Props**:
```typescript
interface AnimatedTicketBackgroundProps {
  /** Optional CSS class name for container styling */
  className?: string;
}
```

**Return Type**: `React.ReactElement`

**Example Usage**:
```tsx
import AnimatedTicketBackground from '@/app/(landing)/components/animated-ticket-background';

export default function LandingPage() {
  return (
    <section className="relative min-h-screen">
      {/* Background layer (z-0) */}
      <AnimatedTicketBackground className="absolute inset-0 -z-10" />

      {/* Foreground content (z-auto) */}
      <div className="relative z-10">
        <h1>Your Hero Headline</h1>
        <p>Subtext content</p>
        <button>Call to Action</button>
      </div>
    </section>
  );
}
```

**Contract Guarantees**:
- ✅ Component is a Server Component (no `"use client"` directive)
- ✅ Renders 18 `<div>` elements with `ticket-card` class
- ✅ No JavaScript runtime required (pure CSS animation)
- ✅ Respects `prefers-reduced-motion` (animations disabled when enabled)
- ✅ Pointer events disabled (`pointer-events: none`) on all ticket elements
- ✅ Accessibility: All ticket elements have `aria-hidden="true"`

---

## CSS Classes Contract

### Container Classes

**Class**: `animated-ticket-background`

**Applied To**: Root `<div>` of `AnimatedTicketBackground` component

**Generated Styles**:
```css
.animated-ticket-background {
  @apply absolute inset-0 overflow-hidden;
  /* Container fills parent, hides overflowing tickets */
}
```

---

### Ticket Card Classes

**Class**: `ticket-card`

**Applied To**: Individual animated ticket `<div>` elements

**Generated Styles**:
```css
.ticket-card {
  @apply absolute w-16 h-10 rounded border-2 backdrop-blur-sm;
  @apply pointer-events-none; /* Never interfere with clicks */
  @apply motion-safe:animate-ticket-drift; /* Animation respects user preference */
  will-change: transform; /* GPU acceleration hint */
}
```

**Responsive Behavior** (via Tailwind `@media` queries):
```css
/* Mobile (<768px): Show 8 tickets */
@media (max-width: 767px) {
  .ticket-card:nth-child(n+9) {
    @apply hidden;
  }
}

/* Tablet (768-1023px): Show 12 tickets */
@media (min-width: 768px) and (max-width: 1023px) {
  .ticket-card:nth-child(n+13) {
    @apply hidden;
  }
}

/* Desktop (≥1024px): Show all 18 tickets */
```

---

### Color Variants

**Classes**: `border-catppuccin-{color}/10`

**Available Colors**:
- `border-catppuccin-mauve/10` (purple, opacity 10%)
- `border-catppuccin-blue/10` (indigo, opacity 10%)
- `border-catppuccin-sapphire/10` (blue, opacity 10%)
- `border-catppuccin-green/10` (emerald, opacity 10%)
- `border-catppuccin-yellow/10` (amber, opacity 10%)

**Color Assignment**: Distributed via `index % 5` modulo operation (deterministic)

---

## TailwindCSS Configuration Contract

### Required Extensions

**File**: `tailwind.config.ts`

**Keyframes Extension**:
```typescript
keyframes: {
  'ticket-drift': {
    '0%': { transform: 'translateX(-100px)' },
    '100%': { transform: 'translateX(calc(100vw + 100px))' }
  }
}
```

**Animation Extension**:
```typescript
animation: {
  'ticket-drift': 'ticket-drift linear infinite'
  // Duration set via inline style: var(--ticket-duration)
}
```

**Colors Extension**:
```typescript
colors: {
  catppuccin: {
    mauve: '#cba6f7',
    blue: '#89b4fa',
    sapphire: '#74c7ec',
    green: '#a6e3a1',
    yellow: '#f9e2af'
  }
}
```

**Breaking Change Policy**: These configuration keys MUST remain stable. Renaming requires migration guide for consumers.

---

## Inline Styles Contract

### CSS Custom Properties

Each ticket card uses inline styles for randomized animation parameters:

```tsx
<div
  className="ticket-card border-catppuccin-mauve/10"
  style={{
    '--ticket-y': '23%',         // Randomized vertical position
    '--ticket-duration': '47s',  // Randomized duration (40-60s)
    '--ticket-delay': '12s',     // Randomized delay (0-60s)
    '--ticket-rotation': '5deg', // Randomized rotation (-10 to +10)
    animationDuration: 'var(--ticket-duration)',
    animationDelay: 'var(--ticket-delay)',
    transform: 'translateY(var(--ticket-y)) rotate(var(--ticket-rotation))'
  } as React.CSSProperties}
  aria-hidden="true"
>
  {/* Decorative content (2 horizontal lines) */}
</div>
```

**Contract**: Inline styles MUST NOT override safety classes:
- ❌ NEVER override `pointer-events: none`
- ❌ NEVER override `aria-hidden="true"`
- ❌ NEVER override `motion-safe:` variant (accessibility requirement)

---

## Accessibility Contract

### ARIA Attributes

**Requirement**: All ticket card elements MUST have `aria-hidden="true"`

**Rationale**: Decorative background elements should not be announced by screen readers

**Example**:
```tsx
<div className="ticket-card" aria-hidden="true">
  {/* Content */}
</div>
```

---

### Motion Preference

**Requirement**: Animation MUST respect `prefers-reduced-motion` user setting

**Implementation**: Use Tailwind's `motion-safe:` variant

**Example**:
```tsx
<div className="motion-safe:animate-ticket-drift motion-reduce:animate-none">
  {/* Ticket card */}
</div>
```

**Contract Verification**: Manual test with browser DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion"

---

## Performance Contract

### Rendering Guarantees

- **Total DOM Nodes**: 18 `<div>` elements (1 container + 18 tickets = 19 total)
- **Animation Performance**: 60fps on desktop (Chrome/Firefox/Safari latest)
- **Mobile Performance**: 55-60fps on mid-range devices (2021+ Android/iOS)
- **Page Load Impact**: <200ms added load time compared to no-animation baseline

### GPU Optimization

**Required CSS Properties**:
```css
.ticket-card {
  will-change: transform; /* Promote to GPU layer */
  transform: translate(...); /* Use compositing, avoid layout thrashing */
}
```

**Forbidden Properties** (cause layout reflow):
- ❌ `top` / `left` (use `transform: translate()` instead)
- ❌ `width` / `height` animations (size is static)
- ❌ `margin` / `padding` animations (no layout changes)

---

## Testing Contract

### Visual Regression Tests

**Test File**: `tests/e2e/landing-animation.spec.ts`

**Required Test Cases**:
1. ✅ Ticket cards render on landing page
2. ✅ Correct ticket count per breakpoint (18 desktop, 12 tablet, 8 mobile)
3. ✅ Animation plays by default (check `animation` computed style)
4. ✅ Animation stops when `prefers-reduced-motion` enabled
5. ✅ Tickets have `pointer-events: none` (no click interception)
6. ✅ Tickets have `aria-hidden="true"` (screen reader exclusion)

**Playwright Example**:
```typescript
test('renders 18 tickets on desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');

  const ticketCards = page.locator('.ticket-card');
  await expect(ticketCards).toHaveCount(18);
});

test('respects prefers-reduced-motion', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      })
    });
  });

  await page.goto('/');
  const ticketCard = page.locator('.ticket-card').first();
  const animationState = await ticketCard.evaluate((el) =>
    getComputedStyle(el).animationPlayState
  );

  expect(animationState).toBe('paused'); // or animation removed entirely
});
```

---

## Integration Contract

### Landing Page Integration

**File**: `app/(landing)/page.tsx`

**Integration Pattern**:
```tsx
import AnimatedTicketBackground from './components/animated-ticket-background';

export default function LandingPage() {
  return (
    <main className="relative">
      {/* Step 1: Add background with negative z-index */}
      <section className="relative min-h-screen">
        <AnimatedTicketBackground className="absolute inset-0 -z-10" />

        {/* Step 2: Ensure hero content has positive z-index */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-6xl font-bold">Your Headline</h1>
          <p className="text-xl mt-4">Subtext with high contrast</p>
          <button className="mt-8 px-6 py-3 bg-blue-600 text-white rounded">
            Call to Action
          </button>
        </div>
      </section>
    </main>
  );
}
```

**Contract Requirements**:
1. ✅ Background component rendered with `absolute inset-0 -z-10` classes
2. ✅ Hero content has `relative z-10` or higher z-index
3. ✅ Parent container has `relative` positioning
4. ✅ Hero text maintains ≥4.5:1 contrast ratio (WCAG AA compliance)

---

## Versioning & Deprecation

**Current Version**: 1.0.0

**Breaking Changes Policy**:
- Renaming CSS classes (`.ticket-card` → `.animated-ticket`) requires MAJOR version bump
- Changing TailwindCSS theme keys (`catppuccin.*` → `brand.*`) requires MAJOR version bump
- Removing props (if added in future) requires deprecation notice + MAJOR version bump

**Backward Compatibility**:
- Adding optional props is MINOR version (non-breaking)
- Adding new Catppuccin colors is MINOR version (non-breaking)
- Changing animation duration within spec range (40-60s) is PATCH version (non-breaking)

---

## Summary

This component contract defines:

- ✅ **Component API**: Server Component with optional `className` prop
- ✅ **CSS Classes**: `.animated-ticket-background`, `.ticket-card`, `.border-catppuccin-*`
- ✅ **TailwindCSS Config**: Custom keyframes, animations, and colors
- ✅ **Accessibility**: `aria-hidden`, `prefers-reduced-motion` support
- ✅ **Performance**: 60fps target, GPU-accelerated transforms
- ✅ **Testing**: Playwright E2E tests for visual regression and a11y
- ✅ **Integration**: Landing page z-index layering pattern

**No API Endpoints**: This feature requires zero backend contracts (frontend-only).
