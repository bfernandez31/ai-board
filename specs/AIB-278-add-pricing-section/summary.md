# Implementation Summary: Add Pricing Section to Landing Page & Footer

**Branch**: `AIB-278-add-pricing-section` | **Date**: 2026-03-12
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a server-rendered landing-page pricing section with Free, Pro, and Team cards, mapped from canonical billing plan metadata. Inserted it between workflow and CTA, added plan CTAs, a two-item FAQ, and `Pricing` anchor links in the marketing header and footer. Expanded unit coverage for pricing content, section order, and navigation links.

## Key Decisions

Derived landing pricing content from `lib/billing/plans.ts` through a dedicated typed mapper in `lib/landing/pricing.ts` to keep marketing copy aligned with billing rules. Used a dedicated landing component set and native `#pricing` fragment links instead of reusing authenticated billing UI or creating a separate pricing page.

## Files Modified

`app/landing/page.tsx`, `components/landing/pricing-card.tsx`, `components/landing/pricing-section.tsx`, `components/landing/pricing-faq.tsx`, `components/layout/header.tsx`, `components/layout/footer.tsx`, `lib/landing/pricing.ts`, `tests/unit/app/landing-page.test.tsx`, `tests/unit/components/pricing-section.test.tsx`, `tests/unit/components/header.test.tsx`, `tests/unit/components/footer.test.tsx`

## ⚠️ Manual Requirements

None
