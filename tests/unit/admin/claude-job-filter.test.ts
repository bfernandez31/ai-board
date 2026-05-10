import { describe, it, expect } from 'vitest';
import {
  effectiveAgent,
  isClaudeJob,
} from '@/lib/admin/insights/claude-job-filter';

describe('effectiveAgent', () => {
  it('returns ticket.agent when set', () => {
    expect(
      effectiveAgent({ ticketAgent: 'CODEX', projectDefaultAgent: 'CLAUDE' })
    ).toBe('CODEX');
  });

  it('falls back to project.defaultAgent when ticket agent is null', () => {
    expect(
      effectiveAgent({ ticketAgent: null, projectDefaultAgent: 'GEMINI' })
    ).toBe('GEMINI');
  });

  it('falls back to CLAUDE when both are null', () => {
    expect(
      effectiveAgent({ ticketAgent: null, projectDefaultAgent: null })
    ).toBe('CLAUDE');
  });

  it('falls back to CLAUDE when both are undefined', () => {
    expect(effectiveAgent({})).toBe('CLAUDE');
  });
});

describe('isClaudeJob', () => {
  it('returns true when ticket.agent=CLAUDE', () => {
    expect(
      isClaudeJob({ ticketAgent: 'CLAUDE', projectDefaultAgent: 'CODEX' })
    ).toBe(true);
  });

  it('returns true when ticket.agent null + project.defaultAgent=CLAUDE', () => {
    expect(
      isClaudeJob({ ticketAgent: null, projectDefaultAgent: 'CLAUDE' })
    ).toBe(true);
  });

  it('returns true when both null (fallback to CLAUDE)', () => {
    expect(isClaudeJob({ ticketAgent: null, projectDefaultAgent: null })).toBe(
      true
    );
  });

  it('returns false when explicitly non-Claude', () => {
    expect(
      isClaudeJob({ ticketAgent: 'CODEX', projectDefaultAgent: 'CLAUDE' })
    ).toBe(false);
    expect(
      isClaudeJob({ ticketAgent: null, projectDefaultAgent: 'GEMINI' })
    ).toBe(false);
  });
});
