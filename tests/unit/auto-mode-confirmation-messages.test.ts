/**
 * Unit Tests: Auto-mode confirmation modal helper (AIB-683)
 *
 * Verifies the chain of stages surfaced in the activation modal, based on the
 * current ticket stage.
 */

import { describe, it, expect } from 'vitest';
import { Stage } from '@/lib/stage-transitions';
import { getAutoTransitionChainLabel } from '@/components/board/auto-mode-confirmation-modal';

describe('getAutoTransitionChainLabel', () => {
  it('lists SPECIFY → PLAN → BUILD from INBOX', () => {
    expect(getAutoTransitionChainLabel(Stage.INBOX)).toBe('SPECIFY \u2192 PLAN \u2192 BUILD');
  });

  it('lists PLAN → BUILD from SPECIFY', () => {
    expect(getAutoTransitionChainLabel(Stage.SPECIFY)).toBe('PLAN \u2192 BUILD');
  });

  it('lists BUILD from PLAN', () => {
    expect(getAutoTransitionChainLabel(Stage.PLAN)).toBe('BUILD');
  });

  it('returns empty string for stages outside the auto-transition scope', () => {
    expect(getAutoTransitionChainLabel(Stage.BUILD)).toBe('');
    expect(getAutoTransitionChainLabel(Stage.VERIFY)).toBe('');
    expect(getAutoTransitionChainLabel(Stage.SHIP)).toBe('');
    expect(getAutoTransitionChainLabel(Stage.CLOSED)).toBe('');
  });
});
