# Data Model: Add Pricing Section to Landing Page and Public Footer

## Overview

This feature does not add or modify Prisma models. It introduces typed presentation models for static public-site content rendered on the landing page and in the shared footer.

## Presentation Entities

### Plan Summary

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `'Free' \| 'Pro' \| 'Team'` | Yes | Public plan name shown on the landing page |
| `tagline` | `string` | Yes | Short descriptor that helps visitors compare plans |
| `capabilities` | `string[]` | Yes | Human-readable list of plan benefits or included capabilities |
| `ctaLabel` | `string` | Yes | Button text shown on the card |
| `ctaHref` | `string` | Yes | Destination for the CTA, expected to be `/auth/signin` |
| `highlighted` | `boolean` | No | Optional visual emphasis for the featured plan |

**Validation Rules**

- Exactly three plan summaries must be rendered.
- Allowed names are limited to `Free`, `Pro`, and `Team`.
- `ctaLabel` must be `Get Started` for `Free` and `Start 14-day trial` for `Pro` and `Team`.
- `capabilities` must contain at least one item per plan.

### Pricing FAQ Item

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | `string` | Yes | FAQ prompt displayed below pricing cards |
| `answer` | `string` | Yes | Concise answer shown directly under the question |

**Validation Rules**

- FAQ content must include an entry addressing BYOK.
- FAQ content must include an entry addressing supported agents.
- Items are static content only; no expand/collapse state is required by the spec.

### Public Footer Link

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | `string` | Yes | Visible link text |
| `href` | `string` | Yes | Internal route or external URL |
| `external` | `boolean` | No | Whether the link should open as an external destination |

**Validation Rules**

- Footer must expose links for Terms of Service, Privacy Policy, and GitHub repository.
- Legal links use internal app routes.
- Repository link uses an external GitHub URL from shared config.

## Relationships

- One `PricingSection` renders many `Plan Summary` items.
- One `PricingSection` renders many `Pricing FAQ Item` entries.
- One global `Footer` renders many `Public Footer Link` entries.
- `PricingSection` and `Footer` both depend on the same `public-site` config module for content.

## Render State Transitions

### Landing Page Composition

1. `HeroSection`
2. `FeaturesGrid`
3. `WorkflowSection`
4. `PricingSection`
5. `CTASection`
6. Shared global `Footer`

### Footer Availability

1. Public route loads through `app/layout.tsx`
2. Shared `Footer` renders after page content
3. Terms, Privacy, and GitHub links are available without route-specific branching

## Files Backed by This Model

| File | Kind | Responsibility |
|------|------|----------------|
| `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts` | Typed config | Stores plan, FAQ, and footer content |
| `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx` | Server Component | Renders plan summaries and FAQ items |
| `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx` | Presentational component | Displays one plan summary |
| `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-faq.tsx` | Presentational component | Displays FAQ items |
| `/home/runner/work/ai-board/ai-board/target/components/layout/footer.tsx` | Shared layout component | Renders footer links from shared config |
