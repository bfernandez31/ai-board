import { describe, it, expect } from 'vitest';
import { projectAgentSchema, ticketAgentSchema } from '@/app/lib/schemas/agent';

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
