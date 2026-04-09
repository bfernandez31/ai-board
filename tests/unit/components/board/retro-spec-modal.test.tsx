/**
 * RTL Component Tests: RetroSpecModal
 *
 * Tests for the retro-spec generation modal.
 * Verifies depth selection, URL validation, submit behavior, and error states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { RetroSpecModal } from '@/components/board/retro-spec-modal';

describe('RetroSpecModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: 1,
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should display modal title and description when open', () => {
      renderWithProviders(<RetroSpecModal {...defaultProps} />);

      expect(screen.getByText('Generate Project Specs')).toBeInTheDocument();
      expect(screen.getByText(/analyze your codebase/i)).toBeInTheDocument();
    });

    it('should display depth selection with Standard as default', () => {
      renderWithProviders(<RetroSpecModal {...defaultProps} />);

      const standardRadio = screen.getByRole('radio', { name: /standard/i }) as HTMLInputElement;
      expect(standardRadio.checked).toBe(true);

      expect(screen.getByText('Quick')).toBeInTheDocument();
      expect(screen.getByText('Standard')).toBeInTheDocument();
      expect(screen.getByText('Comprehensive')).toBeInTheDocument();
    });

    it('should display optional docUrl and context fields', () => {
      renderWithProviders(<RetroSpecModal {...defaultProps} />);

      expect(screen.getByLabelText(/documentation url/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/additional context/i)).toBeInTheDocument();
    });
  });

  describe('URL Validation', () => {
    it('should show error for invalid docUrl on submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RetroSpecModal {...defaultProps} />);

      const urlInput = screen.getByLabelText(/documentation url/i);
      await user.type(urlInput, 'not-a-url');
      await user.click(screen.getByRole('button', { name: /generate specs/i }));

      expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
    });

    it('should accept valid URL', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, status: 'PENDING' }),
      });

      renderWithProviders(<RetroSpecModal {...defaultProps} />);

      const urlInput = screen.getByLabelText(/documentation url/i);
      await user.type(urlInput, 'https://docs.example.com');
      await user.click(screen.getByRole('button', { name: /generate specs/i }));

      expect(screen.queryByText(/please enter a valid url/i)).not.toBeInTheDocument();
    });
  });

  describe('Submission', () => {
    it('should POST with correct payload on submit', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, status: 'PENDING', command: 'RETRO_SPEC' }),
      });
      global.fetch = fetchMock;

      renderWithProviders(<RetroSpecModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /generate specs/i }));

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/setup/jobs',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            agent: 'CLAUDE',
            command: 'RETRO_SPEC',
            depth: 'STANDARD',
          }),
        })
      );
    });

    it('should include docUrl and context in payload when provided', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, status: 'PENDING' }),
      });
      global.fetch = fetchMock;

      renderWithProviders(<RetroSpecModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/documentation url/i), 'https://docs.example.com');
      await user.type(screen.getByLabelText(/additional context/i), 'Custom auth system');
      await user.click(screen.getByRole('button', { name: /generate specs/i }));

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/setup/jobs',
        expect.objectContaining({
          body: JSON.stringify({
            agent: 'CLAUDE',
            command: 'RETRO_SPEC',
            depth: 'STANDARD',
            docUrl: 'https://docs.example.com',
            context: 'Custom auth system',
          }),
        })
      );
    });

    it('should call onSuccess and close modal on successful submit', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, status: 'PENDING' }),
      });

      renderWithProviders(<RetroSpecModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /generate specs/i }));

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should display error on API failure', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'A setup job is already active' }),
      });

      renderWithProviders(<RetroSpecModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /generate specs/i }));

      await waitFor(() => {
        expect(screen.getByText('A setup job is already active')).toBeInTheDocument();
      });
    });
  });
});
