export const CODEX_MODEL_IDS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.2',
] as const;

export type CodexModelId = (typeof CODEX_MODEL_IDS)[number];

export const CODEX_MODEL_LABELS: Record<CodexModelId, string> = {
  'gpt-5.5': 'GPT-5.5',
  'gpt-5.4': 'GPT-5.4',
  'gpt-5.4-mini': 'GPT-5.4 mini',
  'gpt-5.3-codex': 'GPT-5.3 Codex',
  'gpt-5.2': 'GPT-5.2',
};

export const CODEX_GLOBAL_FALLBACK_MODEL: CodexModelId = 'gpt-5.5';

export type CodexStageModelKey =
  | 'codexSpecifyModel'
  | 'codexPlanModel'
  | 'codexImplementModel'
  | 'codexQuickImplModel'
  | 'codexVerifyModel';

export const CODEX_STAGE_MODEL_KEYS: readonly CodexStageModelKey[] = [
  'codexSpecifyModel',
  'codexPlanModel',
  'codexImplementModel',
  'codexQuickImplModel',
  'codexVerifyModel',
] as const;

export const CODEX_STAGE_MODEL_LABELS: Record<CodexStageModelKey, string> = {
  codexSpecifyModel: 'SPECIFY',
  codexPlanModel: 'PLAN',
  codexImplementModel: 'IMPLEMENT',
  codexQuickImplModel: 'QUICK-IMPL',
  codexVerifyModel: 'VERIFY',
};

export const CODEX_SMART_DEFAULTS: Record<CodexStageModelKey, CodexModelId> = {
  codexSpecifyModel: 'gpt-5.5',
  codexPlanModel: 'gpt-5.5',
  codexImplementModel: 'gpt-5.4',
  codexQuickImplModel: 'gpt-5.4-mini',
  codexVerifyModel: 'gpt-5.4-mini',
};

export function isCodexModelId(value: unknown): value is CodexModelId {
  return typeof value === 'string' && (CODEX_MODEL_IDS as readonly string[]).includes(value);
}

const CODEX_COMMAND_TO_STAGE_KEY: Record<string, CodexStageModelKey> = {
  specify: 'codexSpecifyModel',
  plan: 'codexPlanModel',
  implement: 'codexImplementModel',
  'quick-impl': 'codexQuickImplModel',
  verify: 'codexVerifyModel',
};

export function commandToCodexStageModelKey(command: string): CodexStageModelKey | null {
  return CODEX_COMMAND_TO_STAGE_KEY[command] ?? null;
}
