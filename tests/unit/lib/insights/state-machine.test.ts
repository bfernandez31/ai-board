import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isTerminalStatus,
} from '@/app/lib/insights/state-machine';

describe('InsightsReport state machine (AIB-791)', () => {
  describe('canTransition', () => {
    it('allows RUNNING → COMPLETED', () => {
      expect(canTransition('RUNNING', 'COMPLETED')).toBe(true);
    });

    it('allows RUNNING → FAILED', () => {
      expect(canTransition('RUNNING', 'FAILED')).toBe(true);
    });

    it('allows RUNNING → RUNNING (idempotent)', () => {
      expect(canTransition('RUNNING', 'RUNNING')).toBe(true);
    });

    it('forbids COMPLETED → anything except itself (VR-2)', () => {
      expect(canTransition('COMPLETED', 'COMPLETED')).toBe(true);
      expect(canTransition('COMPLETED', 'RUNNING')).toBe(false);
      expect(canTransition('COMPLETED', 'FAILED')).toBe(false);
    });

    it('forbids FAILED → anything except itself (VR-3)', () => {
      expect(canTransition('FAILED', 'FAILED')).toBe(true);
      expect(canTransition('FAILED', 'RUNNING')).toBe(false);
      expect(canTransition('FAILED', 'COMPLETED')).toBe(false);
    });
  });

  describe('isTerminalStatus', () => {
    it('returns true for COMPLETED', () => {
      expect(isTerminalStatus('COMPLETED')).toBe(true);
    });

    it('returns true for FAILED', () => {
      expect(isTerminalStatus('FAILED')).toBe(true);
    });

    it('returns false for RUNNING', () => {
      expect(isTerminalStatus('RUNNING')).toBe(false);
    });
  });
});
