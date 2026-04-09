/**
 * RTL Component Tests: SpecGenBanner
 *
 * Tests the board spec generation banner rendering, dismiss, and modal trigger.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { SpecGenBanner } from '@/components/board/spec-gen-banner';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockSpecGenResponse(
  job: { status: string } | null = null,
  specsGeneratedAt: string | null = null
) {
  return {
    ok: true,
    json: async () => ({ job, specsGeneratedAt }),
  };
}

describe('SpecGenBanner', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Clear sessionStorage
    try { sessionStorage.clear(); } catch { /* noop */ }
  });

  it('renders banner when no job and specs not generated', async () => {
    mockFetch.mockResolvedValue(mockSpecGenResponse(null));

    renderWithProviders(<SpecGenBanner projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Project specs not generated')).toBeInTheDocument();
    });
  });

  it('shows Generate and Dismiss buttons', async () => {
    mockFetch.mockResolvedValue(mockSpecGenResponse(null));

    renderWithProviders(<SpecGenBanner projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Generate')).toBeInTheDocument();
      expect(screen.getByLabelText('Dismiss spec generation banner')).toBeInTheDocument();
    });
  });

  it('hides banner when dismissed', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue(mockSpecGenResponse(null));

    renderWithProviders(<SpecGenBanner projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Project specs not generated')).toBeInTheDocument();
    });

    const dismissBtn = screen.getByLabelText('Dismiss spec generation banner');
    await user.click(dismissBtn);

    expect(screen.queryByText('Project specs not generated')).not.toBeInTheDocument();
  });

  it('hides banner when job is active', async () => {
    mockFetch.mockResolvedValue(mockSpecGenResponse({ status: 'RUNNING' }));

    renderWithProviders(<SpecGenBanner projectId={1} />);

    // Wait for fetch to settle
    await waitFor(() => {
      expect(screen.queryByText('Project specs not generated')).not.toBeInTheDocument();
    });
  });

  it('opens modal when Generate clicked', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue(mockSpecGenResponse(null));

    renderWithProviders(<SpecGenBanner projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Generate')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Generate'));

    await waitFor(() => {
      expect(screen.getByText('Generate Project Specs')).toBeInTheDocument();
    });
  });
});
