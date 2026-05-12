import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { KpiTile } from '@/components/admin/home/kpi-tile';
import type { KpiTile as KpiTileType } from '@/app/lib/admin/home/types';

function makeTile(overrides: Partial<KpiTileType> = {}): KpiTileType {
  return {
    id: 'users',
    label: 'Utilisateurs',
    value: 1247,
    unit: 'count',
    deltas: [
      { label: 'Δ7j', value: 42, unit: 'absolute', goodDirection: 'up' },
      { label: 'Δ30j', value: 168, unit: 'absolute', goodDirection: 'up' },
    ],
    sparkline: Array.from({ length: 30 }, (_, i) => i),
    tooltip: 'Total inscrits sur la plateforme.',
    ...overrides,
  };
}

describe('<KpiTile>', () => {
  it('renders the headline formatted value for unit=count', () => {
    renderWithProviders(<KpiTile tile={makeTile({ id: 'users', value: 1247 })} />);
    expect(screen.getByText('1 247')).toBeTruthy();
  });

  it('renders MRR tile with €X.XX formatting for unit=cents', () => {
    renderWithProviders(
      <KpiTile
        tile={makeTile({ id: 'mrr', label: 'MRR estimé', value: 184_500, unit: 'cents' })}
      />
    );
    expect(screen.getByText('€1,845.00')).toBeTruthy();
  });

  it('renders both deltas with their labels', () => {
    renderWithProviders(<KpiTile tile={makeTile()} />);
    expect(screen.getByText('Δ7j')).toBeTruthy();
    expect(screen.getByText('Δ30j')).toBeTruthy();
    expect(screen.getByText('+42')).toBeTruthy();
    expect(screen.getByText('+168')).toBeTruthy();
  });

  it('exposes a tooltip trigger with definition button', () => {
    renderWithProviders(
      <KpiTile tile={makeTile({ id: 'mau', label: 'MAU', tooltip: 'Users with ≥1 job this month.' })} />
    );
    expect(screen.getByRole('button', { name: /MAU definition/i })).toBeTruthy();
  });

  it('renders a sparkline element', () => {
    renderWithProviders(<KpiTile tile={makeTile()} />);
    expect(screen.getByRole('img', { name: /sparkline/i })).toBeTruthy();
  });

  it('handles negative deltas with minus sign', () => {
    renderWithProviders(
      <KpiTile
        tile={makeTile({
          deltas: [
            { label: 'Δ7j', value: -4, unit: 'absolute', goodDirection: 'up' },
            { label: 'Δ30j', value: 0, unit: 'absolute', goodDirection: 'up' },
          ],
        })}
      />
    );
    expect(screen.getByText('−4')).toBeTruthy();
  });
});
