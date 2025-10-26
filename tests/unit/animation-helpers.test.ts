/**
 * Unit tests for animation helper functions
 * Testing pure utility functions for ticket progression
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNextColumn,
  shouldAnimate,
  getColumnName,
  WorkflowStageName,
} from '@/lib/utils/animation-helpers';

describe('calculateNextColumn', () => {
  it('increments column from 0 to 1', () => {
    expect(calculateNextColumn(0)).toBe(1);
  });

  it('increments column from 1 to 2', () => {
    expect(calculateNextColumn(1)).toBe(2);
  });

  it('increments column from 2 to 3', () => {
    expect(calculateNextColumn(2)).toBe(3);
  });

  it('increments column from 3 to 4', () => {
    expect(calculateNextColumn(3)).toBe(4);
  });

  it('increments column from 4 to 5', () => {
    expect(calculateNextColumn(4)).toBe(5);
  });

  it('wraps column from 5 to 0', () => {
    expect(calculateNextColumn(5)).toBe(0);
  });

  it('handles negative numbers by incrementing', () => {
    expect(calculateNextColumn(-1)).toBe(0);
  });
});

describe('shouldAnimate', () => {
  it('returns true when not paused, visible, and no reduced motion', () => {
    expect(shouldAnimate(false, true, false)).toBe(true);
  });

  it('returns false when paused', () => {
    expect(shouldAnimate(true, true, false)).toBe(false);
  });

  it('returns false when not visible', () => {
    expect(shouldAnimate(false, false, false)).toBe(false);
  });

  it('returns false when reduced motion enabled', () => {
    expect(shouldAnimate(false, true, true)).toBe(false);
  });

  it('returns false when paused and not visible', () => {
    expect(shouldAnimate(true, false, false)).toBe(false);
  });

  it('returns false when paused and reduced motion', () => {
    expect(shouldAnimate(true, true, true)).toBe(false);
  });

  it('returns false when not visible and reduced motion', () => {
    expect(shouldAnimate(false, false, true)).toBe(false);
  });

  it('returns false when all conditions prevent animation', () => {
    expect(shouldAnimate(true, false, true)).toBe(false);
  });
});

describe('getColumnName', () => {
  it('maps 0 to INBOX', () => {
    expect(getColumnName(0)).toBe(WorkflowStageName.INBOX);
  });

  it('maps 1 to SPECIFY', () => {
    expect(getColumnName(1)).toBe(WorkflowStageName.SPECIFY);
  });

  it('maps 2 to PLAN', () => {
    expect(getColumnName(2)).toBe(WorkflowStageName.PLAN);
  });

  it('maps 3 to BUILD', () => {
    expect(getColumnName(3)).toBe(WorkflowStageName.BUILD);
  });

  it('maps 4 to VERIFY', () => {
    expect(getColumnName(4)).toBe(WorkflowStageName.VERIFY);
  });

  it('maps 5 to SHIP', () => {
    expect(getColumnName(5)).toBe(WorkflowStageName.SHIP);
  });

  it('returns UNKNOWN for out-of-range positive index', () => {
    expect(getColumnName(6)).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for negative index', () => {
    expect(getColumnName(-1)).toBe('UNKNOWN');
  });
});
