import { describe, expect, it } from 'vitest';
import {
  CLAUDE_GLOBAL_FALLBACK_MODEL,
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  SMART_DEFAULTS,
  isClaudeModelId,
} from '@/lib/models/claude-models';

describe('Claude model registry', () => {
  it('includes Claude Opus 4.8 as a selectable model', () => {
    expect(CLAUDE_MODEL_IDS).toContain('claude-opus-4-8');
    expect(CLAUDE_MODEL_LABELS['claude-opus-4-8']).toBe('Claude Opus 4.8');
    expect(isClaudeModelId('claude-opus-4-8')).toBe(true);
  });

  it('uses Claude Opus 4.8 for global and Opus smart defaults', () => {
    expect(CLAUDE_GLOBAL_FALLBACK_MODEL).toBe('claude-opus-4-8');
    expect(SMART_DEFAULTS.specifyModel).toBe('claude-opus-4-8');
    expect(SMART_DEFAULTS.planModel).toBe('claude-opus-4-8');
  });
});
