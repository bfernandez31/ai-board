# Research: Add Pricing Section to Landing Page

**Date**: 2026-03-12 | **Branch**: `AIB-277-add-pricing-section`

## R1: Plan Data Source Strategy

**Decision**: Import `PLANS` directly from `lib/billing/plans.ts` in a server component.

**Rationale**: The PricingSection is a server component and can import directly from the billing module without needing an API call. This is simpler, faster (no network request), and keeps the data source consistent with the billing settings page. The `PLANS` object contains `name`, `priceMonthly` (in cents), `features[]`, and `trial` configuration - all fields needed for the pricing cards.

**Alternatives considered**:
- Fetch from `/api/billing/plans` endpoint: Unnecessary for a server component that can import directly. The API exists for client-side billing page usage.
- Hardcode pricing data: Violates FR-010 (consistency with plan configuration) and creates maintenance burden.

## R2: Component Architecture (Server vs Client)

**Decision**: PricingSection and PricingCard are server components. PricingFAQ is a client component (requires Collapsible interactivity).

**Rationale**: Server components by default (Constitution II). The pricing cards are purely presentational - they display static data and link to `/auth/signin` via standard `<a>` tags or Next.js `Link`. No onClick handlers needed. The FAQ requires expand/collapse interactivity via the existing Collapsible component, so it must be a client component.

**Alternatives considered**:
- All client components: Unnecessary JS shipped to client for static pricing cards.
- Static FAQ (no accordion): Spec requires expandable FAQ ("when they interact with a question, then the answer expands"). Collapsible component already exists in the codebase.

## R3: Reuse vs New Pricing Card Component

**Decision**: Create a new `PricingCard` component in `components/landing/` rather than reusing `components/billing/pricing-cards.tsx`.

**Rationale**: The existing `PricingCards` component is a client component with `onSubscribe` callback, loading states, and authenticated-user logic (current plan detection, subscribe button). The landing page needs a simpler, server-rendered version with different CTAs ("Get Started" / "Start 14-day trial") linking to `/auth/signin`. Creating a new component avoids over-parameterizing the existing billing component and keeps concerns separated.

**Alternatives considered**:
- Refactor existing `PricingCards` to accept a `variant` prop: Would increase complexity of the billing component and couple landing page concerns with authenticated billing logic. The two use cases have fundamentally different behaviors (navigate to sign-in vs trigger Stripe checkout).

## R4: Landing Page Section Pattern

**Decision**: Follow the established section pattern with `<section>` wrapper, container, and heading structure.

**Rationale**: All existing landing sections (HeroSection, FeaturesGrid, WorkflowSection, CTASection) follow a consistent pattern:
```
<section id="..." className="py-16 md:py-24 lg:py-32 [optional-bg]">
  <div className="container mx-auto px-4">
    <div className="max-w-7xl mx-auto">
      <h2>Section Title</h2>
      <p>Section Description</p>
      {/* Content */}
    </div>
  </div>
</section>
```
The PricingSection will follow this exact pattern for visual consistency.

**Alternatives considered**: None - consistency with existing patterns is non-negotiable.

## R5: FAQ Implementation

**Decision**: Use existing `Collapsible` component from `components/ui/collapsible.tsx` to build a simple accordion-style FAQ.

**Rationale**: The Collapsible component wraps Radix UI's React Collapsible and is already installed. It provides accessible expand/collapse behavior with proper ARIA attributes. The FAQ has 4 questions:
1. "What does BYOK mean?" - Explains Bring Your Own Key model
2. "Which AI agents are supported?" - Claude and Codex
3. "How does the 14-day trial work?" - Trial details for Pro/Team
4. "Can I switch plans?" - Plan upgrade/downgrade info

**Alternatives considered**:
- Install shadcn/ui Accordion: Not currently installed. Collapsible provides equivalent functionality for a small FAQ.
- Static display (no interactivity): Spec requires interactive expand/collapse behavior.

## R6: Color & Styling Approach

**Decision**: Use Tailwind semantic tokens exclusively. Use `border-primary` for Pro card emphasis instead of hardcoded colors.

**Rationale**: Constitution and CLAUDE.md prohibit hardcoded hex/rgb colors. The existing `PricingCards` billing component uses `border-primary shadow-md` for Pro card highlighting. Landing page sections use `bg-[hsl(var(--ctp-mantle))]` for alternate backgrounds. Semantic tokens ensure dark theme compatibility.

**Key tokens to use**:
- Text: `text-foreground`, `text-muted-foreground`
- Backgrounds: `bg-card`, `bg-[hsl(var(--ctp-mantle))]`
- Borders: `border-border`, `border-primary`
- Accents: `text-primary`, `bg-primary`

**Alternatives considered**: None - constitution is explicit about this requirement.

## R7: Responsive Layout Strategy

**Decision**: CSS Grid with `grid-cols-1 md:grid-cols-3` for pricing cards. Single column for FAQ.

**Rationale**: Matches the responsive pattern used in FeaturesGrid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) and existing PricingCards (`grid gap-6 md:grid-cols-3`). Three cards map naturally to a 3-column grid on desktop and stack on mobile. The Pro card (center) gets visual emphasis on all breakpoints.

**Alternatives considered**:
- `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`: Three pricing cards should show all three on tablet since they're narrower than feature cards. `md:grid-cols-3` is proven in the existing billing page.

## R8: Testing Strategy

**Decision**: Vitest + RTL component tests for PricingSection. No E2E tests.

**Rationale**: Per Testing Trophy (Constitution III):
- PricingSection is a React component with minimal interactivity → component test
- FAQ has expand/collapse → component test with `userEvent`
- No browser-required features (no OAuth, no drag-drop, no viewport-specific logic)
- No API endpoints to test (server component with direct import)

**Test cases**:
1. Renders three pricing cards with correct plan names
2. Displays correct prices ($0, $15, $30)
3. Shows "Most Popular" badge on Pro card
4. Free card has "Get Started" CTA
5. Pro/Team cards have "Start 14-day trial" CTA
6. All CTA links point to `/auth/signin`
7. FAQ renders all questions
8. FAQ questions expand/collapse on interaction

**Alternatives considered**:
- E2E viewport tests: Component tests with RTL are sufficient for verifying render output. Responsive CSS doesn't need E2E verification for a server-rendered section.
