# Quickstart: Landing Page UX/UI & Accessibility Improvements

**Branch**: `AIB-294-copy-of-landing` | **Date**: 2026-03-16

## Implementation Order

### Phase 1: Standards Compliance (FR-004) — No Visual Changes
1. Replace all hardcoded hex colors with semantic Tailwind tokens (see `data-model.md` color mapping)
2. Files: `hero-section.tsx`, `features-grid.tsx`, `workflow-step.tsx`, `cta-section.tsx`
3. Verify: `bun run type-check && bun run lint` — visual output should be identical

### Phase 2: Accessibility Foundation (FR-001 through FR-003, FR-005, FR-008, FR-010)
1. Add skip-to-content link at top of landing page
2. Audit and fix heading hierarchy (h1 → h2 → h3)
3. Add visible focus indicators to all interactive elements
4. Ensure all decorative elements have `aria-hidden="true"`
5. Add `aria-expanded`/`aria-controls` to PricingFAQ collapsibles
6. Verify keyboard tab order is logical
7. Verify: Navigate entire page with keyboard only

### Phase 3: Motion & Reduced Motion (FR-011, FR-012)
1. Add scroll-triggered fade-in animations using IntersectionObserver
2. Ensure all new animations respect `prefers-reduced-motion`
3. Verify page is fully functional with animations disabled

### Phase 4: Mobile Workflow Enhancement (FR-006, FR-007)
1. Create mobile-responsive workflow demo (replace `hidden lg:block`)
2. Ensure touch targets >= 44x44px on all CTAs
3. Verify on 375px and 768px viewports

### Phase 5: Visual Uniqueness (FR-009, FR-013)
1. Add distinctive section transitions/dividers
2. Refine typography and spacing
3. Add unique decorative elements (patterns, gradient meshes)
4. Verify: At least 3 distinctive visual elements introduced

## Key Files to Modify

```
components/landing/
├── hero-section.tsx          # Hex colors, skip-to-content, visual enhancements
├── features-grid.tsx         # Hex icon colors, scroll animations, card accessibility
├── workflow-section.tsx      # Mobile demo, remove hidden lg:block
├── pricing-section.tsx       # Visual hierarchy, touch targets
├── cta-section.tsx           # Hex gradient, visual enhancements
├── feature-card.tsx          # Semantic color prop, aria-label, focus
├── workflow-step.tsx         # Hex stage colors, aria-label
├── pricing-card.tsx          # Touch targets, contrast
├── pricing-faq.tsx           # aria-expanded/controls
├── mini-kanban-demo.tsx      # Mobile adaptation
└── [new] mobile-workflow-demo.tsx  # (if needed)

app/landing/
├── page.tsx                  # Skip-to-content target
└── components/
    └── animated-ticket-background.tsx  # Verify aria-hidden

app/globals.css               # New animations, gradient utilities
tailwind.config.ts            # New animation keyframes if needed
```

## Validation Checklist

- [ ] Zero hardcoded hex/rgb colors in landing page components
- [ ] All text passes WCAG AA contrast (4.5:1 normal, 3:1 large)
- [ ] Full keyboard navigation with visible focus indicators
- [ ] Screen reader announces all sections, headings, and interactive elements properly
- [ ] `prefers-reduced-motion` disables all animations without content loss
- [ ] Workflow section visible and informative on mobile (< 1024px)
- [ ] All touch targets >= 44x44px
- [ ] 3+ distinctive visual elements introduced
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] Existing tests still pass
