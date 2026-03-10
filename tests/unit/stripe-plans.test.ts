/**
 * Unit Test: Stripe Plans Configuration
 *
 * Tests the plan configuration, pricing, and limits.
 */

import { describe, it, expect } from 'vitest';
import { PLANS, getPlanFromPriceId } from '@/lib/stripe/plans';

describe('Stripe Plans', () => {
  describe('PLANS configuration', () => {
    it('should define FREE, PRO, and TEAM plans', () => {
      expect(PLANS).toHaveProperty('FREE');
      expect(PLANS).toHaveProperty('PRO');
      expect(PLANS).toHaveProperty('TEAM');
    });

    it('should have correct FREE plan config', () => {
      const free = PLANS.FREE;
      expect(free.name).toBe('Free');
      expect(free.price).toBe(0);
      expect(free.priceId).toBeNull();
      expect(free.limits.maxProjects).toBe(1);
      expect(free.limits.maxTicketsPerMonth).toBe(5);
      expect(free.limits.membersAllowed).toBe(false);
      expect(free.limits.advancedAnalytics).toBe(false);
      expect(free.trialDays).toBe(0);
    });

    it('should have correct PRO plan config', () => {
      const pro = PLANS.PRO;
      expect(pro.name).toBe('Pro');
      expect(pro.price).toBe(15);
      expect(pro.limits.maxProjects).toBe(Infinity);
      expect(pro.limits.maxTicketsPerMonth).toBe(Infinity);
      expect(pro.limits.membersAllowed).toBe(false);
      expect(pro.trialDays).toBe(14);
    });

    it('should have correct TEAM plan config', () => {
      const team = PLANS.TEAM;
      expect(team.name).toBe('Team');
      expect(team.price).toBe(30);
      expect(team.limits.maxProjects).toBe(Infinity);
      expect(team.limits.maxTicketsPerMonth).toBe(Infinity);
      expect(team.limits.membersAllowed).toBe(true);
      expect(team.limits.advancedAnalytics).toBe(true);
      expect(team.trialDays).toBe(14);
    });

    it('should have features listed for each plan', () => {
      for (const plan of Object.values(PLANS)) {
        expect(plan.features.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getPlanFromPriceId', () => {
    it('should return FREE for unknown price IDs', () => {
      expect(getPlanFromPriceId('price_unknown')).toBe('FREE');
    });

    it('should return FREE for empty string', () => {
      expect(getPlanFromPriceId('')).toBe('FREE');
    });

    it('should match PRO plan when price ID matches', () => {
      const proPriceId = PLANS.PRO.priceId;
      if (proPriceId) {
        expect(getPlanFromPriceId(proPriceId)).toBe('PRO');
      }
    });

    it('should match TEAM plan when price ID matches', () => {
      const teamPriceId = PLANS.TEAM.priceId;
      if (teamPriceId) {
        expect(getPlanFromPriceId(teamPriceId)).toBe('TEAM');
      }
    });
  });
});
