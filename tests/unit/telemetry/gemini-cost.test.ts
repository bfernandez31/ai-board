/**
 * Unit Tests: Gemini Cost Estimation
 *
 * Tests the estimateGeminiCost() function for correct pricing calculations,
 * prefix matching, unknown model handling, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { estimateGeminiCost } from '@/app/api/telemetry/v1/logs/route';

describe('estimateGeminiCost', () => {
  it('calculates correct cost for gemini-2.5-pro', () => {
    // 1000 input @ $1.25/M = $0.00125
    // 500 output @ $10.00/M = $0.005
    // 200 thinking @ $3.75/M = $0.00075
    // 100 cached @ $0.3125/M = $0.00003125
    const cost = estimateGeminiCost('gemini-2.5-pro', 1000, 500, 200, 100);
    expect(cost).not.toBeNull();
    expect(cost).toBeCloseTo(0.00125 + 0.005 + 0.00075 + 0.00003125, 8);
  });

  it('calculates correct cost for gemini-2.5-flash', () => {
    // 10000 input @ $0.15/M = $0.0015
    // 5000 output @ $0.60/M = $0.003
    // 3000 thinking @ $0.45/M = $0.00135
    // 2000 cached @ $0.0375/M = $0.000075
    const cost = estimateGeminiCost('gemini-2.5-flash', 10000, 5000, 3000, 2000);
    expect(cost).not.toBeNull();
    expect(cost).toBeCloseTo(0.0015 + 0.003 + 0.00135 + 0.000075, 8);
  });

  it('calculates correct cost for gemini-2.0-flash (no thinking cost)', () => {
    // 10000 input @ $0.10/M = $0.001
    // 5000 output @ $0.40/M = $0.002
    // 3000 thinking @ $0.00/M = $0.000 (no thinking support)
    // 2000 cached @ $0.025/M = $0.00005
    const cost = estimateGeminiCost('gemini-2.0-flash', 10000, 5000, 3000, 2000);
    expect(cost).not.toBeNull();
    expect(cost).toBeCloseTo(0.001 + 0.002 + 0.0 + 0.00005, 8);
  });

  it('returns null for unknown model', () => {
    const cost = estimateGeminiCost('unknown-model', 1000, 500, 200, 100);
    expect(cost).toBeNull();
  });

  it('matches gemini-2.5-pro-preview via prefix matching', () => {
    const cost = estimateGeminiCost('gemini-2.5-pro-preview-05-06', 1000, 500, 200, 100);
    expect(cost).not.toBeNull();
    // Should match gemini-2.5-pro pricing
    const directCost = estimateGeminiCost('gemini-2.5-pro', 1000, 500, 200, 100);
    expect(cost).toEqual(directCost);
  });

  it('matches gemini-2.5-flash-preview via prefix matching', () => {
    const cost = estimateGeminiCost('gemini-2.5-flash-preview', 1000, 500, 0, 0);
    expect(cost).not.toBeNull();
    const directCost = estimateGeminiCost('gemini-2.5-flash', 1000, 500, 0, 0);
    expect(cost).toEqual(directCost);
  });

  it('handles zero thinking tokens correctly', () => {
    const cost = estimateGeminiCost('gemini-2.5-pro', 1000, 500, 0, 0);
    expect(cost).not.toBeNull();
    // Only input + output cost
    expect(cost).toBeCloseTo(
      (1000 / 1_000_000) * 1.25 + (500 / 1_000_000) * 10.00,
      8
    );
  });

  it('handles all-zero tokens correctly', () => {
    const cost = estimateGeminiCost('gemini-2.5-pro', 0, 0, 0, 0);
    expect(cost).not.toBeNull();
    expect(cost).toBe(0);
  });

  it('calculates large token counts accurately', () => {
    // 1M input @ $1.25/M = $1.25
    // 500K output @ $10.00/M = $5.00
    // 200K thinking @ $3.75/M = $0.75
    // 100K cached @ $0.3125/M = $0.03125
    const cost = estimateGeminiCost('gemini-2.5-pro', 1_000_000, 500_000, 200_000, 100_000);
    expect(cost).not.toBeNull();
    expect(cost).toBeCloseTo(1.25 + 5.0 + 0.75 + 0.03125, 5);
  });
});
