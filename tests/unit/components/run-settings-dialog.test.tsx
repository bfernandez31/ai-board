/**
 * Component Tests: RunSettingsDialog (AIB-849, US3)
 *
 * Verifies the four consolidated sections render with inherited/override
 * indicators, that Agent/Policy edits stay INBOX-only, and that token saving is
 * editable past INBOX but disabled while a run is active.
 * Note: Radix Select interaction is limited in happy-dom — gating is asserted
 * via the trigger's disabled state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { RunSettingsDialog } from '@/components/tickets/run-settings-dialog';
import { Agent, ClarificationPolicy } from '@prisma/client';

function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    stage: 'INBOX',
    version: 1,
    agent: null as Agent | null,
    clarificationPolicy: null as ClarificationPolicy | null,
    tokenSaving: null as boolean | null,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    codexSpecifyModel: null,
    codexPlanModel: null,
    codexImplementModel: null,
    codexQuickImplModel: null,
    codexVerifyModel: null,
    ...overrides,
  };
}

const baseProject = {
  defaultAgent: Agent.CLAUDE,
  clarificationPolicy: ClarificationPolicy.AUTO,
  tokenSaving: false,
};

function renderDialog(props: Record<string, unknown> = {}) {
  return renderWithProviders(
    <RunSettingsDialog
      open={true}
      onOpenChange={vi.fn()}
      projectId={1}
      ticket={baseTicket(props.ticket as Record<string, unknown>)}
      project={baseProject}
      onSavePolicy={vi.fn().mockResolvedValue(undefined)}
      onSaveAgent={vi.fn().mockResolvedValue(undefined)}
      onSaveModels={vi.fn().mockResolvedValue(undefined)}
      onTokenSavingSaved={vi.fn()}
      {...props}
    />
  );
}

describe('RunSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four sections', () => {
    renderDialog();
    expect(screen.getByTestId('run-settings-section-agent')).toBeInTheDocument();
    expect(screen.getByTestId('run-settings-section-models')).toBeInTheDocument();
    expect(screen.getByTestId('run-settings-section-policy')).toBeInTheDocument();
    expect(screen.getByTestId('run-settings-section-token-saving')).toBeInTheDocument();
  });

  it('shows inherited indicators when no overrides set', () => {
    renderDialog();
    expect(screen.getByTestId('agent-inherited-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('policy-inherited-indicator')).toBeInTheDocument();
  });

  it('shows override indicators when ticket overrides are set', () => {
    renderDialog({
      ticket: { agent: Agent.CODEX, clarificationPolicy: ClarificationPolicy.PRAGMATIC },
    });
    expect(screen.getByTestId('agent-override-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('policy-override-indicator')).toBeInTheDocument();
  });

  it('allows editing Agent and Policy in INBOX stage', () => {
    renderDialog({ ticket: { stage: 'INBOX' } });
    expect(screen.getByTestId('run-settings-edit-agent')).not.toBeDisabled();
    expect(screen.getByTestId('run-settings-edit-policy')).not.toBeDisabled();
  });

  it('makes Agent and Policy read-only outside INBOX', () => {
    renderDialog({ ticket: { stage: 'BUILD' } });
    expect(screen.getByTestId('run-settings-edit-agent')).toBeDisabled();
    expect(screen.getByTestId('run-settings-edit-policy')).toBeDisabled();
  });

  it('keeps token saving editable past INBOX when no run is active', () => {
    renderDialog({ ticket: { stage: 'VERIFY' }, isRunActive: false });
    expect(screen.getByTestId('token-saving-select')).not.toBeDisabled();
  });

  it('disables token saving while a run is active', () => {
    renderDialog({ ticket: { stage: 'BUILD' }, isRunActive: true });
    expect(screen.getByTestId('token-saving-select')).toBeDisabled();
  });
});
