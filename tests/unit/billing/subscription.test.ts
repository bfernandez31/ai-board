import { describe, it, expect } from 'vitest';
import { getEffectivePlan, getPlanLimits } from '@/lib/billing/subscription';

describe('getEffectivePlan', () => {
  it('should return FREE for canceled subscription', () => {
    expect(getEffectivePlan('PRO', 'CANCELED', null)).toBe('FREE');
    expect(getEffectivePlan('TEAM', 'CANCELED', null)).toBe('FREE');
  });

  it('should return plan for active subscription', () => {
    expect(getEffectivePlan('PRO', 'ACTIVE', null)).toBe('PRO');
    expect(getEffectivePlan('TEAM', 'ACTIVE', null)).toBe('TEAM');
  });

  it('should return plan for trialing subscription', () => {
    expect(getEffectivePlan('PRO', 'TRIALING', null)).toBe('PRO');
  });

  it('should return plan for past_due within grace period', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(getEffectivePlan('PRO', 'PAST_DUE', futureDate)).toBe('PRO');
  });

  it('should return FREE for past_due with expired grace period', () => {
    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    expect(getEffectivePlan('PRO', 'PAST_DUE', pastDate)).toBe('FREE');
  });

  it('should return plan for past_due without grace period', () => {
    expect(getEffectivePlan('PRO', 'PAST_DUE', null)).toBe('PRO');
  });
});

describe('getPlanLimits', () => {
  it('should return correct limits for FREE plan', () => {
    const limits = getPlanLimits('FREE');
    expect(limits.maxProjects).toBe(1);
    expect(limits.maxTicketsPerMonth).toBe(5);
    expect(limits.membersEnabled).toBe(false);
    expect(limits.maxMembersPerProject).toBeNull();
    expect(limits.advancedAnalytics).toBe(false);
  });

  it('should return correct limits for PRO plan', () => {
    const limits = getPlanLimits('PRO');
    expect(limits.maxProjects).toBeNull();
    expect(limits.maxTicketsPerMonth).toBeNull();
    expect(limits.membersEnabled).toBe(false);
    expect(limits.maxMembersPerProject).toBeNull();
  });

  it('should return correct limits for TEAM plan', () => {
    const limits = getPlanLimits('TEAM');
    expect(limits.maxProjects).toBeNull();
    expect(limits.maxTicketsPerMonth).toBeNull();
    expect(limits.membersEnabled).toBe(true);
    expect(limits.maxMembersPerProject).toBe(10);
    expect(limits.advancedAnalytics).toBe(true);
  });
});
