import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ActivationFunnel } from '@/components/admin/home/activation-funnel';
import type { FunnelStep } from '@/app/lib/admin/home/types';

function makeSteps(overrides: Partial<Record<FunnelStep['id'], FunnelStep>> = {}): FunnelStep[] {
  const base: Record<FunnelStep['id'], FunnelStep> = {
    signups: { id: 'signups', label: 'Inscriptions', count: 240, conversionFromPrevious: null },
    first_project: {
      id: 'first_project',
      label: '1er projet',
      count: 168,
      conversionFromPrevious: 0.7,
    },
    first_job: {
      id: 'first_job',
      label: '1er job',
      count: 132,
      conversionFromPrevious: 0.785,
    },
    paid: {
      id: 'paid',
      label: 'Activation payante',
      count: 19,
      conversionFromPrevious: 0.144,
    },
  };
  return [
    overrides.signups ?? base.signups,
    overrides.first_project ?? base.first_project,
    overrides.first_job ?? base.first_job,
    overrides.paid ?? base.paid,
  ];
}

describe('<ActivationFunnel>', () => {
  it('renders 4 ordered steps with count + conversion-rate', () => {
    renderWithProviders(<ActivationFunnel steps={makeSteps()} />);
    expect(screen.getByText('Inscriptions')).toBeTruthy();
    expect(screen.getByText('1er projet')).toBeTruthy();
    expect(screen.getByText('1er job')).toBeTruthy();
    expect(screen.getByText('Activation payante')).toBeTruthy();
    expect(screen.getByText('240')).toBeTruthy();
    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('renders em-dash when conversion is null (step 1 always)', () => {
    renderWithProviders(<ActivationFunnel steps={makeSteps()} />);
    const signupsItem = screen.getByText('Inscriptions').closest('li');
    expect(signupsItem?.textContent).toContain('—');
  });

  it('renders em-dash (not NaN%) when cohort denominator is zero', () => {
    const steps = makeSteps({
      signups: { id: 'signups', label: 'Inscriptions', count: 0, conversionFromPrevious: null },
      first_project: {
        id: 'first_project',
        label: '1er projet',
        count: 0,
        conversionFromPrevious: null,
      },
      first_job: {
        id: 'first_job',
        label: '1er job',
        count: 0,
        conversionFromPrevious: null,
      },
      paid: {
        id: 'paid',
        label: 'Activation payante',
        count: 0,
        conversionFromPrevious: null,
      },
    });
    renderWithProviders(<ActivationFunnel steps={steps} />);
    expect(screen.queryByText(/NaN/i)).toBeNull();
  });
});
