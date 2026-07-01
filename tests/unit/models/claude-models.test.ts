import { describe, it, expect } from 'vitest';
import {
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  isClaudeModelId,
} from '@/lib/models/claude-models';

describe('Claude model list', () => {
  it('includes Sonnet 5 as an available model', () => {
    expect(CLAUDE_MODEL_IDS).toContain('claude-sonnet-5');
    expect(isClaudeModelId('claude-sonnet-5')).toBe(true);
  });

  it('exposes a display label for Sonnet 5', () => {
    expect(CLAUDE_MODEL_LABELS['claude-sonnet-5']).toBe('Claude Sonnet 5');
  });

  it('provides a label for every model id', () => {
    for (const id of CLAUDE_MODEL_IDS) {
      expect(CLAUDE_MODEL_LABELS[id]).toBeTruthy();
    }
  });
});
