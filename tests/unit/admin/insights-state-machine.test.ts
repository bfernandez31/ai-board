import { describe, it, expect } from 'vitest';
import type { AdminInsightsReportStatus } from '@prisma/client';
import {
  canTransition,
  isTerminalStatus,
} from '@/lib/admin/insights/state-machine';

const STATUSES: AdminInsightsReportStatus[] = ['RUNNING', 'COMPLETED', 'FAILED'];

const ALLOWED = new Set<string>([
  'RUNNING->RUNNING',
  'RUNNING->COMPLETED',
  'RUNNING->FAILED',
  'COMPLETED->COMPLETED',
  'FAILED->FAILED',
]);

describe('canTransition (insights)', () => {
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const expected = ALLOWED.has(`${from}->${to}`);
      it(`${from} -> ${to} = ${expected}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe('isTerminalStatus', () => {
  it('RUNNING is not terminal', () => {
    expect(isTerminalStatus('RUNNING')).toBe(false);
  });

  it('COMPLETED is terminal', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
  });

  it('FAILED is terminal', () => {
    expect(isTerminalStatus('FAILED')).toBe(true);
  });
});
