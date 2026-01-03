/**
 * Unit tests for telemetry aggregation logic
 *
 * Documents the jq aggregation logic used in fetch-telemetry.sh
 * and verifies the TypeScript equivalent in telemetry-extractor.ts
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateJobTelemetry,
  createEmptyTelemetry,
  formatTelemetryDisplay,
  compareTelemetry,
} from '@/lib/comparison/telemetry-extractor';

describe('Telemetry Aggregation', () => {
  describe('aggregateJobTelemetry', () => {
    it('should aggregate multiple jobs into single telemetry', () => {
      const jobs = [
        {
          inputTokens: 10000,
          outputTokens: 5000,
          cacheReadTokens: 2000,
          cacheCreationTokens: 1000,
          costUsd: 0.05,
          durationMs: 10000,
          model: 'claude-sonnet-4-5-20251101',
          toolsUsed: ['Read', 'Write'],
        },
        {
          inputTokens: 15000,
          outputTokens: 8000,
          cacheReadTokens: 3000,
          cacheCreationTokens: 1500,
          costUsd: 0.07,
          durationMs: 15000,
          model: 'claude-sonnet-4-5-20251101',
          toolsUsed: ['Edit', 'Bash'],
        },
      ];

      const result = aggregateJobTelemetry('AIB-127', jobs);

      // Token sums
      expect(result.inputTokens).toBe(25000);
      expect(result.outputTokens).toBe(13000);
      expect(result.cacheReadTokens).toBe(5000);
      expect(result.cacheCreationTokens).toBe(2500);

      // Cost and duration sums
      expect(result.costUsd).toBeCloseTo(0.12, 4);
      expect(result.durationMs).toBe(25000);

      // Model (most frequent)
      expect(result.model).toBe('claude-sonnet-4-5-20251101');

      // Tools (unique, sorted)
      expect(result.toolsUsed).toEqual(['Bash', 'Edit', 'Read', 'Write']);

      // Job count and hasData
      expect(result.jobCount).toBe(2);
      expect(result.hasData).toBe(true);
    });

    it('should handle jobs with null telemetry values', () => {
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
        {
          inputTokens: 10000,
          outputTokens: 5000,
          cacheReadTokens: 2000,
          cacheCreationTokens: 1000,
          costUsd: 0.05,
          durationMs: 10000,
          model: 'claude-sonnet-4-5-20251101',
          toolsUsed: ['Read'],
        },
      ];

      const result = aggregateJobTelemetry('AIB-128', jobs);

      // Null values should be treated as 0
      expect(result.inputTokens).toBe(10000);
      expect(result.outputTokens).toBe(5000);
      expect(result.costUsd).toBeCloseTo(0.05, 4);
      expect(result.hasData).toBe(true);
    });

    it('should return empty telemetry for empty job array', () => {
      const result = aggregateJobTelemetry('AIB-129', []);

      expect(result.ticketKey).toBe('AIB-129');
      expect(result.inputTokens).toBe(0);
      expect(result.costUsd).toBe(0);
      expect(result.jobCount).toBe(0);
      expect(result.hasData).toBe(false);
    });
  });

  describe('createEmptyTelemetry', () => {
    it('should create empty telemetry with correct structure', () => {
      const result = createEmptyTelemetry('AIB-130');

      expect(result).toEqual({
        ticketKey: 'AIB-130',
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0,
        durationMs: 0,
        model: null,
        toolsUsed: [],
        jobCount: 0,
        hasData: false,
      });
    });
  });

  describe('formatTelemetryDisplay', () => {
    it('should format telemetry with data', () => {
      const telemetry = {
        ticketKey: 'AIB-127',
        inputTokens: 25000,
        outputTokens: 13000,
        cacheReadTokens: 5000,
        cacheCreationTokens: 2500,
        costUsd: 0.1234,
        durationMs: 33000,
        model: 'claude-sonnet-4-5-20251101',
        toolsUsed: ['Read', 'Write'],
        jobCount: 2,
        hasData: true,
      };

      const result = formatTelemetryDisplay(telemetry);

      expect(result.tokens).toBe('38,000');
      expect(result.cost).toBe('$0.1234');
      expect(result.duration).toBe('33s');
      expect(result.model).toBe('claude-sonnet-4-5-20251101');
    });

    it('should return N/A for telemetry without data', () => {
      const telemetry = createEmptyTelemetry('AIB-128');
      const result = formatTelemetryDisplay(telemetry);

      expect(result.tokens).toBe('N/A');
      expect(result.cost).toBe('N/A');
      expect(result.duration).toBe('N/A');
      expect(result.model).toBe('N/A');
    });

    it('should format duration in minutes for longer durations', () => {
      const telemetry = {
        ticketKey: 'AIB-129',
        inputTokens: 50000,
        outputTokens: 25000,
        cacheReadTokens: 10000,
        cacheCreationTokens: 5000,
        costUsd: 0.25,
        durationMs: 180000, // 3 minutes
        model: 'claude-opus-4-5-20251101',
        toolsUsed: [],
        jobCount: 1,
        hasData: true,
      };

      const result = formatTelemetryDisplay(telemetry);
      expect(result.duration).toBe('3m');
    });
  });

  describe('compareTelemetry', () => {
    it('should compare telemetry between two tickets', () => {
      const t1 = {
        ticketKey: 'AIB-127',
        inputTokens: 10000,
        outputTokens: 5000,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.10,
        durationMs: 30000,
        model: null,
        toolsUsed: [],
        jobCount: 1,
        hasData: true,
      };

      const t2 = {
        ticketKey: 'AIB-128',
        inputTokens: 12000,
        outputTokens: 6000,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.12,
        durationMs: 36000,
        model: null,
        toolsUsed: [],
        jobCount: 1,
        hasData: true,
      };

      const result = compareTelemetry(t1, t2);

      // t2 is 20% more expensive
      expect(result.costDiff).toBeCloseTo(0.02, 4);
      expect(result.costDiffPercent).toBeCloseTo(20, 1);

      // t2 has 20% more tokens (18000 vs 15000)
      expect(result.tokensDiff).toBe(3000);
      expect(result.tokensDiffPercent).toBeCloseTo(20, 1);

      // t2 took 20% longer
      expect(result.durationDiff).toBe(6000);
      expect(result.durationDiffPercent).toBeCloseTo(20, 1);
    });

    it('should handle zero values without division errors', () => {
      const t1 = createEmptyTelemetry('AIB-127');
      const t2 = createEmptyTelemetry('AIB-128');

      const result = compareTelemetry(t1, t2);

      expect(result.costDiff).toBe(0);
      expect(result.costDiffPercent).toBe(0);
      expect(result.tokensDiff).toBe(0);
      expect(result.tokensDiffPercent).toBe(0);
    });
  });
});

/**
 * Documentation: jq aggregation logic in fetch-telemetry.sh
 *
 * The script uses this jq expression to aggregate job telemetry:
 *
 * ```jq
 * {
 *   ticketKey: $key,
 *   inputTokens: ([.[] | select(.status == "COMPLETED") | .inputTokens // 0] | add) // 0,
 *   outputTokens: ([.[] | select(.status == "COMPLETED") | .outputTokens // 0] | add) // 0,
 *   cacheReadTokens: ([.[] | select(.status == "COMPLETED") | .cacheReadTokens // 0] | add) // 0,
 *   cacheCreationTokens: ([.[] | select(.status == "COMPLETED") | .cacheCreationTokens // 0] | add) // 0,
 *   costUsd: ([.[] | select(.status == "COMPLETED") | .costUsd // 0] | add) // 0,
 *   durationMs: ([.[] | select(.status == "COMPLETED") | .durationMs // 0] | add) // 0,
 *   model: ([.[] | select(.status == "COMPLETED" and .model != null) | .model] | first) // null,
 *   toolsUsed: ([.[] | select(.status == "COMPLETED") | .toolsUsed[]] | unique | sort) // [],
 *   jobCount: ([.[] | select(.status == "COMPLETED")] | length) // 0,
 *   hasData: (([.[] | select(.status == "COMPLETED") | .costUsd // 0] | add) // 0) > 0
 * }
 * ```
 *
 * Key behaviors:
 * 1. Only COMPLETED jobs are included
 * 2. Null values are treated as 0 (using // 0 fallback)
 * 3. Model takes the first non-null value
 * 4. Tools are unique and sorted
 * 5. hasData is true if total cost > 0
 */
