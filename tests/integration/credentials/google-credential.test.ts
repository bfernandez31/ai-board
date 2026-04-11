/**
 * Integration Tests: Google Credential Verification
 *
 * Tests the Google credential provider's live verification against
 * the Google Generative Language API (mocked at fetch level).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyWithProvider } from '@/lib/ai-credentials/providers/google';

describe('Google Credential Verification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API_KEY verification', () => {
    it('should return READY when Google returns 200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ models: [] }), { status: 200 })
      );

      const result = await verifyWithProvider('API_KEY', 'AIza' + 'a'.repeat(35));

      expect(result.readinessStatus).toBe('READY');
      expect(result.verificationCode).toBe('VALID');
      expect(result.verificationMessage).toBeNull();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com/v1beta/models?key='),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should return ACTION_REQUIRED with INVALID_KEY on 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      const result = await verifyWithProvider('API_KEY', 'AIza' + 'a'.repeat(35));

      expect(result.readinessStatus).toBe('ACTION_REQUIRED');
      expect(result.verificationCode).toBe('INVALID_KEY');
      expect(result.verificationMessage).toContain('rejected by Google');
    });

    it('should return ACTION_REQUIRED with INVALID_KEY on 403', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 })
      );

      const result = await verifyWithProvider('API_KEY', 'AIza' + 'a'.repeat(35));

      expect(result.readinessStatus).toBe('ACTION_REQUIRED');
      expect(result.verificationCode).toBe('INVALID_KEY');
    });

    it('should return ACTION_REQUIRED with RATE_LIMITED on 429', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Too Many Requests', { status: 429 })
      );

      const result = await verifyWithProvider('API_KEY', 'AIza' + 'a'.repeat(35));

      expect(result.readinessStatus).toBe('ACTION_REQUIRED');
      expect(result.verificationCode).toBe('RATE_LIMITED');
      expect(result.verificationMessage).toContain('rate limit');
    });

    it('should return UNREACHABLE on timeout', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
      );

      const result = await verifyWithProvider('API_KEY', 'AIza' + 'a'.repeat(35));

      expect(result.readinessStatus).toBe('ACTION_REQUIRED');
      expect(result.verificationCode).toBe('UNREACHABLE');
      expect(result.verificationMessage).toContain('timeout');
    });

    it('should return UNREACHABLE on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await verifyWithProvider('API_KEY', 'AIza' + 'a'.repeat(35));

      expect(result.readinessStatus).toBe('ACTION_REQUIRED');
      expect(result.verificationCode).toBe('UNREACHABLE');
    });
  });

  describe('OAUTH_TOKEN verification', () => {
    it('should return READY when Google returns 200 with Bearer auth', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ models: [] }), { status: 200 })
      );

      const result = await verifyWithProvider('OAUTH_TOKEN', 'a'.repeat(40));

      expect(result.readinessStatus).toBe('READY');
      expect(result.verificationCode).toBe('VALID');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com/v1beta/models'),
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: expect.stringContaining('Bearer ') },
        })
      );
    });

    it('should return ACTION_REQUIRED with INVALID_KEY on 401 for OAuth', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      const result = await verifyWithProvider('OAUTH_TOKEN', 'a'.repeat(40));

      expect(result.readinessStatus).toBe('ACTION_REQUIRED');
      expect(result.verificationCode).toBe('INVALID_KEY');
    });

    it('should return UNREACHABLE on timeout for OAuth', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
      );

      const result = await verifyWithProvider('OAUTH_TOKEN', 'a'.repeat(40));

      expect(result.readinessStatus).toBe('ACTION_REQUIRED');
      expect(result.verificationCode).toBe('UNREACHABLE');
      expect(result.verificationMessage).toContain('timeout');
    });
  });
});
