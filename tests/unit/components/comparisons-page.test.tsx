/**
 * Component Test: ComparisonsPage
 * Feature: AIB-358-comparisons-hub-page
 *
 * Tests for the ComparisonsPage component rendering empty state and list of comparisons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComparisonsPage } from '@/components/comparisons/comparisons-page';

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock the hooks
const mockUseProjectComparisons = vi.fn();
const mockUseProjectComparisonDetail = vi.fn();
const mockUseVerifyStageTickets = vi.fn();
const mockUseLaunchComparison = vi.fn();

vi.mock('@/hooks/use-project-comparisons', () => ({
  useProjectComparisons: (...args: unknown[]) => mockUseProjectComparisons(...args),
  useProjectComparisonDetail: (...args: unknown[]) => mockUseProjectComparisonDetail(...args),
  useVerifyStageTickets: (...args: unknown[]) => mockUseVerifyStageTickets(...args),
  useLaunchComparison: (...args: unknown[]) => mockUseLaunchComparison(...args),
}));

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function TestQueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return TestQueryWrapper;
}

describe('ComparisonsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProjectComparisonDetail.mockReturnValue({ data: null, isLoading: false });
    mockUseVerifyStageTickets.mockReturnValue({ data: { tickets: [] }, isLoading: false });
    mockUseLaunchComparison.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    });
  });

  it('should render empty state when no comparisons exist', () => {
    mockUseProjectComparisons.mockReturnValue({
      data: { comparisons: [], total: 0, limit: 20, offset: 0 },
      isLoading: false,
      error: null,
    });

    render(<ComparisonsPage projectId={1} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText('No comparisons yet')).toBeInTheDocument();
    expect(screen.getByText(/Comparisons are generated/)).toBeInTheDocument();
  });

  it('should render loading skeletons while data is loading', () => {
    mockUseProjectComparisons.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<ComparisonsPage projectId={1} />, {
      wrapper: createQueryWrapper(),
    });

    // Check for skeleton elements
    const skeletons = container.querySelectorAll('[class*="skeleton"], [class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render error state on fetch error', () => {
    mockUseProjectComparisons.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    });

    render(<ComparisonsPage projectId={1} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText(/Failed to load comparisons/)).toBeInTheDocument();
  });

  it('should render comparison list items when data is available', () => {
    mockUseProjectComparisons.mockReturnValue({
      data: {
        comparisons: [
          {
            id: 1,
            generatedAt: '2026-03-20T09:00:00.000Z',
            sourceTicketKey: 'AIB-101',
            sourceTicketTitle: 'Source ticket',
            winnerTicketKey: 'AIB-102',
            winnerTicketTitle: 'Winner ticket',
            winnerScore: 91,
            participantCount: 2,
            participantTicketKeys: ['AIB-102', 'AIB-103'],
            summary: 'Winner had best coverage.',
            keyDifferentiators: ['coverage', 'smaller diff'],
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
      isLoading: false,
      error: null,
    });

    render(<ComparisonsPage projectId={1} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText('AIB-102')).toBeInTheDocument();
    expect(screen.getByText('Winner ticket')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('Winner had best coverage.')).toBeInTheDocument();
  });

  it('should show Load More button when there are more comparisons', () => {
    mockUseProjectComparisons.mockReturnValue({
      data: {
        comparisons: Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          generatedAt: '2026-03-20T09:00:00.000Z',
          sourceTicketKey: `AIB-${100 + i}`,
          sourceTicketTitle: `Source ${i}`,
          winnerTicketKey: `AIB-${200 + i}`,
          winnerTicketTitle: `Winner ${i}`,
          winnerScore: 80,
          participantCount: 2,
          participantTicketKeys: [`AIB-${200 + i}`, `AIB-${300 + i}`],
          summary: `Summary ${i}`,
          keyDifferentiators: [],
        })),
        total: 25,
        limit: 20,
        offset: 0,
      },
      isLoading: false,
      error: null,
    });

    render(<ComparisonsPage projectId={1} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText('Load More')).toBeInTheDocument();
  });

  it('should render page heading', () => {
    mockUseProjectComparisons.mockReturnValue({
      data: { comparisons: [], total: 0, limit: 20, offset: 0 },
      isLoading: false,
      error: null,
    });

    render(<ComparisonsPage projectId={1} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText('Comparisons')).toBeInTheDocument();
    expect(screen.getByText('Compare ticket implementations')).toBeInTheDocument();
  });
});
