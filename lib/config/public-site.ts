export interface PublicPlanSummary {
  readonly name: 'Free' | 'Pro' | 'Team';
  readonly tagline: string;
  readonly capabilities: readonly string[];
  readonly ctaLabel: string;
  ctaHref: '/auth/signin';
  readonly highlighted?: boolean;
}

export interface PublicPricingFaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface PublicFooterLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

export const PUBLIC_SIGNIN_HREF = '/auth/signin' as const;

export const PUBLIC_PLAN_SUMMARIES: PublicPlanSummary[] = [
  {
    name: 'Free',
    tagline: 'For solo builders validating the workflow.',
    capabilities: ['1 project', '5 tickets per month', 'BYOK API key required'],
    ctaLabel: 'Get Started',
    ctaHref: PUBLIC_SIGNIN_HREF,
  },
  {
    name: 'Pro',
    tagline: 'For individuals shipping AI-assisted work every week.',
    capabilities: ['Unlimited projects', 'Unlimited tickets', '14-day free trial'],
    ctaLabel: 'Start 14-day trial',
    ctaHref: PUBLIC_SIGNIN_HREF,
    highlighted: true,
  },
  {
    name: 'Team',
    tagline: 'For teams coordinating delivery across projects.',
    capabilities: [
      'Everything in Pro',
      'Project members',
      'Advanced analytics',
      '14-day free trial',
    ],
    ctaLabel: 'Start 14-day trial',
    ctaHref: PUBLIC_SIGNIN_HREF,
  },
];

export const PUBLIC_PRICING_FAQ_ITEMS: PublicPricingFaqItem[] = [
  {
    question: 'Do I bring my own model keys?',
    answer:
      'Yes. AI Board supports a BYOK setup so you can connect your own provider credentials and control usage directly.',
  },
  {
    question: 'Which agents are supported?',
    answer:
      'You can run your workflow with Claude Code, Codex, and Gemini-based agents, with room to add more as your process evolves.',
  },
];

export const PUBLIC_FOOTER_LINKS: PublicFooterLink[] = [
  {
    label: 'Terms of Service',
    href: '/legal/terms',
  },
  {
    label: 'Privacy Policy',
    href: '/legal/privacy',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/bfernandez31/ai-board',
    external: true,
  },
];
