import { describe, it, expect } from 'vitest';
import { isAutoModeEligible } from '../../app/lib/tickets/auto-mode-eligibility';
import type { Stage, WorkflowType } from '@prisma/client';

describe('isAutoModeEligible', () => {
  const fullEligibleStages: Stage[] = ['INBOX', 'SPECIFY', 'PLAN'];
  const fullIneligibleStages: Stage[] = ['BUILD', 'VERIFY', 'SHIP', 'CLOSED'];
  const allStages: Stage[] = [
    'INBOX',
    'SPECIFY',
    'PLAN',
    'BUILD',
    'VERIFY',
    'SHIP',
    'CLOSED',
  ];
  const nonFullTypes: WorkflowType[] = ['QUICK', 'CLEAN'];

  it.each(fullEligibleStages)('returns true for FULL + %s', (stage) => {
    expect(isAutoModeEligible({ workflowType: 'FULL', stage })).toBe(true);
  });

  it.each(fullIneligibleStages)('returns false for FULL + %s', (stage) => {
    expect(isAutoModeEligible({ workflowType: 'FULL', stage })).toBe(false);
  });

  it.each(nonFullTypes)('returns false for %s workflow in any stage', (wt) => {
    for (const stage of allStages) {
      expect(isAutoModeEligible({ workflowType: wt, stage })).toBe(false);
    }
  });
});
