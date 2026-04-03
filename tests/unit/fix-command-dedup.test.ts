/**
 * Unit Test: /fix Command Deduplication Logic
 *
 * Validates the /fix command file contains correct deduplication instructions
 * for handling findings from multiple review sources.
 * The actual deduplication is performed by the Claude agent at runtime.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const COMMAND_FILE_PATH = resolve(
  process.cwd(),
  '.claude-plugin/commands/ai-board.fix.md'
);
const commandContent = readFileSync(COMMAND_FILE_PATH, 'utf-8');

describe('/fix command deduplication specification', () => {
  it('should specify deduplication by file path and line range overlap', () => {
    expect(commandContent).toContain('filePath');
    expect(commandContent).toContain('lineRangeOverlap');
  });

  it('should specify priority order: ai-board > Codex > Copilot', () => {
    expect(commandContent).toContain('ai-board > Codex > Copilot');
  });

  it('should specify keeping higher-priority source on conflict', () => {
    expect(commandContent).toContain(
      'keep the finding from the higher-priority source'
    );
  });

  it('should specify marking lower-priority as rejected with reason', () => {
    expect(commandContent).toContain('duplicate of #N');
  });

  it('should specify three review sources', () => {
    expect(commandContent).toContain("source`: `'ai-board'");
    expect(commandContent).toContain("source`: `'codex'");
    expect(commandContent).toContain("source`: `'copilot'");
  });

  it('should specify line range overlap detection', () => {
    expect(commandContent).toContain('line ranges overlap');
    expect(commandContent).toContain('line 10-15');
    expect(commandContent).toContain('line 12-18');
  });
});

describe('/fix command review source parsing', () => {
  it('should specify ai-board review fetching via issue comments', () => {
    expect(commandContent).toContain(
      'issues/{PR_NUMBER}/comments'
    );
    expect(commandContent).toContain('### Code review');
  });

  it('should specify Codex bot identification', () => {
    expect(commandContent).toContain('chatgpt-codex-connector[bot]');
  });

  it('should specify Copilot identification', () => {
    expect(commandContent).toContain('user.login == "Copilot"');
  });

  it('should specify PR review comments API for inline comments', () => {
    expect(commandContent).toContain(
      'pulls/{PR_NUMBER}/comments'
    );
  });

  it('should specify ai-board permalink parsing regex', () => {
    expect(commandContent).toContain(
      '/blob\\/[a-f0-9]+\\/(.+)#L(\\d+)(?:-L(\\d+))?/'
    );
  });

  it('should specify ai-board finding number regex', () => {
    expect(commandContent).toContain('/^(\\d+)\\.\\s+(.+)$/');
  });
});
