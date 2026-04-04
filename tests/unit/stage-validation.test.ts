import { describe, it, expect } from 'vitest';
import { Stage, isValidTransition, getNextStage, getValidRollbackTargets } from '../../lib/stage-transitions';

/**
 * Unit Tests: Stage Validation Logic
 * Features: 031-quick-implementation, 051-897-rollback-quick
 *
 * Tests cover:
 * - Quick-impl special case (INBOX → BUILD)
 * - Rollback special case (BUILD → INBOX for QUICK workflows)
 * - Normal sequential validation
 * - Invalid transitions
 */

describe('Stage Validation - Quick-Impl Support', () => {
  /**
   * Test 1: Quick-Impl Path - INBOX → BUILD (NEW BEHAVIOR)
   * Given: Ticket in INBOX stage
   * When: Validate transition to BUILD (skipping SPECIFY and PLAN)
   * Then: Returns true (quick-impl special case)
   */
  it('should allow INBOX → BUILD transition (quick-impl)', () => {
    const result = isValidTransition(Stage.INBOX, Stage.BUILD);
    expect(result).toBe(true);
  });

  /**
   * Test 2: Quick-Impl Detection via getNextStage
   * Given: Ticket in INBOX stage
   * When: Get next stage
   * Then: Returns SPECIFY (normal path), but INBOX → BUILD also valid
   *
   * Note: getNextStage returns normal sequential path
   * isValidTransition has special case for INBOX → BUILD
   */
  it('getNextStage returns SPECIFY for INBOX (normal path)', () => {
    const nextStage = getNextStage(Stage.INBOX);
    expect(nextStage).toBe(Stage.SPECIFY);
  });

  /**
   * Test 3: Normal Workflow - INBOX → SPECIFY (EXISTING BEHAVIOR)
   * Given: Ticket in INBOX stage
   * When: Validate transition to SPECIFY
   * Then: Returns true (normal sequential transition)
   */
  it('should allow INBOX → SPECIFY transition (normal workflow)', () => {
    const result = isValidTransition(Stage.INBOX, Stage.SPECIFY);
    expect(result).toBe(true);
  });

  /**
   * Test 4: Invalid Transition - INBOX → PLAN (EXISTING BEHAVIOR)
   * Given: Ticket in INBOX stage
   * When: Validate transition to PLAN (skipping SPECIFY)
   * Then: Returns false (invalid, must go through SPECIFY first)
   */
  it('should reject INBOX → PLAN transition (skipping SPECIFY)', () => {
    const result = isValidTransition(Stage.INBOX, Stage.PLAN);
    expect(result).toBe(false);
  });

  /**
   * Test 5: Invalid Transition - SPECIFY → BUILD (EXISTING BEHAVIOR)
   * Given: Ticket in SPECIFY stage
   * When: Validate transition to BUILD (skipping PLAN)
   * Then: Returns false (invalid, must go through PLAN first)
   */
  it('should reject SPECIFY → BUILD transition (skipping PLAN)', () => {
    const result = isValidTransition(Stage.SPECIFY, Stage.BUILD);
    expect(result).toBe(false);
  });

  /**
   * Test 6: Normal Workflow - PLAN → BUILD (EXISTING BEHAVIOR)
   * Given: Ticket in PLAN stage
   * When: Validate transition to BUILD
   * Then: Returns true (normal sequential transition)
   */
  it('should allow PLAN → BUILD transition (normal workflow)', () => {
    const result = isValidTransition(Stage.PLAN, Stage.BUILD);
    expect(result).toBe(true);
  });
});

describe('Stage Validation - Rollback Support', () => {
  it('should allow BUILD → INBOX transition for QUICK workflow (rollback)', () => {
    expect(isValidTransition(Stage.BUILD, Stage.INBOX, 'QUICK')).toBe(true);
  });

  it('should reject BUILD → INBOX transition for FULL workflow', () => {
    expect(isValidTransition(Stage.BUILD, Stage.INBOX, 'FULL')).toBe(false);
  });

  it('should reject BUILD → INBOX transition without workflowType', () => {
    expect(isValidTransition(Stage.BUILD, Stage.INBOX)).toBe(false);
  });

  it('should allow BUILD → VERIFY transition (normal workflow)', () => {
    expect(isValidTransition(Stage.BUILD, Stage.VERIFY)).toBe(true);
  });
});

describe('Stage Validation - Extended Rollback Paths', () => {
  it('should allow SPECIFY → INBOX transition for FULL workflow', () => {
    expect(isValidTransition(Stage.SPECIFY, Stage.INBOX, 'FULL')).toBe(true);
  });

  it('should reject SPECIFY → INBOX transition without workflowType', () => {
    expect(isValidTransition(Stage.SPECIFY, Stage.INBOX)).toBe(false);
  });

  it('should reject SPECIFY → INBOX transition for QUICK workflow', () => {
    expect(isValidTransition(Stage.SPECIFY, Stage.INBOX, 'QUICK')).toBe(false);
  });

  it('should allow PLAN → SPECIFY transition for FULL workflow', () => {
    expect(isValidTransition(Stage.PLAN, Stage.SPECIFY, 'FULL')).toBe(true);
  });

  it('should reject PLAN → SPECIFY transition without workflowType', () => {
    expect(isValidTransition(Stage.PLAN, Stage.SPECIFY)).toBe(false);
  });

  it('should reject PLAN → SPECIFY transition for QUICK workflow', () => {
    expect(isValidTransition(Stage.PLAN, Stage.SPECIFY, 'QUICK')).toBe(false);
  });

  it('should allow BUILD → PLAN transition for FULL workflow', () => {
    expect(isValidTransition(Stage.BUILD, Stage.PLAN, 'FULL')).toBe(true);
  });

  it('should reject BUILD → PLAN transition for QUICK workflow', () => {
    expect(isValidTransition(Stage.BUILD, Stage.PLAN, 'QUICK')).toBe(false);
  });

  it('should reject BUILD → PLAN transition without workflowType', () => {
    expect(isValidTransition(Stage.BUILD, Stage.PLAN)).toBe(false);
  });

  it('should allow VERIFY → BUILD transition for FULL workflow', () => {
    expect(isValidTransition(Stage.VERIFY, Stage.BUILD, 'FULL')).toBe(true);
  });

  it('should reject VERIFY → BUILD transition for QUICK workflow', () => {
    expect(isValidTransition(Stage.VERIFY, Stage.BUILD, 'QUICK')).toBe(false);
  });

  it('should reject VERIFY → BUILD transition without workflowType', () => {
    expect(isValidTransition(Stage.VERIFY, Stage.BUILD)).toBe(false);
  });

  it('should reject SHIP → VERIFY (backwards from terminal)', () => {
    expect(isValidTransition(Stage.SHIP, Stage.VERIFY)).toBe(false);
  });
});

describe('Stage Validation - getValidRollbackTargets', () => {
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
