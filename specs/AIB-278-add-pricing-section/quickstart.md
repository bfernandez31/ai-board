# Quickstart: Landing Page Pricing Section

**Feature**: `AIB-278-add-pricing-section`  
**Branch**: `AIB-278-add-pricing-section`  
**Date**: 2026-03-12

## Overview

This feature adds a pricing section and footer pricing anchor to the existing public landing page. It is a presentation-only change that reuses current billing plan metadata and existing sign-in/trial entry points.

## Implementation Touchpoints

Primary files expected to change:

- `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/layout/header.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/layout/footer.tsx`
- `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts` as a read-only source of truth

## Suggested Build Sequence

1. Create a presentation mapper from existing `PLANS` data to landing-page card props.
2. Implement the pricing section as a Server Component under `/home/runner/work/ai-board/ai-board/target/components/landing/`.
3. Insert the section in `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx` after `WorkflowSection` and before `CTASection`.
4. Add a `Pricing` anchor link to the marketing header navigation.
5. Add a matching `Pricing` anchor link to the footer while preserving Terms and Privacy links.
6. Add or extend automated tests for section order, CTA labels, FAQ copy, and anchor visibility.

## Local Validation

Run from `/home/runner/work/ai-board/ai-board/target`:

```bash
bun run type-check
bun run lint
```

Recommended targeted test path:

```bash
bun run test:unit
```

Optional browser validation if fragment navigation or responsive layout still feels risky:

```bash
bun run test:e2e
```

## Manual Verification Checklist

1. Visit `http://localhost:3000/` while signed out.
2. Confirm the pricing section appears after the workflow section and before the final CTA.
3. Confirm three cards render in order: Free, Pro, Team.
4. Confirm CTA labels read `Get Started`, `Start 14-day trial`, `Start 14-day trial`.
5. Confirm the FAQ contains one BYOK entry and one supported-agents entry mentioning Claude and Codex.
6. Confirm both header and footer expose a `Pricing` link that reaches `#pricing`.
7. Confirm the layout remains readable on narrow mobile and wide desktop widths.

## Content Update Rules

- Do not hardcode plan benefits in multiple places if they can be derived from `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts`.
- Keep FAQ copy intentionally minimal; this ticket does not add long-form billing guidance.
- Use semantic Tailwind tokens only. Do not introduce hex/rgb utility classes for the new section.

## Non-Goals

- No standalone pricing page
- No Stripe checkout or billing-flow changes
- No database changes
- No new API routes
