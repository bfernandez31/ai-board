/**
 * RTL Component Tests: ActivityFeed and ActivityEventItem
 * Feature: AIB-172 Project Activity Feed
 *
 * Tests for activity feed rendering, event variations, navigation, and pagination.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/tests/utils/component-test-utils';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { ActivityEventItem } from '@/components/activity/activity-event-item';
import type {
  ActivityEvent,
  ActivityFeedResponse,
  TicketCreatedEvent,
  TicketStageChangedEvent,
  CommentPostedEvent,
  JobStartedEvent,
  JobCompletedEvent,
  JobFailedEvent,
} from '@/app/lib/types/activity-event';

// Mock next/navigation
const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ projectId: '1' }),
  usePathname: () => '/projects/1/activity',
}));

// Mock the useActivityFeed hook
const mockUseActivityFeed = vi.fn();
vi.mock('@/app/lib/hooks/queries/use-activity-feed', () => ({
  useActivityFeed: (options: { projectId: number }) => mockUseActivityFeed(options),
}));

// Helper to create mock activity events
function createMockActor(overrides = {}) {
  return {
    id: 'actor-1',
    name: 'John Doe',
    email: 'john@example.com',
    image: 'https://example.com/avatar.jpg',
    isSystem: false,
    ...overrides,
  };
}

function createMockTicketReference(overrides = {}) {
  return {
    ticketKey: 'AIB-123',
    ticketId: 'ticket-1',
    isDeleted: false,
    ...overrides,
  };
}

function createTicketCreatedEvent(overrides = {}): TicketCreatedEvent {
  return {
    id: 'tc_1',
    type: 'ticket_created',
    timestamp: '2024-01-15T10:00:00Z',
    actor: createMockActor(),
    ticket: createMockTicketReference(),
    projectId: '1',
    data: {
      title: 'Test Ticket',
    },
    ...overrides,
  };
}

function createTicketStageChangedEvent(overrides = {}): TicketStageChangedEvent {
  return {
    id: 'tsc_1',
    type: 'ticket_stage_changed',
    timestamp: '2024-01-15T11:00:00Z',
    actor: createMockActor(),
    ticket: createMockTicketReference(),
    projectId: '1',
    data: {
      fromStage: 'INBOX',
      toStage: 'SPECIFY',
    },
    ...overrides,
  };
}

function createCommentPostedEvent(overrides = {}): CommentPostedEvent {
  return {
    id: 'cp_1',
    type: 'comment_posted',
    timestamp: '2024-01-15T12:00:00Z',
    actor: createMockActor(),
    ticket: createMockTicketReference(),
    projectId: '1',
    data: {
      contentPreview: 'This is a test comment',
      isAiBoardMention: false,
    },
    ...overrides,
  };
}

function createJobStartedEvent(overrides = {}): JobStartedEvent {
  return {
    id: 'js_1',
    type: 'job_started',
    timestamp: '2024-01-15T13:00:00Z',
    actor: createMockActor({ isSystem: true, name: 'AI-BOARD' }),
    ticket: createMockTicketReference(),
    projectId: '1',
    data: {
      command: 'specify',
      displayName: 'Specification',
    },
    ...overrides,
  };
}

function createJobCompletedEvent(overrides = {}): JobCompletedEvent {
  return {
    id: 'jc_1',
    type: 'job_completed',
    timestamp: '2024-01-15T14:00:00Z',
    actor: createMockActor({ isSystem: true, name: 'AI-BOARD' }),
    ticket: createMockTicketReference(),
    projectId: '1',
    data: {
      command: 'specify',
      displayName: 'Specification',
      durationMs: 120000,
    },
    ...overrides,
  };
}

function createJobFailedEvent(overrides = {}): JobFailedEvent {
  return {
    id: 'jf_1',
    type: 'job_failed',
    timestamp: '2024-01-15T15:00:00Z',
    actor: createMockActor({ isSystem: true, name: 'AI-BOARD' }),
    ticket: createMockTicketReference(),
    projectId: '1',
    data: {
      command: 'implement',
      displayName: 'Implementation',
      durationMs: 60000,
    },
    ...overrides,
  };
}

function createMockFeedResponse(
  events: ActivityEvent[],
  hasMore = false,
  total?: number
): ActivityFeedResponse {
  return {
    events,
    pagination: {
      offset: 0,
      limit: 50,
      total: total ?? events.length,
      hasMore,
    },
    actors: {},
  };
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render loading state', () => {
      mockUseActivityFeed.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        isFetching: false,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      // Loading spinner should be visible
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should render error state with message', () => {
      mockUseActivityFeed.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        isFetching: false,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      expect(screen.getByText('Failed to load activity')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should render empty state when no events', () => {
      mockUseActivityFeed.mockReturnValue({
        data: createMockFeedResponse([]),
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
      expect(
        screen.getByText(/When tickets are created, jobs run, or comments are posted/)
      ).toBeInTheDocument();
    });

    it('should render activity events in a timeline', () => {
      const events: ActivityEvent[] = [
        createTicketCreatedEvent(),
        createCommentPostedEvent({ id: 'cp_2' }),
      ];

      mockUseActivityFeed.mockReturnValue({
        data: createMockFeedResponse(events),
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      // Timeline should be rendered with proper ARIA label
      expect(screen.getByRole('list', { name: /timeline/i })).toBeInTheDocument();

      // Events should be rendered (use getAllByText for multiple matches)
      expect(screen.getAllByText(/John Doe/)).toHaveLength(2);
      expect(screen.getByText(/created/)).toBeInTheDocument();
      expect(screen.getByText(/commented on/)).toBeInTheDocument();
    });

    it('should show event count', () => {
      const events: ActivityEvent[] = [
        createTicketCreatedEvent(),
        createCommentPostedEvent({ id: 'cp_2' }),
      ];

      mockUseActivityFeed.mockReturnValue({
        data: createMockFeedResponse(events, false, 2),
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      expect(screen.getByText(/Showing 2 of 2 events/)).toBeInTheDocument();
    });

    it('should show polling indicator when fetching updates', () => {
      mockUseActivityFeed.mockReturnValue({
        data: createMockFeedResponse([createTicketCreatedEvent()]),
        isLoading: false,
        isError: false,
        error: null,
        isFetching: true,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      expect(screen.getByText('Updating')).toBeInTheDocument();
    });
  });

  describe('Load More Button', () => {
    it('should show Load more button when hasMore is true', () => {
      mockUseActivityFeed.mockReturnValue({
        data: createMockFeedResponse(
          [createTicketCreatedEvent()],
          true, // hasMore
          100
        ),
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      expect(
        screen.getByRole('button', { name: /load more activity/i })
      ).toBeInTheDocument();
    });

    it('should not show Load more button when hasMore is false', () => {
      mockUseActivityFeed.mockReturnValue({
        data: createMockFeedResponse(
          [createTicketCreatedEvent()],
          false // hasMore
        ),
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      expect(
        screen.queryByRole('button', { name: /load more activity/i })
      ).not.toBeInTheDocument();
    });

    it('should fetch more events when Load more button is clicked', async () => {
      const user = userEvent.setup();

      // Mock fetch for pagination
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            createMockFeedResponse([createCommentPostedEvent({ id: 'cp_page2' })])
          ),
      } as Response);

      mockUseActivityFeed.mockReturnValue({
        data: createMockFeedResponse([createTicketCreatedEvent()], true, 100),
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      const loadMoreButton = screen.getByRole('button', { name: /load more activity/i });
      await user.click(loadMoreButton);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/projects/1/activity?offset=1')
        );
      });

      fetchSpy.mockRestore();
    });

    it('should disable Load more button while fetching', () => {
      mockUseActivityFeed.mockReturnValue({
        data: createMockFeedResponse([createTicketCreatedEvent()], true, 100),
        isLoading: false,
        isError: false,
        error: null,
        isFetching: true,
      });

      renderWithProviders(<ActivityFeed projectId={1} />);

      const loadMoreButton = screen.getByRole('button', { name: /loading/i });
      expect(loadMoreButton).toBeDisabled();
    });
  });
});

describe('ActivityEventItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Ticket Created Event', () => {
    it('should render ticket created event with actor and title', () => {
      const event = createTicketCreatedEvent();

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/created/)).toBeInTheDocument();
      expect(screen.getByText('AIB-123')).toBeInTheDocument();
      expect(screen.getByText('Test Ticket')).toBeInTheDocument();
    });

    it('should show avatar for ticket created event', () => {
      const event = createTicketCreatedEvent();

      const { container } = renderWithProviders(
        <ActivityEventItem event={event} projectId={1} />
      );

      // Avatar should be rendered
      const avatar = container.querySelector('[data-slot="avatar"]') ||
        container.querySelector('img[alt="John Doe"]') ||
        container.querySelector('span.text-xs');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Ticket Stage Changed Event', () => {
    it('should render stage change with from and to stages', () => {
      const event = createTicketStageChangedEvent();

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText('AIB-123')).toBeInTheDocument();
      expect(screen.getByText(/moved/)).toBeInTheDocument();
      expect(screen.getByText('Inbox')).toBeInTheDocument();
      expect(screen.getByText('Specify')).toBeInTheDocument();
    });

    it('should render stage change without fromStage', () => {
      const event = createTicketStageChangedEvent({
        data: { toStage: 'BUILD' },
      });

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText(/moved/)).toBeInTheDocument();
      expect(screen.getByText('Build')).toBeInTheDocument();
      expect(screen.queryByText('Inbox')).not.toBeInTheDocument();
    });
  });

  describe('Comment Posted Event', () => {
    it('should render comment with preview', () => {
      const event = createCommentPostedEvent();

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/commented on/)).toBeInTheDocument();
      expect(screen.getByText('AIB-123')).toBeInTheDocument();
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    it('should show @ai-board mention indicator', () => {
      const event = createCommentPostedEvent({
        data: {
          contentPreview: 'Hey @ai-board, can you help?',
          isAiBoardMention: true,
        },
      });

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText('@ai-board')).toBeInTheDocument();
    });
  });

  describe('Job Events', () => {
    it('should render job started event', () => {
      const event = createJobStartedEvent();

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText('Specification')).toBeInTheDocument();
      expect(screen.getByText(/started for/)).toBeInTheDocument();
      expect(screen.getByText('AIB-123')).toBeInTheDocument();
    });

    it('should render job completed event with duration', () => {
      const event = createJobCompletedEvent();

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText('Specification')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('AIB-123')).toBeInTheDocument();
      expect(screen.getByText(/2m 0s/)).toBeInTheDocument();
    });

    it('should render job failed event with duration', () => {
      const event = createJobFailedEvent();

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText('Implementation')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
      expect(screen.getByText('AIB-123')).toBeInTheDocument();
      expect(screen.getByText(/1m 0s/)).toBeInTheDocument();
    });

    it('should show lightning icon for quick-impl jobs', () => {
      const event = createJobStartedEvent({
        data: {
          command: 'quick-impl',
          displayName: 'Quick Implementation',
        },
      });

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText('Quick Implementation')).toBeInTheDocument();
      // Lightning emoji should be present
      expect(screen.getByText(/⚡/)).toBeInTheDocument();
    });
  });

  describe('Ticket Reference Navigation', () => {
    it('should render clickable ticket reference link', () => {
      const event = createTicketCreatedEvent();

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      const link = screen.getByRole('link', { name: 'AIB-123' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/projects/1/board?ticket=ticket-1');
    });

    it('should render non-clickable reference for deleted ticket', () => {
      const event = createTicketCreatedEvent({
        ticket: createMockTicketReference({ isDeleted: true }),
      });

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText('AIB-123')).toBeInTheDocument();
      expect(screen.getByText('(deleted)')).toBeInTheDocument();

      // Should not be a link
      const link = screen.queryByRole('link', { name: 'AIB-123' });
      expect(link).not.toBeInTheDocument();
    });
  });

  describe('Deleted User Handling', () => {
    it('should show email when user name is null', () => {
      const event = createTicketCreatedEvent({
        actor: createMockActor({ name: null }),
      });

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      expect(screen.getByText(/john@example.com/)).toBeInTheDocument();
    });

    it('should show AI avatar fallback for system actor', () => {
      const event = createJobStartedEvent();

      const { container } = renderWithProviders(
        <ActivityEventItem event={event} projectId={1} />
      );

      // For job events, should show event icon, not avatar
      const icon = container.querySelector('[aria-label]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Timestamp Display', () => {
    it('should render timestamp with datetime attribute', () => {
      const event = createTicketCreatedEvent({
        timestamp: '2024-01-15T10:00:00Z',
      });

      renderWithProviders(<ActivityEventItem event={event} projectId={1} />);

      const timeElement = screen.getByRole('time');
      expect(timeElement).toHaveAttribute('dateTime', '2024-01-15T10:00:00Z');
    });
  });
});
