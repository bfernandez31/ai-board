# Implementation Summary: Add Pricing Section to Landing Page & Footer

**Branch**: `AIB-252-add-pricing-section` | **Date**: 2026-03-11
**Spec**: [spec.md](spec.md)

## Changes Summary

Added pricing section with 3 plan cards (Free/$0, Pro/$15, Team/$30) displaying feature lists and CTA buttons. Created FAQ subsection with 2 collapsible items (BYOK and supported agents). Added "Pricing" anchor link to header and mobile menu navigation. Added GitHub repository link to footer. All CTAs link to /auth/signin. 13 component tests pass.

## Key Decisions

- Static plan data hardcoded in component (aligned with lib/billing/plans.ts) rather than API fetch for performance
- FAQ uses existing Collapsible primitive instead of installing Accordion
- FAQSection created as separate client component to keep PricingSection as server component
- Mobile menu enhanced with full marketing nav links (Features, Workflow, Pricing) for unauthenticated users

## Files Modified

- CREATE `components/landing/pricing-section.tsx` - Main pricing section with plan cards
- CREATE `components/landing/faq-section.tsx` - FAQ subsection with Collapsible
- CREATE `tests/unit/components/pricing-section.test.tsx` - 9 component tests
- MODIFY `app/landing/page.tsx` - Import and render PricingSection
- MODIFY `components/layout/header.tsx` - Add Pricing nav link
- MODIFY `components/layout/mobile-menu.tsx` - Add marketing nav links
- MODIFY `components/layout/footer.tsx` - Add GitHub link
- MODIFY `tests/unit/components/footer.test.tsx` - Add GitHub link test

## Manual Requirements

None
