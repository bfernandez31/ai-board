# Research: AIB-252 Add Pricing Section

## R1: Landing Page Section Ordering

**Decision**: Insert pricing section between WorkflowSection and CTASection.
**Rationale**: The current landing page flow is Hero → Features → Workflow → CTA. Pricing logically follows the workflow demo (which shows the product's value) and precedes the final CTA (which becomes redundant with pricing CTAs but provides a catch-all conversion point).
**Alternatives considered**:
- After CTA: Would make pricing an afterthought; visitors may leave before reaching it.
- Before Workflow: Too early; visitors haven't seen the product value yet.

## R2: Plan Data Source for Landing Page

**Decision**: Hardcode plan display data in the pricing section component using static arrays aligned with `lib/billing/plans.ts` definitions, rather than fetching from `/api/billing/plans`.
**Rationale**: The landing page is a Server Component and serves unauthenticated visitors. API fetch adds latency and a dependency on auth/session. Plan data (names, prices, features) changes infrequently and is already defined in the billing module. Marketing feature descriptions may differ slightly from the billing system's terse feature lists.
**Alternatives considered**:
- Fetch from API at build time (ISR/SSG): Over-engineering for 3 static plans.
- Import `lib/billing/plans.ts` directly: Viable but couples landing page to billing internals. Static data is simpler and allows marketing-friendly descriptions.

## R3: FAQ Implementation Pattern

**Decision**: Use the existing `Collapsible` component from `@radix-ui/react-collapsible` (already installed as `components/ui/collapsible.tsx`) to build the FAQ accordion.
**Rationale**: No need to install `@radix-ui/react-accordion`. The Collapsible primitive provides the same expand/collapse behavior. Each FAQ item is an independent collapsible, which matches the spec requirement. Constitution forbids adding UI libs beyond shadcn/ui and Radix (which Collapsible already uses).
**Alternatives considered**:
- Install shadcn/ui Accordion: Adds a dependency when Collapsible already exists.
- Custom CSS-only toggle: Less accessible; Radix handles aria attributes automatically.

## R4: Footer Enhancement Strategy

**Decision**: Add a GitHub repository link to the existing `Footer` component in `components/layout/footer.tsx`. The footer is already rendered globally via `app/layout.tsx` on all pages including legal pages.
**Rationale**: Minimal change. The footer already has Terms and Privacy links plus copyright. Adding one more link to the existing `<nav>` element is the simplest approach. No new component needed.
**Alternatives considered**:
- Create a new enhanced footer component: Unnecessary; the existing component is simple and additive changes suffice.
- Create a separate landing-page footer: Violates DRY; the spec requires the same footer on all public pages.

## R5: Responsive Layout for Pricing Cards

**Decision**: Use a 3-column CSS grid on desktop (`md:grid-cols-3`) stacking to single column on mobile, matching the existing pattern in `components/billing/pricing-cards.tsx`.
**Rationale**: Consistent with existing codebase patterns. The billing settings page already uses this exact layout for plan cards.
**Alternatives considered**:
- Horizontal scroll on mobile: Poor UX for comparison.
- Two-column on tablet: 3 cards don't divide evenly; single-column stacking is cleaner.

## R6: CTA Navigation Target

**Decision**: All pricing CTA buttons link to `/auth/signin`. The existing CTASection already links there.
**Rationale**: The spec states "Free plan → sign-up page, Pro/Team → sign-up page (trial activation occurs after account creation)." All paths converge on sign-up. Trial activation is handled post-auth in the billing flow.
**Alternatives considered**:
- Link Pro/Team to Stripe Checkout directly: Requires authentication first; not possible from landing page.

## R7: Header Navigation Update

**Decision**: Add a "Pricing" anchor link to the marketing variant of the header, linking to `#pricing` on the landing page.
**Rationale**: The header already has "Features" (`#features`) and "Workflow" (`#workflow`) anchor links for the landing page. Adding "Pricing" follows the same pattern and improves discoverability.
**Alternatives considered**:
- No header link: Visitors must scroll to find pricing; sub-optimal for conversion.
