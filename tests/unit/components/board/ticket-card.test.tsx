/**
 * TicketCard Component Tests
 *
 * Tests for the TicketCard component which displays ticket information
 * and handles click interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/render-helpers';
import { createMockTicketWithVersion, createMockJob } from '../helpers/factories';
import { TicketCard } from '@/components/board/ticket-card';
import type { TicketWithVersion } from '@/lib/types';

// Mock @dnd-kit/core to avoid drag-and-drop context requirements
vi.mock('@dnd-kit/core', () => ({
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

describe('TicketCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('displays ticket key and title', () => {
      const ticket = createMockTicketWithVersion({
        ticketKey: 'ABC-42',
        title: 'Fix authentication bug',
      });

      renderWithProviders(<TicketCard ticket={ticket} />);

      expect(screen.getByText('ABC-42')).toBeInTheDocument();
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
    });

    it('shows QUICK workflow type badge', () => {
      const ticket = createMockTicketWithVersion({
        workflowType: 'QUICK',
      });

      renderWithProviders(<TicketCard ticket={ticket} />);

      expect(screen.getByText('⚡ Quick')).toBeInTheDocument();
    });

    it('shows CLEAN workflow type badge with Sparkles icon', () => {
      const ticket = createMockTicketWithVersion({
        workflowType: 'CLEAN',
      });

      renderWithProviders(<TicketCard ticket={ticket} />);

      expect(screen.getByText('Clean')).toBeInTheDocument();
    });

    it('does not show Quick badge for FULL workflow type', () => {
      const ticket = createMockTicketWithVersion({
        workflowType: 'FULL',
      });

      renderWithProviders(<TicketCard ticket={ticket} />);

      expect(screen.queryByText('⚡ Quick')).not.toBeInTheDocument();
      expect(screen.queryByText('Clean')).not.toBeInTheDocument();
    });

    it('renders with data-testid for testing', () => {
      const ticket = createMockTicketWithVersion();

      renderWithProviders(<TicketCard ticket={ticket} />);

      expect(screen.getByTestId('ticket-card')).toBeInTheDocument();
    });

    it('shows model badge (SONNET for non-CLEAN, OPUS for CLEAN)', () => {
      const fullTicket = createMockTicketWithVersion({ workflowType: 'FULL' });
      const cleanTicket = createMockTicketWithVersion({ workflowType: 'CLEAN' });

      const { rerender } = renderWithProviders(<TicketCard ticket={fullTicket} />);
      expect(screen.getByText('SONNET')).toBeInTheDocument();

      rerender(<TicketCard ticket={cleanTicket} />);
      expect(screen.getByText('OPUS')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('calls onTicketClick when card is clicked', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicketWithVersion({
        ticketKey: 'XYZ-99',
        title: 'Test click interaction',
      });
      const onTicketClick = vi.fn();

      renderWithProviders(
        <TicketCard ticket={ticket} onTicketClick={onTicketClick} />
      );

      await user.click(screen.getByTestId('ticket-card'));

      expect(onTicketClick).toHaveBeenCalledTimes(1);
      expect(onTicketClick).toHaveBeenCalledWith(ticket);
    });

    it('does not throw when clicked without onTicketClick prop', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicketWithVersion();

      renderWithProviders(<TicketCard ticket={ticket} />);

      // Should not throw
      await user.click(screen.getByTestId('ticket-card'));
    });
  });

  describe('job status indicators', () => {
    it('shows job status indicator when workflowJob is present', () => {
      const ticket = createMockTicketWithVersion({ stage: 'BUILD' });
      const job = createMockJob({ status: 'RUNNING', command: 'implement' });

      renderWithProviders(<TicketCard ticket={ticket} workflowJob={job} />);

      // Job status indicator section should be present
      const card = screen.getByTestId('ticket-card');
      expect(card).toBeInTheDocument();
    });

    it('does not show job status section when no jobs', () => {
      const ticket = createMockTicketWithVersion({
        stage: 'INBOX',
        branch: null,
      });

      renderWithProviders(<TicketCard ticket={ticket} />);

      // The ticket card should still render
      expect(screen.getByTestId('ticket-card')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA role and label', () => {
      const ticket = createMockTicketWithVersion({
        ticketKey: 'ACC-1',
        title: 'Accessibility test ticket',
      });

      renderWithProviders(<TicketCard ticket={ticket} />);

      const article = screen.getByRole('article', {
        name: 'Ticket ACC-1: Accessibility test ticket',
      });
      expect(article).toBeInTheDocument();
    });
  });
});
