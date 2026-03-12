# Data Model: Add Pricing Section to Landing Page

**Date**: 2026-03-12 | **Branch**: `AIB-277-add-pricing-section`

## Overview

This feature introduces **no new database entities or schema changes**. All data is sourced from the existing `PLANS` configuration in `lib/billing/plans.ts`. The data model below documents the TypeScript interfaces used by the new components.

## Entities

### PricingPlan (derived from existing PLANS config)

Represents a plan card displayed on the landing page. Not a new type - maps directly from the existing `PlanConfig` in `lib/billing/plans.ts`.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| plan | `SubscriptionPlan` | `PLANS[key].plan` | Plan identifier: "FREE", "PRO", "TEAM" |
| name | `string` | `PLANS[key].name` | Display name: "Free", "Pro", "Team" |
| priceMonthly | `number` | `PLANS[key].priceMonthly` | Price in cents (0, 1500, 3000) |
| features | `string[]` | `PLANS[key].features` | Feature list for display |
| trialEnabled | `boolean` | `PLANS[key].trial.enabled` | Whether plan has trial (Pro/Team: true) |
| trialDays | `number` | `PLANS[key].trial.days` | Trial duration (14 days for Pro/Team) |

### FAQItem (static data)

Represents a question-answer pair in the FAQ section. Defined as a static array within the PricingFAQ component.

| Field | Type | Description |
|-------|------|-------------|
| question | `string` | The FAQ question text |
| answer | `string` | The FAQ answer text |

## Component Props Interfaces

### PricingCardProps

```typescript
interface PricingCardProps {
  name: string;
  price: number;           // in cents
  features: string[];
  ctaLabel: string;        // "Get Started" or "Start 14-day trial"
  ctaHref: string;         // "/auth/signin"
  isPopular?: boolean;     // true for Pro plan
}
```

### FAQItemData

```typescript
interface FAQItemData {
  question: string;
  answer: string;
}
```

## State Transitions

N/A - No state changes. All components display static data.

## Validation Rules

N/A - No user input. Price formatting: `priceMonthly / 100` to convert cents to dollars.

## Relationships

```
PLANS (lib/billing/plans.ts)
  └── PricingSection (components/landing/pricing-section.tsx)
       ├── PricingCard x3 (components/landing/pricing-card.tsx)
       └── PricingFAQ (components/landing/pricing-faq.tsx)
            └── FAQItem[] (static data within component)
```
