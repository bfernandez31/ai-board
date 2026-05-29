import type { StageModelKey } from '@/lib/models/claude-models';

export const CODEX_MODEL_IDS = [
  'gpt-5-codex',
  'gpt-5',
  'gpt-5.4',
  'gpt-5.5',
] as const;

export type CodexModelId = (typeof CODEX_MODEL_IDS)[number];

export const CODEX_MODEL_LABELS: Record<CodexModelId, string> = {
  'gpt-5-codex': 'GPT-5 Codex',
  'gpt-5': 'GPT-5',
  'gpt-5.4': 'GPT-5.4',
  'gpt-5.5': 'GPT-5.5',
};

export const CODEX_GLOBAL_FALLBACK_MODEL: CodexModelId = 'gpt-5.4';

export const CODEX_SMART_DEFAULTS: Record<StageModelKey, CodexModelId> = {
  specifyModel: 'gpt-5.5',
  planModel: 'gpt-5.5',
  implementModel: 'gpt-5.4',
  quickImplModel: 'gpt-5.4',
  verifyModel: 'gpt-5.4',
};

export function isCodexModelId(value: unknown): value is CodexModelId {
  return typeof value === 'string' && (CODEX_MODEL_IDS as readonly string[]).includes(value);
}
