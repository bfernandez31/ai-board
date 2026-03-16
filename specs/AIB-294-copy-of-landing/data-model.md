# Data Model: Landing Page UX/UI & Accessibility Improvements

**Branch**: `AIB-294-copy-of-landing` | **Date**: 2026-03-16

## Overview

This feature is **frontend-only** — no database schema changes, no new API endpoints, no new Prisma models. All changes are to React components, CSS, and Tailwind configuration.

## Entities (UI Components — No DB Changes)

### Landing Page Sections (Existing — Enhanced)

| Component | File | Changes |
|-----------|------|---------|
| HeroSection | `components/landing/hero-section.tsx` | Replace hex gradients with semantic tokens, add skip-to-content link, add scroll-triggered animation, enhance visual uniqueness |
| FeaturesGrid | `components/landing/features-grid.tsx` | Replace hex icon colors with semantic tokens, add scroll-fade animation, improve card accessibility |
| WorkflowSection | `components/landing/workflow-section.tsx` | Create mobile-responsive Kanban visualization, remove `hidden lg:block` pattern |
| PricingSection | `components/landing/pricing-section.tsx` | Enhance visual hierarchy, verify accessibility |
| CTASection | `components/landing/cta-section.tsx` | Replace hex gradient with semantic tokens, enhance visual distinction |

### Sub-Components (Existing — Enhanced)

| Component | File | Changes |
|-----------|------|---------|
| FeatureCard | `components/landing/feature-card.tsx` | Accept semantic color token prop instead of hex, add aria-label, improve focus states |
| WorkflowStep | `components/landing/workflow-step.tsx` | Replace hex stage colors with semantic tokens, add aria-label |
| WorkflowColumnCard | `components/landing/workflow-column-card.tsx` | Minor accessibility improvements |
| PricingCard | `components/landing/pricing-card.tsx` | Verify touch target sizes, verify contrast ratios |
| PricingFAQ | `components/landing/pricing-faq.tsx` | Ensure aria-expanded/aria-controls on collapsible triggers |
| MiniKanbanDemo | `components/landing/mini-kanban-demo.tsx` | Adapt for mobile-responsive layout |
| AnimatedTicketBackground | `app/landing/components/animated-ticket-background.tsx` | Verify aria-hidden, verify reduced-motion |

### New Sub-Components (If Needed)

| Component | File | Purpose |
|-----------|------|---------|
| MobileWorkflowDemo | `components/landing/mobile-workflow-demo.tsx` | Mobile-optimized workflow visualization (if separate from existing MiniKanbanDemo) |
| SectionDivider | `components/landing/section-divider.tsx` | Custom SVG/gradient transition between sections (optional — may be CSS-only) |

## Color Token Mapping

| Current Hardcoded Value | Semantic Token | Tailwind Class |
|------------------------|----------------|----------------|
| `#8B5CF6` | `--ctp-mauve` | `text-ctp-mauve` / `bg-ctp-mauve` |
| `#6366F1` | `--primary-violet` | `text-primary` |
| `#3B82F6` | `--ctp-blue` | `text-ctp-blue` / `bg-ctp-blue` |
| `#89b4fa` | `--ctp-blue` | `text-ctp-blue` |
| `#a6e3a1` | `--ctp-green` | `text-ctp-green` |
| `#f9e2af` | `--ctp-yellow` | `text-ctp-yellow` |
| `#f5c2e7` | `--ctp-pink` | `text-ctp-pink` |
| `#89dceb` | `--ctp-sky` | `text-ctp-sky` |
| `#6c7086` | `--ctp-overlay-0` | `text-ctp-overlay-0` |
| `#b4befe` | `--ctp-lavender` | `text-ctp-lavender` / `bg-ctp-lavender` |
| `#f9cb98` | `--ctp-peach` | `text-ctp-peach` / `bg-ctp-peach` |
| `#f2cdcd` | `--ctp-flamingo` | `text-ctp-flamingo` / `bg-ctp-flamingo` |
| `#1e1e2e` | `--ctp-base` | `text-ctp-base` |

## State Transitions

No new application state. Existing animation state hooks (`useAnimationState`, `useIntersectionObserver`, `useReducedMotion`) continue to manage demo state.

## Validation Rules

- All text elements: contrast ratio >= 4.5:1 (normal text) or >= 3:1 (large text) per WCAG AA
- All interactive elements: touch target >= 44x44px
- All animations: must respect `prefers-reduced-motion`
- Zero hardcoded hex/rgb colors in final output
