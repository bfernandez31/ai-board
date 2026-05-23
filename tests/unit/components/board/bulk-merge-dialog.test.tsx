import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { BulkMergeDialog } from '@/components/board/bulk-merge-dialog';
import type { TicketWithVersion } from '@/lib/types';
import { Agent } from '@prisma/client';

function createTicket(id: number, title: string, description: string | null): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: `AIB-${id}`,
    title,
    description,
    stage: 'INBOX',
    version: 1,
    projectId: 1,
    branch: null,
    previewUrl: null,
    autoMode: false,
    clarificationPolicy: null,
    agent: Agent.CLAUDE,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    workflowType: 'FULL',
    attachments: [],
    qualityScore: null,
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:00:00.000Z',
    project: { clarificationPolicy: 'AUTO', defaultAgent: Agent.CLAUDE },
    jobs: [],
  };
}

describe('BulkMergeDialog', () => {
  it('shows merge preview order and the oldest base ticket', () => {
    renderWithProviders(
      <BulkMergeDialog
        open={true}
        onOpenChange={vi.fn()}
        selectedTickets={[
          createTicket(1, 'First', 'Base'),
          createTicket(2, 'Second', 'Source'),
        ]}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByTestId('bulk-merge-base-ticket')).toHaveTextContent('AIB-1 First');
    expect(screen.getByTestId('bulk-merge-preview-order')).toHaveTextContent('Base: AIB-1 First');
    expect(screen.getByTestId('bulk-merge-preview-order')).toHaveTextContent('Source: AIB-2 Second');
  });

  it('shows live remaining-character feedback and blocks over-limit submission', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    renderWithProviders(
      <BulkMergeDialog
        open={true}
        onOpenChange={vi.fn()}
        selectedTickets={[
          createTicket(1, 'First', 'Base'),
          createTicket(2, 'Second', 'Source'),
        ]}
        onSave={onSave}
      />
    );

    const description = screen.getByLabelText('Merged description');
    fireEvent.change(description, { target: { value: 'x'.repeat(10001) } });

    expect(screen.getByTestId('bulk-merge-remaining-characters')).toHaveTextContent('1 characters over limit');
    expect(screen.getByRole('button', { name: 'Merge selected tickets' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
