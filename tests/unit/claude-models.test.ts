import { describe, it, expect } from 'vitest';
import { Agent } from '@prisma/client';
import {
  CLAUDE_MODEL_DEFAULT,
  CLAUDE_MODEL_IDS,
  CLAUDE_SMART_DEFAULTS,
  CLAUDE_STAGE_KEYS,
  commandToStageKey,
  getClaudeModelLabel,
  isValidClaudeModel,
  overriddenStageKeys,
  resolveClaudeModel,
  sanitizeClaudeModelMap,
} from '@/lib/workflows/claude-models';

describe('claude-models constants', () => {
  it('exposes four whitelisted model ids', () => {
    expect(CLAUDE_MODEL_IDS).toEqual([
      'claude-opus-4-7',
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
    ]);
  });

  it('default model is Opus 4.7', () => {
    expect(CLAUDE_MODEL_DEFAULT).toBe('claude-opus-4-7');
  });

  it('covers all five stage keys', () => {
    expect(CLAUDE_STAGE_KEYS).toEqual([
      'specify',
      'plan',
      'implement',
      'quickImpl',
      'verify',
    ]);
  });

  it('smart defaults use Sonnet for implement/quickImpl/verify', () => {
    expect(CLAUDE_SMART_DEFAULTS.specify).toBe('claude-opus-4-7');
    expect(CLAUDE_SMART_DEFAULTS.plan).toBe('claude-opus-4-7');
    expect(CLAUDE_SMART_DEFAULTS.implement).toBe('claude-sonnet-4-6');
    expect(CLAUDE_SMART_DEFAULTS.quickImpl).toBe('claude-sonnet-4-6');
    expect(CLAUDE_SMART_DEFAULTS.verify).toBe('claude-sonnet-4-6');
  });

  it('getClaudeModelLabel returns friendly name or falls back', () => {
    expect(getClaudeModelLabel('claude-opus-4-7')).toBe('Claude Opus 4.7');
    expect(getClaudeModelLabel('unknown-model')).toBe('unknown-model');
  });
});

describe('isValidClaudeModel', () => {
  it('accepts whitelisted ids', () => {
    for (const id of CLAUDE_MODEL_IDS) {
      expect(isValidClaudeModel(id)).toBe(true);
    }
  });

  it('rejects unknown ids and non-strings', () => {
    expect(isValidClaudeModel('gpt-4')).toBe(false);
    expect(isValidClaudeModel('')).toBe(false);
    expect(isValidClaudeModel(null)).toBe(false);
    expect(isValidClaudeModel(undefined)).toBe(false);
    expect(isValidClaudeModel(42)).toBe(false);
    expect(isValidClaudeModel({})).toBe(false);
  });
});

describe('commandToStageKey', () => {
  it('maps configurable commands to stage keys', () => {
    expect(commandToStageKey('specify')).toBe('specify');
    expect(commandToStageKey('plan')).toBe('plan');
    expect(commandToStageKey('implement')).toBe('implement');
    expect(commandToStageKey('quick-impl')).toBe('quickImpl');
    expect(commandToStageKey('verify')).toBe('verify');
  });

  it('returns null for out-of-scope commands', () => {
    expect(commandToStageKey('iterate')).toBeNull();
    expect(commandToStageKey('comment-plan')).toBeNull();
    expect(commandToStageKey('health-scan')).toBeNull();
    expect(commandToStageKey('retro-spec')).toBeNull();
    expect(commandToStageKey('onboard')).toBeNull();
    expect(commandToStageKey('ship')).toBeNull();
  });
});

describe('sanitizeClaudeModelMap', () => {
  it('keeps only whitelisted stage/model pairs', () => {
    const result = sanitizeClaudeModelMap({
      specify: 'claude-opus-4-7',
      plan: 'gpt-4',
      implement: 'claude-sonnet-4-6',
      bogus: 'claude-opus-4-7',
    });
    expect(result).toEqual({
      specify: 'claude-opus-4-7',
      implement: 'claude-sonnet-4-6',
    });
  });

  it('returns empty object for bogus input', () => {
    expect(sanitizeClaudeModelMap(null)).toEqual({});
    expect(sanitizeClaudeModelMap(undefined)).toEqual({});
    expect(sanitizeClaudeModelMap('not-an-object')).toEqual({});
    expect(sanitizeClaudeModelMap(42)).toEqual({});
  });
});

describe('resolveClaudeModel', () => {
  it('returns null for non-Claude agents', () => {
    expect(
      resolveClaudeModel({
        command: 'specify',
        effectiveAgent: Agent.CODEX,
        projectClaudeModels: { specify: 'claude-opus-4-6' },
        ticketClaudeModelOverrides: null,
      })
    ).toBeNull();
  });

  it('returns null for commands outside the configurable stages', () => {
    expect(
      resolveClaudeModel({
        command: 'iterate',
        effectiveAgent: Agent.CLAUDE,
        projectClaudeModels: null,
        ticketClaudeModelOverrides: null,
      })
    ).toBeNull();
  });

  it('uses ticket override when present', () => {
    expect(
      resolveClaudeModel({
        command: 'verify',
        effectiveAgent: Agent.CLAUDE,
        projectClaudeModels: { verify: 'claude-sonnet-4-6' },
        ticketClaudeModelOverrides: { verify: 'claude-haiku-4-5' },
      })
    ).toBe('claude-haiku-4-5');
  });

  it('falls back to project default when ticket has no override', () => {
    expect(
      resolveClaudeModel({
        command: 'plan',
        effectiveAgent: Agent.CLAUDE,
        projectClaudeModels: { plan: 'claude-opus-4-6' },
        ticketClaudeModelOverrides: null,
      })
    ).toBe('claude-opus-4-6');
  });

  it('falls back to Opus 4.7 when neither is set', () => {
    expect(
      resolveClaudeModel({
        command: 'implement',
        effectiveAgent: Agent.CLAUDE,
        projectClaudeModels: null,
        ticketClaudeModelOverrides: null,
      })
    ).toBe('claude-opus-4-7');
  });

  it('ignores unknown model ids on override and falls through', () => {
    expect(
      resolveClaudeModel({
        command: 'plan',
        effectiveAgent: Agent.CLAUDE,
        projectClaudeModels: { plan: 'claude-sonnet-4-6' },
        ticketClaudeModelOverrides: { plan: 'evil-model' },
      })
    ).toBe('claude-sonnet-4-6');
  });
});

describe('overriddenStageKeys', () => {
  it('returns keys whose model id is valid', () => {
    expect(
      overriddenStageKeys({
        specify: 'claude-opus-4-7',
        plan: 'bogus',
        verify: 'claude-haiku-4-5',
      })
    ).toEqual(['specify', 'verify']);
  });

  it('returns empty array for null input', () => {
    expect(overriddenStageKeys(null)).toEqual([]);
    expect(overriddenStageKeys({})).toEqual([]);
  });
});
