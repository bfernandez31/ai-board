export const CLAUDE_MODEL_IDS = [
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const;

export type ClaudeModelId = (typeof CLAUDE_MODEL_IDS)[number];

export const CLAUDE_MODEL_LABELS: Record<ClaudeModelId, string> = {
  'claude-opus-4-8': 'Claude Opus 4.8',
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
};

export const CLAUDE_GLOBAL_FALLBACK_MODEL: ClaudeModelId = 'claude-opus-4-8';

export type StageModelKey =
  | 'specifyModel'
  | 'planModel'
  | 'implementModel'
  | 'quickImplModel'
  | 'verifyModel';

export const STAGE_MODEL_KEYS: readonly StageModelKey[] = [
  'specifyModel',
  'planModel',
  'implementModel',
  'quickImplModel',
  'verifyModel',
] as const;

export const STAGE_MODEL_LABELS: Record<StageModelKey, string> = {
  specifyModel: 'SPECIFY',
  planModel: 'PLAN',
  implementModel: 'IMPLEMENT',
  quickImplModel: 'QUICK-IMPL',
  verifyModel: 'VERIFY',
};

export const SMART_DEFAULTS: Record<StageModelKey, ClaudeModelId> = {
  specifyModel: CLAUDE_GLOBAL_FALLBACK_MODEL,
  planModel: CLAUDE_GLOBAL_FALLBACK_MODEL,
  implementModel: 'claude-sonnet-4-6',
  quickImplModel: 'claude-sonnet-4-6',
  verifyModel: 'claude-sonnet-4-6',
};

export function isClaudeModelId(value: unknown): value is ClaudeModelId {
  return (
    typeof value === 'string' &&
    (CLAUDE_MODEL_IDS as readonly string[]).includes(value)
  );
}

const COMMAND_TO_STAGE_KEY: Record<string, StageModelKey> = {
  specify: 'specifyModel',
  plan: 'planModel',
  implement: 'implementModel',
  'quick-impl': 'quickImplModel',
  verify: 'verifyModel',
};

export function commandToStageModelKey(command: string): StageModelKey | null {
  return COMMAND_TO_STAGE_KEY[command] ?? null;
}
