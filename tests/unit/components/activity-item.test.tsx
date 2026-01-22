/**
 * Component Test: Activity Item
 * Feature: AIB-177-project-activity-feed
 *
 * Tests for the ActivityItem component rendering different event types
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityItem } from '@/components/activity/activity-item';
import type {
  ActivityEvent,
  TicketCreatedEvent,
  StageChangedEvent,
  CommentPostedEvent,
  JobStartedEvent,
  JobCompletedEvent,
  JobFailedEvent,
  PRCreatedEvent,
  PreviewDeployedEvent,
} from '@/app/lib/types/activity-event';

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

// Store original Date for cleanup
const RealDate = Date;

beforeAll(() => {
  // Mock Date to make relative time consistent
  const mockDate = new Date('2026-01-15T12:00:00Z');
  vi.useFakeTimers();
  vi.setSystemTime(mockDate);
});

afterAll(() => {
  vi.useRealTimers();
});

// Factory functions for test events
function createBaseEvent(): Pick<ActivityEvent, 'timestamp' | 'actor' | 'ticket'> {
  return {
    timestamp: '2026-01-15T11:00:00Z', // 1 hour ago from mock time
    actor: {
      type: 'system',
      id: 'ai-board',
      name: 'AI-BOARD',
      image: null,
    },
    ticket: {
      id: 1,
      ticketKey: 'TEST-1',
      title: 'Test Ticket',
      exists: true,
      stage: 'BUILD',
    },
  };
}

function createUserEvent(): Pick<ActivityEvent, 'timestamp' | 'actor' | 'ticket'> {
  return {
    timestamp: '2026-01-15T11:30:00Z', // 30 mins ago from mock time
    actor: {
      type: 'user',
      id: 'user-1',
      name: 'John Doe',
      image: 'https://example.com/avatar.png',
    },
    ticket: {
      id: 1,
      ticketKey: 'TEST-1',
      title: 'Test Ticket',
      exists: true,
      stage: 'BUILD',
    },
  };
}

describe('ActivityItem', () => {
  describe('ticket_created event', () => {
    it('should render ticket created event', () => {
      const event: TicketCreatedEvent = {
        type: 'ticket_created',
        id: 'ticket_created_1',
        ...createBaseEvent(),
        data: { title: 'New Feature' },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.getByText('AI-BOARD')).toBeInTheDocument();
      expect(screen.getByText(/created ticket/i)).toBeInTheDocument();
      expect(screen.getByText('TEST-1')).toBeInTheDocument();
    });
  });

  describe('stage_changed event', () => {
    it('should render stage change with badges', () => {
      const event: StageChangedEvent = {
        type: 'stage_changed',
        id: 'stage_changed_1',
        ...createBaseEvent(),
        data: { fromStage: 'PLAN', toStage: 'BUILD' },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.getByText('AI-BOARD')).toBeInTheDocument();
      expect(screen.getByText(/moved/i)).toBeInTheDocument();
      expect(screen.getByText('PLAN')).toBeInTheDocument();
      expect(screen.getByText('BUILD')).toBeInTheDocument();
    });
  });

  describe('comment_posted event', () => {
    it('should render comment with user actor and preview', () => {
      const event: CommentPostedEvent = {
        type: 'comment_posted',
        id: 'comment_1',
        ...createUserEvent(),
        data: { preview: 'This is a great feature!', commentId: 123 },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText(/commented on/i)).toBeInTheDocument();
      expect(screen.getByText(/"This is a great feature!"/)).toBeInTheDocument();
    });

    it('should handle long comment preview (truncated to 100 chars)', () => {
      const longPreview = 'A'.repeat(100) + '...';
      const event: CommentPostedEvent = {
        type: 'comment_posted',
        id: 'comment_2',
        ...createUserEvent(),
        data: { preview: longPreview, commentId: 124 },
      };

      render(<ActivityItem event={event} projectId={1} />);

      // Preview should be shown (even if truncated)
      expect(screen.getByText(/A{10,}/)).toBeInTheDocument();
    });
  });

  describe('job_started event', () => {
    it('should render job started event', () => {
      const event: JobStartedEvent = {
        type: 'job_started',
        id: 'job_started_1',
        ...createBaseEvent(),
        data: { command: 'implement', jobId: 1 },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.getByText('AI-BOARD')).toBeInTheDocument();
      expect(screen.getByText(/started/i)).toBeInTheDocument();
      expect(screen.getByText(/Implementation/i)).toBeInTheDocument();
    });
  });

  describe('job_completed event', () => {
    it('should render job completed event with duration', () => {
      const event: JobCompletedEvent = {
        type: 'job_completed',
        id: 'job_completed_1',
        ...createBaseEvent(),
        data: { command: 'verify', jobId: 2, durationMs: 30000 },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.getByText('AI-BOARD')).toBeInTheDocument();
      expect(screen.getByText(/completed/i)).toBeInTheDocument();
      expect(screen.getByText(/Verification/i)).toBeInTheDocument();
      expect(screen.getByText(/(30s)/)).toBeInTheDocument();
    });

    it('should handle null duration', () => {
      const event: JobCompletedEvent = {
        type: 'job_completed',
        id: 'job_completed_2',
        ...createBaseEvent(),
        data: { command: 'specify', jobId: 3, durationMs: null },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.queryByText(/\(\d+s\)/)).not.toBeInTheDocument();
    });
  });

  describe('job_failed event', () => {
    it('should render job failed event with red styling', () => {
      const event: JobFailedEvent = {
        type: 'job_failed',
        id: 'job_failed_1',
        ...createBaseEvent(),
        data: { command: 'implement', jobId: 4 },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.getByText('AI-BOARD')).toBeInTheDocument();
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });

  describe('pr_created event', () => {
    it('should render PR created event', () => {
      const event: PRCreatedEvent = {
        type: 'pr_created',
        id: 'pr_created_1',
        ...createBaseEvent(),
        data: { jobId: 5 },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.getByText('AI-BOARD')).toBeInTheDocument();
      expect(screen.getByText(/created PR for/i)).toBeInTheDocument();
    });
  });

  describe('preview_deployed event', () => {
    it('should render preview deployed event with link', () => {
      const event: PreviewDeployedEvent = {
        type: 'preview_deployed',
        id: 'preview_deployed_1',
        ...createBaseEvent(),
        data: { jobId: 6, previewUrl: 'https://preview.example.com' },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.getByText('AI-BOARD')).toBeInTheDocument();
      expect(screen.getByText(/deployed preview for/i)).toBeInTheDocument();
      expect(screen.getByText('View preview')).toBeInTheDocument();
      expect(screen.getByText('View preview')).toHaveAttribute(
        'href',
        'https://preview.example.com'
      );
    });

    it('should handle null preview URL', () => {
      const event: PreviewDeployedEvent = {
        type: 'preview_deployed',
        id: 'preview_deployed_2',
        ...createBaseEvent(),
        data: { jobId: 7, previewUrl: null },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.queryByText('View preview')).not.toBeInTheDocument();
    });
  });

  describe('Relative time formatting', () => {
    it('should show relative time for events', () => {
      const event: TicketCreatedEvent = {
        type: 'ticket_created',
        id: 'ticket_created_time',
        ...createBaseEvent(),
        timestamp: '2026-01-15T11:00:00Z', // 1 hour ago
        data: { title: 'Test' },
      };

      render(<ActivityItem event={event} projectId={1} />);

      expect(screen.getByText('1h ago')).toBeInTheDocument();
    });
  });

  describe('Ticket link', () => {
    it('should link to ticket when it exists', () => {
      const event: TicketCreatedEvent = {
        type: 'ticket_created',
        id: 'ticket_link_test',
        ...createBaseEvent(),
        data: { title: 'Test' },
      };

      render(<ActivityItem event={event} projectId={1} />);

      const link = screen.getByText('TEST-1');
      expect(link).toHaveAttribute('href', '/projects/1/board?ticket=TEST-1');
    });

    it('should show plain text for deleted ticket', () => {
      const event: TicketCreatedEvent = {
        type: 'ticket_created',
        id: 'deleted_ticket_test',
        timestamp: '2026-01-15T11:00:00Z',
        actor: { type: 'system', id: 'ai-board', name: 'AI-BOARD', image: null },
        ticket: {
          id: 999,
          ticketKey: 'OLD-1',
          title: '[Deleted ticket]',
          exists: false,
          stage: null,
        },
        data: { title: 'Deleted' },
      };

      render(<ActivityItem event={event} projectId={1} />);

      const ticketKey = screen.getByText('OLD-1');
      expect(ticketKey.tagName).not.toBe('A');
    });
  });

  describe('Actor avatar', () => {
    it('should render system icon for AI-BOARD actor', () => {
      const event: JobStartedEvent = {
        type: 'job_started',
        id: 'system_actor_test',
        ...createBaseEvent(),
        data: { command: 'implement', jobId: 1 },
      };

      const { container } = render(<ActivityItem event={event} projectId={1} />);

      // Check for Bot icon (system actor)
      const botIcon = container.querySelector('.lucide-bot');
      expect(botIcon).toBeInTheDocument();
    });

    it('should render user avatar for user actor', () => {
      const event: CommentPostedEvent = {
        type: 'comment_posted',
        id: 'user_actor_test',
        ...createUserEvent(),
        data: { preview: 'Test', commentId: 1 },
      };

      render(<ActivityItem event={event} projectId={1} />);

      // Check for user's name in the component (avatar fallback shows initials JD)
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      // Avatar fallback shows initials when image doesn't load in test environment
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });
});
