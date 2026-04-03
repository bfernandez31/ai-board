/**
 * Unit Test: /fix Command Pertinence Filtering
 *
 * Validates the /fix command file contains correct pertinence filtering rules
 * for Codex and Copilot findings. ai-board findings always skip filtering.
 * The actual filtering is performed by the Claude agent at runtime.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const COMMAND_FILE_PATH = resolve(
  process.cwd(),
  '.claude-plugin/commands/ai-board.fix.md'
);
const commandContent = readFileSync(COMMAND_FILE_PATH, 'utf-8');

describe('/fix command pertinence filtering rules', () => {
  it('should specify ai-board findings skip pertinence filter', () => {
    expect(commandContent).toContain(
      'ai-board findings ALWAYS skip this filter'
    );
  });

  it('should specify documentation nitpick rejection', () => {
    expect(commandContent).toContain('Documentation nitpick');
    expect(commandContent).toContain('comments, JSDoc, or README');
  });

  it('should specify tooling-caught issue rejection', () => {
    expect(commandContent).toContain('Already caught by tooling');
    expect(commandContent).toContain('TypeScript strict mode or ESLint');
  });

  it('should specify overengineering suggestion rejection', () => {
    expect(commandContent).toContain('Overengineering suggestion');
    expect(commandContent).toContain('unnecessary abstraction');
  });

  it('should specify false positive rejection', () => {
    expect(commandContent).toContain('False positive');
    expect(commandContent).toContain('code is actually correct');
  });

  it('should require reading constitution and CLAUDE.md for context', () => {
    expect(commandContent).toContain('constitution.md');
    expect(commandContent).toContain('CLAUDE.md');
  });

  it('should require recording rejection reasons', () => {
    expect(commandContent).toContain('FindingResolution');
    expect(commandContent).toContain('rejection');
    expect(commandContent).toContain('reason');
  });
});

describe('/fix command fix application rules', () => {
  it('should specify minimal targeted fixes', () => {
    expect(commandContent).toContain('minimal, targeted fix');
  });

  it('should specify sequential processing', () => {
    expect(commandContent).toContain('sequentially');
    expect(commandContent).toContain('in ID order');
  });

  it('should specify conflict handling for overlapping fixes', () => {
    expect(commandContent).toContain('conflict with higher-priority fix');
  });

  it('should specify post-fix validation', () => {
    expect(commandContent).toContain('bun run type-check');
    expect(commandContent).toContain('bun run lint');
  });

  it('should specify single grouped commit format', () => {
    expect(commandContent).toContain(
      'fix(review): address N review findings'
    );
  });
});

describe('/fix command error handling', () => {
  it('should handle no reviews found', () => {
    expect(commandContent).toContain('No Reviews Found');
    expect(commandContent).toContain('Run /review first');
  });

  it('should handle type-check/lint failure', () => {
    expect(commandContent).toContain(
      'Fix introduced errors that could not be resolved'
    );
  });

  it('should handle all findings rejected', () => {
    expect(commandContent).toContain('All Findings Rejected');
  });

  it('should specify result file format', () => {
    expect(commandContent).toContain('.ai-board-result.md');
    expect(commandContent).toContain('## Status');
    expect(commandContent).toContain('## Message');
    expect(commandContent).toContain('## Files Modified');
    expect(commandContent).toContain('## Summary');
  });

  it('should specify character limit for output', () => {
    expect(commandContent).toContain('1500 characters');
  });
});
