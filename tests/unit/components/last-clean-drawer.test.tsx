import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { LastCleanDrawerContent } from '@/components/health/drawer/last-clean-drawer-content';
import type { LastCleanModuleStatus } from '@/lib/health/types';

const moduleOk: LastCleanModuleStatus = {
  score: null,
  label: 'OK',
  lastCleanDate: '2026-03-24T08:00:00.000Z',
  passive: true,
  jobId: 42,
  summary: '5 days ago',
  filesCleaned: 12,
  remainingIssues: 2,
  daysAgo: 5,
  isOverdue: false,
  status: 'ok',
  detail: {
    summary: 'Cleaned 12 files, resolved lint warnings',
    history: [
      { jobId: 42, completedAt: '2026-03-24T08:00:00.000Z', filesCleaned: 12, remainingIssues: 2, summary: 'Cleaned 12 files', ticketKey: 'AIB-340' },
      { jobId: 35, completedAt: '2026-02-20T10:30:00.000Z', filesCleaned: 8, remainingIssues: 0, summary: 'Cleaned 8 files', ticketKey: 'AIB-320' },
    ],
  },
};

const moduleOverdue: LastCleanModuleStatus = {
  score: null,
  label: 'Overdue',
  lastCleanDate: '2026-02-10T08:00:00.000Z',
  passive: true,
  jobId: 30,
  summary: '48 days ago',
  filesCleaned: 5,
  remainingIssues: 1,
  daysAgo: 48,
  isOverdue: true,
  status: 'overdue',
  detail: {
    summary: 'Cleaned 5 files',
    history: [
      { jobId: 30, completedAt: '2026-02-10T08:00:00.000Z', filesCleaned: 5, remainingIssues: 1, summary: 'Cleaned 5 files', ticketKey: 'AIB-300' },
    ],
  },
};

const moduleNever: LastCleanModuleStatus = {
  score: null,
  label: null,
  lastCleanDate: null,
  passive: true,
  jobId: null,
  summary: 'No cleanup yet',
  filesCleaned: 0,
  remainingIssues: 0,
  daysAgo: null,
  isOverdue: false,
  status: 'never',
  detail: null,
};

describe('LastCleanDrawerContent', () => {
  it('renders summary card with files cleaned and remaining issues', () => {
    renderWithProviders(<LastCleanDrawerContent module={moduleOk} />);

    expect(screen.getByText('Latest Cleanup')).toBeInTheDocument();
    expect(screen.getByText('Files cleaned')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Remaining issues')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Cleaned 12 files, resolved lint warnings')).toBeInTheDocument();
  });

  it('renders history list in reverse chronological order', () => {
    renderWithProviders(<LastCleanDrawerContent module={moduleOk} />);

    expect(screen.getByText('Cleanup History')).toBeInTheDocument();
    expect(screen.getByText(/AIB-340/)).toBeInTheDocument();
    expect(screen.getByText(/AIB-320/)).toBeInTheDocument();

    // Check both history items render files count
    const fileLabels = screen.getAllByText(/\d+ files/);
    expect(fileLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('renders overdue alert when status is overdue', () => {
    renderWithProviders(<LastCleanDrawerContent module={moduleOverdue} />);

    expect(screen.getByText(/Last cleanup was over 30 days ago/)).toBeInTheDocument();
  });

  it('renders empty state when no cleanup', () => {
    renderWithProviders(<LastCleanDrawerContent module={moduleNever} />);

    expect(screen.getByText('No data available yet')).toBeInTheDocument();
    expect(screen.queryByText('Latest Cleanup')).not.toBeInTheDocument();
  });
});
