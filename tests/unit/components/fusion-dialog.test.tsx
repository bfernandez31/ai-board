import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { FusionDialog } from '@/components/board/fusion-dialog';

const SHORT_DESC = 'Anchor body\n\n---\n\n## [AIB-2] Beta\n\nBeta body';

function setup(overrides: Partial<React.ComponentProps<typeof FusionDialog>> = {}) {
  const onOpenChange = vi.fn();
  const props: React.ComponentProps<typeof FusionDialog> = {
    open: true,
    onOpenChange,
    projectId: 1,
    anchorId: 1,
    anchorVersion: 1,
    anchorKey: 'AIB-1',
    initialTitle: 'Anchor title',
    initialDescription: SHORT_DESC,
    attachments: [],
    clippedAttachmentCount: 0,
    absorbed: [{ id: 2, version: 1, ticketKey: 'AIB-2' }],
    ...overrides,
  };
  renderWithProviders(<FusionDialog {...props} />);
  return { onOpenChange };
}

describe('FusionDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prefills the title and merged description', () => {
    setup();
    expect(screen.getByDisplayValue('Anchor title')).toBeInTheDocument();
    expect(screen.getByTestId('fusion-description-textarea')).toHaveValue(SHORT_DESC);
  });

  it('renders a live character counter', () => {
    setup();
    expect(screen.getByTestId('character-counter')).toBeInTheDocument();
  });

  it('disables Save and shows banner when description exceeds 10000 chars', async () => {
    const user = userEvent.setup();
    setup({ initialDescription: 'x' });

    const textarea = screen.getByTestId('fusion-description-textarea');
    await user.clear(textarea);
    const oversize = 'a'.repeat(10_001);
    await user.click(textarea);
    // Use clipboard-like paste to avoid 10k slow keyboard simulation
    await user.paste(oversize);

    expect(screen.getByTestId('fusion-too-long-banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fuse 2 tickets/i })).toBeDisabled();
  });

  it('enables Save at exactly 10000 chars', async () => {
    const user = userEvent.setup();
    setup({ initialDescription: 'x' });
    const textarea = screen.getByTestId('fusion-description-textarea');
    await user.clear(textarea);
    const exact = 'a'.repeat(10_000);
    await user.click(textarea);
    await user.paste(exact);

    expect(screen.queryByTestId('fusion-too-long-banner')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fuse 2 tickets/i })).toBeEnabled();
  });

  it('renders the clipped-attachments warning when clippedAttachmentCount > 0', () => {
    setup({ clippedAttachmentCount: 2 });
    expect(screen.getByTestId('fusion-clipped-banner')).toHaveTextContent(/2 images dropped/i);
  });

  it('singularizes the clipped banner at count 1', () => {
    setup({ clippedAttachmentCount: 1 });
    expect(screen.getByTestId('fusion-clipped-banner')).toHaveTextContent(/^1 image dropped/i);
  });
});
