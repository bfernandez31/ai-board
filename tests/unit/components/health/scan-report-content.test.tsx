import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ScanReportContent } from '@/components/health/scan-report-content';

describe('ScanReportContent', () => {
  it('renders markdown report content', () => {
    const report = ['## Security Report', '', 'All systems healthy.'].join('\n');
    renderWithProviders(
      <ScanReportContent report={report} />
    );
    expect(screen.getByText('Security Report')).toBeInTheDocument();
    expect(screen.getByText('All systems healthy.')).toBeInTheDocument();
  });

  it('renders empty state when report is null', () => {
    renderWithProviders(<ScanReportContent report={null} />);
    expect(screen.getByText('Report data unavailable')).toBeInTheDocument();
  });

  it('renders tables from markdown', () => {
    const report = '| Column A | Column B |\n|---|---|\n| Value 1 | Value 2 |';
    renderWithProviders(<ScanReportContent report={report} />);
    expect(screen.getByText('Column A')).toBeInTheDocument();
    expect(screen.getByText('Value 1')).toBeInTheDocument();
  });

  it('renders code blocks from markdown', () => {
    const report = '```\nconst x = 1;\n```';
    renderWithProviders(<ScanReportContent report={report} />);
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('renders lists from markdown', () => {
    const report = '- Item one\n- Item two\n- Item three';
    renderWithProviders(<ScanReportContent report={report} />);
    expect(screen.getByText('Item one')).toBeInTheDocument();
    expect(screen.getByText('Item two')).toBeInTheDocument();
  });
});
