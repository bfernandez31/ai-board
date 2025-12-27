/**
 * StageColumn Component Tests
 *
 * Tests for the StageColumn component which displays a column of tickets
 * for a specific stage in the board.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/render-helpers';
import { createMockTicketWithVersion } from '../helpers/factories';
import { StageColumn } from '@/components/board/stage-column';
import { Stage } from '@/lib/stage-transitions';

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

// Mock the deploy preview hook
vi.mock('@/app/lib/hooks/mutations/useDeployPreview', () => ({
  useDeployPreview: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// Mock Next.js navigation (needed by NewTicketButton)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

describe('StageColumn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('displays column heading with stage name', () => {
      renderWithProviders(
        <StageColumn
          stage={Stage.INBOX}
          tickets={[]}
          projectId={1}
        />
      );

      expect(screen.getByText('INBOX')).toBeInTheDocument();
    });

    it('displays different stage names correctly', () => {
      const stages = [
        { stage: Stage.SPECIFY, expected: 'SPECIFY' },
        { stage: Stage.PLAN, expected: 'PLAN' },
        { stage: Stage.BUILD, expected: 'BUILD' },
        { stage: Stage.VERIFY, expected: 'VERIFY' },
        { stage: Stage.SHIP, expected: 'SHIP' },
      ];

      for (const { stage, expected } of stages) {
        const { unmount } = renderWithProviders(
          <StageColumn
            stage={stage}
            tickets={[]}
            projectId={1}
          />
        );

        expect(screen.getByText(expected)).toBeInTheDocument();
        unmount();
      }
    });

    it('renders all ticket cards in the column', () => {
      const tickets = [
        createMockTicketWithVersion({ id: 1, ticketKey: 'ABC-1', title: 'First ticket' }),
        createMockTicketWithVersion({ id: 2, ticketKey: 'ABC-2', title: 'Second ticket' }),
        createMockTicketWithVersion({ id: 3, ticketKey: 'ABC-3', title: 'Third ticket' }),
      ];

      renderWithProviders(
        <StageColumn
          stage={Stage.INBOX}
          tickets={tickets}
          projectId={1}
        />
      );

      expect(screen.getByText('ABC-1')).toBeInTheDocument();
      expect(screen.getByText('ABC-2')).toBeInTheDocument();
      expect(screen.getByText('ABC-3')).toBeInTheDocument();
      expect(screen.getByText('First ticket')).toBeInTheDocument();
      expect(screen.getByText('Second ticket')).toBeInTheDocument();
      expect(screen.getByText('Third ticket')).toBeInTheDocument();
    });

    it('shows empty state when no tickets', () => {
      renderWithProviders(
        <StageColumn
          stage={Stage.INBOX}
          tickets={[]}
          projectId={1}
        />
      );

      expect(screen.getByText('No tickets')).toBeInTheDocument();
    });

    it('shows ticket count badge', () => {
      const tickets = [
        createMockTicketWithVersion({ id: 1 }),
        createMockTicketWithVersion({ id: 2 }),
      ];

      renderWithProviders(
        <StageColumn
          stage={Stage.INBOX}
          tickets={tickets}
          projectId={1}
        />
      );

      // Badge shows "2" for 2 tickets
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows zero count when no tickets', () => {
      renderWithProviders(
        <StageColumn
          stage={Stage.INBOX}
          tickets={[]}
          projectId={1}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('data-testid', () => {
    it('has correct data-testid for column', () => {
      renderWithProviders(
        <StageColumn
          stage={Stage.BUILD}
          tickets={[]}
          projectId={1}
        />
      );

      expect(screen.getByTestId('column-BUILD')).toBeInTheDocument();
    });
  });

  describe('blocked state', () => {
    it('shows workflow blocked overlay when isBlockedByJob is true', () => {
      renderWithProviders(
        <StageColumn
          stage={Stage.INBOX}
          tickets={[]}
          projectId={1}
          isBlockedByJob={true}
          blockReason="job"
        />
      );

      expect(screen.getByText('Workflow in progress')).toBeInTheDocument();
      expect(screen.getByText('Wait for job completion')).toBeInTheDocument();
    });

    it('shows cleanup blocked overlay when blockReason is cleanup', () => {
      renderWithProviders(
        <StageColumn
          stage={Stage.INBOX}
          tickets={[]}
          projectId={1}
          isBlockedByJob={true}
          blockReason="cleanup"
        />
      );

      expect(screen.getByText('Cleanup in progress')).toBeInTheDocument();
      expect(screen.getByText('Wait for cleanup completion')).toBeInTheDocument();
    });

    it('does not show blocked overlay when isBlockedByJob is false', () => {
      renderWithProviders(
        <StageColumn
          stage={Stage.INBOX}
          tickets={[]}
          projectId={1}
          isBlockedByJob={false}
        />
      );

      expect(screen.queryByText('Workflow in progress')).not.toBeInTheDocument();
      expect(screen.queryByText('Cleanup in progress')).not.toBeInTheDocument();
    });
  });
});
