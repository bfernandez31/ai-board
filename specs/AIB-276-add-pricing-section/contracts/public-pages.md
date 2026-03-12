# Public Page Contracts: Add Pricing Section to Landing Page and Public Footer

## Scope

This feature does not introduce API endpoints. The contracts below describe the required rendered content for existing public page routes.

## Route: `GET /`

### Purpose

Render the unauthenticated marketing landing page with the new pricing section inserted between the workflow and final CTA sections.

### Required Rendered Content

| Requirement | Contract |
|-------------|----------|
| Placement | Pricing section appears after workflow content and before the final CTA section |
| Plans | Exactly three plans named `Free`, `Pro`, and `Team` |
| CTA labels | `Free` card shows `Get Started`; `Pro` and `Team` show `Start 14-day trial` |
| FAQ | Section below pricing cards includes answers about BYOK and supported agents |
| Responsiveness | Markup supports stacked cards on smaller screens and multi-column layout on larger screens |

### Content Contract

```ts
interface LandingPricingContract {
  plans: [
    { name: 'Free'; ctaLabel: 'Get Started'; ctaHref: '/auth/signin' },
    { name: 'Pro'; ctaLabel: 'Start 14-day trial'; ctaHref: '/auth/signin' },
    { name: 'Team'; ctaLabel: 'Start 14-day trial'; ctaHref: '/auth/signin' },
  ];
  faqTopics: ['BYOK', 'Supported agents'];
}
```

## Route: `GET /legal/terms`

### Purpose

Continue rendering the existing Terms of Service page with the shared footer visible below the content.

### Required Footer Content

| Link | Destination |
|------|-------------|
| Terms of Service | `/legal/terms` |
| Privacy Policy | `/legal/privacy` |
| GitHub repository | External GitHub URL from public-site config |

## Route: `GET /legal/privacy`

### Purpose

Continue rendering the existing Privacy Policy page with the shared footer visible below the content.

### Required Footer Content

| Link | Destination |
|------|-------------|
| Terms of Service | `/legal/terms` |
| Privacy Policy | `/legal/privacy` |
| GitHub repository | External GitHub URL from public-site config |

## Non-Goals

- No checkout, billing portal, or subscription mutation endpoints
- No new standalone pricing page
- No authenticated plan-selection behavior
