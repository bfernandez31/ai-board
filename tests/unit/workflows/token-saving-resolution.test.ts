import { describe, expect, it } from 'vitest';
import { Agent, Stage, TokenSavingOverride, TokenSavingRunStatus } from '@prisma/client';
import {
  canEditTokenSavingOverride,
  isTokenSavingApplicableToCommand,
  resolveInitialTokenSavingStatus,
  resolveTokenSavingRunSetting,
} from '@/lib/workflows/token-saving-resolution';

describe('resolveTokenSavingRunSetting', () => {
  it('inherits the project default when the ticket override is null', () => {
    expect(
      resolveTokenSavingRunSetting({
        tokenSavingOverride: null,
        project: { tokenSavingEnabled: true },
      })
    ).toEqual({
      projectDefault: true,
      override: null,
      effectiveEnabled: true,
      source: 'project',
    });
  });

  it('allows FORCE_ON to override a disabled project default', () => {
    expect(
      resolveTokenSavingRunSetting({
        tokenSavingOverride: TokenSavingOverride.FORCE_ON,
        project: { tokenSavingEnabled: false },
      })
    ).toEqual({
      projectDefault: false,
      override: TokenSavingOverride.FORCE_ON,
      effectiveEnabled: true,
      source: 'ticket',
    });
  });

  it('allows FORCE_OFF to override an enabled project default', () => {
    expect(
      resolveTokenSavingRunSetting({
        tokenSavingOverride: TokenSavingOverride.FORCE_OFF,
        project: { tokenSavingEnabled: true },
      })
    ).toEqual({
      projectDefault: true,
      override: TokenSavingOverride.FORCE_OFF,
      effectiveEnabled: false,
      source: 'ticket',
    });
  });
});

describe('canEditTokenSavingOverride', () => {
  it.each([Stage.INBOX])('allows edits in %s', (stage) => {
    expect(canEditTokenSavingOverride(stage)).toBe(true);
  });

  it.each([Stage.SPECIFY, Stage.PLAN, Stage.BUILD, Stage.VERIFY, Stage.SHIP, Stage.CLOSED])(
    'rejects edits in %s',
    (stage) => {
      expect(canEditTokenSavingOverride(stage)).toBe(false);
    }
  );
});

describe('isTokenSavingApplicableToCommand', () => {
  it.each([
    'specify',
    'plan',
    'implement',
    'quick-impl',
    'verify',
    'ai-board.specify',
    'ai-board.plan',
    'ai-board.implement',
    'ai-board.quick-impl',
    'ai-board.verify',
  ])('applies to Claude core command %s', (command) => {
    expect(isTokenSavingApplicableToCommand(command, Agent.CLAUDE)).toBe(true);
  });

  it.each(['comment-plan', 'iterate', 'deploy-preview', 'ai-board.code-review'])(
    'excludes auxiliary command %s',
    (command) => {
      expect(isTokenSavingApplicableToCommand(command, Agent.CLAUDE)).toBe(false);
    }
  );

  it.each([Agent.CODEX, Agent.MISTRAL, Agent.GEMINI])(
    'does not apply to non-Claude agent %s',
    (agent) => {
      expect(isTokenSavingApplicableToCommand('implement', agent)).toBe(false);
    }
  );
});

describe('resolveInitialTokenSavingStatus', () => {
  it('starts disabled runs as INACTIVE', () => {
    expect(
      resolveInitialTokenSavingStatus({
        tokenSavingRequested: false,
        effectiveAgent: Agent.CLAUDE,
        command: 'implement',
      })
    ).toBe(TokenSavingRunStatus.INACTIVE);
  });

  it('leaves requested Claude core runs as NOT_RECORDED until runner callback', () => {
    expect(
      resolveInitialTokenSavingStatus({
        tokenSavingRequested: true,
        effectiveAgent: Agent.CLAUDE,
        command: 'implement',
      })
    ).toBe(TokenSavingRunStatus.NOT_RECORDED);
  });

  it('marks requested non-Claude runs as NOT_APPLICABLE', () => {
    expect(
      resolveInitialTokenSavingStatus({
        tokenSavingRequested: true,
        effectiveAgent: Agent.CODEX,
        command: 'implement',
      })
    ).toBe(TokenSavingRunStatus.NOT_APPLICABLE);
  });

  it('marks requested auxiliary commands as NOT_APPLICABLE', () => {
    expect(
      resolveInitialTokenSavingStatus({
        tokenSavingRequested: true,
        effectiveAgent: Agent.CLAUDE,
        command: 'comment-build',
      })
    ).toBe(TokenSavingRunStatus.NOT_APPLICABLE);
  });
});
