# Quickstart: Add Pricing Section to Landing Page

**Branch**: `AIB-277-add-pricing-section` | **Date**: 2026-03-12

## Implementation Order

### Step 1: Create PricingCard component
**File**: `components/landing/pricing-card.tsx`
- Server component (no `"use client"`)
- Accept props: `name`, `price` (cents), `features[]`, `ctaLabel`, `ctaHref`, `isPopular?`
- Use shadcn Card, CardHeader, CardContent, CardFooter, Badge, Button
- Pro card: `border-primary shadow-md` + "Most Popular" Badge
- CTA: Next.js `Link` to `/auth/signin`
- Features list with lucide-react `Check` icon

### Step 2: Create PricingFAQ component
**File**: `components/landing/pricing-faq.tsx`
- Client component (`"use client"`) - Collapsible requires interactivity
- Static FAQ data array (4 items: BYOK, AI agents, trial, plan switching)
- Use shadcn Collapsible, CollapsibleTrigger, CollapsibleContent
- lucide-react `ChevronDown` icon for expand/collapse indicator

### Step 3: Create PricingSection component
**File**: `components/landing/pricing-section.tsx`
- Server component (no `"use client"`)
- Import `PLANS` from `@/lib/billing/plans`
- Map PLANS to PricingCard components
- Render heading, subheading, 3-column card grid, then PricingFAQ
- Follow existing section pattern: `<section>` > `container` > `max-w-7xl`

### Step 4: Add PricingSection to landing page
**File**: `app/landing/page.tsx`
- Import PricingSection
- Insert between WorkflowSection and CTASection

### Step 5: Write component tests
**File**: `tests/unit/components/pricing-section.test.tsx`
- Vitest + RTL
- Test card rendering (3 cards, correct names/prices/CTAs)
- Test "Most Popular" badge on Pro card
- Test CTA link destinations
- Test FAQ rendering and expand/collapse

## Key Files

| File | Action | Purpose |
|------|--------|---------|
| `components/landing/pricing-card.tsx` | CREATE | Individual plan card |
| `components/landing/pricing-faq.tsx` | CREATE | FAQ accordion |
| `components/landing/pricing-section.tsx` | CREATE | Section container |
| `app/landing/page.tsx` | MODIFY | Add section to page |
| `tests/unit/components/pricing-section.test.tsx` | CREATE | Component tests |

## Dependencies (existing, no installs needed)

- `@/lib/billing/plans` - Plan configuration (source of truth)
- `@/components/ui/card` - Card, CardHeader, CardContent, CardFooter
- `@/components/ui/badge` - Badge
- `@/components/ui/button` - Button
- `@/components/ui/collapsible` - Collapsible, CollapsibleTrigger, CollapsibleContent
- `lucide-react` - Check, ChevronDown icons
- `next/link` - Link component for CTAs
