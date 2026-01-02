/**
 * Unit Tests: Telemetry Extractor
 *
 * Tests the job telemetry aggregation and extraction for ticket comparison.
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateJobTelemetry,
  createEmptyTelemetry,
  buildTelemetryQuery,
  formatTelemetryDisplay,
  calculateTotalCost,
  calculateTotalTokens,
  compareTelemetry,
} from '@/lib/comparison/telemetry-extractor';
import type { TicketTelemetry } from '@/lib/types/comparison';

describe('createEmptyTelemetry', () => {
  it('should create empty telemetry with correct ticket key', () => {
    const result = createEmptyTelemetry('AIB-123');

    expect(result.ticketKey).toBe('AIB-123');
    expect(result.hasData).toBe(false);
  });

  it('should have zero values for all numeric fields', () => {
    const result = createEmptyTelemetry('TEST-1');

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.cacheReadTokens).toBe(0);
    expect(result.cacheCreationTokens).toBe(0);
    expect(result.costUsd).toBe(0);
    expect(result.durationMs).toBe(0);
    expect(result.jobCount).toBe(0);
  });

  it('should have null model and empty tools array', () => {
    const result = createEmptyTelemetry('TEST-2');

    expect(result.model).toBeNull();
    expect(result.toolsUsed).toEqual([]);
  });
});

describe('aggregateJobTelemetry', () => {
  it('should return empty telemetry for empty jobs array', () => {
    const result = aggregateJobTelemetry('AIB-123', []);

    expect(result.ticketKey).toBe('AIB-123');
    expect(result.hasData).toBe(false);
    expect(result.jobCount).toBe(0);
  });

  it('should aggregate numeric fields correctly', () => {
    const jobs = [
      {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 10,
        cacheCreationTokens: 5,
        costUsd: 0.01,
        durationMs: 1000,
        model: 'claude-3',
        toolsUsed: ['Edit', 'Read'],
      },
      {
        inputTokens: 200,
        outputTokens: 100,
        cacheReadTokens: 20,
        cacheCreationTokens: 10,
        costUsd: 0.02,
        durationMs: 2000,
        model: 'claude-3',
        toolsUsed: ['Write', 'Read'],
      },
    ];

    const result = aggregateJobTelemetry('AIB-123', jobs);

    expect(result.inputTokens).toBe(300);
    expect(result.outputTokens).toBe(150);
    expect(result.cacheReadTokens).toBe(30);
    expect(result.cacheCreationTokens).toBe(15);
    expect(result.costUsd).toBeCloseTo(0.03, 10);
    expect(result.durationMs).toBe(3000);
    expect(result.jobCount).toBe(2);
    expect(result.hasData).toBe(true);
  });

  it('should handle null values in job fields', () => {
    const jobs = [
      {
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
        costUsd: null,
        durationMs: null,
        model: null,
        toolsUsed: [],
      },
    ];

    const result = aggregateJobTelemetry('AIB-123', jobs);

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.hasData).toBe(false);
    expect(result.jobCount).toBe(1);
  });

  it('should collect unique tools from all jobs', () => {
    const jobs = [
      {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.01,
        durationMs: 1000,
        model: 'claude-3',
        toolsUsed: ['Edit', 'Read', 'Bash'],
      },
      {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.01,
        durationMs: 1000,
        model: 'claude-3',
        toolsUsed: ['Write', 'Read', 'Glob'],
      },
    ];

    const result = aggregateJobTelemetry('AIB-123', jobs);

    expect(result.toolsUsed).toContain('Edit');
    expect(result.toolsUsed).toContain('Read');
    expect(result.toolsUsed).toContain('Bash');
    expect(result.toolsUsed).toContain('Write');
    expect(result.toolsUsed).toContain('Glob');
    expect(result.toolsUsed).toHaveLength(5);
    // Should be sorted
    expect(result.toolsUsed).toEqual(result.toolsUsed.slice().sort());
  });

  it('should determine primary model from most frequent usage', () => {
    const jobs = [
      {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.01,
        durationMs: 1000,
        model: 'claude-3-opus',
        toolsUsed: [],
      },
      {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.01,
        durationMs: 1000,
        model: 'claude-3-sonnet',
        toolsUsed: [],
      },
      {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.01,
        durationMs: 1000,
        model: 'claude-3-sonnet',
        toolsUsed: [],
      },
    ];

    const result = aggregateJobTelemetry('AIB-123', jobs);

    expect(result.model).toBe('claude-3-sonnet');
  });

  it('should handle jobs with no model set', () => {
    const jobs = [
      {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.01,
        durationMs: 1000,
        model: null,
        toolsUsed: [],
      },
    ];

    const result = aggregateJobTelemetry('AIB-123', jobs);

    expect(result.model).toBeNull();
  });
});

describe('buildTelemetryQuery', () => {
  it('should create query for completed jobs', () => {
    const query = buildTelemetryQuery(123);

    expect(query.where).toEqual({
      ticketId: 123,
      status: 'COMPLETED',
    });
  });

  it('should select only telemetry fields', () => {
    const query = buildTelemetryQuery(456);

    expect(query.select).toEqual({
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheCreationTokens: true,
      costUsd: true,
      durationMs: true,
      model: true,
      toolsUsed: true,
    });
  });
});

describe('formatTelemetryDisplay', () => {
  it('should return N/A for all fields when hasData is false', () => {
    const telemetry = createEmptyTelemetry('AIB-123');
    const display = formatTelemetryDisplay(telemetry);

    expect(display.tokens).toBe('N/A');
    expect(display.cost).toBe('N/A');
    expect(display.duration).toBe('N/A');
    expect(display.model).toBe('N/A');
  });

  it('should format tokens with locale string', () => {
    const telemetry: TicketTelemetry = {
      ticketKey: 'AIB-123',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0.05,
      durationMs: 5000,
      model: 'claude-3',
      toolsUsed: [],
      jobCount: 1,
      hasData: true,
    };
    const display = formatTelemetryDisplay(telemetry);

    expect(display.tokens).toBe('1,500');
  });

  it('should format cost in USD', () => {
    const telemetry: TicketTelemetry = {
      ticketKey: 'AIB-123',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 1.2345,
      durationMs: 5000,
      model: 'claude-3',
      toolsUsed: [],
      jobCount: 1,
      hasData: true,
    };
    const display = formatTelemetryDisplay(telemetry);

    expect(display.cost).toBe('$1.2345');
  });

  it('should return N/A for zero cost', () => {
    const telemetry: TicketTelemetry = {
      ticketKey: 'AIB-123',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0,
      durationMs: 5000,
      model: 'claude-3',
      toolsUsed: [],
      jobCount: 1,
      hasData: true,
    };
    const display = formatTelemetryDisplay(telemetry);

    expect(display.cost).toBe('N/A');
  });

  it('should format duration in seconds', () => {
    const telemetry: TicketTelemetry = {
      ticketKey: 'AIB-123',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0.05,
      durationMs: 5000,
      model: 'claude-3',
      toolsUsed: [],
      jobCount: 1,
      hasData: true,
    };
    const display = formatTelemetryDisplay(telemetry);

    expect(display.duration).toBe('5s');
  });

  it('should format duration in minutes', () => {
    const telemetry: TicketTelemetry = {
      ticketKey: 'AIB-123',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0.05,
      durationMs: 90000,
      model: 'claude-3',
      toolsUsed: [],
      jobCount: 1,
      hasData: true,
    };
    const display = formatTelemetryDisplay(telemetry);

    expect(display.duration).toBe('1m 30s');
  });

  it('should format duration in hours', () => {
    const telemetry: TicketTelemetry = {
      ticketKey: 'AIB-123',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0.05,
      durationMs: 3700000,
      model: 'claude-3',
      toolsUsed: [],
      jobCount: 1,
      hasData: true,
    };
    const display = formatTelemetryDisplay(telemetry);

    expect(display.duration).toBe('1h 1m');
  });

  it('should display model name', () => {
    const telemetry: TicketTelemetry = {
      ticketKey: 'AIB-123',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0.05,
      durationMs: 5000,
      model: 'claude-3-opus',
      toolsUsed: [],
      jobCount: 1,
      hasData: true,
    };
    const display = formatTelemetryDisplay(telemetry);

    expect(display.model).toBe('claude-3-opus');
  });
});

describe('calculateTotalCost', () => {
  it('should sum costs from all tickets', () => {
    const telemetry: Record<string, TicketTelemetry> = {
      'AIB-1': { ...createEmptyTelemetry('AIB-1'), costUsd: 0.5, hasData: true },
      'AIB-2': { ...createEmptyTelemetry('AIB-2'), costUsd: 1.0, hasData: true },
      'AIB-3': { ...createEmptyTelemetry('AIB-3'), costUsd: 0.25, hasData: true },
    };

    const total = calculateTotalCost(telemetry);

    expect(total).toBeCloseTo(1.75, 10);
  });

  it('should ignore tickets without data', () => {
    const telemetry: Record<string, TicketTelemetry> = {
      'AIB-1': { ...createEmptyTelemetry('AIB-1'), costUsd: 1.0, hasData: true },
      'AIB-2': createEmptyTelemetry('AIB-2'),
    };

    const total = calculateTotalCost(telemetry);

    expect(total).toBeCloseTo(1.0, 10);
  });

  it('should return 0 for empty record', () => {
    const total = calculateTotalCost({});

    expect(total).toBe(0);
  });
});

describe('calculateTotalTokens', () => {
  it('should sum input and output tokens from all tickets', () => {
    const telemetry: Record<string, TicketTelemetry> = {
      'AIB-1': {
        ...createEmptyTelemetry('AIB-1'),
        inputTokens: 1000,
        outputTokens: 500,
        hasData: true,
      },
      'AIB-2': {
        ...createEmptyTelemetry('AIB-2'),
        inputTokens: 2000,
        outputTokens: 1000,
        hasData: true,
      },
    };

    const result = calculateTotalTokens(telemetry);

    expect(result.input).toBe(3000);
    expect(result.output).toBe(1500);
    expect(result.total).toBe(4500);
  });

  it('should ignore tickets without data', () => {
    const telemetry: Record<string, TicketTelemetry> = {
      'AIB-1': {
        ...createEmptyTelemetry('AIB-1'),
        inputTokens: 1000,
        outputTokens: 500,
        hasData: true,
      },
      'AIB-2': createEmptyTelemetry('AIB-2'),
    };

    const result = calculateTotalTokens(telemetry);

    expect(result.input).toBe(1000);
    expect(result.output).toBe(500);
    expect(result.total).toBe(1500);
  });
});

describe('compareTelemetry', () => {
  it('should calculate differences correctly', () => {
    const t1: TicketTelemetry = {
      ...createEmptyTelemetry('AIB-1'),
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.10,
      durationMs: 5000,
      hasData: true,
    };
    const t2: TicketTelemetry = {
      ...createEmptyTelemetry('AIB-2'),
      inputTokens: 2000,
      outputTokens: 1000,
      costUsd: 0.20,
      durationMs: 10000,
      hasData: true,
    };

    const result = compareTelemetry(t1, t2);

    expect(result.costDiff).toBeCloseTo(0.10, 10);
    expect(result.costDiffPercent).toBeCloseTo(100, 10);
    expect(result.tokensDiff).toBe(1500);
    expect(result.tokensDiffPercent).toBeCloseTo(100, 10);
    expect(result.durationDiff).toBe(5000);
    expect(result.durationDiffPercent).toBeCloseTo(100, 10);
  });

  it('should handle negative differences', () => {
    const t1: TicketTelemetry = {
      ...createEmptyTelemetry('AIB-1'),
      inputTokens: 2000,
      outputTokens: 1000,
      costUsd: 0.20,
      durationMs: 10000,
      hasData: true,
    };
    const t2: TicketTelemetry = {
      ...createEmptyTelemetry('AIB-2'),
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.10,
      durationMs: 5000,
      hasData: true,
    };

    const result = compareTelemetry(t1, t2);

    expect(result.costDiff).toBeCloseTo(-0.10, 10);
    expect(result.costDiffPercent).toBeCloseTo(-50, 10);
    expect(result.tokensDiff).toBe(-1500);
    expect(result.tokensDiffPercent).toBeCloseTo(-50, 10);
  });

  it('should handle division by zero (baseline is zero)', () => {
    const t1 = createEmptyTelemetry('AIB-1');
    const t2: TicketTelemetry = {
      ...createEmptyTelemetry('AIB-2'),
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.10,
      durationMs: 5000,
      hasData: true,
    };

    const result = compareTelemetry(t1, t2);

    // When baseline is 0 and current has value, percent should be 100
    expect(result.tokensDiffPercent).toBe(100);
    expect(result.costDiffPercent).toBe(100);
    expect(result.durationDiffPercent).toBe(100);
  });

  it('should return 0% when both are zero', () => {
    const t1 = createEmptyTelemetry('AIB-1');
    const t2 = createEmptyTelemetry('AIB-2');

    const result = compareTelemetry(t1, t2);

    expect(result.tokensDiffPercent).toBe(0);
    expect(result.costDiffPercent).toBe(0);
    expect(result.durationDiffPercent).toBe(0);
  });
});
