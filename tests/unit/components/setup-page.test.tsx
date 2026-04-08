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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 1, status: 'PENDING', agent: 'CLAUDE' }),
    });

    renderWithProviders(<SetupPageClient {...defaultProps} />);

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
});
