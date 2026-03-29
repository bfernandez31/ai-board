import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ScanDetailDrawer } from '@/components/health/scan-detail-drawer';
import type { HealthModuleStatus } from '@/lib/health/types';

// Mock useScanReport hook
const mockUseScanReport = vi.fn();
vi.mock('@/app/lib/hooks/useScanReport', () => ({
  useScanReport: (...args: unknown[]) => mockUseScanReport(...args),
}));

const completedStatus: HealthModuleStatus = {
  score: 85,
  label: 'Good',
  lastScanDate: '2026-03-27T14:30:00Z',
  scanStatus: 'COMPLETED',
  issuesFound: 3,
  summary: '3 issues found',
};

const neverScannedStatus: HealthModuleStatus = {
  score: null,
  label: null,
  lastScanDate: null,
  scanStatus: null,
  issuesFound: null,
  summary: 'No scan yet',
};

const failedStatus: HealthModuleStatus = {
  score: null,
  label: null,
  lastScanDate: null,
  scanStatus: 'FAILED',
  issuesFound: null,
  summary: 'Scan failed',
};

const completedScan = {
  id: 1,
  scanType: 'SECURITY' as const,
  status: 'COMPLETED' as const,
  score: 85,
  issuesFound: 3,
  issuesFixed: 1,
  baseCommit: 'abc1234567',
  headCommit: 'def7654321',
  durationMs: 5000,
  errorMessage: null,
  startedAt: '2026-03-27T14:29:00Z',
  completedAt: '2026-03-27T14:30:00Z',
  createdAt: '2026-03-27T14:29:00Z',
  report: null,
};

const securityReport = {
  type: 'SECURITY' as const,
  issues: [
    { id: 'sec-001', severity: 'high' as const, description: 'SQL injection vulnerability' },
    { id: 'sec-002', severity: 'low' as const, description: 'Missing header' },
  ],
  generatedTickets: [{ ticketKey: 'AIB-123', stage: 'INBOX' }],
};

describe('ScanDetailDrawer', () => {
  beforeEach(() => {
    mockUseScanReport.mockReturnValue({
      data: null,
      isLoading: false,
    });
  });

  it('does not render content when moduleType is null (closed)', () => {
    renderWithProviders(
      <ScanDetailDrawer
        projectId={1}
        moduleType={null}
        moduleStatus={null}
        isScanning={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText('Security')).not.toBeInTheDocument();
  });

  it('renders header with module name when open', () => {
    mockUseScanReport.mockReturnValue({
      data: { scan: completedScan, report: securityReport },
      isLoading: false,
    });

    renderWithProviders(
      <ScanDetailDrawer
        projectId={1}
        moduleType="SECURITY"
        moduleStatus={completedStatus}
        isScanning={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    mockUseScanReport.mockReturnValue({
      data: null,
      isLoading: true,
    });

    renderWithProviders(
      <ScanDetailDrawer
        projectId={1}
        moduleType="SECURITY"
        moduleStatus={completedStatus}
        isScanning={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Loading report...')).toBeInTheDocument();
  });

  it('renders never_scanned state when no scan data', () => {
    renderWithProviders(
      <ScanDetailDrawer
        projectId={1}
        moduleType="SECURITY"
        moduleStatus={neverScannedStatus}
        isScanning={false}
        onClose={vi.fn()}
        onTriggerScan={vi.fn()}
      />
    );
    expect(screen.getByText('No scan data yet')).toBeInTheDocument();
    expect(screen.getByText('Run first scan')).toBeInTheDocument();
  });

  it('renders scanning state', () => {
    renderWithProviders(
      <ScanDetailDrawer
        projectId={1}
        moduleType="SECURITY"
        moduleStatus={neverScannedStatus}
        isScanning={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Scanning in progress...')).toBeInTheDocument();
  });

  it('renders failed state with error message', () => {
    mockUseScanReport.mockReturnValue({
      data: {
        scan: { ...completedScan, status: 'FAILED', errorMessage: 'Timeout exceeded' },
        report: null,
      },
      isLoading: false,
    });

    renderWithProviders(
      <ScanDetailDrawer
        projectId={1}
        moduleType="SECURITY"
        moduleStatus={failedStatus}
        isScanning={false}
        onClose={vi.fn()}
        onTriggerScan={vi.fn()}
      />
    );
    expect(screen.getByText('Scan Failed')).toBeInTheDocument();
    expect(screen.getByText('Timeout exceeded')).toBeInTheDocument();
  });

  it('renders report data unavailable when completed scan has no report', () => {
    mockUseScanReport.mockReturnValue({
      data: { scan: completedScan, report: null },
      isLoading: false,
    });

    renderWithProviders(
      <ScanDetailDrawer
        projectId={1}
        moduleType="SECURITY"
        moduleStatus={completedStatus}
        isScanning={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Report data unavailable/)).toBeInTheDocument();
  });

  it('renders issues and tickets when report is available', () => {
    mockUseScanReport.mockReturnValue({
      data: { scan: completedScan, report: securityReport },
      isLoading: false,
    });

    renderWithProviders(
      <ScanDetailDrawer
        projectId={1}
        moduleType="SECURITY"
        moduleStatus={completedStatus}
        isScanning={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Security Issues')).toBeInTheDocument();
    expect(screen.getByText(/SQL injection vulnerability/)).toBeInTheDocument();
    expect(screen.getByText('Generated Tickets')).toBeInTheDocument();
    expect(screen.getByText('AIB-123')).toBeInTheDocument();
  });
});
