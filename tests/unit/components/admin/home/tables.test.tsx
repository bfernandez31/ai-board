import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { NewPayingTable } from '@/components/admin/home/new-paying-table';
import { CancellationsTable } from '@/components/admin/home/cancellations-table';
import { TopUsersTable } from '@/components/admin/home/top-users-table';
import { TopProjectsTable } from '@/components/admin/home/top-projects-table';
import type { NewPayingRow, CancellationRow, TopUserRow, TopProjectRow } from '@/lib/admin/home/types';

const newPayingRows: NewPayingRow[] = [
  { email: 'alice@test.com', plan: 'PRO', accountAgeDays: 10, subscribedAt: '2026-05-01T00:00:00Z' },
  { email: 'bob@test.com', plan: 'TEAM', accountAgeDays: 30, subscribedAt: '2026-05-02T00:00:00Z' },
];

const cancellationRows: CancellationRow[] = [
  { email: 'charlie@test.com', lostPlan: 'PRO', accountAgeDays: 60, canceledAt: '2026-05-10T00:00:00Z' },
];

const topUserRows: TopUserRow[] = [
  { email: 'user1@test.com', plan: 'PRO', jobsThisMonth: 20 },
  { email: 'user2@test.com', plan: 'FREE', jobsThisMonth: 15 },
  { email: 'user3@test.com', plan: 'TEAM', jobsThisMonth: 10 },
  { email: 'user4@test.com', plan: 'FREE', jobsThisMonth: 5 },
  { email: 'user5@test.com', plan: 'PRO', jobsThisMonth: 3 },
];

const topProjectRows: TopProjectRow[] = [
  { projectKey: 'AIB', ownerEmail: 'owner@test.com', jobsThisMonth: 50 },
];

describe('NewPayingTable', () => {
  it('renders empty state when no data', () => {
    render(<NewPayingTable data={[]} />);
    expect(screen.getByText(/no new paying users/i)).toBeTruthy();
  });

  it('renders email, plan, accountAgeDays columns', () => {
    render(<NewPayingTable data={newPayingRows} />);
    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('PRO')).toBeTruthy();
    expect(screen.getByText('10d')).toBeTruthy();
  });

  it('renders TEAM plan row', () => {
    render(<NewPayingTable data={newPayingRows} />);
    expect(screen.getByText('bob@test.com')).toBeTruthy();
    expect(screen.getByText('TEAM')).toBeTruthy();
  });
});

describe('CancellationsTable', () => {
  it('renders empty state when no data', () => {
    render(<CancellationsTable data={[]} />);
    expect(screen.getByText(/no cancellations/i)).toBeTruthy();
  });

  it('renders email, lostPlan, accountAgeDays columns', () => {
    render(<CancellationsTable data={cancellationRows} />);
    expect(screen.getByText('charlie@test.com')).toBeTruthy();
    expect(screen.getByText('PRO')).toBeTruthy();
    expect(screen.getByText('60d')).toBeTruthy();
  });
});

describe('TopUsersTable', () => {
  it('renders empty state when no data', () => {
    render(<TopUsersTable data={[]} />);
    expect(screen.getByText(/no activity/i)).toBeTruthy();
  });

  it('renders email, plan, jobsThisMonth columns', () => {
    render(<TopUsersTable data={topUserRows} />);
    expect(screen.getByText('user1@test.com')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('enforces max 5 rows', () => {
    const sixRows: TopUserRow[] = [
      ...topUserRows,
      { email: 'extra@test.com', plan: 'FREE', jobsThisMonth: 1 },
    ];
    render(<TopUsersTable data={sixRows} />);
    expect(screen.queryByText('extra@test.com')).toBeNull();
  });
});

describe('TopProjectsTable', () => {
  it('renders empty state when no data', () => {
    render(<TopProjectsTable data={[]} />);
    expect(screen.getByText(/no activity/i)).toBeTruthy();
  });

  it('renders projectKey, ownerEmail, jobsThisMonth columns', () => {
    render(<TopProjectsTable data={topProjectRows} />);
    expect(screen.getByText('AIB')).toBeTruthy();
    expect(screen.getByText('owner@test.com')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('enforces max 5 rows', () => {
    const sixProjects: TopProjectRow[] = Array.from({ length: 6 }, (_, i) => ({
      projectKey: `P${i}`,
      ownerEmail: `owner${i}@test.com`,
      jobsThisMonth: 10 - i,
    }));
    render(<TopProjectsTable data={sixProjects} />);
    expect(screen.queryByText('P5')).toBeNull();
  });
});
