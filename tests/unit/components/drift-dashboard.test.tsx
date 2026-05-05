/**
 * Unit tests for drift dashboard components (US1).
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ConfusionMatrix } from '@/components/drift/confusion-matrix';
import { RangeHitPanel } from '@/components/drift/range-hit-panel';
import { UsagePanel } from '@/components/drift/usage-panel';
import { DriftDashboard } from '@/components/drift/drift-dashboard';
import type { DriftDashboardSnapshot } from '@/lib/drift/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const emptySnapshot: DriftDashboardSnapshot = {
  projectId: 1,
  generatedAt: new Date().toISOString(),
  sampleSize: 0,
  unpairedCount: 0,
  pendingCount: 0,
  friction: { incomparable: 0, matrix: { tp: 0, fp: 0, tn: 0, fn: 0 }, precision: null, recall: null },
  cost: { incomparable: 0, inRange: 0, under: 0, over: 0 },
  quality: { incomparable: 0, inRange: 0, under: 0, over: 0 },
  usage: { analysedShipped: 0, leftInbox: 0, ratio: 0 },
  recentPairings: [],
  nextCursor: null,
};

const seedSnapshot: DriftDashboardSnapshot = {
  projectId: 1,
  generatedAt: new Date().toISOString(),
  sampleSize: 10,
  unpairedCount: 1,
  pendingCount: 0,
  friction: {
    incomparable: 0,
    matrix: { tp: 6, fp: 1, tn: 2, fn: 1 },
    precision: 0.857,
    recall: 0.857,
  },
  cost: { incomparable: 1, inRange: 7, under: 1, over: 1 },
  quality: { incomparable: 0, inRange: 8, under: 1, over: 1 },
  usage: { analysedShipped: 11, leftInbox: 20, ratio: 0.55 },
  recentPairings: [],
  nextCursor: null,
};

describe('ConfusionMatrix component', () => {
  it('renders all four cells with labels', () => {
    renderWithProviders(
      <ConfusionMatrix
        tp={6}
        fp={1}
        tn={2}
        fn={1}
        precision={0.857}
        recall={0.857}
      />
    );
    expect(screen.getByText(/true positive/i)).toBeTruthy();
    expect(screen.getByText(/false positive/i)).toBeTruthy();
    expect(screen.getByText(/true negative/i)).toBeTruthy();
    expect(screen.getByText(/false negative/i)).toBeTruthy();
    expect(screen.getByText(/precision/i)).toBeTruthy();
    expect(screen.getByText(/recall/i)).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('renders — for null precision/recall (FR-008)', () => {
    renderWithProviders(
      <ConfusionMatrix tp={0} fp={0} tn={5} fn={0} precision={null} recall={null} />
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('RangeHitPanel component', () => {
  it('renders title and labelled rows', () => {
    renderWithProviders(
      <RangeHitPanel
        title="Cost Range"
        data={{ inRange: 7, under: 1, over: 2, incomparable: 0 }}
      />
    );
    expect(screen.getByText(/cost range/i)).toBeTruthy();
    expect(screen.getByText(/in.range/i)).toBeTruthy();
    expect(screen.getByText(/under/i)).toBeTruthy();
    expect(screen.getByText(/over/i)).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });
});

describe('UsagePanel component', () => {
  it('renders analysed and leftInbox counts', () => {
    renderWithProviders(
      <UsagePanel analysedShipped={11} leftInbox={20} ratio={0.55} />
    );
    expect(screen.getAllByText(/analysed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });
});

describe('DriftDashboard component', () => {
  it('shows empty state when sampleSize=0', () => {
    renderWithProviders(
      <DriftDashboard projectId={1} initialData={emptySnapshot} />
    );
    // The empty state component should be rendered
    expect(screen.getByText(/no drift data/i)).toBeTruthy();
  });

  it('renders all four panels when data present', () => {
    renderWithProviders(
      <DriftDashboard projectId={1} initialData={seedSnapshot} />
    );
    expect(screen.getAllByText(/friction/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/cost/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/quality/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/analysed/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders sample size label (FR-012)', () => {
    renderWithProviders(
      <DriftDashboard projectId={1} initialData={seedSnapshot} />
    );
    expect(screen.getByText(/10/)).toBeTruthy();
  });
});
