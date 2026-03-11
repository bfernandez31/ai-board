# Data Model: Add pricing section to landing page & footer

**Feature**: AIB-270 Add pricing section to landing page & footer  
**Date**: 2026-03-11

## Entity Overview

### MarketingContent (New, static config)

Single source of truth for public marketing copy. Lives in `lib/marketing/pricing-content.ts` and is imported by landing + footer components.

```typescript
export interface MarketingContent {
  plans: PricingPlanContent[];
  faq: FAQEntry[];
  footerLinks: FooterLink[];
  faqIntro: string;
  disclaimer: string;
  lastUpdated: string; // ISO date for marketing review
}
```

### PricingPlanContent (New)

Represents each pricing card (Free, Pro, Team).

```typescript
export type PlanId = 'free' | 'pro' | 'team';

export interface PricingPlanContent {
  id: PlanId;
  name: string;
  badge?: {
    label: string;
    tone: 'primary' | 'accent';
  };
  pricePerMonth: number; // USD numeric value (0, 49, 149)
  priceDisplay: string;  // e.g., '$49/mo'
  description: string;
  featureBullets: PlanFeature[];
  limitsSummary: string;
  cta: PlanCTA;
  analyticsId: string; // e.g., 'pricing.plan.pro'
}
```

`PlanFeature` describes bullet rows; includes optional scope label for tooltips.

```typescript
export interface PlanFeature {
  label: string;
  description?: string;
  availability: 'included' | 'limited' | 'exclusive';
}
```

`PlanCTA` captures link metadata, analytics hook, and plan pre-selection info.

```typescript
export interface PlanCTA {
  label: string;              // 'Get Started' or 'Start 14-day trial'
  href: string;               // Derived from auth/billing flows
  style: 'primary' | 'secondary';
  planKey?: 'PRO' | 'TEAM';   // Billing plan enum for paid tiers
  trialLengthDays?: number;   // 14 for Pro/Team
  analyticsId: string;        // 'pricing.cta.pro'
}
```

### FAQEntry (New)

Two-item FAQ per spec.

```typescript
export interface FAQEntry {
  id: string;                // 'faq-byok'
  question: string;
  answer: string;
  defaultExpanded: boolean;
  analyticsId: string;       // 'faq.toggle.byok'
}
```

### FooterLink (Extended)

Centralized config for footer items (Terms, Privacy, GitHub). Supports internal/external routing and analytics.

```typescript
export interface FooterLink {
  id: string;                       // 'footer.terms'
  label: string;                    // 'Terms of Service'
  href: string;                     // '/terms' or 'https://github.com/ai-board/ai-board'
  kind: 'internal' | 'external';
  opensInNewTab: boolean;
  ariaLabel?: string;
  analyticsId: string;
}
```

## Field Specifications

| Entity.Field | Type | Constraints | Notes |
|--------------|------|-------------|-------|
| `MarketingContent.plans` | `PricingPlanContent[]` | Exactly 3 entries | Order: Free → Pro → Team; used to render cards sequentially |
| `MarketingContent.faq` | `FAQEntry[]` | Exactly 2 entries | BYOK first, Supported Agents second |
| `MarketingContent.footerLinks` | `FooterLink[]` | ≥3 entries | Must include Terms, Privacy, GitHub |
| `MarketingContent.faqIntro` | string | ≤140 chars | Short copy under cards |
| `PricingPlanContent.id` | `'free'|'pro'|'team'` | Unique | Drives CSS data attributes + instrumentation |
| `PricingPlanContent.pricePerMonth` | number | Positive integer except Free | Represented in USD |
| `PricingPlanContent.featureBullets` | `PlanFeature[]` | ≥4 features per plan | FR-003 requirement |
| `PlanFeature.availability` | enum | Only `'included'`, `'limited'`, `'exclusive'` | Used for icon color (success/amber/purple) |
| `PlanCTA.href` | string | Absolute or root-relative URL | Paid plans append `?callbackUrl=/settings/billing?plan=PRO` |
| `PlanCTA.analyticsId` | string | kebab-case, ≤40 chars | Consumed by analytics SDK |
| `FAQEntry.answer` | string | Markdown-compatible text | Allows inline emphasis without HTML |
| `FooterLink.opensInNewTab` | boolean | True for external GitHub + legal if spec requires new tab | Terms/Privacy open `target="_blank"` even though internal |

