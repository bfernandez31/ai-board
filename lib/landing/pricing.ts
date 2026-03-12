import type { SubscriptionPlan } from '@prisma/client';
import { PLANS } from '@/lib/billing/plans';

export const LANDING_PRICING_SECTION_ID = 'pricing';
export const LANDING_PRICING_ANCHOR_HREF = '#pricing';

export interface LandingPricingPlan {
  plan: SubscriptionPlan;
  name: string;
  priceMonthly: number;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  emphasis: 'default' | 'featured';
}

export interface LandingPricingFaqEntry {
  id: string;
  question: string;
  answer: string;
  topic: 'BYOK' | 'SUPPORTED_AGENTS';
}

const PLAN_ORDER: SubscriptionPlan[] = ['FREE', 'PRO', 'TEAM'];

export const LANDING_PRICING_PLANS: LandingPricingPlan[] = PLAN_ORDER.map((plan) => {
  const config = PLANS[plan];

  return {
    plan,
    name: config.name,
    priceMonthly: config.priceMonthly,
    features: config.features,
    ctaLabel: plan === 'FREE' ? 'Get Started' : 'Start 14-day trial',
    ctaHref: '/auth/signin',
    emphasis: plan === 'PRO' ? 'featured' : 'default',
  };
});

export const LANDING_PRICING_FAQS: LandingPricingFaqEntry[] = [
  {
    id: 'byok',
    topic: 'BYOK',
    question: 'Do I need to bring my own model API key?',
    answer: 'Free includes BYOK access, while paid plans remove that setup friction so teams can start faster.',
  },
  {
    id: 'supported-agents',
    topic: 'SUPPORTED_AGENTS',
    question: 'Which coding agents can I use with AI Board?',
    answer: 'AI Board supports Claude and Codex workflows so you can run the same ticket pipeline with the agent that fits your team.',
  },
];
