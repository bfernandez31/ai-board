import { describe, it, expect } from 'vitest';
import { Stage, isValidTransition, getNextStage } from '../../lib/stage-validation';

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
  /**
   * Test: Rollback Path - BUILD → INBOX for QUICK workflow
   * Given: Ticket in BUILD stage with workflowType=QUICK
   * When: Validate transition to INBOX
   * Then: Returns true (rollback special case)
   */
  it('should allow BUILD → INBOX transition for QUICK workflow (rollback)', () => {
    const result = isValidTransition(Stage.BUILD, Stage.INBOX, 'QUICK');
    expect(result).toBe(true);
  });

  /**
   * Test: Block Rollback for FULL workflow
   * Given: Ticket in BUILD stage with workflowType=FULL
   * When: Validate transition to INBOX
   * Then: Returns false (rollback only for QUICK workflows)
   */
  it('should reject BUILD → INBOX transition for FULL workflow', () => {
    const result = isValidTransition(Stage.BUILD, Stage.INBOX, 'FULL');
    expect(result).toBe(false);
  });

  /**
   * Test: Block Rollback without workflowType specified
   * Given: Ticket in BUILD stage without workflowType parameter
   * When: Validate transition to INBOX
   * Then: Returns false (defaults to blocking without explicit QUICK)
   */
  it('should reject BUILD → INBOX transition without workflowType', () => {
    const result = isValidTransition(Stage.BUILD, Stage.INBOX);
    expect(result).toBe(false);
  });

  /**
   * Test: Normal BUILD → VERIFY transition
   * Given: Ticket in BUILD stage
   * When: Validate transition to VERIFY
   * Then: Returns true (normal sequential transition)
   */
  it('should allow BUILD → VERIFY transition (normal workflow)', () => {
    const result = isValidTransition(Stage.BUILD, Stage.VERIFY);
    expect(result).toBe(true);
  });
});
