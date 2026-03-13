/**
 * RTL Component Tests: ApiKeysCard
 *
 * Tests for the BYOK API keys settings card component.
 * Verifies rendering states, owner vs member views.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ApiKeysCard } from '@/components/settings/api-keys-card';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock fetch for loading keys
const mockKeys = [
  { provider: 'ANTHROPIC', preview: null, configured: false, updatedAt: null },
  { provider: 'OPENAI', preview: null, configured: false, updatedAt: null },
];

const mockConfiguredKeys = [
  { provider: 'ANTHROPIC', preview: 'a1b2', configured: true, updatedAt: '2026-03-13T10:00:00Z' },
  { provider: 'OPENAI', preview: null, configured: false, updatedAt: null },
];

describe('ApiKeysCard', () => {
  const defaultProps = {
    project: { id: 1 },
    isOwner: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return unconfigured keys
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: mockKeys }),
    });
  });

  describe('Rendering - Owner View', () => {
    it('should display card title and description after loading', async () => {
      renderWithProviders(<ApiKeysCard {...defaultProps} />);

      // Wait for fetch to complete and title to update
      const title = await screen.findByText('API Keys (BYOK)');
      expect(title).toBeInTheDocument();
      expect(screen.getByText(/Configure API keys/i)).toBeInTheDocument();
    });

    it('should show both provider sections after loading', async () => {
      renderWithProviders(<ApiKeysCard {...defaultProps} />);

      // Wait for fetch to complete
      const anthropicSection = await screen.findByTestId('provider-section-ANTHROPIC');
      expect(anthropicSection).toBeInTheDocument();

      const openaiSection = await screen.findByTestId('provider-section-OPENAI');
      expect(openaiSection).toBeInTheDocument();
    });

    it('should show input fields for owner', async () => {
      renderWithProviders(<ApiKeysCard {...defaultProps} />);

      const anthropicInput = await screen.findByTestId('key-input-ANTHROPIC');
      expect(anthropicInput).toBeInTheDocument();

      const openaiInput = await screen.findByTestId('key-input-OPENAI');
      expect(openaiInput).toBeInTheDocument();
    });

    it('should show save buttons for owner', async () => {
      renderWithProviders(<ApiKeysCard {...defaultProps} />);

      const anthropicSave = await screen.findByTestId('save-key-ANTHROPIC');
      expect(anthropicSave).toBeInTheDocument();

      const openaiSave = await screen.findByTestId('save-key-OPENAI');
      expect(openaiSave).toBeInTheDocument();
    });

    it('should show "Not configured" badges when no keys exist', async () => {
      renderWithProviders(<ApiKeysCard {...defaultProps} />);

      const badges = await screen.findAllByText('Not configured');
      expect(badges).toHaveLength(2);
    });
  });

  describe('Rendering - Configured Keys', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ keys: mockConfiguredKeys }),
      });
    });

    it('should show "Configured" badge for configured key', async () => {
      renderWithProviders(<ApiKeysCard {...defaultProps} />);

      const configured = await screen.findByText('Configured');
      expect(configured).toBeInTheDocument();
    });

    it('should show masked preview for configured key', async () => {
      renderWithProviders(<ApiKeysCard {...defaultProps} />);

      const preview = await screen.findByTestId('key-preview-ANTHROPIC');
      expect(preview).toBeInTheDocument();
      expect(preview.textContent).toContain('a1b2');
    });

    it('should show test and remove buttons for configured key', async () => {
      renderWithProviders(<ApiKeysCard {...defaultProps} />);

      const testButton = await screen.findByTestId('test-key-ANTHROPIC');
      expect(testButton).toBeInTheDocument();

      const removeButton = await screen.findByTestId('remove-key-ANTHROPIC');
      expect(removeButton).toBeInTheDocument();
    });
  });

  describe('Rendering - Member View (read-only)', () => {
    it('should not show input fields for non-owner', async () => {
      renderWithProviders(<ApiKeysCard project={{ id: 1 }} isOwner={false} />);

      // Wait for loading to finish
      await screen.findByTestId('provider-section-ANTHROPIC');

      expect(screen.queryByTestId('key-input-ANTHROPIC')).not.toBeInTheDocument();
      expect(screen.queryByTestId('key-input-OPENAI')).not.toBeInTheDocument();
    });

    it('should not show save buttons for non-owner', async () => {
      renderWithProviders(<ApiKeysCard project={{ id: 1 }} isOwner={false} />);

      await screen.findByTestId('provider-section-ANTHROPIC');

      expect(screen.queryByTestId('save-key-ANTHROPIC')).not.toBeInTheDocument();
      expect(screen.queryByTestId('save-key-OPENAI')).not.toBeInTheDocument();
    });

    it('should show read-only description for non-owner', async () => {
      renderWithProviders(<ApiKeysCard project={{ id: 1 }} isOwner={false} />);

      // Wait for loading to complete
      await screen.findByTestId('provider-section-ANTHROPIC');

      expect(screen.getByText(/Only the project owner/i)).toBeInTheDocument();
    });
  });
});
