/**
 * Unit Tests: Credential Format Validation
 *
 * Tests for client-side format validation of API keys by provider.
 */

import { describe, it, expect } from 'vitest';
import { validateKeyFormat } from '@/lib/credentials/validation';

describe('validateKeyFormat', () => {
  describe('ANTHROPIC API_KEY', () => {
    it('should accept valid Anthropic API key', () => {
      const result = validateKeyFormat('ANTHROPIC', 'API_KEY', 'sk-ant-api03-abcdefghijklmno');
      expect(result.valid).toBe(true);
    });

    it('should reject key not starting with sk-ant-', () => {
      const result = validateKeyFormat('ANTHROPIC', 'API_KEY', 'invalid-key-format');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sk-ant-');
    });

    it('should reject key that is too short', () => {
      const result = validateKeyFormat('ANTHROPIC', 'API_KEY', 'sk-ant-short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject empty key', () => {
      const result = validateKeyFormat('ANTHROPIC', 'API_KEY', '');
      expect(result.valid).toBe(false);
    });
  });

  describe('ANTHROPIC OAUTH_TOKEN', () => {
    it('should accept valid OAuth token', () => {
      const result = validateKeyFormat('ANTHROPIC', 'OAUTH_TOKEN', 'some-oauth-token-value-here');
      expect(result.valid).toBe(true);
    });

    it('should reject token that is too short', () => {
      const result = validateKeyFormat('ANTHROPIC', 'OAUTH_TOKEN', 'short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject empty token', () => {
      const result = validateKeyFormat('ANTHROPIC', 'OAUTH_TOKEN', '');
      expect(result.valid).toBe(false);
    });
  });
});
