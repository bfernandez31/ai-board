# Data Model: AIB-252 Add Pricing Section

## No Database Changes Required

This feature is entirely frontend. No new entities, fields, or migrations are needed.

## Existing Entities Referenced (Read-Only)

### Plan Definitions (from `lib/billing/plans.ts`)

| Plan | Price (cents) | Price Display | Trial Days |
|------|--------------|---------------|------------|
| FREE | 0 | $0/month | 0 |
| PRO | 1500 | $15/month | 14 |
| TEAM | 3000 | $30/month | 14 |

### Feature Lists for Landing Page Display

These are marketing-friendly descriptions derived from PlanLimits:

**Free**:
- 1 project
- 5 tickets per month
- BYOK API key required
- Community support

**Pro** (Most Popular):
- Unlimited projects
- Unlimited tickets
- 14-day free trial
- Priority support

**Team**:
- Everything in Pro
- Up to 10 project members
- Advanced analytics
- 14-day free trial

### FAQ Content (Static)

| Question | Answer Summary |
|----------|---------------|
| What is BYOK? | Bring Your Own Key — Free plan users provide their own API key for AI agents. Paid plans include managed API access. |
| Which AI agents are supported? | Claude (Anthropic) via Claude Code for automated development workflows. |

## TypeScript Interfaces (New)

```typescript
// Landing page pricing card data (static, not from API)
interface LandingPlanCard {
  name: string;           // "Free", "Pro", "Team"
  price: string;          // "$0", "$15", "$30"
  period: string;         // "/month"
  features: string[];     // Marketing feature list
  cta: string;            // Button text
  ctaHref: string;        // Navigation target
  popular?: boolean;      // Visual highlight
}

// FAQ item data
interface FAQItem {
  question: string;
  answer: string;
}
```

## State Transitions

N/A — This feature has no state management. All data is static and rendered server-side.

## Validation Rules

N/A — No user input is collected by this feature.
