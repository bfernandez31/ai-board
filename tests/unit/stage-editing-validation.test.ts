import { describe, it, expect } from 'vitest';
import { Stage } from '@prisma/client';
import { canEditDescriptionAndPolicy } from '../../lib/utils/field-edit-permissions';

/**
 * Unit Tests: Stage-Based Editing Restrictions
 * Feature: 051-895-restricted-description
 *
 * Tests the canEditDescriptionAndPolicy utility function that determines
 * if ticket description and clarificationPolicy fields can be edited
 * based on the current workflow stage.
 *
 * Business Rule: Only INBOX stage allows editing. All other stages are read-only.
 */

describe('canEditDescriptionAndPolicy', () => {
  /**
   * Test 1: INBOX Stage - Editing Allowed
   * Given: Ticket in INBOX stage
   * When: Check if description/policy can be edited
   * Then: Returns true (editing allowed)
   */
  it('should return true for INBOX stage (editing allowed)', () => {
    const result = canEditDescriptionAndPolicy(Stage.INBOX);
    expect(result).toBe(true);
  });

  /**
   * Test 2: SPECIFY Stage - Editing NOT Allowed
   * Given: Ticket in SPECIFY stage
   * When: Check if description/policy can be edited
   * Then: Returns false (read-only)
   */
  it('should return false for SPECIFY stage (read-only)', () => {
    const result = canEditDescriptionAndPolicy(Stage.SPECIFY);
    expect(result).toBe(false);
  });

  /**
   * Test 3: PLAN Stage - Editing NOT Allowed
   * Given: Ticket in PLAN stage
   * When: Check if description/policy can be edited
   * Then: Returns false (read-only)
   */
  it('should return false for PLAN stage (read-only)', () => {
    const result = canEditDescriptionAndPolicy(Stage.PLAN);
    expect(result).toBe(false);
  });

  /**
   * Test 4: BUILD Stage - Editing NOT Allowed
   * Given: Ticket in BUILD stage
   * When: Check if description/policy can be edited
   * Then: Returns false (read-only)
   */
  it('should return false for BUILD stage (read-only)', () => {
    const result = canEditDescriptionAndPolicy(Stage.BUILD);
    expect(result).toBe(false);
  });

  /**
   * Test 5: VERIFY Stage - Editing NOT Allowed
   * Given: Ticket in VERIFY stage
   * When: Check if description/policy can be edited
   * Then: Returns false (read-only)
   */
  it('should return false for VERIFY stage (read-only)', () => {
    const result = canEditDescriptionAndPolicy(Stage.VERIFY);
    expect(result).toBe(false);
  });

  /**
   * Test 6: SHIP Stage - Editing NOT Allowed
   * Given: Ticket in SHIP stage
   * When: Check if description/policy can be edited
   * Then: Returns false (read-only)
   */
  it('should return false for SHIP stage (read-only)', () => {
    const result = canEditDescriptionAndPolicy(Stage.SHIP);
    expect(result).toBe(false);
  });
});
