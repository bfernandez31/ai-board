import { describe, it, expect } from 'vitest';
import { Agent } from '@prisma/client';
import { getAgentIcon, getAgentLabel, getAgentDescription } from '@/app/lib/utils/agent-icons';

describe('agent-icons', () => {
  describe('getAgentIcon', () => {
    it('returns icon for CLAUDE', () => {
      expect(getAgentIcon(Agent.CLAUDE)).toBe('🤖');
    });

    it('returns icon for CODEX', () => {
      expect(getAgentIcon(Agent.CODEX)).toBe('⚙️');
    });
  });

  describe('getAgentLabel', () => {
    it('returns label for CLAUDE', () => {
      expect(getAgentLabel(Agent.CLAUDE)).toBe('Claude');
    });

    it('returns label for CODEX', () => {
      expect(getAgentLabel(Agent.CODEX)).toBe('Codex');
    });
  });

  describe('getAgentDescription', () => {
    it('returns description for CLAUDE', () => {
      expect(getAgentDescription(Agent.CLAUDE)).toBe('Anthropic Claude Code agent');
    });

    it('returns description for CODEX', () => {
      expect(getAgentDescription(Agent.CODEX)).toBe('OpenAI Codex agent');
    });
  });
});
