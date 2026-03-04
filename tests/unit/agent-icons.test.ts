import { describe, it, expect } from 'vitest';
import { getAgentIcon, getAgentLabel, getAgentDescription } from '@/app/lib/utils/agent-icons';

describe('agent-icons', () => {
  describe('getAgentIcon', () => {
    it('returns icon for CLAUDE', () => {
      expect(getAgentIcon('CLAUDE')).toBe('🤖');
    });

    it('returns icon for CODEX', () => {
      expect(getAgentIcon('CODEX')).toBe('🧬');
    });
  });

  describe('getAgentLabel', () => {
    it('returns label for CLAUDE', () => {
      expect(getAgentLabel('CLAUDE')).toBe('Claude');
    });

    it('returns label for CODEX', () => {
      expect(getAgentLabel('CODEX')).toBe('Codex');
    });
  });

  describe('getAgentDescription', () => {
    it('returns description for CLAUDE', () => {
      expect(getAgentDescription('CLAUDE')).toContain('Claude');
    });

    it('returns description for CODEX', () => {
      expect(getAgentDescription('CODEX')).toContain('Codex');
    });
  });
});
