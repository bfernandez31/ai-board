/**
 * Unit Tests: getValidRollbackTargets
 *
 * Tests for the rollback target computation function.
 */

import { describe, it, expect } from 'vitest';
import { getValidRollbackTargets, Stage } from '@/lib/stage-transitions';

describe('getValidRollbackTargets', () => {
  describe('FULL workflow', () => {
    it('should return [INBOX] for SPECIFY with FAILED job', () => {
      expect(getValidRollbackTargets(Stage.SPECIFY, 'FULL', 'FAILED')).toEqual([Stage.INBOX]);
    });

    it('should return [SPECIFY] for PLAN with CANCELLED job', () => {
      expect(getValidRollbackTargets(Stage.PLAN, 'FULL', 'CANCELLED')).toEqual([Stage.SPECIFY]);
    });

    it('should return [PLAN] for BUILD with FAILED job', () => {
      expect(getValidRollbackTargets(Stage.BUILD, 'FULL', 'FAILED')).toEqual([Stage.PLAN]);
    });

    it('should return [BUILD, PLAN] for VERIFY with FAILED job', () => {
      expect(getValidRollbackTargets(Stage.VERIFY, 'FULL', 'FAILED')).toEqual([Stage.BUILD, Stage.PLAN]);
    });

    it('should return [PLAN] for VERIFY with COMPLETED job (existing rollback)', () => {
      expect(getValidRollbackTargets(Stage.VERIFY, 'FULL', 'COMPLETED')).toEqual([Stage.PLAN]);
    });
  });

  describe('QUICK workflow', () => {
    it('should return [INBOX] for BUILD with FAILED job', () => {
      expect(getValidRollbackTargets(Stage.BUILD, 'QUICK', 'FAILED')).toEqual([Stage.INBOX]);
    });

    it('should return [] for SPECIFY (no rollback in QUICK)', () => {
      expect(getValidRollbackTargets(Stage.SPECIFY, 'QUICK', 'FAILED')).toEqual([]);
    });
  });

  describe('non-terminal statuses', () => {
    it('should return [] for RUNNING job', () => {
      expect(getValidRollbackTargets(Stage.BUILD, 'FULL', 'RUNNING')).toEqual([]);
    });

    it('should return [] for PENDING job', () => {
      expect(getValidRollbackTargets(Stage.BUILD, 'FULL', 'PENDING')).toEqual([]);
    });

    it('should return [] for null job status', () => {
      expect(getValidRollbackTargets(Stage.BUILD, 'FULL', null)).toEqual([]);
    });
  });

  describe('stages with no rollback', () => {
    it('should return [] for INBOX', () => {
      expect(getValidRollbackTargets(Stage.INBOX, 'FULL', 'FAILED')).toEqual([]);
    });

    it('should return [] for SHIP', () => {
      expect(getValidRollbackTargets(Stage.SHIP, 'FULL', 'FAILED')).toEqual([]);
    });
  });
});
