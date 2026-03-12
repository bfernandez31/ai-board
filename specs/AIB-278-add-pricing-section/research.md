# Research: Landing Page Pricing Section

**Feature**: `AIB-278-add-pricing-section`  
**Date**: 2026-03-12  
**Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/spec.md`

## Overview

This document resolves the implementation decisions for adding a pricing section and footer pricing navigation to the landing page. The feature is a presentation-only marketing update, so the research focuses on source-of-truth content, component boundaries, navigation behavior, and copy alignment with existing product rules.

## 1. Source of Truth for Plan Content

**Decision**: Derive plan names, prices, features, and trial availability from `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts`, then map that data into a landing-page presentation model.

**Rationale**:
- The spec explicitly requires plan benefits to match the current product offering.
- `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts` already contains canonical plan names, price points, feature bullets, and trial configuration for Free, Pro, and Team.
- Reusing the existing plan config reduces drift between billing settings and marketing copy.
- A small presentation mapper can still tailor CTA labels to spec wording: `"Get Started"` for Free and `"Start 14-day trial"` for paid tiers.

**Alternatives considered**:
- Hardcode all card copy inside the landing component.
  - Rejected because plan benefits and trial language would drift easily.
- Reuse only the plan names and invent new marketing bullets.
  - Rejected because the ticket requires benefit statements that match the current offer.

## 2. Marketing Component Strategy

**Decision**: Create dedicated landing-page components under `/home/runner/work/ai-board/ai-board/target/components/landing/` instead of reusing `/home/runner/work/ai-board/ai-board/target/components/billing/pricing-cards.tsx`.

**Rationale**:
- The existing billing cards component is a client component built for authenticated subscription management, loading states, and current-plan actions.
- The landing page needs static marketing CTAs, section-level layout control, FAQ placement, and dark-theme presentation rather than account-state logic.
- A dedicated Server Component implementation avoids shipping unnecessary client-side code to anonymous visitors and keeps concerns separated.

**Alternatives considered**:
- Reuse `components/billing/pricing-cards.tsx` directly.
  - Rejected because it requires client interactivity, `currentPlan`, and subscription callbacks that do not exist on the landing page.
- Fork the billing component in place.
  - Rejected because a clean marketing-specific component is simpler than partially disabling account-management behaviors.

## 3. Pricing Navigation Pattern

**Decision**: Use semantic fragment navigation to a landing-page section with `id="pricing"` and expose that anchor from both the header marketing nav and the global footer.

**Rationale**:
- The repo already uses in-page section anchors such as `#features` and `#workflow` in `/home/runner/work/ai-board/ai-board/target/components/layout/header.tsx`.
- Fragment links are accessible, low-cost, and do not require a new route or client-side router logic.
- The footer requirement is satisfied by a visible pricing entry point that returns the user to the section without replacing legal links.

**Alternatives considered**:
- Create a dedicated `/pricing` page.
  - Rejected because FR-001 explicitly requires the pricing section to live on the existing landing page.
- Add imperative scroll handlers with custom JavaScript.
  - Rejected because native fragment navigation is simpler and already consistent with header behavior.

## 4. FAQ Content Source

**Decision**: Keep the FAQ to exactly two entries and align copy with existing platform documentation:
- BYOK entry based on `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts` and `/home/runner/work/ai-board/ai-board/target/specs/specifications/functional/07-billing.md`
- Supported agents entry based on `/home/runner/work/ai-board/ai-board/target/specs/specifications/functional/05-projects.md`

**Rationale**:
- The Free plan explicitly lists "BYOK API key required".
- The broader product specifications already recognize Claude and Codex as supported agents.
- Restricting the FAQ to two short entries matches the minimal scope requested by the spec and avoids growing the page into a full pricing document.

**Alternatives considered**:
- Expand the FAQ to cover billing cadence, refunds, or member limits.
  - Rejected because the spec requests a minimal FAQ with only two named topics.
- Link out to legal or billing docs instead of answering inline.
  - Rejected because the goal is fast self-serve clarification on the landing page.

## 5. Responsive Layout and Visual Consistency

**Decision**: Follow the existing landing-page visual language with a section heading, three-card responsive grid, highlighted Pro emphasis if desired, and a stacked FAQ block below the cards using semantic Tailwind tokens only.

**Rationale**:
- The current landing page already uses spaced sections, centered headings, and token-based dark-theme styling.
- A mobile-first grid (`1 column` on narrow screens, `3 columns` from desktop) satisfies the requirement that all cards remain readable and actionable.
- Token-based styling avoids the hardcoded color violations explicitly forbidden in project guidance.

**Alternatives considered**:
- Reuse billing-page visuals exactly.
  - Rejected because the authenticated settings page and anonymous marketing page have different content density and CTA intent.
- Introduce custom gradients or hardcoded palette values for pricing.
  - Rejected because the project rules prohibit hardcoded hex/rgb colors in UI styling.

## 6. Testing Approach

**Decision**: Prefer Vitest + React Testing Library for component behavior and static content assertions; use Playwright only if fragment navigation or viewport behavior needs browser-level confirmation.

**Rationale**:
- This is primarily a React rendering task with deterministic copy, section order, CTA labels, and footer links.
- The constitution requires defaulting away from E2E unless browser behavior is the actual risk.
- Component tests can validate the presence and order of pricing content faster than Playwright.

**Alternatives considered**:
- Use Playwright as the primary coverage layer.
  - Rejected because that is slower and unnecessary for most acceptance criteria.
- Skip automated tests because the change is marketing-only.
  - Rejected because the constitution requires test coverage for completed features.

## Conclusion

All technical uncertainties are resolved:
- No new API or database work is required.
- Canonical plan details come from `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts`.
- A dedicated landing pricing component is the correct architectural boundary.
- `#pricing` fragment navigation satisfies both header and footer entry-point requirements.
