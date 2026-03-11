import type { SubscriptionPlan } from '@prisma/client';

export interface PlanLimits {
  maxProjects: number | null;
  maxTicketsPerMonth: number | null;
  membersEnabled: boolean;
  maxMembersPerProject: number | null;
  advancedAnalytics: boolean;
}

export interface PlanConfig {
  name: string;
  plan: SubscriptionPlan;
  priceMonthly: number;
  stripePriceId: string | null;
  limits: PlanLimits;
  trial: {
    enabled: boolean;
    days: number;
  };
  features: string[];
}

export const PLANS: Record<SubscriptionPlan, PlanConfig> = {
  FREE: {
    name: 'Free',
    plan: 'FREE',
    priceMonthly: 0,
    stripePriceId: null,
    limits: {
      maxProjects: 1,
      maxTicketsPerMonth: 5,
      membersEnabled: false,
      maxMembersPerProject: 0,
      advancedAnalytics: false,
    },
    trial: { enabled: false, days: 0 },
    features: ['1 project', '5 tickets per month', 'BYOK API key required'],
  },
  PRO: {
    name: 'Pro',
    plan: 'PRO',
    priceMonthly: 1500,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
    limits: {
      maxProjects: null,
      maxTicketsPerMonth: null,
      membersEnabled: false,
      maxMembersPerProject: 0,
      advancedAnalytics: false,
    },
    trial: { enabled: true, days: 14 },
    features: ['Unlimited projects', 'Unlimited tickets', '14-day free trial'],
  },
  TEAM: {
    name: 'Team',
    plan: 'TEAM',
    priceMonthly: 3000,
    stripePriceId: process.env.STRIPE_TEAM_PRICE_ID || null,
    limits: {
      maxProjects: null,
      maxTicketsPerMonth: null,
      membersEnabled: true,
      maxMembersPerProject: 10,
      advancedAnalytics: true,
    },
    trial: { enabled: true, days: 14 },
    features: [
      'Everything in Pro',
      'Project members',
      'Advanced analytics',
      '14-day free trial',
    ],
  },
};

export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}

export function getPlanConfig(plan: SubscriptionPlan): PlanConfig {
  return PLANS[plan];
}
