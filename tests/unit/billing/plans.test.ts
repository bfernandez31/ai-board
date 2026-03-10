import { describe, it, expect } from 'vitest';
import { PLANS, getPlanConfig, getPlanByPriceId } from '@/lib/billing/plans';

describe('Plan Configuration', () => {
  it('should define three plans', () => {
    expect(Object.keys(PLANS)).toEqual(['FREE', 'PRO', 'TEAM']);
  });

  it('should have correct Free plan limits', () => {
    const free = PLANS.FREE;
    expect(free.name).toBe('Free');
    expect(free.priceMonthly).toBe(0);
    expect(free.stripePriceId).toBeNull();
    expect(free.limits.maxProjects).toBe(1);
    expect(free.limits.maxTicketsPerMonth).toBe(5);
    expect(free.limits.membersEnabled).toBe(false);
    expect(free.limits.advancedAnalytics).toBe(false);
    expect(free.trial.enabled).toBe(false);
  });

  it('should have correct Pro plan limits', () => {
    const pro = PLANS.PRO;
    expect(pro.name).toBe('Pro');
    expect(pro.priceMonthly).toBe(1500);
    expect(pro.limits.maxProjects).toBeNull();
    expect(pro.limits.maxTicketsPerMonth).toBeNull();
    expect(pro.limits.membersEnabled).toBe(false);
    expect(pro.limits.advancedAnalytics).toBe(false);
    expect(pro.trial.enabled).toBe(true);
    expect(pro.trial.days).toBe(14);
  });

  it('should have correct Team plan limits', () => {
    const team = PLANS.TEAM;
    expect(team.name).toBe('Team');
    expect(team.priceMonthly).toBe(3000);
    expect(team.limits.maxProjects).toBeNull();
    expect(team.limits.maxTicketsPerMonth).toBeNull();
    expect(team.limits.membersEnabled).toBe(true);
    expect(team.limits.advancedAnalytics).toBe(true);
    expect(team.trial.enabled).toBe(true);
    expect(team.trial.days).toBe(14);
  });

  it('should have features for each plan', () => {
    expect(PLANS.FREE.features.length).toBeGreaterThan(0);
    expect(PLANS.PRO.features.length).toBeGreaterThan(0);
    expect(PLANS.TEAM.features.length).toBeGreaterThan(0);
  });

  describe('getPlanConfig', () => {
    it('should return config for valid plans', () => {
      expect(getPlanConfig('FREE')).toBe(PLANS.FREE);
      expect(getPlanConfig('PRO')).toBe(PLANS.PRO);
      expect(getPlanConfig('TEAM')).toBe(PLANS.TEAM);
    });
  });

  describe('getPlanByPriceId', () => {
    it('should return undefined for null price ID', () => {
      expect(getPlanByPriceId('nonexistent')).toBeUndefined();
    });
  });
});
