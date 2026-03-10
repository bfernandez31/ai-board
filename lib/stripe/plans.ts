import type { SubscriptionPlan } from '@prisma/client';

export interface PlanConfig {
  name: string;
  plan: SubscriptionPlan;
  price: number;
  priceId: string | null;
  features: string[];
  limits: {
    maxProjects: number;
    maxTicketsPerMonth: number;
    membersAllowed: boolean;
    advancedAnalytics: boolean;
    byokRequired: boolean;
  };
  trialDays: number;
}

export const PLANS: Record<SubscriptionPlan, PlanConfig> = {
  FREE: {
    name: 'Free',
    plan: 'FREE',
    price: 0,
    priceId: null,
    features: [
      '1 project',
      '5 tickets/month',
      'Bring your own API key (required)',
    ],
    limits: {
      maxProjects: 1,
      maxTicketsPerMonth: 5,
      membersAllowed: false,
      advancedAnalytics: false,
      byokRequired: true,
    },
    trialDays: 0,
  },
  PRO: {
    name: 'Pro',
    plan: 'PRO',
    price: 15,
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    features: [
      'Unlimited projects',
      'Unlimited tickets',
      'Bring your own API key',
    ],
    limits: {
      maxProjects: Infinity,
      maxTicketsPerMonth: Infinity,
      membersAllowed: false,
      advancedAnalytics: false,
      byokRequired: true,
    },
    trialDays: 14,
  },
  TEAM: {
    name: 'Team',
    plan: 'TEAM',
    price: 30,
    priceId: process.env.STRIPE_TEAM_PRICE_ID || '',
    features: [
      'Everything in Pro',
      'Add team members',
      'Advanced analytics',
    ],
    limits: {
      maxProjects: Infinity,
      maxTicketsPerMonth: Infinity,
      membersAllowed: true,
      advancedAnalytics: true,
      byokRequired: true,
    },
    trialDays: 14,
  },
};

/**
 * Get plan config from a Stripe price ID
 */
export function getPlanFromPriceId(priceId: string): SubscriptionPlan {
  if (!priceId) return 'FREE';
  for (const [plan, config] of Object.entries(PLANS)) {
    if (config.priceId && config.priceId === priceId) {
      return plan as SubscriptionPlan;
    }
  }
  return 'FREE';
}
