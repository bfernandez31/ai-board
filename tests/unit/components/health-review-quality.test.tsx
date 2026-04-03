import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { HealthModuleCard } from '@/components/health/health-module-card';
import { DrawerIssues } from '@/components/health/drawer/drawer-issues';
import type { HealthModuleStatus, ReviewQualityReport } from '@/lib/health/types';

const completedModule: HealthModuleStatus = {
  score: 77,
  label: 'Fair',
  lastScanDate: '2026-04-02T10:00:00Z',
  scanStatus: 'COMPLETED',
  issuesFound: 2,
  summary: '2 missed findings across 3 PRs',
};

const neverScannedModule: HealthModuleStatus = {
  score: null,
  label: null,
  lastScanDate: null,
  scanStatus: null,
  issuesFound: null,
  summary: 'No scan yet',
};

const reviewReport: ReviewQualityReport = {
  type: 'REVIEW_QUALITY',
  summary: {
    prsAnalyzed: 3,
    totalMissedFindings: 2,
    coverageScore: 77,
    scoreBreakdown: { base: 100, highPenalty: -15, mediumPenalty: -8, lowPenalty: 0 },
  },
  missedFindings: [
    {
      id: 'f1',
      prNumber: 360,
      source: 'codex',
      category: 'error-handling',
      severity: 'high',
      description: 'Missing error boundary',
      file: 'src/foo.ts',
      line: 42,
    },
    {
      id: 'f2',
      prNumber: 361,
      source: 'copilot',
      category: 'security',
      severity: 'medium',
      description: 'SQL injection risk',
      file: 'src/bar.ts',
      line: 10,
    },
  ],
  cumulativeAnalysis: {
    windowDays: 30,
    reportsAnalyzed: 5,
    recurringPatterns: [
      {
        category: 'error-handling',
        occurrences: 4,
        prNumbers: [355, 358, 360, 362],
        suggestedRule: 'Wrap async in error boundaries',
        target: 'constitution',
        alreadyTicketed: false,
      },
    ],
  },
  generatedTickets: [],
};

describe('Health Review Quality', () => {
  describe('HealthModuleCard – REVIEW_QUALITY', () => {
    it('renders score, findings count, and trend for completed module', () => {
      renderWithProviders(
        <HealthModuleCard moduleType="REVIEW_QUALITY" module={completedModule} />
      );
      expect(screen.getByText('Review Quality')).toBeInTheDocument();
      expect(screen.getByText('77')).toBeInTheDocument();
      expect(screen.getByText('2 missed findings across 3 PRs')).toBeInTheDocument();
    });

    it('shows "Never scanned" state with null score', () => {
      renderWithProviders(
        <HealthModuleCard moduleType="REVIEW_QUALITY" module={neverScannedModule} />
      );
      expect(screen.getByText('No scan yet')).toBeInTheDocument();
      expect(screen.getByText('Run scan')).toBeInTheDocument();
      expect(screen.getAllByText('---').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DrawerIssues – REVIEW_QUALITY', () => {
    it('shows findings grouped by category', () => {
      renderWithProviders(<DrawerIssues report={reviewReport} />);
      expect(screen.getByText('Missed Findings')).toBeInTheDocument();
      expect(screen.getByText(/error handling \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/security \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText('• Missing error boundary')).toBeInTheDocument();
      expect(screen.getByText('• SQL injection risk')).toBeInTheDocument();
    });

    it('shows cumulative patterns section', () => {
      renderWithProviders(<DrawerIssues report={reviewReport} />);
      expect(screen.getByText('Cumulative Patterns')).toBeInTheDocument();
      expect(screen.getAllByText(/error handling/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('4 PRs')).toBeInTheDocument();
      expect(screen.getByText('Wrap async in error boundaries')).toBeInTheDocument();
      expect(screen.getByText('Target: constitution')).toBeInTheDocument();
      expect(screen.getByText('Pending ticket')).toBeInTheDocument();
    });

    it('shows empty state when no findings or patterns', () => {
      const emptyReport: ReviewQualityReport = {
        type: 'REVIEW_QUALITY',
        summary: {
          prsAnalyzed: 3,
          totalMissedFindings: 0,
          coverageScore: 100,
          scoreBreakdown: { base: 100, highPenalty: 0, mediumPenalty: 0, lowPenalty: 0 },
        },
        missedFindings: [],
        cumulativeAnalysis: {
          windowDays: 30,
          reportsAnalyzed: 5,
          recurringPatterns: [],
        },
        generatedTickets: [],
      };

      renderWithProviders(<DrawerIssues report={emptyReport} />);
      expect(screen.getByText('No review gaps detected')).toBeInTheDocument();
    });
  });
});
