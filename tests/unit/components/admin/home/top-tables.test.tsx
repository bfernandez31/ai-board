import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import {
  ActionableTable,
  type ActionableColumn,
} from '@/components/admin/home/actionable-table';

interface SampleRow {
  id: number;
  name: string;
  jobs: number;
}

const COLUMNS: ActionableColumn<SampleRow>[] = [
  { key: 'name', header: 'Name', render: (r) => r.name },
  { key: 'jobs', header: 'Jobs', render: (r) => r.jobs },
];

describe('<ActionableTable>', () => {
  it('renders an empty-state message when rows is empty (FR-023)', () => {
    renderWithProviders(
      <ActionableTable<SampleRow>
        title="Top users"
        rows={[]}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        emptyMessage="No data yet"
      />
    );
    expect(screen.getByText(/No data yet/)).toBeTruthy();
  });

  it('renders rows with column values', () => {
    renderWithProviders(
      <ActionableTable<SampleRow>
        title="Top users"
        rows={[
          { id: 1, name: 'Alice', jobs: 10 },
          { id: 2, name: 'Bob', jobs: 5 },
        ]}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        emptyMessage="No data"
      />
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows "X au total" badge when total > rows.length (FR-024)', () => {
    renderWithProviders(
      <ActionableTable<SampleRow>
        title="Top users"
        rows={[{ id: 1, name: 'Alice', jobs: 10 }]}
        total={50}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        emptyMessage="No data"
      />
    );
    expect(screen.getByText('50 au total')).toBeTruthy();
  });

  it('does NOT show total badge when total === rows.length', () => {
    renderWithProviders(
      <ActionableTable<SampleRow>
        title="Top users"
        rows={[{ id: 1, name: 'Alice', jobs: 10 }]}
        total={1}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        emptyMessage="No data"
      />
    );
    expect(screen.queryByText(/au total/)).toBeNull();
  });

  it('two renders of identical input produce identical DOM row order (SC-008)', () => {
    const rows: SampleRow[] = [
      { id: 1, name: 'Alpha', jobs: 5 },
      { id: 2, name: 'Beta', jobs: 5 },
      { id: 3, name: 'Gamma', jobs: 5 },
    ];

    const { container: c1, unmount } = renderWithProviders(
      <ActionableTable<SampleRow>
        title="t"
        rows={rows}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        emptyMessage="empty"
      />
    );
    const html1 = c1.innerHTML;
    unmount();

    const { container: c2 } = renderWithProviders(
      <ActionableTable<SampleRow>
        title="t"
        rows={rows}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        emptyMessage="empty"
      />
    );
    expect(c2.innerHTML).toBe(html1);
  });
});
