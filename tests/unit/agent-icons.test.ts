import { describe, it, expect } from 'vitest';
import { Agent } from '@prisma/client';
import { getAgentDescription, getAgentIconPath, getAgentLabel, inferAgentFromIdentifier } from '@/app/lib/utils/agent-icons';

describe('agent-icons utility', () => {
  describe('getAgentIconPath', () => {
    it('should return correct icon path for CLAUDE', () => {
      expect(getAgentIconPath(Agent.CLAUDE)).toBe('/agents/claude.svg');
    });

    it('should return correct icon path for CODEX', () => {
      expect(getAgentIconPath(Agent.CODEX)).toBe('/agents/codex.svg');
    });

    it('should return correct icon path for MISTRAL', () => {
      expect(getAgentIconPath(Agent.MISTRAL)).toBe('/agents/mistral.svg');
    });
  });

  describe('getAgentLabel', () => {
    it('should return correct label for CLAUDE', () => {
      expect(getAgentLabel(Agent.CLAUDE)).toBe('Claude');
    });

    it('should return correct label for CODEX', () => {
      expect(getAgentLabel(Agent.CODEX)).toBe('Codex');
    });

    it('should return correct label for MISTRAL', () => {
      expect(getAgentLabel(Agent.MISTRAL)).toBe('Mistral');
    });
  });

  describe('getAgentDescription', () => {
    it('should return correct description for CLAUDE', () => {
      expect(getAgentDescription(Agent.CLAUDE)).toBe('Anthropic Claude Code');
    });

    it('should return correct description for CODEX', () => {
      expect(getAgentDescription(Agent.CODEX)).toBe('OpenAI Codex');
    });

    it('should return correct description for MISTRAL', () => {
      expect(getAgentDescription(Agent.MISTRAL)).toBe('Mistral vibe');
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

  describe('inferAgentFromIdentifier', () => {
    it('resolves Claude-flavored identifiers', () => {
      expect(inferAgentFromIdentifier('claude-sonnet-4-6')).toBe(Agent.CLAUDE);
    });

    it('resolves Codex-flavored identifiers', () => {
      expect(inferAgentFromIdentifier('codex-mini-latest')).toBe(Agent.CODEX);
    });

    it('resolves Mistral-flavored identifiers', () => {
      expect(inferAgentFromIdentifier('mistral-large-latest')).toBe(Agent.MISTRAL);
    });

    it('resolves vibe identifier as Mistral', () => {
      expect(inferAgentFromIdentifier('vibe')).toBe(Agent.MISTRAL);
    });

    it('returns null for unknown identifiers', () => {
      expect(inferAgentFromIdentifier('custom-runner')).toBeNull();
    });
  });
});
