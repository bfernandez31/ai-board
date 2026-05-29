import { describe, it, expect } from 'vitest';
import { Agent } from '@prisma/client';
import { resolveStageModel, type TicketLikeForResolution } from '@/lib/workflows/model-resolution';
import { CLAUDE_GLOBAL_FALLBACK_MODEL } from '@/lib/models/claude-models';
import { CODEX_GLOBAL_FALLBACK_MODEL } from '@/lib/models/codex-models';

const EMPTY: TicketLikeForResolution = {
  specifyModel: null,
  planModel: null,
  implementModel: null,
  quickImplModel: null,
  verifyModel: null,
  project: {
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
  },
};

describe('resolveStageModel', () => {
  const commands = ['specify', 'plan', 'implement', 'quick-impl', 'verify'] as const;
  const stageKeys = [
    'specifyModel',
    'planModel',
    'implementModel',
    'quickImplModel',
    'verifyModel',
  ] as const;

  it.each(commands.map((cmd, i) => [cmd, stageKeys[i]] as const))(
    'returns the ticket override for command %s (Claude)',
    (cmd, key) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        [key]: 'claude-haiku-4-5-20251001',
        project: { ...EMPTY.project, [key]: 'claude-sonnet-4-6' },
      };
      expect(resolveStageModel(ticket, cmd, Agent.CLAUDE)).toBe('claude-haiku-4-5-20251001');
    }
  );

  it.each(commands.map((cmd, i) => [cmd, stageKeys[i]] as const))(
    'falls back to project default for command %s when ticket override is null (Claude)',
    (cmd, key) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        project: { ...EMPTY.project, [key]: 'claude-sonnet-4-6' },
      };
      expect(resolveStageModel(ticket, cmd, Agent.CLAUDE)).toBe('claude-sonnet-4-6');
    }
  );

  it.each(commands)('falls back to global when neither layer is set for command %s (Claude)', (cmd) => {
    expect(resolveStageModel(EMPTY, cmd, Agent.CLAUDE)).toBe(CLAUDE_GLOBAL_FALLBACK_MODEL);
  });

  it('accepts claude-opus-4-8 as a valid Claude override', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      implementModel: 'claude-opus-4-8',
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CLAUDE)).toBe('claude-opus-4-8');
  });

  it.each(commands.map((cmd, i) => [cmd, stageKeys[i]] as const))(
    'returns the ticket override for command %s (Codex)',
    (cmd, key) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        [key]: 'gpt-5.5-codex',
        project: { ...EMPTY.project, [key]: 'gpt-5.4' },
      };
      expect(resolveStageModel(ticket, cmd, Agent.CODEX)).toBe('gpt-5.5-codex');
    }
  );

  it.each(commands.map((cmd, i) => [cmd, stageKeys[i]] as const))(
    'falls back to project default for command %s when ticket override is null (Codex)',
    (cmd, key) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        project: { ...EMPTY.project, [key]: 'gpt-5.5' },
      };
      expect(resolveStageModel(ticket, cmd, Agent.CODEX)).toBe('gpt-5.5');
    }
  );

  it.each(commands)('falls back to global when neither layer is set for command %s (Codex)', (cmd) => {
    expect(resolveStageModel(EMPTY, cmd, Agent.CODEX)).toBe(CODEX_GLOBAL_FALLBACK_MODEL);
  });

  it.each(['iterate', 'comment-specify', 'comment-plan', 'comment-verify', 'health-scan'])(
    'returns null for non-configurable command %s',
    (cmd) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        implementModel: 'claude-opus-4-6',
        project: { ...EMPTY.project, implementModel: 'claude-sonnet-4-6' },
      };
      expect(resolveStageModel(ticket, cmd, Agent.CLAUDE)).toBeNull();
    }
  );

  it.each([Agent.MISTRAL, Agent.GEMINI])(
    'returns null when effective agent is %s (not model-configurable)',
    (agent) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        implementModel: 'claude-opus-4-7',
        project: { ...EMPTY.project, implementModel: 'claude-sonnet-4-6' },
      };
      expect(resolveStageModel(ticket, 'implement', agent)).toBeNull();
    }
  );

  it('treats a stale ticket value as "not set" and falls through to project (Claude)', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      implementModel: 'claude-opus-3-deprecated',
      project: { ...EMPTY.project, implementModel: 'claude-sonnet-4-6' },
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CLAUDE)).toBe('claude-sonnet-4-6');
  });

  it('treats stale values on both layers as "not set" and returns Claude fallback', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      implementModel: 'claude-opus-3-deprecated',
      project: { ...EMPTY.project, implementModel: 'claude-ancient' },
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CLAUDE)).toBe(CLAUDE_GLOBAL_FALLBACK_MODEL);
  });

  it('treats a Codex value stored on a Claude resolution as stale, falling through', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      implementModel: 'gpt-5.5',
      project: { ...EMPTY.project, implementModel: 'claude-sonnet-4-6' },
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CLAUDE)).toBe('claude-sonnet-4-6');
  });

  it('treats a Claude value stored on a Codex resolution as stale, falling through', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      implementModel: 'claude-opus-4-8',
      project: { ...EMPTY.project, implementModel: 'gpt-5.4-codex' },
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CODEX)).toBe('gpt-5.4-codex');
  });
});
