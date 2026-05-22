import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { MergePreviewModal } from '@/components/board/merge-preview-modal';
import type { TicketWithVersion } from '@/lib/types';

function makeTicket(id: number, key: string, title: string, description: string | null = null): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: key,
    title,
    description,
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

describe('MergePreviewModal', () => {
  const tickets = [
    makeTicket(10, 'AIB-10', 'Base ticket', 'Base description'),
    makeTicket(15, 'AIB-15', 'Source ticket 1', 'Source 1 desc'),
    makeTicket(20, 'AIB-20', 'Source ticket 2', null),
  ];

  const defaultProps = {
    tickets,
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    isMerging: false,
  };

  it('should display tickets ordered by ID with base badge', () => {
    renderWithProviders(<MergePreviewModal {...defaultProps} />);
    expect(screen.getByText('AIB-10')).toBeInTheDocument();
    expect(screen.getByText('AIB-15')).toBeInTheDocument();
    expect(screen.getByText('AIB-20')).toBeInTheDocument();
    const badges = screen.getAllByText('base');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('should pre-fill title from base ticket', () => {
    renderWithProviders(<MergePreviewModal {...defaultProps} />);
    const titleInput = screen.getByDisplayValue('Base ticket');
    expect(titleInput).toBeInTheDocument();
  });

  it('should pre-fill description with concatenated format', () => {
    renderWithProviders(<MergePreviewModal {...defaultProps} />);
    const textarea = screen.getByRole('textbox', { name: /description/i }) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Base description');
    expect(textarea.value).toContain('AIB-15');
  });

  it('should show character counter', () => {
    renderWithProviders(<MergePreviewModal {...defaultProps} />);
    expect(screen.getByText(/\d+\s*\/\s*10,?000/)).toBeInTheDocument();
  });

  it('should show submit button with ticket count', () => {
    renderWithProviders(<MergePreviewModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /merge 3 tickets/i })).toBeInTheDocument();
  });

  it('should show merging state', () => {
    renderWithProviders(<MergePreviewModal {...defaultProps} isMerging={true} />);
    expect(screen.getByText(/merging/i)).toBeInTheDocument();
  });

  it('should show data loss warning', () => {
    renderWithProviders(<MergePreviewModal {...defaultProps} />);
    expect(screen.getByText(/permanently lost/i)).toBeInTheDocument();
  });

  it('should not render when no tickets', () => {
    const { container } = renderWithProviders(
      <MergePreviewModal {...defaultProps} tickets={[]} />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
