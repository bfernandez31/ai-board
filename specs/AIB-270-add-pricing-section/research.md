# Research: Add pricing section to landing page & footer

**Feature**: AIB-270 Add pricing section to landing page & footer  
**Date**: 2026-03-11  
**Status**: Complete (all Phase 0 clarifications resolved)

## Research Questions Addressed

### 1. CTA Deep-Link Contract for Paid Plans

- **Decision**: Route Pro/Team CTAs to `/auth/signin?callbackUrl=/settings/billing?plan={PLAN}` so authentication flows preserve the selected plan; extend `app/(marketing)/landing/pricing-section.tsx` to set `href` accordingly and update `app/settings/billing/page.tsx` to read the `plan` query param, surface trial messaging, highlight the card, and prefill the handler that eventually posts to `POST /api/billing/checkout`.
- **Rationale**:
  - `app/auth/signin/page.tsx` already accepts an arbitrary `callbackUrl` search param and forwards it to `signIn()` so no new auth work is needed.
  - Billing page logic already encapsulates `handleSubscribe(plan)` which posts JSON `{ plan }` to `/api/billing/checkout`; reusing that code after redirect keeps all Stripe orchestration in one place.
  - Highlighting the selected plan before users click subscribe satisfies “plan pre-selected” plus “trial messaging shown before payment entry” while avoiding auto-triggering Stripe checkout immediately after login.
- **Alternatives Considered**:
  1. **Direct checkout link** (`/api/billing/checkout?plan=PRO`): would require GET-to-POST proxy or server action exposed publicly, increasing CSRF surface.
  2. **Dedicated marketing upgrade page**: duplicates billing UI and diverges from single source of truth for plan management.
  3. **Auto-subscribe on landing CTA click**: poor UX (Stripe modal without confirmation) and complicates analytics attribution.

### 2. Marketing Layout Gating vs. Runtime Checks

- **Decision**: Create a `(marketing)` route group with its own `app/(marketing)/layout.tsx` that wraps children with the marketing header variant plus the new shared footer, and remove `<Footer />` from `app/layout.tsx` so authenticated product routes are unaffected.
- **Rationale**:
  - Current root layout renders `<Footer />` for every page (`app/layout.tsx` lines 6-36), so product dashboards already show marketing footer—violates spec intent.
  - Route-group layout lets us co-locate marketing-only providers and ensures any future public page added under `(marketing)` automatically inherits the footer without runtime pathname checks.
  - Avoids making `Footer` a client component just to read `usePathname`; stays server-rendered for better performance.
- **Alternatives Considered**:
  1. **Client-side gating inside `Footer`**: would require converting to `"use client"` and calling `usePathname`, increasing bundle size and delaying render.
  2. **Duplicate footer markup inside each marketing page**: violates “shared footer component” requirement and risks drift.
  3. **Global layout branching on `headers().get('x-path')`**: brittle and still executes on every request, harder to test.

### 3. Analytics Instrumentation Pattern (FR-009)

- **Decision**: Introduce a `data-analytics-id` attribute on all marketing CTAs and FAQ triggers with values defined in the centralized config (`lib/marketing/pricing-content.ts`) so analytics can target DOM nodes without structural assumptions.
- **Rationale**:
  - Existing components primarily expose `data-testid` for testing; using a dedicated `data-analytics-id` avoids conflating QA selectors with analytics trackers.
  - Centralizing IDs in the config keeps instrumentation in sync with the actual plan/FAQ entries and allows marketing to extend them when adding plans without editing components.
  - Works with current analytics tooling that listens for DOM events and reads attributes—no new network endpoints are required per spec (FR-009 only requested hooks, not tracking implantation).
- **Alternatives Considered**:
  1. **`id` attributes**: risk conflicts with CSS/JS anchors; not expressive enough for hierarchical naming.
  2. **`data-testid` reuse**: mixing QA + analytics can cause accidental renames during refactors and is discouraged in constitution-guided testing.
  3. **Custom event dispatch**: heavier JS footprint, unnecessary since analytics stack already parses attributes.

### 4. Responsive Card & FAQ Composition

- **Decision**: Use existing shadcn/ui `Card` primitives with Tailwind utility layout patterns already present in `components/landing/features-grid.tsx` and `components/landing/workflow-section.tsx`—specifically `max-w-7xl` containers, `grid grid-cols-1 md:grid-cols-3` for cards, and `flex flex-col gap-8` stacks on mobile; implement FAQ with Radix `Collapsible` so each question expands independently without forcing a new Accordion dependency.
- **Rationale**:
  - Landing sections already rely on container widths + Catppuccin tokens (e.g., features grid uses `bg-[hsl(var(--ctp-mantle))]` and border classes) which we can mirror for visual consistency.
  - shadcn `Card` ensures consistent padding, typography, and dark-mode colors while allowing plan badges + CTA buttons inside `CardFooter`.
  - Radix Collapsible is already installed (`components/ui/collapsible.tsx`), so FAQ interactivity only adds minimal client JS; we can default to collapsed state per spec.
- **Alternatives Considered**:
  1. **Custom CSS modules**: redundant with Tailwind/shadcn, increases maintenance cost.
  2. **`@radix-ui/react-accordion`**: not yet included; Collapsible meets requirement with less overhead.
  3. **Swiper-based mobile carousel**: spec only requires stacked/swipeable layout; CSS `snap-x` + horizontal scroll is enough without new dependency.

### 5. Testing Surface & Tooling

- **Decision**: Cover pricing + FAQ with Vitest + RTL component tests (rendering, CTA hrefs, FAQ toggles) and add a lightweight Playwright smoke test that loads `/landing` at 360px width to assert section order (Workflow → Pricing → CTA) plus CTA navigation, since no landing-specific E2E tests exist today.
- **Rationale**:
  - `rg -n \"landing\" tests/` returned no hits, confirming there are zero existing landing specs to extend—new coverage is required.
  - Responsive guarantee (SC-001) is better validated in a browser context; Playwright already part of toolchain and used for marketing-critical flows (see `tests/e2e/quick-impl-visual-feedback.spec.ts` for precedent).
  - Component tests remain primary for fast feedback, making Playwright suite minimal (single spec with two assertions) to respect Testing Trophy guidance.
- **Alternatives Considered**:
  1. **Only component tests**: can’t faithfully verify section order with `scrollIntoView` behavior or CTA navigation across routes.
  2. **Heavy E2E scenario with fake signup**: unnecessary; we only need to confirm CTA `href`s and DOM placement, not backend flows.
  3. **Visual regression tooling**: not part of stack and would add significant setup for limited payoff.

