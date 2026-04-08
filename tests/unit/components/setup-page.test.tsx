import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { SetupPageClient } from '@/components/setup/setup-page-client';

// Mock useSetupPolling
const mockUseSetupPolling = vi.fn();
vi.mock('@/app/lib/hooks/useSetupPolling', () => ({
  useSetupPolling: (...args: unknown[]) => mockUseSetupPolling(...args),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SetupPageClient', () => {
  const defaultProps = {
    projectId: 1,
    projectName: 'Test Project',
    isOwner: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSetupPolling.mockReturnValue({
      setupState: 'NEEDS_SETUP',
      latestJob: null,
      isPolling: false,
    });
    // Default: credentials available for ANTHROPIC
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/credentials') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            credentials: [{ provider: 'ANTHROPIC', credentialType: 'API_KEY' }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders agent selection options', () => {
    renderWithProviders(<SetupPageClient {...defaultProps} />);

    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
  });

  it('renders the initialize button', () => {
    renderWithProviders(<SetupPageClient {...defaultProps} />);

    expect(screen.getByRole('button', { name: /initialize project/i })).toBeInTheDocument();
  });

  it('dispatches POST on button click', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/credentials') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            credentials: [{ provider: 'ANTHROPIC', credentialType: 'API_KEY' }],
          }),
        });
      }
      if (url === '/api/projects/1/setup' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ jobId: 1, status: 'PENDING', agent: 'CLAUDE' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<SetupPageClient {...defaultProps} />);

    // Wait for credentials to load so button is enabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /initialize project/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /initialize project/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/1/setup',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ agent: 'CLAUDE' }),
        })
      );
    });
  });

  it('shows progress state during RUNNING', () => {
    mockUseSetupPolling.mockReturnValue({
      setupState: 'IN_PROGRESS',
      latestJob: {
        id: 1,
        agent: 'CLAUDE',
        status: 'RUNNING',
        logs: null,
        artifactSummary: null,
        startedAt: new Date(Date.now() - 5000).toISOString(),
        completedAt: null,
      },
      isPolling: true,
    });

    renderWithProviders(<SetupPageClient {...defaultProps} />);

    expect(screen.getByText(/setting up/i)).toBeInTheDocument();
  });

  it('shows success state on COMPLETED', () => {
    mockUseSetupPolling.mockReturnValue({
      setupState: 'CONFIGURED',
      latestJob: {
        id: 1,
        agent: 'CLAUDE',
        status: 'COMPLETED',
        logs: null,
        artifactSummary: null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      isPolling: false,
    });

    renderWithProviders(<SetupPageClient {...defaultProps} />);

    expect(screen.getByText(/setup complete/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to board/i })).toBeInTheDocument();
  });

  it('shows error details and retry button on FAILED state', () => {
    mockUseSetupPolling.mockReturnValue({
      setupState: 'FAILED',
      latestJob: {
        id: 1,
        agent: 'CLAUDE',
        status: 'FAILED',
        logs: 'Error: Config file not found',
        artifactSummary: null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      isPolling: false,
    });

    renderWithProviders(<SetupPageClient {...defaultProps} />);

    expect(screen.getByText(/setup failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Config file not found/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('disables dispatch for non-owners', () => {
    renderWithProviders(<SetupPageClient {...defaultProps} isOwner={false} />);

    const button = screen.getByRole('button', { name: /initialize project/i });
    expect(button).toBeDisabled();
  });

  describe('credential validation', () => {
    it('disables button when credential is missing', async () => {
      // Mock fetch to return empty credentials
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/credentials') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ credentials: [] }),
          });
        }
        if (url.includes('/setup')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              setupState: 'NEEDS_SETUP',
              latestJob: null,
              configSyncedAt: null,
            }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      renderWithProviders(<SetupPageClient {...defaultProps} />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /initialize project/i });
        expect(button).toBeDisabled();
      });
    });

    it('enables button when credential is present', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/credentials') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              credentials: [{ provider: 'ANTHROPIC', credentialType: 'API_KEY' }],
            }),
          });
        }
        if (url.includes('/setup')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              setupState: 'NEEDS_SETUP',
              latestJob: null,
              configSyncedAt: null,
            }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      renderWithProviders(<SetupPageClient {...defaultProps} />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /initialize project/i });
        expect(button).not.toBeDisabled();
      });
    });

    it('updates on agent selection change', async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/credentials') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              // Only ANTHROPIC credential, no OPENAI
              credentials: [{ provider: 'ANTHROPIC', credentialType: 'API_KEY' }],
            }),
          });
        }
        if (url.includes('/setup')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              setupState: 'NEEDS_SETUP',
              latestJob: null,
              configSyncedAt: null,
            }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      renderWithProviders(<SetupPageClient {...defaultProps} />);

      // Wait for button to be enabled (ANTHROPIC credential exists)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /initialize project/i })).not.toBeDisabled();
      });

      // Switch to Codex — no OPENAI credential
      await user.click(screen.getByText('Codex'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /initialize project/i })).toBeDisabled();
      });
    });

    it('shows credential warning when missing', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/credentials') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ credentials: [] }),
          });
        }
        if (url.includes('/setup')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              setupState: 'NEEDS_SETUP',
              latestJob: null,
              configSyncedAt: null,
            }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      renderWithProviders(<SetupPageClient {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/no anthropic credential configured/i)).toBeInTheDocument();
      });
    });
  });

  describe('state restoration on page refresh', () => {
    it('shows running state with elapsed time on initial load when job is RUNNING', () => {
      mockUseSetupPolling.mockReturnValue({
        setupState: 'IN_PROGRESS',
        latestJob: {
          id: 1,
          agent: 'CLAUDE',
          status: 'RUNNING',
          logs: null,
          artifactSummary: null,
          startedAt: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
          completedAt: null,
        },
        isPolling: true,
      });

      renderWithProviders(<SetupPageClient {...defaultProps} />);

      expect(screen.getByText(/setting up/i)).toBeInTheDocument();
      expect(screen.getByText(/elapsed/i)).toBeInTheDocument();
    });

    it('shows success state when job COMPLETED while page was closed', () => {
      mockUseSetupPolling.mockReturnValue({
        setupState: 'CONFIGURED',
        latestJob: {
          id: 1,
          agent: 'CLAUDE',
          status: 'COMPLETED',
          logs: null,
          artifactSummary: null,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        isPolling: false,
      });

      renderWithProviders(<SetupPageClient {...defaultProps} />);

      expect(screen.getByText(/setup complete/i)).toBeInTheDocument();
    });
  });
});
