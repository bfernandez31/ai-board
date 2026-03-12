# Data Model: Landing Page Pricing Section

**Feature**: `AIB-278-add-pricing-section`  
**Date**: 2026-03-12  
**Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/spec.md`

## Overview

This feature introduces no persisted database entities. The data model is a presentation-layer view model composed from existing billing configuration and static FAQ/navigation content.

## Entity: PricingPlanCard

Represents one pricing card rendered on the landing page.

**Fields**

| Field | Type | Source | Rules |
|------|------|--------|-------|
| `plan` | `SubscriptionPlan` | `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts` | Must be one of `FREE`, `PRO`, `TEAM` |
| `name` | `string` | plan config | Must render exactly `Free`, `Pro`, or `Team` |
| `priceMonthly` | `number` | plan config | `0` for Free, positive cents for paid plans |
| `features` | `string[]` | plan config | Must reflect current offer; should remain concise enough for card layout |
| `ctaLabel` | `string` | presentation mapping | `Get Started` for Free; `Start 14-day trial` for Pro and Team |
| `ctaHref` | `string` | presentation mapping | Reuses existing sign-in/signup path; no new route |
| `emphasis` | `'default' | 'featured'` | presentation mapping | Optional visual emphasis for the preferred paid tier |

**Validation Rules**
- Exactly three cards must be rendered.
- Cards must appear in this order: Free, Pro, Team.
- CTA labels must satisfy FR-005 and FR-006.
- Feature bullets must remain readable on mobile without clipping critical information.

## Entity: PricingFaqEntry

Represents one FAQ item shown beneath the pricing cards.

**Fields**

| Field | Type | Source | Rules |
|------|------|--------|-------|
| `id` | `string` | static content | Stable unique key for rendering |
| `question` | `string` | static content | Short, scannable, user-facing |
| `answer` | `string` | static content | Must align with existing product behavior |
| `topic` | `'BYOK' | 'SUPPORTED_AGENTS'` | static content | Exactly two entries only |

**Validation Rules**
- Exactly two FAQ entries must exist.
- One entry must explain BYOK in plan context.
- One entry must state that Claude and Codex are supported.

## Entity: PricingAnchorLink

Represents a navigation item that jumps to the pricing section.

**Fields**

| Field | Type | Source | Rules |
|------|------|--------|-------|
| `label` | `string` | static content | User-facing nav text, e.g. `Pricing` |
| `href` | `'#pricing'` | static content | Must point to the landing-page pricing section |
| `surface` | `'header' | 'footer'` | render location | Must support both header and footer placements |

**Validation Rules**
- Footer pricing navigation must coexist with existing legal links.
- The landing page must contain a matching `id="pricing"` target.

## Relationships

- One landing page contains many `PricingPlanCard` entities.
- One landing page contains exactly two `PricingFaqEntry` entities.
- One landing page exposes at least two `PricingAnchorLink` instances pointing to the same `#pricing` target: one in header marketing nav and one in footer.

## State Transitions

This feature has no persisted workflow or lifecycle state. The only interaction transition is navigation:

1. Visitor views `/`
2. Visitor activates a pricing CTA or a pricing anchor
3. Browser navigates either to the existing auth flow or to the in-page `#pricing` section

## Persistence Impact

- No Prisma schema changes
- No migrations
- No API payload changes
- No new server-side storage

## Source Dependencies

- Canonical plan configuration: `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts`
- Billing product rules: `/home/runner/work/ai-board/ai-board/target/specs/specifications/functional/07-billing.md`
- Supported agent definitions: `/home/runner/work/ai-board/ai-board/target/specs/specifications/functional/05-projects.md`
