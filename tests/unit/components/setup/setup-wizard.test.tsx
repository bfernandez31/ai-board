import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SetupWizard } from '@/components/setup/setup-wizard';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: { alt: string; [key: string]: unknown }) => {
    const { alt, ...rest } = props;
    return <img alt={alt} {...rest} />;
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  function TestWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return TestWrapper;
}

describe('SetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('renders agent selector and checks credential on mount', async () => {
    // Mock GET /setup (no existing job)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ setupJob: null, hasConfig: false }),
    });
    // Mock credential check
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ available: true, provider: 'ANTHROPIC' }),
    });

    render(<SetupWizard projectId={1} />, { wrapper: createWrapper() });

    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Credential ready')).toBeInTheDocument();
    });
  });

  it('shows dispatch button enabled when credential is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ setupJob: null, hasConfig: false }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ available: true, provider: 'ANTHROPIC' }),
    });

    render(<SetupWizard projectId={1} />, { wrapper: createWrapper() });

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Initialize Project/i });
      expect(button).not.toBeDisabled();
    });
  });

  it('dispatches setup on button click', async () => {
    const user = userEvent.setup();

    // Initial status check
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ setupJob: null, hasConfig: false }),
    });
    // Credential check
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ available: true, provider: 'ANTHROPIC' }),
    });

    render(<SetupWizard projectId={1} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Initialize Project/i })).not.toBeDisabled();
    });

    // Mock POST dispatch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 1,
          projectId: 1,
          selectedAgent: 'CLAUDE',
          status: 'PENDING',
        }),
    });
    // Mock subsequent polling
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          setupJob: { id: 1, status: 'PENDING', completedFiles: [], isPartial: false, startedAt: null, completedAt: null, errorMessage: null },
          hasConfig: false,
        }),
    });

    const button = screen.getByRole('button', { name: /Initialize Project/i });
    await user.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/1/setup',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('recovers running state on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          setupJob: {
            id: 1,
            status: 'RUNNING',
            selectedAgent: 'CLAUDE',
            completedFiles: [],
            isPartial: false,
            startedAt: new Date().toISOString(),
            completedAt: null,
            errorMessage: null,
          },
          hasConfig: false,
        }),
    });

    render(<SetupWizard projectId={1} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Setting up project/i)).toBeInTheDocument();
    });
  });

  it('shows Go to Project Board on completion', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          setupJob: {
            id: 1,
            status: 'COMPLETED',
            selectedAgent: 'CLAUDE',
            completedFiles: ['.ai-board/config.yml'],
            isPartial: false,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            errorMessage: null,
          },
          hasConfig: true,
        }),
    });

    render(<SetupWizard projectId={1} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Go to Project Board/i })).toBeInTheDocument();
    });
  });
});
