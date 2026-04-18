import { describe, it, expect } from 'vitest';
import { Agent } from '@prisma/client';
import { resolveStageModel, type TicketLikeForResolution } from '@/lib/workflows/model-resolution';
import { CLAUDE_GLOBAL_FALLBACK_MODEL } from '@/lib/models/claude-models';

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
    'returns the ticket override for command %s',
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
    'falls back to project default for command %s when ticket override is null',
    (cmd, key) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        project: { ...EMPTY.project, [key]: 'claude-sonnet-4-6' },
      };
      expect(resolveStageModel(ticket, cmd, Agent.CLAUDE)).toBe('claude-sonnet-4-6');
    }
  );

  it.each(commands)('falls back to global when neither layer is set for command %s', (cmd) => {
    expect(resolveStageModel(EMPTY, cmd, Agent.CLAUDE)).toBe(CLAUDE_GLOBAL_FALLBACK_MODEL);
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

  it.each([Agent.CODEX, Agent.MISTRAL, Agent.GEMINI])(
    'returns null when effective agent is %s, even if columns are set',
    (agent) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        implementModel: 'claude-opus-4-7',
        project: { ...EMPTY.project, implementModel: 'claude-sonnet-4-6' },
      };
      expect(resolveStageModel(ticket, 'implement', agent)).toBeNull();
    }
  );

  it('treats a stale ticket value as "not set" and falls through to project', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      implementModel: 'claude-opus-3-deprecated',
      project: { ...EMPTY.project, implementModel: 'claude-sonnet-4-6' },
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CLAUDE)).toBe('claude-sonnet-4-6');
  });

  it('treats stale values on both layers as "not set" and returns fallback', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      implementModel: 'claude-opus-3-deprecated',
      project: { ...EMPTY.project, implementModel: 'claude-ancient' },
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CLAUDE)).toBe(CLAUDE_GLOBAL_FALLBACK_MODEL);
  });
});
