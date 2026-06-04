import { describe, it, expect } from 'vitest';
import { Agent, type Project, type Ticket } from '@prisma/client';
import { resolveStageModel, type TicketLikeForResolution } from '@/lib/workflows/model-resolution';
import { resolveEffectiveTokenSaving, type TicketWithProject } from '@/lib/workflows/transition';
import { CLAUDE_GLOBAL_FALLBACK_MODEL } from '@/lib/models/claude-models';
import { CODEX_GLOBAL_FALLBACK_MODEL } from '@/lib/models/codex-models';

const EMPTY: TicketLikeForResolution = {
  specifyModel: null,
  planModel: null,
  implementModel: null,
  quickImplModel: null,
  verifyModel: null,
  codexSpecifyModel: null,
  codexPlanModel: null,
  codexImplementModel: null,
  codexQuickImplModel: null,
  codexVerifyModel: null,
  project: {
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    codexSpecifyModel: null,
    codexPlanModel: null,
    codexImplementModel: null,
    codexQuickImplModel: null,
    codexVerifyModel: null,
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

  it.each([Agent.MISTRAL, Agent.GEMINI])(
    'returns null when effective agent is %s, even if Claude columns are set',
    (agent) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        implementModel: 'claude-opus-4-7',
        project: { ...EMPTY.project, implementModel: 'claude-sonnet-4-6' },
      };
      expect(resolveStageModel(ticket, 'implement', agent)).toBeNull();
    }
  );

  it('returns the Codex fallback (not a Claude ID) when effective agent is CODEX and only Claude columns are set', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      implementModel: 'claude-opus-4-7',
      project: { ...EMPTY.project, implementModel: 'claude-sonnet-4-6' },
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CODEX)).toBe(CODEX_GLOBAL_FALLBACK_MODEL);
  });

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

describe('resolveStageModel — Codex', () => {
  const commands = ['specify', 'plan', 'implement', 'quick-impl', 'verify'] as const;
  const codexStageKeys = [
    'codexSpecifyModel',
    'codexPlanModel',
    'codexImplementModel',
    'codexQuickImplModel',
    'codexVerifyModel',
  ] as const;

  it.each(commands.map((cmd, i) => [cmd, codexStageKeys[i]] as const))(
    'returns the Codex ticket override for command %s',
    (cmd, key) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        [key]: 'gpt-5.4-mini',
        project: { ...EMPTY.project, [key]: 'gpt-5.4' },
      };
      expect(resolveStageModel(ticket, cmd, Agent.CODEX)).toBe('gpt-5.4-mini');
    }
  );

  it.each(commands.map((cmd, i) => [cmd, codexStageKeys[i]] as const))(
    'falls back to project Codex default for command %s when ticket override is null',
    (cmd, key) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        project: { ...EMPTY.project, [key]: 'gpt-5.4' },
      };
      expect(resolveStageModel(ticket, cmd, Agent.CODEX)).toBe('gpt-5.4');
    }
  );

  it.each(commands)(
    'falls back to Codex global fallback when neither layer is set for command %s',
    (cmd) => {
      expect(resolveStageModel(EMPTY, cmd, Agent.CODEX)).toBe(CODEX_GLOBAL_FALLBACK_MODEL);
    }
  );

  it.each(['iterate', 'comment-specify', 'comment-plan', 'comment-verify', 'health-scan'])(
    'returns null for non-configurable command %s under CODEX',
    (cmd) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        codexImplementModel: 'gpt-5.5',
        project: { ...EMPTY.project, codexImplementModel: 'gpt-5.4' },
      };
      expect(resolveStageModel(ticket, cmd, Agent.CODEX)).toBeNull();
    }
  );

  it.each([Agent.MISTRAL, Agent.GEMINI])(
    'returns null when effective agent is %s, even if Codex columns are set',
    (agent) => {
      const ticket: TicketLikeForResolution = {
        ...EMPTY,
        codexImplementModel: 'gpt-5.5',
        project: { ...EMPTY.project, codexImplementModel: 'gpt-5.4' },
      };
      expect(resolveStageModel(ticket, 'implement', agent)).toBeNull();
    }
  );

  it('treats a stale Codex ticket value as "not set" and falls through to project', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      codexImplementModel: 'gpt-4-deprecated',
      project: { ...EMPTY.project, codexImplementModel: 'gpt-5.4' },
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CODEX)).toBe('gpt-5.4');
  });

  it('treats stale Codex values on both layers as "not set" and returns Codex fallback', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      codexImplementModel: 'gpt-4-deprecated',
      project: { ...EMPTY.project, codexImplementModel: 'gpt-3-ancient' },
    };
    expect(resolveStageModel(ticket, 'implement', Agent.CODEX)).toBe(CODEX_GLOBAL_FALLBACK_MODEL);
  });

  it('ignores Claude columns when effective agent is CODEX (cross-agent isolation)', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      implementModel: 'claude-opus-4-7',
      project: { ...EMPTY.project, implementModel: 'claude-sonnet-4-6' },
    };
    // Claude columns are populated, but Codex columns are not -> Codex fallback
    expect(resolveStageModel(ticket, 'implement', Agent.CODEX)).toBe(CODEX_GLOBAL_FALLBACK_MODEL);
  });

  it('ignores Codex columns when effective agent is CLAUDE (cross-agent isolation)', () => {
    const ticket: TicketLikeForResolution = {
      ...EMPTY,
      codexImplementModel: 'gpt-5.5',
      project: { ...EMPTY.project, codexImplementModel: 'gpt-5.4' },
    };
    // Codex columns are populated, but Claude columns are not -> Claude fallback
    expect(resolveStageModel(ticket, 'implement', Agent.CLAUDE)).toBe(CLAUDE_GLOBAL_FALLBACK_MODEL);
  });
});

describe('resolveEffectiveTokenSaving', () => {
  function makeTicket(ticketTokenSaving: boolean | null, projectTokenSaving: boolean): TicketWithProject {
    return {
      tokenSaving: ticketTokenSaving,
      project: { tokenSaving: projectTokenSaving },
    } as TicketWithProject;
  }

  it('returns ticket override when set to true', () => {
    expect(resolveEffectiveTokenSaving(makeTicket(true, false))).toBe(true);
  });

  it('returns ticket override when set to false', () => {
    expect(resolveEffectiveTokenSaving(makeTicket(false, true))).toBe(false);
  });

  it('falls back to project default when ticket is null', () => {
    expect(resolveEffectiveTokenSaving(makeTicket(null, true))).toBe(true);
  });

  it('falls back to project default false when ticket is null', () => {
    expect(resolveEffectiveTokenSaving(makeTicket(null, false))).toBe(false);
  });

  it('falls back to false when both are falsy', () => {
    const ticket = { tokenSaving: null, project: {} } as unknown as TicketWithProject;
    expect(resolveEffectiveTokenSaving(ticket)).toBe(false);
  });
});
