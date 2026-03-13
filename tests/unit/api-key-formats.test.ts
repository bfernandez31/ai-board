import { describe, it, expect } from 'vitest';
import { validateApiKeyFormat } from '@/lib/validation/api-key-formats';

describe('API Key Format Validation', () => {
  describe('Anthropic keys', () => {
    it('should accept valid Anthropic key with sk-ant- prefix', () => {
      const result = validateApiKeyFormat('ANTHROPIC', 'sk-ant-api03-abcdefghij1234567890');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject key without sk-ant- prefix', () => {
      const result = validateApiKeyFormat('ANTHROPIC', 'sk-proj-abcdefghij1234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("sk-ant-");
    });

    it('should reject key shorter than 20 characters', () => {
      const result = validateApiKeyFormat('ANTHROPIC', 'sk-ant-short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 20');
    });

    it('should reject empty key', () => {
      const result = validateApiKeyFormat('ANTHROPIC', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only key', () => {
      const result = validateApiKeyFormat('ANTHROPIC', '   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('OpenAI keys', () => {
    it('should accept valid OpenAI key with sk- prefix', () => {
      const result = validateApiKeyFormat('OPENAI', 'sk-proj-abcdefghij1234567890');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject Anthropic-format key for OpenAI', () => {
      const result = validateApiKeyFormat('OPENAI', 'sk-ant-api03-abcdefghij1234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Anthropic');
    });

    it('should reject key without sk- prefix', () => {
      const result = validateApiKeyFormat('OPENAI', 'pk-abcdefghij1234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("sk-");
    });

    it('should reject key shorter than 20 characters', () => {
      const result = validateApiKeyFormat('OPENAI', 'sk-short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 20');
    });

    it('should reject empty key', () => {
      const result = validateApiKeyFormat('OPENAI', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('Edge cases', () => {
    it('should accept minimum length Anthropic key (20 chars)', () => {
      const key = 'sk-ant-1234567890123';
      expect(key.length).toBe(20);
      const result = validateApiKeyFormat('ANTHROPIC', key);
      expect(result.valid).toBe(true);
    });

    it('should accept minimum length OpenAI key (20 chars)', () => {
      const key = 'sk-12345678901234567';
      expect(key.length).toBe(20);
      const result = validateApiKeyFormat('OPENAI', key);
      expect(result.valid).toBe(true);
    });

    it('should reject key with 19 characters for Anthropic', () => {
      const result = validateApiKeyFormat('ANTHROPIC', 'sk-ant-123456789012');
      expect(result.valid).toBe(false);
    });
  });
});
