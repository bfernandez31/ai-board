import { describe, it, expect } from 'vitest';
import { projectAgentSchema, ticketAgentSchema } from '@/app/lib/schemas/agent';
import { AGENT_FILTER_VALUES, NAMED_AGENTS } from '@/lib/analytics/types';

describe('projectAgentSchema', () => {
  it('accepts CLAUDE', () => {
    expect(projectAgentSchema.parse('CLAUDE')).toBe('CLAUDE');
  });

  it('accepts CODEX', () => {
    expect(projectAgentSchema.parse('CODEX')).toBe('CODEX');
  });

  it('accepts MISTRAL', () => {
    expect(projectAgentSchema.parse('MISTRAL')).toBe('MISTRAL');
  });

  it('accepts GEMINI', () => {
    expect(projectAgentSchema.parse('GEMINI')).toBe('GEMINI');
  });

  it('rejects invalid values', () => {
    expect(() => projectAgentSchema.parse('INVALID')).toThrow();
  });

  it('rejects null', () => {
    expect(() => projectAgentSchema.parse(null)).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => projectAgentSchema.parse('')).toThrow();
  });
});

describe('ticketAgentSchema', () => {
  it('accepts CLAUDE', () => {
    expect(ticketAgentSchema.parse('CLAUDE')).toBe('CLAUDE');
  });

  it('accepts CODEX', () => {
    expect(ticketAgentSchema.parse('CODEX')).toBe('CODEX');
  });

  it('accepts MISTRAL', () => {
    expect(ticketAgentSchema.parse('MISTRAL')).toBe('MISTRAL');
  });

  it('accepts GEMINI', () => {
    expect(ticketAgentSchema.parse('GEMINI')).toBe('GEMINI');
  });

  it('accepts null', () => {
    expect(ticketAgentSchema.parse(null)).toBeNull();
  });

  it('rejects invalid values', () => {
    expect(() => ticketAgentSchema.parse('INVALID')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => ticketAgentSchema.parse('')).toThrow();
  });
});

describe('analytics agent types', () => {
  it('reuses the shared named agent list', () => {
    expect(NAMED_AGENTS).toEqual(['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']);
  });

  it('allows all plus every supported named agent as analytics filters', () => {
    expect(AGENT_FILTER_VALUES).toEqual(['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']);
  });
});
