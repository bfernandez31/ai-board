/**
 * RTL Component Tests: CommandPalette
 *
 * Tests for command palette open/close, navigation groups, ticket search,
 * and keyboard navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockPush = vi.fn();
let mockPathname = '/projects/1/board';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

// Mock useTicketSearch
const mockTicketSearch = vi.fn().mockReturnValue({
  data: null,
  isLoading: false,
});
vi.mock('@/app/lib/hooks/queries/useTicketSearch', () => ({
  useTicketSearch: (...args: unknown[]) => mockTicketSearch(...args),
}));

// Import AFTER mocks
import { CommandPalette } from '@/components/navigation/command-palette';

function renderPalette(props: { open?: boolean; onOpenChange?: (v: boolean) => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const onOpenChange = props.onOpenChange ?? vi.fn();
  return {
    onOpenChange,
    ...render(
      <QueryClientProvider client={queryClient}>
        <CommandPalette
          projectId={1}
          open={props.open ?? true}
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>
    ),
  };
}

describe('CommandPalette', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/projects/1/board';
    mockTicketSearch.mockReturnValue({ data: null, isLoading: false });
  });

  it('renders navigation items when open', () => {
    renderPalette({ open: true });

    expect(screen.getByPlaceholderText('Search tickets or navigate...')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderPalette({ open: false });

    expect(screen.queryByPlaceholderText('Search tickets or navigate...')).not.toBeInTheDocument();
  });

  it('opens on Cmd+K keydown', async () => {
    const onOpenChange = vi.fn();
    renderPalette({ open: false, onOpenChange });

    await userEvent.keyboard('{Meta>}k{/Meta}');

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('calls onOpenChange(false) on Escape', async () => {
    const onOpenChange = vi.fn();
    renderPalette({ open: true, onOpenChange });

    await userEvent.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('navigates to selected navigation item', async () => {
    const onOpenChange = vi.fn();
    mockPathname = '/projects/1/board';
    renderPalette({ open: true, onOpenChange });

    const analyticsItem = screen.getByText('Analytics');
    await userEvent.click(analyticsItem);

    expect(mockPush).toHaveBeenCalledWith('/projects/1/analytics');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes without navigation when selecting current page', async () => {
    const onOpenChange = vi.fn();
    mockPathname = '/projects/1/board';
    renderPalette({ open: true, onOpenChange });

    const boardItem = screen.getByText('Board');
    await userEvent.click(boardItem);

    expect(mockPush).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows ticket results when search query >= 2 chars', async () => {
    mockTicketSearch.mockReturnValue({
      data: {
        results: [
          { id: 1, ticketKey: 'AIB-1', title: 'Fix bug', stage: 'BUILD' },
          { id: 2, ticketKey: 'AIB-2', title: 'Add feature', stage: 'INBOX' },
        ],
        totalCount: 2,
      },
      isLoading: false,
    });

    renderPalette({ open: true });

    const input = screen.getByPlaceholderText('Search tickets or navigate...');
    await userEvent.type(input, 'fix');

    await waitFor(() => {
      expect(screen.getByText('AIB-1')).toBeInTheDocument();
      expect(screen.getByText('Fix bug')).toBeInTheDocument();
    });
  });

  it('shows loading spinner during ticket search', () => {
    mockTicketSearch.mockReturnValue({ data: null, isLoading: true });

    renderPalette({ open: true });

    // The Loader2 spinner should be present
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows empty state when no results match', async () => {
    renderPalette({ open: true });

    // Type something that doesn't match any navigation item
    const input = screen.getByPlaceholderText('Search tickets or navigate...');
    await userEvent.type(input, 'xyznonexistent');

    await waitFor(() => {
      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });
  });

  it('groups results under Navigation and Tickets headings', async () => {
    mockTicketSearch.mockReturnValue({
      data: {
        results: [{ id: 1, ticketKey: 'AIB-1', title: 'Test ticket', stage: 'INBOX' }],
        totalCount: 1,
      },
      isLoading: false,
    });

    renderPalette({ open: true });

    const input = screen.getByPlaceholderText('Search tickets or navigate...');
    await userEvent.type(input, 'test');

    await waitFor(() => {
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Tickets')).toBeInTheDocument();
    });
  });
});
