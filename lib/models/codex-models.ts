import type { StageModelKey } from '@/lib/models/claude-models';

export const CODEX_MODEL_IDS = [
  'gpt-5.5',
  'gpt-5.5-mini',
  'gpt-5.5-codex',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-codex',
] as const;

export type CodexModelId = (typeof CODEX_MODEL_IDS)[number];

export const CODEX_MODEL_LABELS: Record<CodexModelId, string> = {
  'gpt-5.5': 'GPT-5.5',
  'gpt-5.5-mini': 'GPT-5.5 Mini',
  'gpt-5.5-codex': 'GPT-5.5 Codex',
  'gpt-5.4': 'GPT-5.4',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gpt-5.4-codex': 'GPT-5.4 Codex',
};

// Matches the runner's default in .github/scripts/run-agent.sh (CODEX_MODEL fallback).
export const CODEX_GLOBAL_FALLBACK_MODEL: CodexModelId = 'gpt-5.4';

export const CODEX_SMART_DEFAULTS: Record<StageModelKey, CodexModelId> = {
  specifyModel: 'gpt-5.5',
  planModel: 'gpt-5.5',
  implementModel: 'gpt-5.5-codex',
  quickImplModel: 'gpt-5.5-codex',
  verifyModel: 'gpt-5.5-codex',
};

export function isCodexModelId(value: unknown): value is CodexModelId {
  return typeof value === 'string' && (CODEX_MODEL_IDS as readonly string[]).includes(value);
}
