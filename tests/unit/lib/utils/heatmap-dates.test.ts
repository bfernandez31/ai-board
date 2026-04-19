import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateDateRange } from '@/lib/utils/heatmap-dates';

describe('calculateDateRange', () => {
  beforeEach(() => {
    // Mock Date.now to have a fixed "now" for tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the correct range for last-12-months', () => {
    const { startDate, endDate } = calculateDateRange('last-12-months');
    
    // End date should be roughly now
    expect(endDate.toISOString()).toContain('2026-04-19');
    
    // Start date should be 1 year ago, at 00:00:00
    expect(startDate.getFullYear()).toBe(2025);
    expect(startDate.getMonth()).toBe(3); // April is index 3
    expect(startDate.getDate()).toBe(19);
    expect(startDate.getHours()).toBe(0);
    expect(startDate.getMinutes()).toBe(0);
  });

  it('should return the correct range for a specific year', () => {
    const { startDate, endDate } = calculateDateRange('2024');
    
    expect(startDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    // Note: JS Date constructor with (year, 11, 31, ...) uses local time, 
    // but in tests we want to be careful. 
    // The implementation uses local time: new Date(year, 11, 31, 23, 59, 59, 999)
    
    expect(startDate.getFullYear()).toBe(2024);
    expect(startDate.getMonth()).toBe(0);
    expect(startDate.getDate()).toBe(1);
    
    expect(endDate.getFullYear()).toBe(2024);
    expect(endDate.getMonth()).toBe(11);
    expect(endDate.getDate()).toBe(31);
  });
});
