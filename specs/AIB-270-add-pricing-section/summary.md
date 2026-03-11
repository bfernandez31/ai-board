# Implementation Summary: Add pricing section to landing page & footer

**Branch**: `AIB-270-add-pricing-section` | **Date**: 2026-03-11
**Spec**: [spec.md](spec.md)

## Changes Summary

Built centralized marketing content config plus pricing/FAQ components, wrapped landing/legal routes with the marketing layout+footer, highlighted billing deep-links, and added Vitest/Playwright coverage for the new surface.

## Key Decisions

Used a typed `marketingContent` source for all copy + analytics IDs, routed footer visibility through the `(marketing)` layout while keeping the product shell untouched, and let billing honor `?plan` via a highlight/alert path instead of auto-checkout.

## Files Modified

lib/marketing/pricing-content.ts; components/landing/{pricing-card.tsx,pricing-section.tsx,faq.tsx}; components/layout/footer.tsx; app/(marketing)/**/*; app/layout.tsx; app/settings/billing/page.tsx; tests/unit/components/{landing/pricing-section.test.tsx,layout/footer.test.tsx}; tests/e2e/marketing/pricing-section.spec.ts; specs/AIB-270-add-pricing-section/quickstart.md; hooks/use-marketing-route.ts; .eslintignore; .prettierignore; app/page.tsx.

## ⚠️ Manual Requirements

ESLint reported existing react-hooks warnings in components/activity/activity-feed.tsx, components/layout/header.tsx, components/search/ticket-search.tsx, and components/settings/constitution-viewer.tsx; follow-up fixes are outside this feature scope.
