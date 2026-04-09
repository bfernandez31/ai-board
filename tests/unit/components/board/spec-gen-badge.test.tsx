/**
 * RTL Component Tests: SpecGenBadge
 *
 * Tests the board spec generation progress badge rendering and states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { SpecGenBadge } from '@/components/board/spec-gen-badge';

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
  job: { status: string; agent?: string; depth?: string; errorMessage?: string | null } | null = null,
  specsGeneratedAt: string | null = null
) {
  return {
    ok: true,
    json: async () => ({ job, specsGeneratedAt }),
  };
}

describe('SpecGenBadge', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('shows "Generating specs..." with pulse when job is PENDING', async () => {
    mockFetch.mockResolvedValue(mockSpecGenResponse({ status: 'PENDING' }));

    renderWithProviders(<SpecGenBadge projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Generating specs...')).toBeInTheDocument();
    });
  });

  it('shows "Generating specs..." when job is RUNNING', async () => {
    mockFetch.mockResolvedValue(mockSpecGenResponse({ status: 'RUNNING' }));

    renderWithProviders(<SpecGenBadge projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Generating specs...')).toBeInTheDocument();
    });
  });

  it('shows "Specs ready" when COMPLETED', async () => {
    mockFetch.mockResolvedValue(
      mockSpecGenResponse({ status: 'COMPLETED' }, '2026-04-09T00:00:00Z')
    );

    renderWithProviders(<SpecGenBadge projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Specs ready')).toBeInTheDocument();
    });
  });

  it('shows error state with retry when FAILED', async () => {
    mockFetch.mockResolvedValue(
      mockSpecGenResponse({ status: 'FAILED', errorMessage: 'Timeout' })
    );

    renderWithProviders(<SpecGenBadge projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Spec generation failed')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('renders nothing when no job exists', async () => {
    mockFetch.mockResolvedValue(mockSpecGenResponse(null));

    const { container } = renderWithProviders(<SpecGenBadge projectId={1} />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="spec-gen-badge"]')).not.toBeInTheDocument();
    });
  });
});
