import { describe, expect, it } from 'vitest';
import { generateLogSummary } from '@/lib/logs/log-summarizer';
import type { NormalizedLogEntry } from '@/lib/logs/types';

function makeEntry(
  eventType: NormalizedLogEntry['eventType'],
  content: string,
  timestamp?: string
): NormalizedLogEntry {
  return {
    timestamp: timestamp ?? new Date().toISOString(),
    eventType,
    content,
  };
}

describe('generateLogSummary', () => {
  describe('FAILED jobs', () => {
    it('extracts error summary from entries', () => {
      const entries: NormalizedLogEntry[] = [
        makeEntry('message', 'Starting implementation...'),
        makeEntry('tool_invocation', 'Read file: src/index.ts'),
        makeEntry('error', 'TypeError: Cannot read property "foo" of undefined'),
      ];
      const summary = generateLogSummary(entries, 'FAILED');
      expect(summary).toContain('TypeError');
      expect(summary).toContain('Cannot read property');
    });

    it('uses last error when multiple errors exist', () => {
      const entries: NormalizedLogEntry[] = [
        makeEntry('error', 'First error: minor issue'),
        makeEntry('message', 'Retrying...'),
        makeEntry('error', 'Fatal error: critical failure'),
      ];
      const summary = generateLogSummary(entries, 'FAILED');
      expect(summary).toContain('critical failure');
    });

    it('falls back to last entry when no error entries exist', () => {
      const entries: NormalizedLogEntry[] = [
        makeEntry('message', 'Starting...'),
        makeEntry('message', 'Process terminated unexpectedly'),
      ];
      const summary = generateLogSummary(entries, 'FAILED');
      expect(summary).toContain('terminated unexpectedly');
    });
  });

  describe('COMPLETED jobs', () => {
    it('generates milestone summary with tool count', () => {
      const entries: NormalizedLogEntry[] = [
        makeEntry('message', 'Starting implementation'),
        makeEntry('tool_invocation', 'Read file: src/a.ts'),
        makeEntry('tool_invocation', 'Edit file: src/a.ts'),
        makeEntry('tool_invocation', 'Bash: npm test'),
        makeEntry('message', 'All tests pass. Implementation complete.'),
      ];
      const summary = generateLogSummary(entries, 'COMPLETED');
      expect(summary).toContain('3');
      expect(summary.length).toBeLessThanOrEqual(2000);
    });

    it('includes completion message', () => {
      const entries: NormalizedLogEntry[] = [
        makeEntry('message', 'Done with all tasks'),
      ];
      const summary = generateLogSummary(entries, 'COMPLETED');
      expect(summary).toContain('Done with all tasks');
    });

    it('includes tool invocation count in summary', () => {
      const entries: NormalizedLogEntry[] = [
        makeEntry('tool_invocation', 'Read file: src/a.ts'),
        makeEntry('tool_invocation', 'Edit file: src/a.ts'),
        makeEntry('tool_invocation', 'Bash: npm test'),
        makeEntry('tool_invocation', 'Read file: src/b.ts'),
        makeEntry('tool_invocation', 'Edit file: src/b.ts'),
        makeEntry('message', 'All done'),
      ];
      const summary = generateLogSummary(entries, 'COMPLETED');
      expect(summary).toContain('5 tool invocations');
    });

    it('includes key milestones and total entries', () => {
      const entries: NormalizedLogEntry[] = [
        makeEntry('message', 'Starting'),
        makeEntry('tool_invocation', 'Read file'),
        makeEntry('tool_invocation', 'Edit file'),
        makeEntry('message', 'Feature implemented successfully'),
      ];
      const summary = generateLogSummary(entries, 'COMPLETED');
      expect(summary).toContain('4 total entries');
      expect(summary).toContain('Feature implemented successfully');
    });
  });

  describe('CANCELLED jobs', () => {
    it('includes entry count and last entry content', () => {
      const entries: NormalizedLogEntry[] = [
        makeEntry('message', 'Starting work...'),
        makeEntry('tool_invocation', 'Read file: src/index.ts'),
        makeEntry('message', 'Analyzing code structure'),
      ];
      const summary = generateLogSummary(entries, 'CANCELLED');
      expect(summary).toContain('3');
      expect(summary).toContain('Cancelled');
    });

    it('handles single entry', () => {
      const entries: NormalizedLogEntry[] = [
        makeEntry('message', 'Starting...'),
      ];
      const summary = generateLogSummary(entries, 'CANCELLED');
      expect(summary).toContain('1');
    });
  });

  describe('summary length', () => {
    it('caps output at 2000 characters', () => {
      const entries: NormalizedLogEntry[] = Array.from({ length: 100 }, (_, i) =>
        makeEntry('error', `Error line ${i}: ${'x'.repeat(50)}`)
      );
      const summary = generateLogSummary(entries, 'FAILED');
      expect(summary.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('empty entries', () => {
    it('returns a minimal summary for empty entries', () => {
      const summary = generateLogSummary([], 'COMPLETED');
      expect(summary).toBeTruthy();
      expect(summary.length).toBeGreaterThan(0);
    });
  });
});
