import { test, expect } from '@playwright/test';
import {
  resolveEffectivePolicyPure,
} from '../../app/lib/utils/policy-resolution';
import { ClarificationPolicy } from '@prisma/client';

/**
 * Unit Tests: Policy Resolution Utility
 * Feature: 029-999-auto-clarification
 * Tests hierarchical policy resolution logic in isolation
 */

test.describe('Policy Resolution - Hierarchical Resolution', () => {
  test('should use ticket policy when set', () => {
    const result = resolveEffectivePolicyPure(
      ClarificationPolicy.CONSERVATIVE,
      ClarificationPolicy.PRAGMATIC
    );
    expect(result).toBe(ClarificationPolicy.CONSERVATIVE);
  });

  test('should fall back to project policy when ticket policy is null', () => {
    const result = resolveEffectivePolicyPure(
      null,
      ClarificationPolicy.PRAGMATIC
    );
    expect(result).toBe(ClarificationPolicy.PRAGMATIC);
  });

  test('should handle AUTO project default', () => {
    const result = resolveEffectivePolicyPure(
      null,
      ClarificationPolicy.AUTO
    );
    expect(result).toBe(ClarificationPolicy.AUTO);
  });

  test('should handle INTERACTIVE policy', () => {
    const result = resolveEffectivePolicyPure(
      ClarificationPolicy.INTERACTIVE,
      ClarificationPolicy.AUTO
    );
    expect(result).toBe(ClarificationPolicy.INTERACTIVE);
  });
});

test.describe('Policy Resolution - All Policy Combinations', () => {
  const policies: ClarificationPolicy[] = [
    ClarificationPolicy.AUTO,
    ClarificationPolicy.CONSERVATIVE,
    ClarificationPolicy.PRAGMATIC,
    ClarificationPolicy.INTERACTIVE,
  ];

  // Test all possible ticket/project policy combinations
  policies.forEach((ticketPolicy) => {
    policies.forEach((projectPolicy) => {
      test(`should resolve ticket=${ticketPolicy} with project=${projectPolicy}`, () => {
        const result = resolveEffectivePolicyPure(ticketPolicy, projectPolicy);
        expect(result).toBe(ticketPolicy); // Ticket always wins when set
      });
    });
  });

  // Test null ticket with all project policies
  policies.forEach((projectPolicy) => {
    test(`should fall back to project=${projectPolicy} when ticket is null`, () => {
      const result = resolveEffectivePolicyPure(null, projectPolicy);
      expect(result).toBe(projectPolicy);
    });
  });
});

test.describe('Policy Resolution - Type Safety', () => {
  test('should return ClarificationPolicy enum type', () => {
    const result = resolveEffectivePolicyPure(
      null,
      ClarificationPolicy.AUTO
    );

    // Verify result is one of the valid enum values
    const validPolicies = Object.values(ClarificationPolicy);
    expect(validPolicies).toContain(result);
  });

  test('should handle all enum values without errors', () => {
    Object.values(ClarificationPolicy).forEach((policy) => {
      expect(() => {
        resolveEffectivePolicyPure(policy, ClarificationPolicy.AUTO);
      }).not.toThrow();
    });
  });
});
