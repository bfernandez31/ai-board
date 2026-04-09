/**
 * RTL Component Tests: RetroSpecBanner
 *
 * Tests for the retro-spec generation banner on the board.
 * Verifies rendering, dismissal persistence, and generate button behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { RetroSpecBanner } from '@/components/board/retro-spec-banner';

// Mock the modal to avoid complex dialog rendering
vi.mock('@/components/board/retro-spec-modal', () => ({
  RetroSpecModal: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="retro-spec-modal"><button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));

describe('RetroSpecBanner', () => {
  const defaultProps = {
    projectId: 1,
    hasSpecs: false,
    isGenerating: false,
    onGenerateSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render when specs not generated and not dismissed', () => {
    renderWithProviders(<RetroSpecBanner {...defaultProps} />);

    expect(screen.getByTestId('retro-spec-banner')).toBeInTheDocument();
    expect(screen.getByText('Project specs not generated')).toBeInTheDocument();
  });

  it('should not render when specs already generated', () => {
    renderWithProviders(<RetroSpecBanner {...defaultProps} hasSpecs={true} />);

    expect(screen.queryByTestId('retro-spec-banner')).not.toBeInTheDocument();
  });

  it('should not render when dismissed via localStorage', () => {
    localStorage.setItem('retro-spec-banner-dismissed-1', 'true');

    renderWithProviders(<RetroSpecBanner {...defaultProps} />);

    expect(screen.queryByTestId('retro-spec-banner')).not.toBeInTheDocument();
  });

  it('should not render when generating', () => {
    renderWithProviders(<RetroSpecBanner {...defaultProps} isGenerating={true} />);

    expect(screen.queryByTestId('retro-spec-banner')).not.toBeInTheDocument();
  });

  it('should dismiss and persist to localStorage on close button click', async () => {
    const user = userEvent.setup();

    renderWithProviders(<RetroSpecBanner {...defaultProps} />);

    expect(screen.getByTestId('retro-spec-banner')).toBeInTheDocument();

    await user.click(screen.getByTestId('retro-spec-dismiss-btn'));

    expect(screen.queryByTestId('retro-spec-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem('retro-spec-banner-dismissed-1')).toBe('true');
  });

  it('should open modal when Generate button is clicked', async () => {
    const user = userEvent.setup();

    renderWithProviders(<RetroSpecBanner {...defaultProps} />);

    await user.click(screen.getByTestId('retro-spec-generate-btn'));

    expect(screen.getByTestId('retro-spec-modal')).toBeInTheDocument();
  });
});
