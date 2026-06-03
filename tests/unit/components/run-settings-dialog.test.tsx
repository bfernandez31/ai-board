import { describe, expect, it, vi } from 'vitest';
import { Agent, ClarificationPolicy } from '@prisma/client';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { RunSettingsDialog } from '@/components/tickets/run-settings-dialog';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  currentAgent: null,
  projectDefaultAgent: Agent.CLAUDE,
  currentPolicy: null,
  projectDefaultPolicy: ClarificationPolicy.AUTO,
  tokenSavingOverride: null,
  tokenSavingProjectDefault: false,
  tokenSavingEffectiveEnabled: false,
  editable: true,
  effectiveAgent: Agent.CLAUDE,
  currentModels: {
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
  },
  onSaveRunSettings: vi.fn(),
  onSaveModelOverrides: vi.fn(),
};

describe('RunSettingsDialog', () => {
  it('renders Agent, Models, Clarification policy, and Token saving sections', () => {
    renderWithProviders(<RunSettingsDialog {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Run settings')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('Clarification policy')).toBeInTheDocument();
    expect(screen.getByText('Token saving')).toBeInTheDocument();
  });

  it('shows inherited defaults and token-saving effective state', () => {
    renderWithProviders(
      <RunSettingsDialog
        {...defaultProps}
        tokenSavingProjectDefault
        tokenSavingEffectiveEnabled
      />
    );

    expect(screen.getByText(/Claude/i)).toBeInTheDocument();
    expect(screen.getByText(/AUTO/i)).toBeInTheDocument();
    expect(screen.getByText('Project default: On')).toBeInTheDocument();
    expect(screen.getByText('Effective: On')).toBeInTheDocument();
  });

  it('renders read-only state outside editable stages', () => {
    renderWithProviders(<RunSettingsDialog {...defaultProps} editable={false} />);

    expect(screen.getByText('Read-only')).toBeInTheDocument();
    expect(screen.getByTestId('run-settings-save')).toBeDisabled();
  });
});
