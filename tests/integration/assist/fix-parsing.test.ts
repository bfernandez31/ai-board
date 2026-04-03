/**
 * Integration Test: /fix Review Parsing
 *
 * Validates that the /fix command file correctly specifies parsing instructions
 * for all three review sources (ai-board, Codex, Copilot) and the ReviewFinding
 * data structure mapping.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const COMMAND_PATH = resolve(
  process.cwd(),
  '.claude-plugin/commands/ai-board.fix.md'
);
const DATA_MODEL_PATH = resolve(
  process.cwd(),
  'specs/AIB-494-add-fix-assist/data-model.md'
);

const commandContent = readFileSync(COMMAND_PATH, 'utf-8');

describe('/fix ai-board review parsing', () => {
  it('should fetch issue comments for ai-board reviews', () => {
    expect(commandContent).toContain('issues/{PR_NUMBER}/comments');
  });

  it('should filter by Code review header', () => {
    expect(commandContent).toContain('### Code review');
  });

  it('should parse numbered findings with regex', () => {
    expect(commandContent).toContain('^(\\d+)\\.\\s+(.+)$');
  });

  it('should extract file paths from GitHub permalinks', () => {
    expect(commandContent).toContain('blob\\/[a-f0-9]+');
    expect(commandContent).toContain('#L(\\d+)');
  });

  it('should map to ReviewFinding with ai-board source', () => {
    expect(commandContent).toContain("`source`: `'ai-board'`");
  });
});

describe('/fix Codex review parsing', () => {
  it('should fetch pull request comments for Codex', () => {
    expect(commandContent).toContain('pulls/{PR_NUMBER}/comments');
  });

  it('should filter by chatgpt-codex-connector bot author', () => {
    expect(commandContent).toContain('chatgpt-codex-connector[bot]');
  });

  it('should extract path and line from API response', () => {
    expect(commandContent).toContain('`path`');
    expect(commandContent).toContain('`line`');
    expect(commandContent).toContain('`original_line`');
  });

  it('should detect P1/P2 priority badges', () => {
    expect(commandContent).toContain('P1');
    expect(commandContent).toContain('P2');
    expect(commandContent).toContain('priority badge');
  });
});

describe('/fix Copilot review parsing', () => {
  it('should use same API endpoint as Codex', () => {
    // Both use pulls/{PR_NUMBER}/comments
    const pullsCommentRefs = commandContent.match(
      /pulls\/\{PR_NUMBER\}\/comments/g
    );
    expect(pullsCommentRefs).not.toBeNull();
    expect(pullsCommentRefs!.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by Copilot author', () => {
    expect(commandContent).toContain('user.login == "Copilot"');
  });

  it('should map to ReviewFinding with copilot source', () => {
    expect(commandContent).toContain("`source`: `'copilot'`");
  });
});

describe('/fix ReviewFinding structure completeness', () => {
  it('should specify all ReviewFinding fields from data model', () => {
    expect(commandContent).toContain('id');
    expect(commandContent).toContain('source');
    expect(commandContent).toContain('sourceIndex');
    expect(commandContent).toContain('filePath');
    expect(commandContent).toContain('lineStart');
    expect(commandContent).toContain('lineEnd');
    expect(commandContent).toContain('description');
    expect(commandContent).toContain('priority');
    expect(commandContent).toContain('permalinkUrl');
    expect(commandContent).toContain('rawComment');
  });

  it('should assign sequential IDs across all sources', () => {
    expect(commandContent).toContain(
      'Sequential ID within this fix run'
    );
    expect(commandContent).toContain(
      'ai-board first, then Codex, then Copilot'
    );
  });
});

describe('/fix data model alignment', () => {
  it('should have data model documentation', () => {
    const dataModel = readFileSync(DATA_MODEL_PATH, 'utf-8');
    expect(dataModel).toContain('ReviewFinding');
    expect(dataModel).toContain('FindingResolution');
    expect(dataModel).toContain('FixResult');
  });

  it('should reference FindingResolution statuses from data model', () => {
    expect(commandContent).toContain('fixed');
    expect(commandContent).toContain('rejected');
    expect(commandContent).toContain('skipped');
    expect(commandContent).toContain('conflict');
    expect(commandContent).toContain('not_found');
  });
});
