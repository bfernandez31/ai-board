# Quickstart: AIB-252 Add Pricing Section

## Implementation Order

1. **Create `PricingSection` component** (`components/landing/pricing-section.tsx`)
   - Static plan data array (Free, Pro, Team)
   - Responsive 3-column grid of plan cards
   - Check icon feature lists using lucide-react `Check`
   - Pro plan "Most Popular" badge with highlighted border
   - CTA buttons linking to `/auth/signin`
   - Uses shadcn/ui `Card`, `Button` components
   - Dark theme styling with Catppuccin Mocha colors

2. **Create FAQ subsection** (within pricing-section or separate `faq-section.tsx`)
   - Client component (needs Collapsible interaction)
   - Uses existing `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `components/ui/collapsible.tsx`
   - 2 FAQ items: BYOK explanation, supported agents
   - ChevronDown icon rotation on expand

3. **Update landing page** (`app/landing/page.tsx`)
   - Import `PricingSection`
   - Insert between `WorkflowSection` and `CTASection`

4. **Enhance footer** (`components/layout/footer.tsx`)
   - Add GitHub repository link with `target="_blank"` and `rel="noopener noreferrer"`

5. **Update header** (`components/layout/header.tsx`)
   - Add "Pricing" anchor link to marketing navigation

6. **Update header mobile menu** (`components/layout/mobile-menu.tsx`)
   - Add "Pricing" link if marketing links are duplicated in mobile menu

7. **Write tests**
   - Component test for PricingSection (renders 3 cards, correct prices, CTAs)
   - Component test for FAQ (expand/collapse behavior)
   - Update existing footer test (verify GitHub link)
   - Integration test not needed (no API calls)
   - E2E test not needed (no browser-required features like drag-drop or auth)

## Key Files

| File | Action |
|------|--------|
| `components/landing/pricing-section.tsx` | CREATE |
| `app/landing/page.tsx` | MODIFY (add PricingSection) |
| `components/layout/footer.tsx` | MODIFY (add GitHub link) |
| `components/layout/header.tsx` | MODIFY (add Pricing nav link) |
| `components/layout/mobile-menu.tsx` | MODIFY (add Pricing link if applicable) |
| `tests/unit/components/pricing-section.test.tsx` | CREATE |
| `tests/unit/components/footer.test.tsx` | MODIFY (add GitHub link test) |

## Dependencies

- No new packages required
- Uses existing: `@radix-ui/react-collapsible`, shadcn/ui Card/Button, lucide-react Check/ChevronDown
- No database changes
- No API changes
