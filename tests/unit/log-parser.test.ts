import { describe, expect, it } from 'vitest';
import { parseAgentOutput } from '@/lib/logs/log-parser';
import type { NormalizedLogEntry } from '@/lib/logs/types';

describe('parseAgentOutput', () => {
  describe('CLAUDE agent', () => {
    it('parses tool invocations from Claude output', () => {
      const raw = `I'll read the file first.

> Read file: src/index.ts

The file contains the main entry point.

> Edit file: src/index.ts

I've updated the file with the fix.`;

      const entries = parseAgentOutput(raw, 'CLAUDE');
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e: NormalizedLogEntry) => e.timestamp)).toBe(true);
      expect(entries.every((e: NormalizedLogEntry) => e.eventType)).toBe(true);
      expect(entries.every((e: NormalizedLogEntry) => e.content)).toBe(true);
    });

    it('parses error output from Claude', () => {
      const raw = `Error: TypeScript compilation failed
  src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.`;

      const entries = parseAgentOutput(raw, 'CLAUDE');
      expect(entries.length).toBeGreaterThan(0);
      const errorEntries = entries.filter((e: NormalizedLogEntry) => e.eventType === 'error');
      expect(errorEntries.length).toBeGreaterThan(0);
    });

    it('parses multi-line Claude conversation', () => {
      const raw = `Let me analyze the issue.

> Bash: npm test

Tests failed with 3 errors.

> Read file: tests/app.test.ts

I see the problem - the mock is incorrect.

> Edit file: tests/app.test.ts

Fixed the mock. Let me re-run the tests.

> Bash: npm test

All tests pass now.`;

      const entries = parseAgentOutput(raw, 'CLAUDE');
      expect(entries.length).toBeGreaterThanOrEqual(4);
      const toolEntries = entries.filter((e: NormalizedLogEntry) => e.eventType === 'tool_invocation');
      expect(toolEntries.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('CODEX agent', () => {
    it('parses Codex output format', () => {
      const raw = `Thinking about the problem...

I will fix the bug in the auth module.

Running: npm test
Output: All 5 tests passed

Writing file: src/auth.ts
Done - applied the fix.`;

      const entries = parseAgentOutput(raw, 'CODEX');
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e: NormalizedLogEntry) => e.timestamp)).toBe(true);
    });
  });

  describe('MISTRAL agent', () => {
    it('parses Mistral/vibe output format', () => {
      const raw = `Analyzing the codebase...

Tool call: read_file("src/main.ts")
Result: File contents read successfully.

Tool call: write_file("src/main.ts")
Result: File written successfully.

Implementation complete.`;

      const entries = parseAgentOutput(raw, 'MISTRAL');
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e: NormalizedLogEntry) => e.timestamp)).toBe(true);
    });
  });

  describe('GEMINI agent', () => {
    it('parses Gemini output format', () => {
      const raw = `I'll implement the requested feature.

Using tool: ReadFile
Path: src/component.tsx

Using tool: WriteFile
Path: src/component.tsx

Feature implemented successfully.`;

      const entries = parseAgentOutput(raw, 'GEMINI');
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e: NormalizedLogEntry) => e.timestamp)).toBe(true);
    });
  });

  describe('fallback behavior', () => {
    it('returns a single message entry on parse failure', () => {
      const raw = '';
      const entries = parseAgentOutput(raw, 'CLAUDE');
      expect(entries).toHaveLength(1);
      expect(entries[0].eventType).toBe('message');
    });

    it('handles unknown agent type with fallback', () => {
      const raw = 'Some agent output';
      const entries = parseAgentOutput(raw, 'UNKNOWN');
      expect(entries).toHaveLength(1);
      expect(entries[0].eventType).toBe('message');
      expect(entries[0].content).toBe('Some agent output');
    });

    it('handles null-like content gracefully', () => {
      const entries = parseAgentOutput('   ', 'CLAUDE');
      expect(entries).toHaveLength(1);
      expect(entries[0].eventType).toBe('message');
    });
  });
});
