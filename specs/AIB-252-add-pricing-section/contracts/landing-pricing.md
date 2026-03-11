# Contracts: Landing Page Pricing Section

## No API Endpoints Required

This feature is entirely client-rendered with static data. No new API routes are needed.

## Component Contracts

### 1. PricingSection

**File**: `components/landing/pricing-section.tsx`
**Type**: Server Component
**Props**: None

**Renders**:
- Section wrapper with `id="pricing"` for anchor navigation
- Section title: "Simple, Transparent Pricing"
- Section subtitle: "Choose the plan that fits your team"
- 3x PricingCard components in a responsive grid
- FAQSection below the cards

**Layout**:
- Desktop: 3-column grid (`md:grid-cols-3`)
- Mobile: Single column stack
- Max width: `max-w-7xl` (consistent with other sections)

---

### 2. PricingCard

**File**: Inline within `pricing-section.tsx` (or extracted if complex)
**Type**: Server Component
**Props**:
```typescript
{
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  ctaHref: string;
  popular?: boolean;
}
```

**Renders**:
- Card with plan name, price, feature list with check icons, CTA button
- If `popular === true`: "Most Popular" badge, highlighted border (`border-[#8B5CF6]`)
- CTA button links to `/auth/signin`

**Styling**: Dark theme cards matching existing Catppuccin Mocha palette:
- Card bg: `#181825` (mantle)
- Card border: `#313244` (surface-0), highlighted: `#8B5CF6`
- Text: `hsl(var(--ctp-text))` and `hsl(var(--ctp-subtext-0))`

---

### 3. FAQSection

**File**: Inline within `pricing-section.tsx` or `components/landing/faq-section.tsx`
**Type**: Client Component (`'use client'` — needed for Collapsible interaction)
**Props**: None (static FAQ data)

**Renders**:
- "Frequently Asked Questions" heading
- List of collapsible FAQ items using `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
- ChevronDown icon that rotates on expand

**FAQ Items**:
1. "What does BYOK (Bring Your Own Key) mean?"
2. "Which AI agents and models are supported?"

---

### 4. Footer Enhancement

**File**: `components/layout/footer.tsx` (existing, modified)
**Change**: Add GitHub repository link to existing `<nav>` element

**New Link**:
```tsx
<a
  href="https://github.com/bfernandez31/ai-board"
  target="_blank"
  rel="noopener noreferrer"
  className="text-sm text-[hsl(var(--ctp-subtext-0))] hover:text-[#8B5CF6] transition-colors"
>
  GitHub
</a>
```

---

### 5. Header Navigation Update

**File**: `components/layout/header.tsx` (existing, modified)
**Change**: Add "Pricing" anchor link to marketing variant navigation

**New Link**: `<Link href="#pricing">Pricing</Link>` — same pattern as existing "Features" and "Workflow" links.

---

### 6. Landing Page Integration

**File**: `app/landing/page.tsx` (existing, modified)
**Change**: Import and render `PricingSection` between `WorkflowSection` and `CTASection`

```tsx
<HeroSection />
<FeaturesGrid />
<WorkflowSection />
<PricingSection />   {/* NEW */}
<CTASection />
```
