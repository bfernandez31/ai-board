import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ScanDetailDrawer } from '@/components/health/scan-detail-drawer';
import type { HealthModuleStatus } from '@/lib/health/types';

// Mock the hooks
vi.mock('@/app/lib/hooks/useScanReport', () => ({
  useScanReport: vi.fn(() => ({
    data: {
      scan: {
        id: 1,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 85,
        report: '## Security Report\n\nAll clear.',
        issuesFound: 3,
        issuesFixed: 1,
        baseCommit: 'abc1234567890',
        headCommit: 'def5678901234',
        durationMs: 30000,
        errorMessage: null,
        startedAt: '2026-03-29T10:00:00Z',
        completedAt: '2026-03-29T10:00:45Z',
        createdAt: '2026-03-29T10:00:00Z',
      },
    },
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/app/lib/hooks/useGeneratedTickets', () => ({
  useGeneratedTickets: vi.fn(() => ({ data: { tickets: [] }, isLoading: false })),
}));

vi.mock('@/app/lib/hooks/useScanHistory', () => ({
  useScanHistory: vi.fn(() => ({ data: { scans: [] }, isLoading: false })),
}));

const completedModule: HealthModuleStatus = {
  score: 85,
  label: 'Good',
  lastScanDate: '2026-03-29T10:00:45Z',
  scanStatus: 'COMPLETED',
  issuesFound: 3,
  summary: '3 issues found',
};

const neverScannedModule: HealthModuleStatus = {
  score: null,
  label: null,
  lastScanDate: null,
  scanStatus: null,
  issuesFound: null,
  summary: 'No scan yet',
};

describe('ScanDetailDrawer', () => {
  it('renders completed state with module header and report', () => {
    renderWithProviders(
      <ScanDetailDrawer
        open={true}
        onOpenChange={() => {}}
        projectId={1}
        moduleType="SECURITY"
        module={completedModule}
        isScanning={false}
      />
    );

    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Security Report')).toBeInTheDocument();
    expect(screen.getByText('All clear.')).toBeInTheDocument();
    expect(screen.getByText(/abc1234/)).toBeInTheDocument();
  });

  it('renders never_scanned state', () => {
    renderWithProviders(
      <ScanDetailDrawer
        open={true}
        onOpenChange={() => {}}
        projectId={1}
        moduleType="SECURITY"
        module={neverScannedModule}
        isScanning={false}
      />
    );

    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('No scans have been run for this module yet.')).toBeInTheDocument();
  });

  it('renders scanning state with spinner', () => {
    renderWithProviders(
      <ScanDetailDrawer
        open={true}
        onOpenChange={() => {}}
        projectId={1}
        moduleType="SECURITY"
        module={neverScannedModule}
        isScanning={true}
      />
    );

    expect(screen.getByText('Scan in progress...')).toBeInTheDocument();
  });

  it('renders failed state with error message', () => {
    const failedModule: HealthModuleStatus = {
      score: null,
      label: null,
      lastScanDate: null,
      scanStatus: 'FAILED',
      issuesFound: null,
      summary: 'Scan failed',
    };

    renderWithProviders(
      <ScanDetailDrawer
        open={true}
        onOpenChange={() => {}}
        projectId={1}
        moduleType="SECURITY"
        module={failedModule}
        isScanning={false}
      />
    );

    expect(screen.getByText('Scan failed')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderWithProviders(
      <ScanDetailDrawer
        open={false}
        onOpenChange={() => {}}
        projectId={1}
        moduleType="SECURITY"
        module={completedModule}
        isScanning={false}
      />
    );

    expect(screen.queryByText('Security Report')).not.toBeInTheDocument();
  });
});