## Validation Rules

- **Plan CTA**: If `planKey` exists, `trialLengthDays` must be provided and ≥14. Free plan omits both.
- **Feature Bullets**: Last bullet on Free plan must mention community/shared agents to satisfy FR-003 messaging.
- **Analytics IDs**: Format `section.element.action` (e.g., `pricing.plan.team`, `faq.toggle.agents`, `footer.link.github`). Enforce via regex `/^[a-z0-9]+(\.[a-z0-9-]+)*$/`.
- **Footer Links**: `kind === 'external'` implies `opensInNewTab = true` and `rel="noopener noreferrer"` at render time.
- **FAQ Expansion**: Only BYOK entry defaults to expanded to keep spec’s emphasis on enterprise readiness.

## Relationships

```
MarketingContent
├─ plans[] --------► PricingPlanContent ──┬─ featureBullets[] ► PlanFeature
│                                         └─ cta ► PlanCTA
├─ faq[] ----------► FAQEntry
└─ footerLinks[] --► FooterLink
```

All relationships are in-memory; there is no database persistence. Updates require editing the config file and re-deploying.

## TypeScript Types

```typescript
export const marketingContent: MarketingContent = {
  plans: [
    {
      id: 'free',
      name: 'Free',
      pricePerMonth: 0,
      priceDisplay: 'Free',
      description: 'Kick off with a single AI project.',
      featureBullets: [
        { label: '1 project', availability: 'included' },
        { label: '10 open tickets/month', availability: 'included' },
        { label: 'Community support', availability: 'limited' },
        { label: 'Shared agents', availability: 'limited' },
      ],
      limitsSummary: '1 project · 10 tickets/mo · shared agents',
      cta: {
        label: 'Get Started',
        href: '/auth/signin',
        style: 'secondary',
        analyticsId: 'pricing.cta.free',
      },
      analyticsId: 'pricing.plan.free',
    },
    // Pro + Team (include badge, trialLengthDays, planKey)
  ],
  faq: [
    {
      id: 'faq-byok',
      question: 'Can I bring my own model (BYOK)?',
      answer: 'BYOK is included on Pro (1 connector) and Team (full coverage). Connect keys via workspace settings.',
      defaultExpanded: true,
      analyticsId: 'faq.toggle.byok',
    },
    {
      id: 'faq-agents',
      question: 'Which AI agents are supported?',
      answer: 'Claude, GPT-4 class, and Gemini Advanced today with quarterly updates.',
      defaultExpanded: false,
      analyticsId: 'faq.toggle.agents',
    },
  ],
  footerLinks: [
    {
      id: 'footer.terms',
      label: 'Terms of Service',
      href: '/terms',
      kind: 'internal',
      opensInNewTab: true,
      analyticsId: 'footer.link.terms',
    },
    {
      id: 'footer.privacy',
      label: 'Privacy Policy',
      href: '/privacy',
      kind: 'internal',
      opensInNewTab: true,
      analyticsId: 'footer.link.privacy',
    },
    {
      id: 'footer.github',
      label: 'GitHub',
      href: 'https://github.com/ai-board/ai-board',
      kind: 'external',
      opensInNewTab: true,
      analyticsId: 'footer.link.github',
    },
  ],
  faqIntro: 'Questions about BYOK or supported agents?',
  disclaimer: 'Pricing in USD — regional taxes shown at checkout.',
  lastUpdated: '2026-03-11',
};
```

## State Transitions

Marketing content is static, but workflow includes:
1. **Update**: Marketing edits config file (code review required).
2. **Deploy**: Next.js rebuild includes updated copy.
3. **Runtime**: Server Components read config and render pricing + footer; there is no mutable runtime state.

## Testing Implications

- Serialize `marketingContent` in tests to assert plan order and CTA hrefs without stubbing network calls.
- Snapshot tests should pin `analyticsId` values to catch accidental renames.
- Footer tests should iterate through `footerLinks` to ensure new additions auto-render without manual component edits.
