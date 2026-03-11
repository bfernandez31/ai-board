# Quickstart: Add pricing section to landing page & footer

**Feature**: AIB-270 Add pricing section to landing page & footer  
**Date**: 2026-03-11

## Implementation Entry Points

### 1. Marketing content config (Source of truth)
- **File**: `/home/runner/work/ai-board/ai-board/target/lib/marketing/pricing-content.ts`
- Export `marketingContent: MarketingContent` matching the schema in `data-model.md`.
- Include:
  - Three plans (Free/Pro/Team) with `featureBullets`, `priceDisplay`, `limitsSummary`.
  - CTA metadata (`href`, `analyticsId`, `planKey`, `trialLengthDays`).
  - FAQ entries + footer links + disclaimer string.
- Derive CTA URLs:
  - Free: `/auth/signin`
  - Pro: `/auth/signin?callbackUrl=/settings/billing?plan=PRO`
  - Team: `/auth/signin?callbackUrl=/settings/billing?plan=TEAM`

### 2. Marketing route group & layout
- **Directories**:
  - Move `app/landing/page.tsx` → `app/(marketing)/landing/page.tsx`.
  - Move `app/legal/terms/page.tsx` → `app/(marketing)/terms/page.tsx`.
  - Move `app/legal/privacy/page.tsx` → `app/(marketing)/privacy/page.tsx`.
  - Remove `app/legal/*` after verifying imports.
- **Layout**: Create `app/(marketing)/layout.tsx`.
  - Wrap children with `<Header />`, `<main>`, `<Footer />`.
  - Accept `children` as ReactNode.
  - Apply unified background + `min-h-screen` container.
- **Root layout**: Update `app/layout.tsx` to remove `<Footer />` so product surfaces are unaffected.

### 3. PricingSection + plan subcomponents
- **Files**: `components/landing/pricing-section.tsx`, `components/landing/pricing-card.tsx`, `components/landing/faq.tsx`.
- Implementation notes:
  - PricingSection (Server Component) imports `marketingContent` and renders cards + FAQ inside `<section data-testid="pricing-section">`.
  - PricingCard: Server component using shadcn `Card` + `Button`. Supports optional `badge`, `limitsSummary`, CTA button with `data-analytics-id` + `data-plan`.
  - FAQ component: Client component using Radix `Collapsible` for independent toggles. Data attribute `data-analytics-id` on triggers.
  - Insert `<PricingSection />` in `app/(marketing)/landing/page.tsx` between `WorkflowSection` and `CTASection`.
  - Render FAQ intro/disclaimer under cards.

### 4. Footer refactor
- **File**: `components/layout/footer.tsx`
  - Import `marketingContent.footerLinks`.
  - Render links with `target="_blank"` for Terms/Privacy/GitHub and `rel="noopener noreferrer"` when `opensInNewTab`.
  - Append GitHub link (external) plus dynamic copyright.
  - Add `data-analytics-id` per link.
- **Consumers**: Only marketing layout should render `<Footer />`.

### 5. Billing page deep-link awareness
- **File**: `app/settings/billing/page.tsx`
  - Use `useSearchParams()` to read optional `plan` query param.
  - Highlight card matching `plan`.
  - Show trial banner (e.g., `<Alert>` or inline message) describing 14-day trial before buttons.
  - Optionally scroll card into view on mount when `plan` present.
  - Tests: ensure highlight state toggles and `handleSubscribe` receives correct plan.

### 6. CTA instrumentation & analytics hooks
- Add `data-analytics-id` attributes (from config) to:
  - Plan card container (`pricing.plan.{id}`) and CTA button (`pricing.cta.{id}`).
  - FAQ triggers (`faq.toggle.byok`, `faq.toggle.agents`).
  - Footer links (`footer.link.*`).
- Provide `data-testid` only where RTL assertions need them (e.g., `data-testid="plan-card-pro"`).

### 7. Responsive + accessibility polish
- Reuse container widths from existing sections (`max-w-7xl`, `container mx-auto px-4`).
- Mobile stacking:
  - Cards: `grid grid-cols-1 lg:grid-cols-3`.
  - FAQ + cards spacing: `gap-8`, `space-y-6`.
- Ensure FAQ triggers use `<button>` semantics for keyboard accessibility.

### 8. Tests
- **Component (Vitest + RTL)**:
  - `tests/unit/components/landing/pricing-section.test.tsx`: asserts card order, CTA hrefs, analytics IDs, disclaimers.
  - `tests/unit/components/layout/footer.test.tsx`: ensures Terms/Privacy/GitHub links open in new tabs and analytics attributes exist.
- **Playwright**:
  - New spec `tests/e2e/marketing-pricing.spec.ts` (or extend existing marketing spec if found).
  - Steps: open `/landing` at 360px width, ensure Workflow section is above Pricing, CTA buttons contain correct text, clicking Free CTA keeps user on `/auth/signin`, Paid CTA retains callback param.

## Implementation Order
1. Create marketing content config (`lib/marketing/pricing-content.ts`).
2. Refactor layouts + move legal routes under `(marketing)`.
3. Build footer updates and ensure root layout no longer renders footer globally.
4. Implement PricingSection + subcomponents and wire into landing page.
5. Update billing page to honor `plan` query param and show trial banner.
6. Add instrumentation attributes + disclaimers.
7. Write/extend component tests.
8. Add Playwright smoke test for `/landing`.

## Testing Checkpoints
- **After layout refactor**: Run `bun run lint` to ensure no unused imports from moved files; manually hit `/landing`, `/terms`, `/privacy` to confirm layout works.
- **After pricing components**: `bun run test:unit --filter=pricing-section` (or file-specific command) to validate rendering/instrumentation.
- **After billing deep-link logic**: Add/extend billing page tests if available; manual QA by visiting `/settings/billing?plan=PRO`.
- **End-to-end**: `bun run test:e2e -- --grep \"marketing\"` (add tag to new Playwright spec) to validate CTA flows.

## Files Created

| Path | Purpose |
|------|---------|
| `lib/marketing/pricing-content.ts` | Centralized content + analytics IDs |
| `app/(marketing)/layout.tsx` | Marketing shell with header/footer |
| `components/landing/pricing-section.tsx` | Section orchestrator |
| `components/landing/pricing-card.tsx` | Individual pricing cards |
| `components/landing/faq.tsx` | BYOK/support accordion |
| `tests/unit/components/landing/pricing-section.test.tsx` | Component coverage |
| `tests/e2e/marketing-pricing.spec.ts` | Responsive/CTA smoke test |

## Files Modified

| Path | Change |
|------|--------|
| `app/layout.tsx` | Remove global footer |
| `app/(marketing)/landing/page.tsx` | Insert pricing + FAQ |
| `app/(marketing)/terms/page.tsx` | Update imports + layout wrappers |
| `app/(marketing)/privacy/page.tsx` | Ditto |
| `components/layout/footer.tsx` | Use config data + analytics |
| `app/settings/billing/page.tsx` | Handle `plan` query param + trial message |
| `tests/unit/components/layout/footer.test.tsx` | New assertions for GitHub/legal links |
| `playwright.config.ts` (if needed) | Tag new spec (optional) |

## Commands

```bash
bun run lint
bun run type-check
bun run test:unit --filter=pricing-section
bun run test:unit --filter=footer
bun run test:e2e -- --grep marketing
```
