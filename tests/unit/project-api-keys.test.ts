import { describe, expect, it } from 'vitest';
import {
  buildProjectApiKeysState,
  decryptProjectApiKey,
  encryptProjectApiKey,
  getMissingProjectApiKeyMessage,
  getProjectApiKeyPreview,
  maskProjectApiKey,
} from '@/lib/project-api-keys';
import { Agent } from '@prisma/client';

describe('project api keys', () => {
  it('encrypts and decrypts api keys losslessly', () => {
    const value = 'sk-ant-test-12345678';
    const encrypted = encryptProjectApiKey(value);

    expect(encrypted).not.toBe(value);
    expect(decryptProjectApiKey(encrypted)).toBe(value);
  });

  it('builds masked summaries from previews', () => {
    const state = buildProjectApiKeysState({
      anthropicApiKeyPreview: '5678',
      openaiApiKeyPreview: null,
    });

    expect(state.anthropic.configured).toBe(true);
    expect(state.anthropic.maskedValue).toBe('••••5678');
    expect(state.openai.configured).toBe(false);
    expect(state.openai.maskedValue).toBeNull();
  });

  it('extracts previews and missing-key messages', () => {
    expect(getProjectApiKeyPreview('sk-openai-test-12345678')).toBe('5678');
    expect(maskProjectApiKey('5678')).toBe('••••5678');
    expect(getMissingProjectApiKeyMessage(Agent.CLAUDE)).toContain('Anthropic API key');
    expect(getMissingProjectApiKeyMessage(Agent.CODEX)).toContain('OpenAI API key');
  });
});
