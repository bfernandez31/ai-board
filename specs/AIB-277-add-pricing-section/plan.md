# Implementation Plan: Add Pricing Section to Landing Page

**Branch**: `AIB-277-add-pricing-section` | **Date**: 2026-03-12 | **Spec**: `specs/AIB-277-add-pricing-section/spec.md`
**Input**: Feature specification from `/specs/AIB-277-add-pricing-section/spec.md`

## Summary

Add a pricing section with three plan cards (Free/Pro/Team) and a minimalist FAQ to the landing page. The section is positioned between WorkflowSection and CTASection. Plan data is sourced from the existing `PLANS` configuration in `lib/billing/plans.ts` to ensure pricing consistency. Each card has plan-specific CTAs linking to `/auth/signin`. The FAQ covers BYOK, supported AI agents, trials, and plan switching using the existing Collapsible component.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0, Next.js 16 (App Router), React 18
**Primary Dependencies**: shadcn/ui (Card, Badge, Button, Collapsible), lucide-react, TailwindCSS 3.4
**Storage**: N/A (static data from `lib/billing/plans.ts`, no new DB models)
**Testing**: Vitest (unit + component tests), Playwright (viewport responsiveness if needed)
**Target Platform**: Web (all viewports: 375px mobile, 768px tablet, 1280px desktop)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Server component (zero client JS for pricing cards); FAQ accordion requires minimal client JS via Collapsible
**Constraints**: No hardcoded hex colors (use semantic tokens only); must be visually consistent with existing landing page sections
**Scale/Scope**: 2 new components (PricingSection, FAQ), 1 modified file (landing page), ~200 LOC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new components will have explicit type annotations |
| II. Component-Driven | PASS | Uses shadcn/ui Card, Badge, Button, Collapsible; server components by default |
| III. Test-Driven | PASS | Component test for PricingSection via Vitest + RTL; no E2E needed (no browser-required features) |
| IV. Security-First | PASS | No user input, no API calls from new components, static data only |
| V. Database Integrity | N/A | No database changes |
| VI. AI-First Model | PASS | No documentation files; implementation follows existing patterns |

**Gate Result**: ALL PASS - proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-277-add-pricing-section/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no new API endpoints)
└── tasks.md             # Phase 2 output (created by /ai-board.tasks)
```

### Source Code (repository root)

```
components/landing/
├── pricing-section.tsx          # NEW: Main pricing section (server component)
├── pricing-card.tsx             # NEW: Individual plan card (server component)
├── pricing-faq.tsx              # NEW: FAQ accordion (client component - Collapsible needs interactivity)
├── hero-section.tsx             # EXISTING
├── features-grid.tsx            # EXISTING
├── workflow-section.tsx         # EXISTING
└── cta-section.tsx              # EXISTING

app/landing/
└── page.tsx                     # MODIFIED: Add PricingSection between WorkflowSection and CTASection

lib/billing/
└── plans.ts                     # EXISTING (source of truth for plan data - no changes)

tests/unit/components/
└── pricing-section.test.tsx     # NEW: Component tests for pricing section
```

**Structure Decision**: Feature components in `components/landing/` following existing landing page pattern. Plan data imported directly from `lib/billing/plans.ts` (no API call needed since this is a server component that can import directly). FAQ is a client component since Collapsible requires interactivity.

## Complexity Tracking

*No constitution violations to justify.*
