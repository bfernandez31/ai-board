/**
 * Unit Tests: API Key Validation
 *
 * Tests for provider-specific key validation logic (Anthropic, OpenAI, network failure).
 * Uses mocked fetch to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateKeyWithProvider, validateKeyFormat } from '@/lib/api-keys/validate';

const originalFetch = global.fetch;

describe('Provider-Specific Key Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Anthropic key validation', () => {
    it('should return valid for successful API response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await validateKeyWithProvider('ANTHROPIC', 'sk-ant-api03-valid-key');
      expect(result.valid).toBe(true);
      expect(result.message).toBe('API key is valid');
    });

    it('should return invalid for 401 response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await validateKeyWithProvider('ANTHROPIC', 'sk-ant-api03-bad-key');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('invalid');
    });

    it('should return valid for rate-limited (429) response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { type: 'rate_limit_error' } }),
      });

      const result = await validateKeyWithProvider('ANTHROPIC', 'sk-ant-api03-rate-limited');
      expect(result.valid).toBe(true);
    });

    it('should return unreachable on network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('fetch failed'));

      const result = await validateKeyWithProvider('ANTHROPIC', 'sk-ant-api03-test');
      expect(result.valid).toBe(false);
      expect(result.unreachable).toBe(true);
      expect(result.message).toContain('Could not reach');
    });

    it('should return unreachable on timeout', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValueOnce(timeoutError);

      const result = await validateKeyWithProvider('ANTHROPIC', 'sk-ant-api03-test');
      expect(result.valid).toBe(false);
      expect(result.unreachable).toBe(true);
    });
  });

  describe('OpenAI key validation', () => {
    it('should return valid for successful API response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await validateKeyWithProvider('OPENAI', 'sk-proj-valid-key');
      expect(result.valid).toBe(true);
      expect(result.message).toBe('API key is valid');
    });

    it('should return invalid for 401 response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await validateKeyWithProvider('OPENAI', 'sk-bad-key');
      expect(result.valid).toBe(false);
    });

    it('should return unreachable on network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('network'));

      const result = await validateKeyWithProvider('OPENAI', 'sk-test');
      expect(result.valid).toBe(false);
      expect(result.unreachable).toBe(true);
    });
  });

  describe('Format validation edge cases', () => {
    it('should handle whitespace-only input', () => {
      expect(validateKeyFormat('ANTHROPIC', '   ')).toContain('empty');
    });

    it('should validate after trimming', () => {
      expect(validateKeyFormat('ANTHROPIC', '  sk-ant-valid  ')).toBeNull();
    });

    it('should accept sk-ant- prefix for Anthropic (not just sk-ant-api03)', () => {
      expect(validateKeyFormat('ANTHROPIC', 'sk-ant-new-format-key')).toBeNull();
    });
  });
});
