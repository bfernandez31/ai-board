/**
 * RTL Component Tests: APIKeysCard
 *
 * Tests for the API keys settings card component.
 * Verifies rendering for owner and member views.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { APIKeysCard } from '@/components/settings/api-keys-card';

// Mock fetch for API key data
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('APIKeysCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Owner view', () => {
    it('should display card title and description', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [
            { provider: 'ANTHROPIC', configured: false, preview: null, updatedAt: null },
            { provider: 'OPENAI', configured: false, preview: null, updatedAt: null },
          ],
        }),
      });

      renderWithProviders(<APIKeysCard project={{ id: 1, isOwner: true }} />);

      expect(screen.getByText('API Keys (BYOK)')).toBeInTheDocument();
      // Description appears after data loads
      expect(await screen.findByText(/Configure your own API keys/i)).toBeInTheDocument();
    });

    it('should show Add Key buttons when no keys are configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [
            { provider: 'ANTHROPIC', configured: false, preview: null, updatedAt: null },
            { provider: 'OPENAI', configured: false, preview: null, updatedAt: null },
          ],
        }),
      });

      renderWithProviders(<APIKeysCard project={{ id: 1, isOwner: true }} />);

      // Wait for data to load
      const addButtons = await screen.findAllByText('Add Key');
      expect(addButtons).toHaveLength(2);
    });

    it('should display provider names', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [
            { provider: 'ANTHROPIC', configured: false, preview: null, updatedAt: null },
            { provider: 'OPENAI', configured: false, preview: null, updatedAt: null },
          ],
        }),
      });

      renderWithProviders(<APIKeysCard project={{ id: 1, isOwner: true }} />);

      expect(await screen.findByText('Anthropic')).toBeInTheDocument();
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    it('should show masked preview when key is configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [
            { provider: 'ANTHROPIC', configured: true, preview: 'abcd', updatedAt: '2026-03-13T12:00:00Z' },
            { provider: 'OPENAI', configured: false, preview: null, updatedAt: null },
          ],
        }),
      });

      renderWithProviders(<APIKeysCard project={{ id: 1, isOwner: true }} />);

      expect(await screen.findByText('****abcd')).toBeInTheDocument();
      expect(screen.getByText('Replace')).toBeInTheDocument();
    });

    it('should show Configured badge when key exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [
            { provider: 'ANTHROPIC', configured: true, preview: 'abcd', updatedAt: '2026-03-13T12:00:00Z' },
            { provider: 'OPENAI', configured: false, preview: null, updatedAt: null },
          ],
        }),
      });

      renderWithProviders(<APIKeysCard project={{ id: 1, isOwner: true }} />);

      expect(await screen.findByText('Configured')).toBeInTheDocument();
    });
  });

  describe('Member view', () => {
    it('should not show Add Key buttons for members', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [
            { provider: 'ANTHROPIC', configured: true, preview: null, updatedAt: null },
            { provider: 'OPENAI', configured: false, preview: null, updatedAt: null },
          ],
        }),
      });

      renderWithProviders(<APIKeysCard project={{ id: 1, isOwner: false }} />);

      // Wait for data to load
      expect(await screen.findByText('Anthropic')).toBeInTheDocument();
      expect(screen.queryByText('Add Key')).not.toBeInTheDocument();
      expect(screen.queryByText('Replace')).not.toBeInTheDocument();
    });

    it('should show status badges without preview for members', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [
            { provider: 'ANTHROPIC', configured: true, preview: null, updatedAt: null },
            { provider: 'OPENAI', configured: false, preview: null, updatedAt: null },
          ],
        }),
      });

      renderWithProviders(<APIKeysCard project={{ id: 1, isOwner: false }} />);

      expect(await screen.findByText('Configured')).toBeInTheDocument();
      expect(screen.getByText('Not configured')).toBeInTheDocument();
      // Should not show masked preview
      expect(screen.queryByText(/\*\*\*\*/)).not.toBeInTheDocument();
    });
  });
});
