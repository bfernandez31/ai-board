# Quickstart: Add Pricing Section to Landing Page and Public Footer

## Implementation Order

### Step 1: Add typed public-site config

Create `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts` with:

- three plan definitions: `Free`, `Pro`, `Team`
- CTA labels and `/auth/signin` destinations
- two FAQ entries covering BYOK and supported agents
- footer links including Terms, Privacy, and the GitHub repository URL

Keep the module static and fully typed.

### Step 2: Build landing pricing components

Create these components under `/home/runner/work/ai-board/ai-board/target/components/landing/`:

- `pricing-section.tsx`
- `pricing-card.tsx`
- `pricing-faq.tsx`

Use shadcn/ui `Card` and `Button` primitives, preserve the existing dark landing visual language, and ensure cards stack cleanly on mobile.

### Step 3: Insert the pricing section into the landing page

Modify `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx` to render `<PricingSection />` after `<WorkflowSection />` and before `<CTASection />`.

### Step 4: Extend the shared footer

Modify `/home/runner/work/ai-board/ai-board/target/components/layout/footer.tsx` to read footer links from the shared config and add the GitHub repository link with proper external-link attributes.

### Step 5: Update tests

Prefer extending existing suites before creating new ones:

- modify `/home/runner/work/ai-board/ai-board/target/tests/unit/components/footer.test.tsx`
- create or extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx`
- create `/home/runner/work/ai-board/ai-board/target/tests/integration/landing/public-marketing.test.ts`
- modify `/home/runner/work/ai-board/ai-board/target/tests/integration/legal/pages.test.ts`

### Step 6: Validate

Run:

```bash
bun run test:unit
bun run test:integration
bun run type-check
bun run lint
```

## Expected File Changes

| File | Action | Notes |
|------|--------|-------|
| `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts` | CREATE | Shared static content |
| `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx` | CREATE | Pricing section container |
| `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx` | CREATE | Individual plan card |
| `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-faq.tsx` | CREATE | FAQ block |
| `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx` | MODIFY | Insert pricing section |
| `/home/runner/work/ai-board/ai-board/target/components/layout/footer.tsx` | MODIFY | Add GitHub link and config usage |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/footer.test.tsx` | MODIFY | Add repository link assertion |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx` | CREATE/EXTEND | Verify plan names, CTA labels, FAQ |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/landing/public-marketing.test.ts` | CREATE | Verify rendered landing HTML |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/legal/pages.test.ts` | MODIFY | Verify footer repository link on legal pages |

## Acceptance Mapping

- FR-001 to FR-006: handled by `PricingSection` insertion and content config
- FR-007 to FR-009: handled by shared footer config and footer test updates
- FR-010 to FR-011: handled by Tailwind layout choices and landing/footer component tests
