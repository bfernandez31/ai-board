import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ModuleCard } from '@/components/health/module-card';
import { Shield, BadgeCheck } from 'lucide-react';
import type { ModuleConfig, ModuleResponse } from '@/lib/health/types';

const activeConfig: ModuleConfig = {
  type: 'SECURITY',
  name: 'Security',
  icon: Shield,
  isPassive: false,
};

const passiveConfig: ModuleConfig = {
  type: 'QUALITY_GATE',
  name: 'Quality Gate',
  icon: BadgeCheck,
  isPassive: true,
};

describe('ModuleCard', () => {
  it('renders never_scanned state correctly', () => {
    const moduleData: ModuleResponse = {
      type: 'SECURITY',
      name: 'Security',
      score: null,
      status: 'never_scanned',
      isPassive: false,
      lastScanAt: null,
      summary: null,
      latestScan: null,
    };

    renderWithProviders(<ModuleCard config={activeConfig} module={moduleData} />);

    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('No scan yet')).toBeInTheDocument();
    expect(screen.getByText('---')).toBeInTheDocument();
  });

  it('renders scanning state correctly', () => {
    const moduleData: ModuleResponse = {
      type: 'SECURITY',
      name: 'Security',
      score: null,
      status: 'scanning',
      isPassive: false,
      lastScanAt: null,
      summary: null,
      latestScan: {
        id: 1,
        status: 'RUNNING',
        baseCommit: null,
        headCommit: null,
        issuesFound: 0,
        issuesFixed: 0,
        errorMessage: null,
      },
    };

    renderWithProviders(<ModuleCard config={activeConfig} module={moduleData} />);

    expect(screen.getByText('Scanning...')).toBeInTheDocument();
  });

  it('renders completed state with score and summary', () => {
    const moduleData: ModuleResponse = {
      type: 'SECURITY',
      name: 'Security',
      score: 90,
      status: 'completed',
      isPassive: false,
      lastScanAt: '2026-03-28T10:00:00Z',
      summary: '2 issues found, 1 fixed',
      latestScan: {
        id: 42,
        status: 'COMPLETED',
        baseCommit: 'abc1234abc1234abc1234abc1234abc1234abc1234',
        headCommit: 'def5678def5678def5678def5678def5678def5678',
        issuesFound: 2,
        issuesFixed: 1,
        errorMessage: null,
      },
    };

    renderWithProviders(<ModuleCard config={activeConfig} module={moduleData} />);

    expect(screen.getByText(/90/)).toBeInTheDocument();
    expect(screen.getByText('2 issues found, 1 fixed')).toBeInTheDocument();
    expect(screen.getByText(/abc1234/)).toBeInTheDocument();
  });

  it('renders failed state with error message', () => {
    const moduleData: ModuleResponse = {
      type: 'SECURITY',
      name: 'Security',
      score: null,
      status: 'failed',
      isPassive: false,
      lastScanAt: '2026-03-28T10:00:00Z',
      summary: null,
      latestScan: {
        id: 43,
        status: 'FAILED',
        baseCommit: null,
        headCommit: null,
        issuesFound: 0,
        issuesFixed: 0,
        errorMessage: 'Workflow timed out',
      },
    };

    renderWithProviders(<ModuleCard config={activeConfig} module={moduleData} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Workflow timed out')).toBeInTheDocument();
  });

  it('renders passive module with passive label', () => {
    const moduleData: ModuleResponse = {
      type: 'QUALITY_GATE',
      name: 'Quality Gate',
      score: 75,
      status: 'completed',
      isPassive: true,
      lastScanAt: '2026-03-27T15:00:00Z',
      summary: 'Average quality score across verify jobs',
      latestScan: null,
    };

    renderWithProviders(<ModuleCard config={passiveConfig} module={moduleData} />);

    expect(screen.getByText('passive')).toBeInTheDocument();
    expect(screen.getByText('Quality Gate')).toBeInTheDocument();
  });
});
