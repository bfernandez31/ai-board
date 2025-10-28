# Research: Animated Ticket Background

**Feature**: 071-926-animated-ticket
**Date**: 2025-10-28
**Purpose**: Resolve technical unknowns for CSS-only GPU-accelerated background animation

## Research Questions

### 1. TailwindCSS Custom Animation Best Practices

**Question**: What's the recommended pattern for defining custom `@keyframes` animations in TailwindCSS 3.4 - extend theme config vs inline in globals.css?

**Decision**: Use `tailwind.config.ts` `extend.keyframes` for reusable animations

**Rationale**:
- TailwindCSS 3.4 supports custom keyframes in config via `theme.extend.keyframes`
- Enables use of Tailwind's `animate-*` utility classes (e.g., `animate-drift`)
- Better integration with JIT mode and IntelliSense
- Keeps animation definitions colocated with theme configuration
- Reference: https://tailwindcss.com/docs/animation#customizing-your-theme

**Alternatives Considered**:
- Inline `@keyframes` in globals.css: Works but loses Tailwind class generation, requires manual class names
- CSS modules: Overkill for single landing page component, adds bundle size

**Implementation Pattern**:
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      keyframes: {
        'ticket-drift': {
          '0%': { transform: 'translateX(-100px) translateY(0)' },
          '100%': { transform: 'translateX(calc(100vw + 100px)) translateY(0)' }
        }
      },
      animation: {
        'ticket-drift': 'ticket-drift var(--duration) linear infinite'
      }
    }
  }
}
```

---

### 2. GPU Acceleration Verification

**Question**: How to ensure CSS transforms trigger GPU acceleration and avoid layout thrashing?

**Decision**: Use `transform: translate()` and `will-change: transform` for GPU compositing

**Rationale**:
- Modern browsers promote elements to GPU layer when `transform` or `will-change` is set
- `translateX/Y` triggers compositing without reflow (unlike `top/left` which causes layout recalculation)
- `will-change: transform` hints browser to optimize early, improving 60fps consistency
- Avoid overusing `will-change` (max 18 elements is acceptable, >50 can degrade performance)
- Reference: https://developer.mozilla.org/en-US/docs/Web/CSS/will-change

**Alternatives Considered**:
- `position: absolute` with `top/left`: Causes layout reflow, fails 60fps target
- JavaScript-based RAF animation: Adds runtime overhead, violates CSS-only constraint
- SVG `<animateTransform>`: Not as performant as CSS transforms, harder to control with media queries

**Implementation Pattern**:
```tsx
<div
  className="absolute will-change-transform animate-ticket-drift"
  style={{
    transform: `translateX(var(--start-x)) translateY(var(--start-y))`,
    animationDelay: `${Math.random() * 60}s`,
    animationDuration: `${40 + Math.random() * 20}s`
  }}
/>
```

---

### 3. Catppuccin Color Palette Integration

**Question**: Should Catppuccin colors be hardcoded hex values or integrated into Tailwind theme?

**Decision**: Extend Tailwind theme with Catppuccin Mocha palette subset

**Rationale**:
- Feature spec references Catppuccin colors (purple/mauve, indigo/blue, emerald/green, amber/yellow)
- Catppuccin has official color mappings: https://github.com/catppuccin/palette
- Extending theme enables type-safe color references (e.g., `bg-catppuccin-mauve/10`)
- Future landing page features can reuse brand colors consistently
- Only include colors used in feature to avoid bloat

**Alternatives Considered**:
- Hardcode hex values in component: Harder to maintain, no theme consistency
- Use closest Tailwind defaults: Loses brand identity, colors won't match design system
- Include full Catppuccin palette: Unnecessary CSS bloat (25+ colors vs 5 needed)

**Implementation Pattern**:
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        catppuccin: {
          mauve: '#cba6f7',   // purple
          blue: '#89b4fa',    // indigo/blue
          sapphire: '#74c7ec', // blue
          green: '#a6e3a1',   // emerald
          yellow: '#f9e2af'   // amber
        }
      }
    }
  }
}
```

---

### 4. Responsive Breakpoint Strategy

**Question**: How to conditionally render different ticket counts (18/12/8) across breakpoints?

**Decision**: Use CSS `@media` queries with `nth-child` selectors to hide tickets, not conditional rendering

**Rationale**:
- Server Components can't use `window.matchMedia` (server-side)
- Conditional rendering with client component causes hydration mismatch
- CSS approach: Render 18 tickets always, use `@media` + `:nth-child(n+9)` to hide tickets 9-18 on mobile
- No JavaScript runtime needed, matches CSS-only constraint
- Avoids CLS (Cumulative Layout Shift) during client hydration

**Alternatives Considered**:
- Client Component with `useMediaQuery` hook: Adds hydration overhead, violates CSS-only constraint
- Next.js `useBreakpoint` hook: Doesn't exist in Next.js 15, would require custom implementation
- Separate components per breakpoint: Code duplication, harder to maintain

**Implementation Pattern**:
```tsx
// Component renders 18 tickets always
{Array.from({ length: 18 }).map((_, i) => (
  <TicketCard key={i} index={i} />
))}

// CSS hides tickets based on breakpoint
@media (max-width: 767px) {
  .ticket-card:nth-child(n+9) { display: none; } /* Mobile: show 8 */
}

@media (min-width: 768px) and (max-width: 1023px) {
  .ticket-card:nth-child(n+13) { display: none; } /* Tablet: show 12 */
}
```

---

### 5. `prefers-reduced-motion` Implementation

**Question**: Best pattern for disabling animations when user has motion sensitivity?

**Decision**: Use Tailwind's `motion-safe:` variant for animation classes

**Rationale**:
- TailwindCSS 3.4 includes built-in `motion-safe:` and `motion-reduce:` variants
- Automatically respects `@media (prefers-reduced-motion)` query
- No custom CSS needed, declarative approach
- Pattern: `motion-safe:animate-ticket-drift` only animates when motion is safe
- Reference: https://tailwindcss.com/docs/animation#prefers-reduced-motion

**Alternatives Considered**:
- Custom CSS `@media (prefers-reduced-motion: reduce)`: Verbose, duplicates Tailwind functionality
- JavaScript detection with `window.matchMedia`: Requires client component, adds hydration complexity
- Completely hide animated elements: Reduces visual interest for all users with preference, animation should just stop

**Implementation Pattern**:
```tsx
<div className="motion-safe:animate-ticket-drift motion-reduce:animate-none">
  {/* Animation plays only if prefers-reduced-motion is NOT enabled */}
</div>
```

---

## Summary

All technical unknowns resolved. No additional dependencies required beyond existing TailwindCSS 3.4 configuration. Implementation uses:

1. **Tailwind config extensions**: Custom keyframes, Catppuccin colors
2. **GPU-accelerated CSS**: `transform: translate()` with `will-change`
3. **Responsive design**: CSS `@media` queries with `:nth-child` hiding
4. **Accessibility**: Tailwind `motion-safe:` variant for `prefers-reduced-motion`
5. **Server Components**: No client-side JavaScript, pure CSS animation

Proceed to Phase 1 (Design & Contracts).
