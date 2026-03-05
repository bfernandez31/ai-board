import { describe, it, expect } from 'vitest';
import { Agent } from '@prisma/client';
import { getAgentIconPath, getAgentLabel, getAgentDescription } from '@/app/lib/utils/agent-icons';

describe('agent-icons utility', () => {
  describe('getAgentIconPath', () => {
    it('should return correct icon path for CLAUDE', () => {
      expect(getAgentIconPath(Agent.CLAUDE)).toBe('/agents/claude.svg');
    });

    it('should return correct icon path for CODEX', () => {
      expect(getAgentIconPath(Agent.CODEX)).toBe('/agents/codex.svg');
    });
  });

  describe('getAgentLabel', () => {
    it('should return correct label for CLAUDE', () => {
      expect(getAgentLabel(Agent.CLAUDE)).toBe('Claude');
    });

    it('should return correct label for CODEX', () => {
      expect(getAgentLabel(Agent.CODEX)).toBe('Codex');
    });
  });

  describe('getAgentDescription', () => {
    it('should return correct description for CLAUDE', () => {
      expect(getAgentDescription(Agent.CLAUDE)).toBe('Anthropic Claude Code');
    });

    it('should return correct description for CODEX', () => {
      expect(getAgentDescription(Agent.CODEX)).toBe('OpenAI Codex');
    });
  });

  describe('exhaustiveness', () => {
    it('should have mappings for all Agent enum values', () => {
      const agents = Object.values(Agent);
      for (const agent of agents) {
        expect(getAgentIconPath(agent)).toBeDefined();
        expect(getAgentLabel(agent)).toBeDefined();
        expect(getAgentDescription(agent)).toBeDefined();
      }
    });
  });
});
