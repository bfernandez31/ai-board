import type { Agent } from '@prisma/client';

export interface CostRangeUsd {
  lowerUsd: number;
  upperUsd: number;
}

// Token estimates summed across both analysis stages (scoping pass + grounded pass).
// Lower bound: small ticket text + few anchors. Upper: larger ticket + 5 anchors.
const ANALYSIS_INPUT_TOKEN_LOWER = 4000;
const ANALYSIS_INPUT_TOKEN_UPPER = 8000;
const ANALYSIS_OUTPUT_TOKEN_LOWER = 600;
const ANALYSIS_OUTPUT_TOKEN_UPPER = 1200;

interface ModelPricing {
  inputUsdPerM: number;
  outputUsdPerM: number;
}

// Per-million-token pricing. OpenAI/Mistral/Gemini values mirror
// lib/telemetry/otlp-processor.ts (single source maintained for telemetry cost).
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic (public pricing)
  'claude-opus-4-7':           { inputUsdPerM: 15,   outputUsdPerM: 75 },
  'claude-opus-4-6':           { inputUsdPerM: 15,   outputUsdPerM: 75 },
  'claude-sonnet-4-6':         { inputUsdPerM: 3,    outputUsdPerM: 15 },
  'claude-haiku-4-5-20251001': { inputUsdPerM: 1,    outputUsdPerM: 5 },
  // OpenAI / Codex
  'gpt-5-codex':               { inputUsdPerM: 1.25, outputUsdPerM: 10 },
  'gpt-5':                     { inputUsdPerM: 2,    outputUsdPerM: 8 },
  'gpt-5.4':                   { inputUsdPerM: 2.5,  outputUsdPerM: 15 },
  'gpt-5.5':                   { inputUsdPerM: 5,    outputUsdPerM: 30 },
  // Mistral
  'mistral-large-latest':      { inputUsdPerM: 2,    outputUsdPerM: 6 },
  'mistral-medium-latest':     { inputUsdPerM: 0.7,  outputUsdPerM: 2.1 },
  'mistral-small-latest':      { inputUsdPerM: 0.1,  outputUsdPerM: 0.3 },
  // Gemini
  'gemini-2.5-pro':            { inputUsdPerM: 1.25, outputUsdPerM: 10 },
  'gemini-2.5-flash':          { inputUsdPerM: 0.3,  outputUsdPerM: 2.5 },
};

const DEFAULT_MODEL_BY_AGENT: Record<Agent, string> = {
  CLAUDE: 'claude-sonnet-4-6',
  CODEX: 'gpt-5.4',
  MISTRAL: 'mistral-large-latest',
  GEMINI: 'gemini-2.5-pro',
};

const FALLBACK_PRICING: ModelPricing = { inputUsdPerM: 3, outputUsdPerM: 15 };

export function estimateAnalysisCostUsd(
  agent: Agent,
  model: string | null
): CostRangeUsd {
  const resolvedModel = model ?? DEFAULT_MODEL_BY_AGENT[agent];
  const pricing =
    MODEL_PRICING[resolvedModel] ??
    MODEL_PRICING[DEFAULT_MODEL_BY_AGENT[agent]] ??
    FALLBACK_PRICING;
  const lowerUsd =
    (ANALYSIS_INPUT_TOKEN_LOWER * pricing.inputUsdPerM +
      ANALYSIS_OUTPUT_TOKEN_LOWER * pricing.outputUsdPerM) /
    1_000_000;
  const upperUsd =
    (ANALYSIS_INPUT_TOKEN_UPPER * pricing.inputUsdPerM +
      ANALYSIS_OUTPUT_TOKEN_UPPER * pricing.outputUsdPerM) /
    1_000_000;
  return { lowerUsd, upperUsd };
}
