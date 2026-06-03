import { Agent, Stage, TokenSavingOverride, TokenSavingRunStatus } from '@prisma/client';
import { canEditDescriptionAndPolicy } from '@/lib/utils/field-edit-permissions';

export type TokenSavingSource = 'project' | 'ticket';

export interface TokenSavingProjectLike {
  tokenSavingEnabled: boolean;
}

export interface TokenSavingTicketLike {
  tokenSavingOverride: TokenSavingOverride | null;
  project: TokenSavingProjectLike;
}

export interface TokenSavingRunSetting {
  projectDefault: boolean;
  override: TokenSavingOverride | null;
  effectiveEnabled: boolean;
  source: TokenSavingSource;
}

export interface InitialTokenSavingStatusInput {
  tokenSavingRequested: boolean;
  effectiveAgent: Agent;
  command: string;
}

const CORE_TOKEN_SAVING_COMMANDS = new Set([
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
]);

export function resolveTokenSavingRunSetting(
  ticket: TokenSavingTicketLike
): TokenSavingRunSetting {
  if (ticket.tokenSavingOverride === TokenSavingOverride.FORCE_ON) {
    return {
      projectDefault: ticket.project.tokenSavingEnabled,
      override: ticket.tokenSavingOverride,
      effectiveEnabled: true,
      source: 'ticket',
    };
  }

  if (ticket.tokenSavingOverride === TokenSavingOverride.FORCE_OFF) {
    return {
      projectDefault: ticket.project.tokenSavingEnabled,
      override: ticket.tokenSavingOverride,
      effectiveEnabled: false,
      source: 'ticket',
    };
  }

  return {
    projectDefault: ticket.project.tokenSavingEnabled,
    override: null,
    effectiveEnabled: ticket.project.tokenSavingEnabled,
    source: 'project',
  };
}

export function canEditTokenSavingOverride(stage: Stage): boolean {
  return canEditDescriptionAndPolicy(stage);
}

export function isTokenSavingApplicableToCommand(command: string, effectiveAgent: Agent): boolean {
  return effectiveAgent === Agent.CLAUDE && CORE_TOKEN_SAVING_COMMANDS.has(command);
}

export function resolveInitialTokenSavingStatus(
  input: InitialTokenSavingStatusInput
): TokenSavingRunStatus {
  if (!input.tokenSavingRequested) {
    return TokenSavingRunStatus.INACTIVE;
  }

  if (!isTokenSavingApplicableToCommand(input.command, input.effectiveAgent)) {
    return TokenSavingRunStatus.NOT_APPLICABLE;
  }

  return TokenSavingRunStatus.NOT_RECORDED;
}
