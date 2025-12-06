/**
 * Unit tests for ticket stats aggregation functions
 *
 * Tests the pure functions in lib/hooks/use-ticket-stats.ts
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateJobStats,
  aggregateToolsUsage,
  calculateCacheEfficiency,
} from '@/lib/hooks/use-ticket-stats';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

/**
 * Helper to create a mock job with telemetry
 */
function createMockJob(
  overrides: Partial<TicketJobWithTelemetry> = {}
): TicketJobWithTelemetry {
  return {
    id: 1,
    command: 'specify',
    status: 'COMPLETED',
    startedAt: new Date('2025-01-01T10:00:00Z'),
    completedAt: new Date('2025-01-01T10:05:00Z'),
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 200,
    cacheCreationTokens: 100,
    costUsd: 0.05,
    durationMs: 5000,
    model: 'claude-opus-4-5',
    toolsUsed: ['Read', 'Edit'],
    ...overrides,
  };
}

describe('calculateCacheEfficiency', () => {
  it('calculates correct percentage when both values are present', () => {
    // cacheReadTokens / (inputTokens + cacheReadTokens) * 100
    // 200 / (1000 + 200) * 100 = 16.67%
    const result = calculateCacheEfficiency(1000, 200);
    expect(result).toBeCloseTo(16.67, 1);
  });

  it('returns 0 when denominator is 0', () => {
    const result = calculateCacheEfficiency(0, 0);
    expect(result).toBe(0);
  });

  it('returns 100 when all tokens are cache reads', () => {
    const result = calculateCacheEfficiency(0, 1000);
    expect(result).toBe(100);
  });

  it('returns 0 when no cache reads', () => {
    const result = calculateCacheEfficiency(1000, 0);
    expect(result).toBe(0);
  });
});

describe('aggregateToolsUsage', () => {
  it('aggregates tools from multiple jobs', () => {
    const jobs: TicketJobWithTelemetry[] = [
      createMockJob({ id: 1, toolsUsed: ['Read', 'Edit', 'Bash'] }),
      createMockJob({ id: 2, toolsUsed: ['Read', 'Edit'] }),
      createMockJob({ id: 3, toolsUsed: ['Read', 'Write'] }),
    ];

    const result = aggregateToolsUsage(jobs);

    expect(result).toEqual([
      { tool: 'Read', count: 3 },
      { tool: 'Edit', count: 2 },
      { tool: 'Bash', count: 1 },
      { tool: 'Write', count: 1 },
    ]);
  });

  it('returns empty array when no tools used', () => {
    const jobs: TicketJobWithTelemetry[] = [
      createMockJob({ id: 1, toolsUsed: [] }),
      createMockJob({ id: 2, toolsUsed: [] }),
    ];

    const result = aggregateToolsUsage(jobs);
    expect(result).toEqual([]);
  });

  it('handles empty jobs array', () => {
    const result = aggregateToolsUsage([]);
    expect(result).toEqual([]);
  });

  it('sorts tools by frequency descending', () => {
    const jobs: TicketJobWithTelemetry[] = [
      createMockJob({ id: 1, toolsUsed: ['A', 'B', 'C'] }),
      createMockJob({ id: 2, toolsUsed: ['B', 'C'] }),
      createMockJob({ id: 3, toolsUsed: ['C'] }),
    ];

    const result = aggregateToolsUsage(jobs);

    expect(result[0]).toEqual({ tool: 'C', count: 3 });
    expect(result[1]).toEqual({ tool: 'B', count: 2 });
    expect(result[2]).toEqual({ tool: 'A', count: 1 });
  });
});

describe('aggregateJobStats', () => {
  it('aggregates all telemetry fields correctly', () => {
    const jobs: TicketJobWithTelemetry[] = [
      createMockJob({
        id: 1,
        costUsd: 0.10,
        durationMs: 5000,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 200,
        cacheCreationTokens: 100,
      }),
      createMockJob({
        id: 2,
        costUsd: 0.20,
        durationMs: 10000,
        inputTokens: 2000,
        outputTokens: 1000,
        cacheReadTokens: 400,
        cacheCreationTokens: 200,
      }),
    ];

    const result = aggregateJobStats(jobs);

    expect(result.totalCost).toBeCloseTo(0.30, 2);
    expect(result.totalDuration).toBe(15000);
    expect(result.inputTokens).toBe(3000);
    expect(result.outputTokens).toBe(1500);
    expect(result.totalTokens).toBe(4500);
    expect(result.cacheReadTokens).toBe(600);
    expect(result.cacheCreationTokens).toBe(300);
    // Cache efficiency: 600 / (3000 + 600) * 100 = 16.67%
    expect(result.cacheEfficiency).toBeCloseTo(16.67, 1);
  });

  it('treats null values as 0 for summation', () => {
    const jobs: TicketJobWithTelemetry[] = [
      createMockJob({
        id: 1,
        costUsd: null,
        durationMs: null,
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
      }),
      createMockJob({
        id: 2,
        costUsd: 0.10,
        durationMs: 5000,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 200,
        cacheCreationTokens: 100,
      }),
    ];

    const result = aggregateJobStats(jobs);

    expect(result.totalCost).toBe(0.10);
    expect(result.totalDuration).toBe(5000);
    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.totalTokens).toBe(1500);
  });

  it('returns hasData=true when at least one job has telemetry', () => {
    const jobs: TicketJobWithTelemetry[] = [
      createMockJob({
        id: 1,
        costUsd: null,
        inputTokens: null,
        durationMs: null,
      }),
      createMockJob({
        id: 2,
        costUsd: 0.10,
        inputTokens: null,
        durationMs: null,
      }),
    ];

    const result = aggregateJobStats(jobs);
    expect(result.hasData).toBe(true);
  });

  it('returns hasData=false when all jobs have null telemetry', () => {
    const jobs: TicketJobWithTelemetry[] = [
      createMockJob({
        id: 1,
        costUsd: null,
        inputTokens: null,
        durationMs: null,
      }),
      createMockJob({
        id: 2,
        costUsd: null,
        inputTokens: null,
        durationMs: null,
      }),
    ];

    const result = aggregateJobStats(jobs);
    expect(result.hasData).toBe(false);
  });

  it('handles empty jobs array', () => {
    const result = aggregateJobStats([]);

    expect(result.totalCost).toBe(0);
    expect(result.totalDuration).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.cacheEfficiency).toBe(0);
    expect(result.toolsUsage).toEqual([]);
    expect(result.hasData).toBe(false);
  });

  it('aggregates tools usage within stats', () => {
    const jobs: TicketJobWithTelemetry[] = [
      createMockJob({ id: 1, toolsUsed: ['Read', 'Edit'] }),
      createMockJob({ id: 2, toolsUsed: ['Read', 'Bash'] }),
    ];

    const result = aggregateJobStats(jobs);

    expect(result.toolsUsage).toContainEqual({ tool: 'Read', count: 2 });
    expect(result.toolsUsage).toContainEqual({ tool: 'Edit', count: 1 });
    expect(result.toolsUsage).toContainEqual({ tool: 'Bash', count: 1 });
  });
});
