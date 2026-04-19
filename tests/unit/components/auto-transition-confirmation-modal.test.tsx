/**
 * Component Tests: AutoTransitionConfirmationModal (AIB-689)
 *
 * Verifies the stage chain text rendered in the modal per current stage.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import {
  AutoTransitionConfirmationModal,
  getAutoTransitionChain,
} from '@/components/board/auto-transition-confirmation-modal';

describe('getAutoTransitionChain', () => {
  it('returns the three-stage chain from INBOX', () => {
    expect(getAutoTransitionChain('INBOX')).toEqual(['SPECIFY', 'PLAN', 'BUILD']);
  });

  it('returns the two-stage chain from SPECIFY', () => {
    expect(getAutoTransitionChain('SPECIFY')).toEqual(['PLAN', 'BUILD']);
  });

  it('returns the single-stage chain from PLAN', () => {
    expect(getAutoTransitionChain('PLAN')).toEqual(['BUILD']);
  });

  it('returns an empty chain for BUILD/VERIFY/SHIP/CLOSED', () => {
    expect(getAutoTransitionChain('BUILD')).toEqual([]);
    expect(getAutoTransitionChain('VERIFY')).toEqual([]);
    expect(getAutoTransitionChain('SHIP')).toEqual([]);
    expect(getAutoTransitionChain('CLOSED')).toEqual([]);
  });
});

describe('AutoTransitionConfirmationModal rendering', () => {
  it('renders the full chain text when open from INBOX', () => {
    renderWithProviders(
      <AutoTransitionConfirmationModal
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        currentStage="INBOX"
        isPending={false}
      />
    );

    expect(screen.getByText('SPECIFY → PLAN → BUILD')).toBeInTheDocument();
    expect(screen.getByText(/Enable auto-transition\?/)).toBeInTheDocument();
  });

  it('renders a shorter chain when open from PLAN', () => {
    renderWithProviders(
      <AutoTransitionConfirmationModal
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        currentStage="PLAN"
        isPending={false}
      />
    );

    expect(screen.getByText('BUILD')).toBeInTheDocument();
  });
});
