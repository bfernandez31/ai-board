import { describe, it, expect } from 'vitest';
import { resolveEffectiveAgent } from '@/app/lib/utils/agent-resolution';

describe('resolveEffectiveAgent', () => {
  it('returns project default when ticket agent is null', () => {
    expect(resolveEffectiveAgent(null, 'CLAUDE')).toBe('CLAUDE');
    expect(resolveEffectiveAgent(null, 'CODEX')).toBe('CODEX');
  });

  it('returns ticket agent when explicitly set', () => {
    expect(resolveEffectiveAgent('CODEX', 'CLAUDE')).toBe('CODEX');
    expect(resolveEffectiveAgent('CLAUDE', 'CODEX')).toBe('CLAUDE');
  });

  it('returns ticket agent even when it matches project default', () => {
    expect(resolveEffectiveAgent('CLAUDE', 'CLAUDE')).toBe('CLAUDE');
    expect(resolveEffectiveAgent('CODEX', 'CODEX')).toBe('CODEX');
  });
});
