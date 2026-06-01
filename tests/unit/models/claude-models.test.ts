import { describe, expect, it } from 'vitest';
import {
  CLAUDE_GLOBAL_FALLBACK_MODEL,
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  SMART_DEFAULTS,
  isClaudeModelId,
} from '@/lib/models/claude-models';

const CLAUDE_OPUS_48 = 'claude-opus-4-8';

describe('Claude model registry', () => {
  it('includes Claude Opus 4.8 as a selectable model', () => {
    expect(CLAUDE_MODEL_IDS).toContain(CLAUDE_OPUS_48);
    expect(CLAUDE_MODEL_LABELS[CLAUDE_OPUS_48]).toBe('Claude Opus 4.8');
    expect(isClaudeModelId(CLAUDE_OPUS_48)).toBe(true);
  });

  it('uses Claude Opus 4.8 for global and Opus smart defaults', () => {
    expect(CLAUDE_GLOBAL_FALLBACK_MODEL).toBe(CLAUDE_OPUS_48);
    expect(SMART_DEFAULTS.specifyModel).toBe(CLAUDE_GLOBAL_FALLBACK_MODEL);
    expect(SMART_DEFAULTS.planModel).toBe(CLAUDE_GLOBAL_FALLBACK_MODEL);
  });
});
