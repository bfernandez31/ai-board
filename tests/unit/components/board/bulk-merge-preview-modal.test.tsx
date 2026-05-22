import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/tests/utils/component-test-utils';
import { BulkMergePreviewModal } from '@/components/board/bulk-merge-preview-modal';
import type { TicketWithVersion } from '@/lib/types';

function makeTicket(overrides: Partial<TicketWithVersion>): TicketWithVersion {
  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'AIB-1',
    title: 'Base',
    description: 'base desc',
    stage: 'INBOX',
    version: 1,
    projectId: 1,
    branch: null,
    previewUrl: null,
    autoMode: false,
    workflowType: 'FULL',
    attachments: [],
    clarificationPolicy: null,
    agent: null,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    qualityScore: null,
    jobs: [],
    ...overrides,
  } as unknown as TicketWithVersion;
}

describe('BulkMergePreviewModal', () => {
  it('renders prefilled values and lists sources with delete badge', () => {
    const base = makeTicket({ id: 10, ticketKey: 'AIB-10', title: 'Base', description: 'base body' });
    const sourceA = makeTicket({
      id: 15,
      ticketNumber: 15,
      ticketKey: 'AIB-15',
      title: 'Source A',
      description: 'A body',
    });
    const sourceB = makeTicket({
      id: 12,
      ticketNumber: 12,
      ticketKey: 'AIB-12',
      title: 'Source B',
      description: 'B body',
    });

    renderWithProviders(
      <BulkMergePreviewModal
        open
        tickets={[base, sourceA, sourceB]}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId('bulk-merge-title').textContent).toContain('3');

    const titleInput = screen.getByTestId('bulk-merge-title-input') as HTMLInputElement;
    expect(titleInput.value).toBe('Base');

    const descriptionInput = screen.getByTestId('bulk-merge-description-input') as HTMLTextAreaElement;
    // sources are ordered asc by id: 12 then 15
    expect(descriptionInput.value).toContain('AIB-12');
    expect(descriptionInput.value).toContain('AIB-15');
    expect(descriptionInput.value.indexOf('AIB-12')).toBeLessThan(descriptionInput.value.indexOf('AIB-15'));

    expect(screen.getByTestId('bulk-merge-source-12')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-merge-source-15')).toBeInTheDocument();
  });

  it('counter turns red and disables submit when description exceeds 10000', () => {
    const base = makeTicket({ id: 10, ticketKey: 'AIB-10', description: 'short' });
    const src = makeTicket({ id: 11, ticketKey: 'AIB-11', description: 'short' });
    renderWithProviders(
      <BulkMergePreviewModal
        open
        tickets={[base, src]}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const textarea = screen.getByTestId('bulk-merge-description-input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'C'.repeat(10001) } });

    const counter = screen.getByTestId('bulk-merge-description-counter');
    expect(counter.className).toContain('text-destructive');
    expect(screen.getByTestId('bulk-merge-confirm')).toBeDisabled();
  });

  it('submits with ordered source ids and edited fields', () => {
    const base = makeTicket({ id: 10, ticketKey: 'AIB-10' });
    const a = makeTicket({ id: 11, ticketKey: 'AIB-11' });
    const b = makeTicket({ id: 12, ticketKey: 'AIB-12' });
    const onSubmit = vi.fn();
    renderWithProviders(
      <BulkMergePreviewModal
        open
        tickets={[base, b, a]}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const titleInput = screen.getByTestId('bulk-merge-title-input') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'My merged title' } });

    fireEvent.click(screen.getByTestId('bulk-merge-confirm'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]![0];
    expect(payload.baseTicketId).toBe(10);
    expect(payload.sourceTicketIds).toEqual([11, 12]);
    expect(payload.title).toBe('My merged title');
  });

  it('renders inline error when errorMessage is provided', () => {
    const base = makeTicket({ id: 10 });
    const src = makeTicket({ id: 11 });
    renderWithProviders(
      <BulkMergePreviewModal
        open
        tickets={[base, src]}
        errorMessage="Stage drift"
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByTestId('bulk-merge-error').textContent).toContain('Stage drift');
  });
});
