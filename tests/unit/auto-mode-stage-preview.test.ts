import { describe, it, expect } from 'vitest';
import { computeChainedStages } from '../../lib/utils/auto-mode-stage-preview';
import type { Stage } from '@prisma/client';

describe('computeChainedStages', () => {
  it('returns SPECIFY → PLAN → BUILD from INBOX', () => {
    expect(computeChainedStages('INBOX')).toEqual(['SPECIFY', 'PLAN', 'BUILD']);
  });

  it('returns PLAN → BUILD from SPECIFY', () => {
    expect(computeChainedStages('SPECIFY')).toEqual(['PLAN', 'BUILD']);
  });

  it('returns BUILD from PLAN', () => {
    expect(computeChainedStages('PLAN')).toEqual(['BUILD']);
  });

  it('returns [] for BUILD', () => {
    expect(computeChainedStages('BUILD')).toEqual([]);
  });

  it('returns [] for VERIFY', () => {
    expect(computeChainedStages('VERIFY')).toEqual([]);
  });

  it('returns [] for SHIP', () => {
    expect(computeChainedStages('SHIP')).toEqual([]);
  });

  it('returns [] for CLOSED', () => {
    const stage: Stage = 'CLOSED';
    expect(computeChainedStages(stage)).toEqual([]);
  });
});
