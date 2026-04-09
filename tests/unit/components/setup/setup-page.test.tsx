/**
 * RTL Component Tests: SetupPageClient
 *
 * Tests the setup page client component rendering, agent selection,
 * credential checks, dispatch, and status display.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { SetupPageClient } from '@/components/setup/setup-page-client';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockCredentialResponse(hasCredential: boolean, provider = 'ANTHROPIC') {
  return {
    ok: true,
    json: async () => ({
      hasCredential,
      provider,
      ...(hasCredential ? {} : { settingsUrl: '/settings/credentials' }),
    }),
  };
}

function mockSetupJobResponse(
  job: { status: string; errorMessage?: string | null } | null = null,
  configSyncedAt: string | null = null
) {
  return {
    ok: true,
    json: async () => ({ job, configSyncedAt }),
  };
}

describe('SetupPageClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockToast.mockReset();
    // Default: credential check returns hasCredential=true, setup job returns null
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/credential-check')) {
        return Promise.resolve(mockCredentialResponse(true));
      }
      if (url.includes('/setup/jobs') && !url.includes('status')) {
        return Promise.resolve(mockSetupJobResponse(null));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders agent selection options', () => {
    renderWithProviders(<SetupPageClient projectId={1} projectName="Test Project" />);

    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
  });

  it('renders initialize button', () => {
    renderWithProviders(<SetupPageClient projectId={1} projectName="Test Project" />);

    expect(screen.getByText('Initialize Project')).toBeInTheDocument();
  });

  it('shows running state with spinner', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/credential-check')) {
        return Promise.resolve(mockCredentialResponse(true));
      }
      if (url.includes('/setup/jobs') && !url.includes('status')) {
        return Promise.resolve(mockSetupJobResponse({
          status: 'RUNNING',
        }));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderWithProviders(<SetupPageClient projectId={1} projectName="Test Project" />);

    await waitFor(() => {
      expect(screen.getByText('Running setup...')).toBeInTheDocument();
    });
  });

  it('shows error and retry button on failure', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/credential-check')) {
        return Promise.resolve(mockCredentialResponse(true));
      }
      if (url.includes('/setup/jobs') && !url.includes('status')) {
        return Promise.resolve(mockSetupJobResponse({
          status: 'FAILED',
          errorMessage: 'Something went wrong',
        }));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderWithProviders(<SetupPageClient projectId={1} projectName="Test Project" />);

    await waitFor(() => {
      expect(screen.getByText('Setup failed')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('calls dispatch API on initialize click', async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/credential-check')) {
        return Promise.resolve(mockCredentialResponse(true));
      }
      if (url.includes('/setup/jobs') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 1, status: 'PENDING', agent: 'CLAUDE' }),
        });
      }
      if (url.includes('/setup/jobs')) {
        return Promise.resolve(mockSetupJobResponse(null));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderWithProviders(<SetupPageClient projectId={1} projectName="Test Project" />);

    const button = screen.getByText('Initialize Project');
    await user.click(button);

    await waitFor(() => {
      const postCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/setup/jobs') &&
          (call[1] as RequestInit)?.method === 'POST'
      );
      expect(postCalls.length).toBeGreaterThan(0);
    });
  });

  it('shows error toast when dispatch API returns error', async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/credential-check')) {
        return Promise.resolve(mockCredentialResponse(true));
      }
      if (url.includes('/setup/jobs') && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: 'Workflow dispatch failed' }),
        });
      }
      if (url.includes('/setup/jobs')) {
        return Promise.resolve(mockSetupJobResponse(null));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderWithProviders(<SetupPageClient projectId={1} projectName="Test Project" />);

    const button = screen.getByText('Initialize Project');
    await user.click(button);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to initialize project',
          variant: 'destructive',
        })
      );
    });
  });

  it('shows error toast when dispatch throws network error', async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/credential-check')) {
        return Promise.resolve(mockCredentialResponse(true));
      }
      if (url.includes('/setup/jobs') && options?.method === 'POST') {
        return Promise.reject(new Error('Network error'));
      }
      if (url.includes('/setup/jobs')) {
        return Promise.resolve(mockSetupJobResponse(null));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderWithProviders(<SetupPageClient projectId={1} projectName="Test Project" />);

    const button = screen.getByText('Initialize Project');
    await user.click(button);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to initialize project',
          variant: 'destructive',
        })
      );
    });
  });

  it('disables button when credential missing', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/credential-check')) {
        return Promise.resolve(mockCredentialResponse(false));
      }
      if (url.includes('/setup/jobs')) {
        return Promise.resolve(mockSetupJobResponse(null));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderWithProviders(<SetupPageClient projectId={1} projectName="Test Project" />);

    await waitFor(() => {
      const button = screen.getByText('Initialize Project');
      expect(button).toBeDisabled();
      expect(screen.getByText(/Missing.*credential/)).toBeInTheDocument();
    });
  });

  it('enables button when credential valid', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/credential-check')) {
        return Promise.resolve(mockCredentialResponse(true));
      }
      if (url.includes('/setup/jobs')) {
        return Promise.resolve(mockSetupJobResponse(null));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderWithProviders(<SetupPageClient projectId={1} projectName="Test Project" />);

    await waitFor(() => {
      const button = screen.getByText('Initialize Project');
      expect(button).not.toBeDisabled();
    });
  });
});
