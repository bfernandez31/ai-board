import { describe, it, expect } from 'vitest';
import { Agent } from '@prisma/client';
import {
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  isClaudeModelId,
} from '@/lib/models/claude-models';
import {
  CODEX_MODEL_IDS,
  CODEX_MODEL_LABELS,
  CODEX_GLOBAL_FALLBACK_MODEL,
  isCodexModelId,
} from '@/lib/models/codex-models';
import {
  AGENT_MODEL_METADATA,
  getAgentModelMetadata,
  isConfigurableAgent,
  isKnownModelId,
} from '@/lib/models/agent-models';

describe('claude-models: Opus 4.8 inclusion', () => {
  it('lists claude-opus-4-8 as a known Claude model', () => {
    expect(CLAUDE_MODEL_IDS).toContain('claude-opus-4-8');
    expect(CLAUDE_MODEL_LABELS['claude-opus-4-8']).toBe('Claude Opus 4.8');
    expect(isClaudeModelId('claude-opus-4-8')).toBe(true);
  });

  it('retains the older 4.7/4.6/Sonnet/Haiku entries', () => {
    for (const id of ['claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']) {
      expect(isClaudeModelId(id)).toBe(true);
    }
  });
});

describe('codex-models', () => {
  it('exposes the two GPT generations and codex variants', () => {
    expect(CODEX_MODEL_IDS).toContain('gpt-5.4');
    expect(CODEX_MODEL_IDS).toContain('gpt-5.5');
    expect(CODEX_MODEL_IDS).toContain('gpt-5.4-codex');
    expect(CODEX_MODEL_IDS).toContain('gpt-5.5-codex');
    expect(CODEX_MODEL_IDS).toContain('gpt-5.4-mini');
    expect(CODEX_MODEL_IDS).toContain('gpt-5.5-mini');
  });

  it('has a human label for every Codex model id', () => {
    for (const id of CODEX_MODEL_IDS) {
      expect(CODEX_MODEL_LABELS[id]).toBeTruthy();
    }
  });

  it('defaults to gpt-5.4 to match the runner script fallback', () => {
    expect(CODEX_GLOBAL_FALLBACK_MODEL).toBe('gpt-5.4');
  });

  it('rejects non-Codex strings via isCodexModelId', () => {
    expect(isCodexModelId('claude-opus-4-8')).toBe(false);
    expect(isCodexModelId('gpt-4o')).toBe(false);
    expect(isCodexModelId('')).toBe(false);
    expect(isCodexModelId(undefined)).toBe(false);
  });
});

describe('agent-models registry', () => {
  it('marks CLAUDE and CODEX as configurable agents', () => {
    expect(isConfigurableAgent(Agent.CLAUDE)).toBe(true);
    expect(isConfigurableAgent(Agent.CODEX)).toBe(true);
    expect(isConfigurableAgent(Agent.MISTRAL)).toBe(false);
    expect(isConfigurableAgent(Agent.GEMINI)).toBe(false);
  });

  it('returns metadata for CLAUDE and CODEX, null otherwise', () => {
    expect(getAgentModelMetadata(Agent.CLAUDE)).toBe(AGENT_MODEL_METADATA.CLAUDE);
    expect(getAgentModelMetadata(Agent.CODEX)).toBe(AGENT_MODEL_METADATA.CODEX);
    expect(getAgentModelMetadata(Agent.MISTRAL)).toBeNull();
    expect(getAgentModelMetadata(Agent.GEMINI)).toBeNull();
  });

  it('isKnownModelId accepts both Claude and Codex IDs', () => {
    expect(isKnownModelId('claude-opus-4-8')).toBe(true);
    expect(isKnownModelId('gpt-5.5-codex')).toBe(true);
    expect(isKnownModelId('made-up-model')).toBe(false);
  });
});
