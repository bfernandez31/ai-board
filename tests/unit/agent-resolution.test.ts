import { describe, it, expect } from 'vitest';
import {
  ALL_AGENTS,
  resolveEffectiveAgent,
  supportsOnboardAgent,
  supportsSetupAgentSelection,
  supportsWorkflowCommand,
} from '@/app/lib/utils/agent-resolution';

describe('resolveEffectiveAgent', () => {
  it('returns project default when ticket agent is null', () => {
    expect(resolveEffectiveAgent(null, 'CLAUDE')).toBe('CLAUDE');
    expect(resolveEffectiveAgent(null, 'CODEX')).toBe('CODEX');
    expect(resolveEffectiveAgent(null, 'MISTRAL')).toBe('MISTRAL');
    expect(resolveEffectiveAgent(null, 'GEMINI')).toBe('GEMINI');
  });

  it('returns ticket agent when explicitly set', () => {
    expect(resolveEffectiveAgent('CODEX', 'CLAUDE')).toBe('CODEX');
    expect(resolveEffectiveAgent('CLAUDE', 'CODEX')).toBe('CLAUDE');
    expect(resolveEffectiveAgent('MISTRAL', 'CLAUDE')).toBe('MISTRAL');
  });

  it('returns ticket agent even when it matches project default', () => {
    expect(resolveEffectiveAgent('CLAUDE', 'CLAUDE')).toBe('CLAUDE');
    expect(resolveEffectiveAgent('CODEX', 'CODEX')).toBe('CODEX');
    expect(resolveEffectiveAgent('MISTRAL', 'MISTRAL')).toBe('MISTRAL');
    expect(resolveEffectiveAgent('GEMINI', 'GEMINI')).toBe('GEMINI');
  });

  it('falls back to project default MISTRAL when ticket agent is null', () => {
    expect(resolveEffectiveAgent(null, 'MISTRAL')).toBe('MISTRAL');
  });

  it('marks Gemini as unsupported for onboarding', () => {
    expect(supportsOnboardAgent('GEMINI')).toBe(false);
    expect(supportsOnboardAgent('CLAUDE')).toBe(true);
  });

  it('only allows Gemini on supported workflows', () => {
    expect(supportsWorkflowCommand('GEMINI', 'specify')).toBe(true);
    expect(supportsWorkflowCommand('GEMINI', 'quick-impl')).toBe(true);
    expect(supportsWorkflowCommand('GEMINI', 'verify')).toBe(true);
    expect(supportsWorkflowCommand('CLAUDE', 'verify')).toBe(true);
  });

  it('exposes a shared supported-agent list in stable analytics order', () => {
    expect(ALL_AGENTS).toEqual(['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']);
  });

  it('keeps every supported agent selectable during project setup', () => {
    expect(ALL_AGENTS.every((agent) => supportsSetupAgentSelection(agent))).toBe(true);
  });

  it('supports filtering inherited project-default activity when ticket agent is unset', () => {
    const effectiveAgents = [
      resolveEffectiveAgent(null, 'CLAUDE'),
      resolveEffectiveAgent(null, 'CLAUDE'),
      resolveEffectiveAgent(null, 'CODEX'),
    ];

    expect(effectiveAgents.filter((agent) => agent === 'CLAUDE')).toHaveLength(2);
    expect(effectiveAgents.filter((agent) => agent === 'CODEX')).toHaveLength(1);
  });

  it('keeps explicit ticket agents overriding inherited defaults during mixed aggregation', () => {
    const effectiveAgents = [
      resolveEffectiveAgent(null, 'CLAUDE'),
      resolveEffectiveAgent('CODEX', 'CLAUDE'),
      resolveEffectiveAgent('GEMINI', 'MISTRAL'),
    ];

    expect(effectiveAgents).toEqual(['CLAUDE', 'CODEX', 'GEMINI']);
  });
});
