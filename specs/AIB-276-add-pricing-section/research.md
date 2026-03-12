# Research: Add Pricing Section to Landing Page and Public Footer

## Decision 1: Store pricing, FAQ, and footer copy in a typed shared config module

- **Decision**: Create a static `lib/config/public-site.ts` module as the source of truth for public marketing copy, including pricing plans, FAQ items, and the footer repository URL.
- **Rationale**: The repo currently keeps landing content inline in section components and already renders the footer globally from `app/layout.tsx`. A typed config module keeps copy centralized and configurable without adding runtime data fetching, CMS infrastructure, or environment-variable coupling for simple public content.
- **Alternatives considered**:
  - Keep arrays inline inside each component: rejected because the footer repository URL and pricing copy would be duplicated and harder to update consistently.
  - Use environment variables for repository URL: rejected because this is not secret configuration and would add operational overhead for a single public constant.
  - Persist marketing copy in Prisma: rejected because the feature is static content with no editing workflow.

## Decision 2: Build a landing-specific pricing section instead of reusing authenticated billing cards

- **Decision**: Implement dedicated landing components under `components/landing/` for the public pricing section and FAQ instead of reusing `components/billing/pricing-cards.tsx`.
- **Rationale**: The existing billing component is a client component tied to subscription state, loading behavior, and checkout actions. The landing-page requirement is static marketing copy with fixed CTA labels and no authenticated state. A landing-specific server-rendered section is simpler, avoids unnecessary client JS, and better matches the spec’s placement and FAQ requirements.
- **Alternatives considered**:
  - Reuse `PricingCards` directly: rejected because it introduces client state and billing semantics the landing page does not need.
  - Generalize `PricingCards` for both contexts: rejected for this ticket because the abstraction cost is higher than the feature scope and risks coupling marketing copy to account billing behavior.

## Decision 3: Keep all CTA destinations on the existing sign-in entry point

- **Decision**: Route all plan CTAs to `/auth/signin`, varying only the button labels per plan.
- **Rationale**: The spec explicitly avoids creating new conversion pages, and the current landing page already funnels users into sign-in. This satisfies FR-004 while keeping implementation scope bounded to presentation changes.
- **Alternatives considered**:
  - Add plan-specific query params: rejected because the spec does not require preselection behavior.
  - Create separate checkout or trial pages: rejected as out of scope.

## Decision 4: Extend the existing shared footer instead of introducing a public-only variant

- **Decision**: Modify `components/layout/footer.tsx` to add the GitHub repository link while preserving its global rendering via `app/layout.tsx`.
- **Rationale**: The footer already appears across public pages, including legal routes, which directly supports FR-009. Extending the existing component is lower risk than creating route-specific footer variants.
- **Alternatives considered**:
  - Add a landing-only footer: rejected because the spec requires consistent footer content on all public pages.
  - Add conditional footer variants by pathname: rejected because there is no distinct content requirement per public route.

## Decision 5: Test with Vitest component and integration coverage, not Playwright

- **Decision**: Cover the feature with Vitest component tests for the landing section/footer and Vitest integration tests for rendered public pages.
- **Rationale**: The feature is static UI composition with no browser-only behavior, auth flow, or drag-and-drop. This aligns with the constitution’s testing trophy guidance to prefer component and integration tests over E2E.
- **Alternatives considered**:
  - Playwright viewport tests: rejected because responsive layout expectations can be covered sufficiently by component structure plus existing CSS conventions for this ticket.
  - Integration tests only: rejected because footer and pricing CTA labels are simpler and faster to verify at component level.
