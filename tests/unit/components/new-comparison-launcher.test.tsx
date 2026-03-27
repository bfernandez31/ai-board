/**
 * Component Test: NewComparisonLauncher
 * Feature: AIB-358-comparisons-hub-page
 *
 * Tests for the new comparison launcher dialog: ticket selection, validation, and empty state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewComparisonLauncher } from '@/components/comparisons/new-comparison-launcher';

// Mock the hooks
const mockUseVerifyStageTickets = vi.fn();
const mockUseLaunchComparison = vi.fn();

vi.mock('@/hooks/use-project-comparisons', () => ({
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

describe('NewComparisonLauncher', () => {
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLaunchComparison.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
      reset: vi.fn(),
    });
  });

  it('should render the New Comparison button', () => {
    mockUseVerifyStageTickets.mockReturnValue({ data: { tickets: [] }, isLoading: false });

    render(<NewComparisonLauncher projectId={1} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText('New Comparison')).toBeInTheDocument();
  });

  it('should open dialog when button is clicked', () => {
    mockUseVerifyStageTickets.mockReturnValue({
      data: {
        tickets: [
          { id: 1, ticketKey: 'AIB-101', title: 'Feature A', branch: 'AIB-101-branch' },
          { id: 2, ticketKey: 'AIB-102', title: 'Feature B', branch: 'AIB-102-branch' },
        ],
      },
      isLoading: false,
    });

    render(<NewComparisonLauncher projectId={1} />, { wrapper: createQueryWrapper() });

    fireEvent.click(screen.getByText('New Comparison'));

    expect(screen.getByText('Select 2 or more VERIFY-stage tickets to compare their implementations.')).toBeInTheDocument();
    expect(screen.getByText('AIB-101')).toBeInTheDocument();
    expect(screen.getByText('AIB-102')).toBeInTheDocument();
  });

  it('should show empty state when no VERIFY-stage tickets', () => {
    mockUseVerifyStageTickets.mockReturnValue({ data: { tickets: [] }, isLoading: false });

    render(<NewComparisonLauncher projectId={1} />, { wrapper: createQueryWrapper() });

    fireEvent.click(screen.getByText('New Comparison'));

    expect(screen.getByText(/No tickets are currently in the VERIFY stage/)).toBeInTheDocument();
  });

  it('should disable Compare button when fewer than 2 tickets selected', () => {
    mockUseVerifyStageTickets.mockReturnValue({
      data: {
        tickets: [
          { id: 1, ticketKey: 'AIB-101', title: 'Feature A', branch: 'AIB-101-branch' },
          { id: 2, ticketKey: 'AIB-102', title: 'Feature B', branch: 'AIB-102-branch' },
        ],
      },
      isLoading: false,
    });

    render(<NewComparisonLauncher projectId={1} />, { wrapper: createQueryWrapper() });

    fireEvent.click(screen.getByText('New Comparison'));

    const compareButton = screen.getByText('Compare (0)');
    expect(compareButton).toBeDisabled();
  });

  it('should enable Compare button when 2+ tickets selected', () => {
    mockUseVerifyStageTickets.mockReturnValue({
      data: {
        tickets: [
          { id: 1, ticketKey: 'AIB-101', title: 'Feature A', branch: 'AIB-101-branch' },
          { id: 2, ticketKey: 'AIB-102', title: 'Feature B', branch: 'AIB-102-branch' },
        ],
      },
      isLoading: false,
    });

    render(<NewComparisonLauncher projectId={1} />, { wrapper: createQueryWrapper() });

    fireEvent.click(screen.getByText('New Comparison'));

    // Select both tickets
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);

    const compareButton = screen.getByText('Compare (2)');
    expect(compareButton).not.toBeDisabled();
  });

  it('should show branch info for tickets', () => {
    mockUseVerifyStageTickets.mockReturnValue({
      data: {
        tickets: [
          { id: 1, ticketKey: 'AIB-101', title: 'Feature A', branch: 'AIB-101-feature-branch' },
        ],
      },
      isLoading: false,
    });

    render(<NewComparisonLauncher projectId={1} />, { wrapper: createQueryWrapper() });

    fireEvent.click(screen.getByText('New Comparison'));

    expect(screen.getByText('AIB-101-feature-branch')).toBeInTheDocument();
  });
});
