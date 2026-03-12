import { describe, expect, it } from 'vitest';
import {
  LANDING_PRICING_ANCHOR_HREF,
  LANDING_PRICING_FAQS,
  LANDING_PRICING_PLANS,
} from '@/lib/landing/pricing';

describe('landing pricing content', () => {
  it('maps plans in Free, Pro, Team order', () => {
    expect(LANDING_PRICING_PLANS.map((plan) => plan.name)).toEqual(['Free', 'Pro', 'Team']);
  });

  it('maps plan CTA labels to the expected journey copy', () => {
    expect(LANDING_PRICING_PLANS.map((plan) => plan.ctaLabel)).toEqual([
      'Get Started',
      'Start 14-day trial',
      'Start 14-day trial',
    ]);
  });

  it('exposes exactly two FAQ entries for BYOK and supported agents', () => {
    expect(LANDING_PRICING_FAQS).toHaveLength(2);
    expect(LANDING_PRICING_FAQS.map((entry) => entry.topic)).toEqual([
      'BYOK',
      'SUPPORTED_AGENTS',
    ]);
  });

  it('uses the shared pricing anchor metadata', () => {
    expect(LANDING_PRICING_ANCHOR_HREF).toBe('#pricing');
    expect(LANDING_PRICING_PLANS.every((plan) => plan.ctaHref === '/auth/signin')).toBe(true);
  });
});
