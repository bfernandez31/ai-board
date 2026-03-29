import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { DrawerIssues } from '@/components/health/drawer/drawer-issues';
import type {
  SecurityReport,
  ComplianceReport,
  TestsReport,
  SpecSyncReport,
  QualityGateReport,
  LastCleanReport,
} from '@/lib/health/types';

describe('DrawerIssues', () => {
  describe('Security renderer', () => {
    it('renders issues grouped by severity', () => {
      const report: SecurityReport = {
        type: 'SECURITY',
        issues: [
          { id: 'sec-001', severity: 'high', description: 'SQL injection', file: 'api/route.ts', line: 42 },
          { id: 'sec-002', severity: 'high', description: 'XSS vulnerability' },
          { id: 'sec-003', severity: 'medium', description: 'Missing CORS header' },
          { id: 'sec-004', severity: 'low', description: 'Console.log left in code' },
        ],
        generatedTickets: [],
      };

      renderWithProviders(<DrawerIssues report={report} />);
      expect(screen.getByText('Security Issues')).toBeInTheDocument();
      expect(screen.getByText(/high \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText(/medium \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/low \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText('• SQL injection')).toBeInTheDocument();
      expect(screen.getByText('api/route.ts:42')).toBeInTheDocument();
    });

    it('renders empty state when no issues', () => {
      const report: SecurityReport = {
        type: 'SECURITY',
        issues: [],
        generatedTickets: [],
      };

      renderWithProviders(<DrawerIssues report={report} />);
      expect(screen.getByText('No security issues found')).toBeInTheDocument();
    });
  });

  describe('Compliance renderer', () => {
    it('renders issues grouped by category', () => {
      const report: ComplianceReport = {
        type: 'COMPLIANCE',
        issues: [
          { id: 'comp-001', severity: 'medium', description: 'Missing strict mode', category: 'TypeScript-First' },
          { id: 'comp-002', severity: 'low', description: 'No test coverage', category: 'Test-Driven' },
        ],
        generatedTickets: [],
      };

      renderWithProviders(<DrawerIssues report={report} />);
      expect(screen.getByText('Compliance Issues')).toBeInTheDocument();
      expect(screen.getByText(/TypeScript-First \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Test-Driven \(1\)/)).toBeInTheDocument();
    });
  });

  describe('Tests renderer', () => {
    it('renders auto-fixed and non-fixable sections', () => {
      const report: TestsReport = {
        type: 'TESTS',
        autoFixed: [{ id: 'test-001', severity: 'low', description: 'Fixed assertion in login test' }],
        nonFixable: [{ id: 'test-002', severity: 'high', description: 'Missing test dependency' }],
        generatedTickets: [],
      };

      renderWithProviders(<DrawerIssues report={report} />);
      expect(screen.getByText('Test Issues')).toBeInTheDocument();
      expect(screen.getByText(/Auto-fixed \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Non-fixable \(1\)/)).toBeInTheDocument();
    });

    it('renders empty state when all tests passing', () => {
      const report: TestsReport = {
        type: 'TESTS',
        autoFixed: [],
        nonFixable: [],
        generatedTickets: [],
      };

      renderWithProviders(<DrawerIssues report={report} />);
      expect(screen.getByText('All tests passing')).toBeInTheDocument();
    });
  });

  describe('Spec Sync renderer', () => {
    it('renders synced and drifted specs', () => {
      const report: SpecSyncReport = {
        type: 'SPEC_SYNC',
        specs: [
          { specPath: 'specs/AIB-370/spec.md', status: 'synced' },
          { specPath: 'specs/AIB-371/spec.md', status: 'drifted', drift: 'Missing FR-005' },
        ],
        generatedTickets: [],
      };

      renderWithProviders(<DrawerIssues report={report} />);
      expect(screen.getByText('Spec Sync Status')).toBeInTheDocument();
      expect(screen.getByText(/Drifted \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Synced \(1\)/)).toBeInTheDocument();
      expect(screen.getByText('Missing FR-005')).toBeInTheDocument();
    });
  });

  describe('Quality Gate renderer', () => {
    it('renders dimension breakdown table', () => {
      const report: QualityGateReport = {
        type: 'QUALITY_GATE',
        dimensions: [
          { name: 'Compliance', score: 92 },
          { name: 'Bug Detection', score: null },
        ],
        recentTickets: [{ ticketKey: 'AIB-350', score: 87 }],
      };

      renderWithProviders(<DrawerIssues report={report} />);
      expect(screen.getByText('Quality Gate Dimensions')).toBeInTheDocument();
      expect(screen.getByText('Compliance')).toBeInTheDocument();
      expect(screen.getByText('92')).toBeInTheDocument();
      expect(screen.getByText('Bug Detection')).toBeInTheDocument();
      expect(screen.getByText('AIB-350')).toBeInTheDocument();
    });
  });

  describe('Last Clean renderer', () => {
    it('renders cleanup summary card', () => {
      const report: LastCleanReport = {
        type: 'LAST_CLEAN',
        filesCleaned: 12,
        remainingIssues: 3,
        summary: 'Removed unused imports across 12 files.',
      };

      renderWithProviders(<DrawerIssues report={report} />);
      expect(screen.getByText('Last Cleanup Summary')).toBeInTheDocument();
      expect(screen.getByText('12 files cleaned')).toBeInTheDocument();
      expect(screen.getByText('3 remaining issues')).toBeInTheDocument();
      expect(screen.getByText('Removed unused imports across 12 files.')).toBeInTheDocument();
    });
  });
});
