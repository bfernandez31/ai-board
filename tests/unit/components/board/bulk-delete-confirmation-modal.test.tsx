import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { BulkDeleteConfirmationModal } from '@/components/board/bulk-delete-confirmation-modal';
import type { TicketWithVersion } from '@/lib/types';

function makeTicket(id: number, key: string, title: string): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: key,
    title,
    description: null,
    stage: 'INBOX',
    version: 1,
    projectId: 1,
    branch: null,
    autoMode: false,
    clarificationPolicy: null,
    agent: null,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    workflowType: 'FULL',
    attachments: [],
    qualityScore: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as TicketWithVersion;
}

describe('BulkDeleteConfirmationModal', () => {
  const tickets = [
    makeTicket(1, 'AIB-1', 'First ticket'),
    makeTicket(2, 'AIB-2', 'Second ticket'),
    makeTicket(3, 'AIB-3', 'Third ticket'),
  ];

  const defaultProps = {
    tickets,
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    isDeleting: false,
  };

  it('should display ticket keys and titles', () => {
    renderWithProviders(<BulkDeleteConfirmationModal {...defaultProps} />);
    expect(screen.getByText(/AIB-1/)).toBeInTheDocument();
    expect(screen.getByText(/AIB-2/)).toBeInTheDocument();
    expect(screen.getByText(/AIB-3/)).toBeInTheDocument();
  });

  it('should display irreversibility warning', () => {
    renderWithProviders(<BulkDeleteConfirmationModal {...defaultProps} />);
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderWithProviders(<BulkDeleteConfirmationModal {...defaultProps} onConfirm={onConfirm} />);
    const confirmBtn = screen.getByRole('button', { name: /delete/i });
    confirmBtn.click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('should show deleting state', () => {
    renderWithProviders(<BulkDeleteConfirmationModal {...defaultProps} isDeleting={true} />);
    expect(screen.getByText(/deleting/i)).toBeInTheDocument();
  });

  it('should not render when no tickets', () => {
    const { container } = renderWithProviders(
      <BulkDeleteConfirmationModal {...defaultProps} tickets={[]} />
    );
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
