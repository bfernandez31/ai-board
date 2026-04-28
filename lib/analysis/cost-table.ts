import type { Agent } from '@prisma/client';

export interface CostRangeUsd {
  lowerUsd: number;
  upperUsd: number;
}

const DEFAULT_MODEL_BY_CLI: Record<string, string> = {
  'claude-code': 'claude-opus-4-7',
  'codex': 'gpt-5-codex',
  'mistral': 'mistral-large',
  'gemini': 'gemini-2.5-pro',
};

const COST_TABLE: Record<string, CostRangeUsd> = {
  'claude-code|claude-opus-4-7': { lowerUsd: 0.04, upperUsd: 0.08 },
  'claude-code|claude-sonnet-4-6': { lowerUsd: 0.012, upperUsd: 0.024 },
  'claude-code|claude-haiku-4-5-20251001': { lowerUsd: 0.003, upperUsd: 0.008 },
  'codex|gpt-5-codex': { lowerUsd: 0.05, upperUsd: 0.10 },
  'mistral|mistral-large': { lowerUsd: 0.02, upperUsd: 0.04 },
  'gemini|gemini-2.5-pro': { lowerUsd: 0.02, upperUsd: 0.05 },
};

const FALLBACK_RANGE: CostRangeUsd = { lowerUsd: 0.02, upperUsd: 0.10 };

function cliKeyForAgent(agent: Agent): string {
  switch (agent) {
    case 'CLAUDE':
      return 'claude-code';
    case 'CODEX':
      return 'codex';
    case 'MISTRAL':
      return 'mistral';
    case 'GEMINI':
      return 'gemini';
  }
}

export function estimateAnalysisCostUsd(
  agent: Agent,
  model: string | null
): CostRangeUsd {
  const cli = cliKeyForAgent(agent);
  const resolvedModel = model ?? DEFAULT_MODEL_BY_CLI[cli] ?? null;
  if (resolvedModel) {
    const direct = COST_TABLE[`${cli}|${resolvedModel}`];
    if (direct) return direct;
  }
  const defaultModel = DEFAULT_MODEL_BY_CLI[cli];
  if (defaultModel) {
    const fallbackForCli = COST_TABLE[`${cli}|${defaultModel}`];
    if (fallbackForCli) return fallbackForCli;
  }
  return FALLBACK_RANGE;
}
