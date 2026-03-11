export type PlanId = 'free' | 'pro' | 'team';

export interface PlanFeature {
  label: string;
  description?: string;
  availability: 'included' | 'limited' | 'exclusive';
}

export interface PlanCTA {
  label: string;
  href: string;
  style: 'primary' | 'secondary';
  planKey?: 'PRO' | 'TEAM';
  trialLengthDays?: number;
  analyticsId: string;
}

export interface PricingPlanContent {
  id: PlanId;
  name: string;
  badge?: {
    label: string;
    tone: 'primary' | 'accent';
  };
  pricePerMonth: number;
  priceDisplay: string;
  description: string;
  featureBullets: PlanFeature[];
  limitsSummary: string;
  cta: PlanCTA;
  analyticsId: string;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  defaultExpanded: boolean;
  analyticsId: string;
}

export interface FooterLink {
  id: string;
  label: string;
  href: string;
  kind: 'internal' | 'external';
  opensInNewTab: boolean;
  ariaLabel?: string;
  analyticsId: string;
}

export interface MarketingContent {
  plans: PricingPlanContent[];
  faq: FAQEntry[];
  footerLinks: FooterLink[];
  faqIntro: string;
  disclaimer: string;
  lastUpdated: string;
}

export const marketingContent: MarketingContent = {
  plans: [
    {
      id: 'free',
      name: 'Free',
      pricePerMonth: 0,
      priceDisplay: 'Free',
      description: 'Kick off your first AI project with community-backed workflows.',
      featureBullets: [
        { label: '1 active project', availability: 'included' },
        { label: '10 open tickets/month', availability: 'included' },
        { label: 'Community support', availability: 'limited' },
        { label: 'Shared AI agents', availability: 'limited' },
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
    {
      id: 'pro',
      name: 'Pro',
      badge: {
        label: 'Most popular',
        tone: 'primary',
      },
      pricePerMonth: 49,
      priceDisplay: '$49/mo',
      description: 'Upgrade to BYOK, higher limits, and live priority support.',
      featureBullets: [
        { label: '5 active projects', availability: 'included' },
        { label: '50 open tickets/month', availability: 'included' },
        { label: '10 members included', availability: 'included' },
        { label: 'Priority support SLA', availability: 'included' },
        { label: 'BYOK connectors (1 provider)', availability: 'limited' },
      ],
      limitsSummary: '5 projects · 50 tickets/mo · priority support',
      cta: {
        label: 'Start 14-day trial',
        href: '/auth/signin?callbackUrl=/settings/billing?plan=PRO',
        style: 'primary',
        planKey: 'PRO',
        trialLengthDays: 14,
        analyticsId: 'pricing.cta.pro',
      },
      analyticsId: 'pricing.plan.pro',
    },
    {
      id: 'team',
      name: 'Team',
      badge: {
        label: 'Best value',
        tone: 'accent',
      },
      pricePerMonth: 149,
      priceDisplay: '$149/mo',
      description: 'Scale automation across teams with dedicated success.',
      featureBullets: [
        { label: 'Unlimited projects', availability: 'included' },
        { label: '200 open tickets/month', availability: 'included' },
        { label: '25 members included', availability: 'included' },
        { label: 'Dedicated success manager', availability: 'exclusive' },
        { label: 'Full BYOK coverage', availability: 'exclusive' },
        { label: 'Advanced audit logs', availability: 'exclusive' },
      ],
      limitsSummary: 'Unlimited projects · 200 tickets/mo · dedicated success',
      cta: {
        label: 'Start 14-day trial',
        href: '/auth/signin?callbackUrl=/settings/billing?plan=TEAM',
        style: 'primary',
        planKey: 'TEAM',
        trialLengthDays: 14,
        analyticsId: 'pricing.cta.team',
      },
      analyticsId: 'pricing.plan.team',
    },
  ],
  faq: [
    {
      id: 'faq-byok',
      question: 'Can I bring my own model (BYOK)?',
      answer:
        'Absolutely. Pro unlocks a single BYOK connector while Team includes full coverage for every supported provider. Drop your keys in workspace settings to start routing jobs immediately.',
      defaultExpanded: true,
      analyticsId: 'faq.toggle.byok',
    },
    {
      id: 'faq-agents',
      question: 'Which AI agents are supported?',
      answer:
        'AI-Board ships with Claude, GPT-4 class, and Gemini Advanced agents out of the box. We add new foundation models quarterly—your plan automatically gains access as soon as each rollout completes.',
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
      ariaLabel: 'Open the AI-Board GitHub repository in a new tab',
    },
  ],
  faqIntro: 'Questions about BYOK or supported agents?',
  disclaimer: 'Pricing in USD — regional taxes shown at checkout.',
  lastUpdated: '2026-03-11',
};
