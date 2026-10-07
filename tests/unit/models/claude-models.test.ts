import { describe, it, expect } from 'vitest';
import {
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  CLAUDE_GLOBAL_FALLBACK_MODEL,
  SMART_DEFAULTS,
  isClaudeModelId,
} from '@/lib/models/claude-models';

describe('claude-models', () => {
  it('includes the Claude 5.5 Opus and Sonnet model ids', () => {
    expect(CLAUDE_MODEL_IDS).toContain('claude-opus-5-5');
    expect(CLAUDE_MODEL_IDS).toContain('claude-sonnet-5-5');
  });

  it('exposes the Claude 5.5 models as the newest (first) options', () => {
    expect(CLAUDE_MODEL_IDS[0]).toBe('claude-opus-5-5');
    expect(CLAUDE_MODEL_IDS[1]).toBe('claude-sonnet-5-5');
  });

  it('labels the Claude 5.5 models', () => {
    expect(CLAUDE_MODEL_LABELS['claude-opus-5-5']).toBe('Claude Opus 5.5');
    expect(CLAUDE_MODEL_LABELS['claude-sonnet-5-5']).toBe('Claude Sonnet 5.5');
  });

  it('accepts the new ids via the type guard', () => {
    expect(isClaudeModelId('claude-opus-5-5')).toBe(true);
    expect(isClaudeModelId('claude-sonnet-5-5')).toBe(true);
  });

  it('defaults to Claude 5.5 for every stage (Opus for reasoning, Sonnet for build)', () => {
    expect(SMART_DEFAULTS.specifyModel).toBe('claude-opus-5-5');
    expect(SMART_DEFAULTS.planModel).toBe('claude-opus-5-5');
    expect(SMART_DEFAULTS.implementModel).toBe('claude-sonnet-5-5');
    expect(SMART_DEFAULTS.quickImplModel).toBe('claude-sonnet-5-5');
    expect(SMART_DEFAULTS.verifyModel).toBe('claude-sonnet-5-5');
  });

  it('uses Claude Opus 5.5 as the global fallback', () => {
    expect(CLAUDE_GLOBAL_FALLBACK_MODEL).toBe('claude-opus-5-5');
  });

  it('keeps a label for every model id', () => {
    for (const id of CLAUDE_MODEL_IDS) {
      expect(CLAUDE_MODEL_LABELS[id]).toBeTruthy();
    }
  });
});
