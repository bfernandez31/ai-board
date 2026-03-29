import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { GeneratedTicketsSection } from '@/components/health/generated-tickets-section';

vi.mock('@/app/lib/hooks/useGeneratedTickets', () => ({
  useGeneratedTickets: vi.fn((projectId: number, scanId: number | null) => {
    if (scanId === 1) {
      return {
        data: {
          tickets: [
            { id: 101, ticketKey: 'AIB-456', title: 'Fix SQL injection', stage: 'BUILD' },
            { id: 102, ticketKey: 'AIB-457', title: 'Update dependencies', stage: 'SHIP' },
          ],
        },
        isLoading: false,
      };
    }
    if (scanId === 2) {
      return { data: { tickets: [] }, isLoading: false };
    }
    if (scanId === 3) {
      return { data: undefined, isLoading: true };
    }
    return { data: { tickets: [] }, isLoading: false };
  }),
}));

describe('GeneratedTicketsSection', () => {
  it('renders tickets with key, title, and stage', () => {
    renderWithProviders(
      <GeneratedTicketsSection projectId={1} scanId={1} />
    );

    expect(screen.getByText('Generated Tickets')).toBeInTheDocument();
    expect(screen.getByText('AIB-456')).toBeInTheDocument();
    expect(screen.getByText('Fix SQL injection')).toBeInTheDocument();
    expect(screen.getByText('BUILD')).toBeInTheDocument();
    expect(screen.getByText('AIB-457')).toBeInTheDocument();
    expect(screen.getByText('SHIP')).toBeInTheDocument();
  });

  it('renders empty state when no tickets', () => {
    renderWithProviders(
      <GeneratedTicketsSection projectId={1} scanId={2} />
    );

    expect(screen.getByText('No tickets were generated from this scan.')).toBeInTheDocument();
  });

  it('renders loading skeleton', () => {
    renderWithProviders(
      <GeneratedTicketsSection projectId={1} scanId={3} />
    );

    expect(screen.getByText('Generated Tickets')).toBeInTheDocument();
  });
});
