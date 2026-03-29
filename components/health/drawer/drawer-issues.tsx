'use client';

import { AlertTriangle, CheckCircle, XCircle, FileText, BarChart3, Sparkles } from 'lucide-react';
import type {
  ScanReport,
  SecurityReport,
  ComplianceReport,
  TestsReport,
  SpecSyncReport,
  QualityGateReport,
  LastCleanReport,
  ReportIssue,
} from '@/lib/health/types';

interface DrawerIssuesProps {
  report: ScanReport;
}

export function DrawerIssues({ report }: DrawerIssuesProps) {
  switch (report.type) {
    case 'SECURITY':
      return <SecurityIssues report={report} />;
    case 'COMPLIANCE':
      return <ComplianceIssues report={report} />;
    case 'TESTS':
      return <TestsIssues report={report} />;
    case 'SPEC_SYNC':
      return <SpecSyncIssues report={report} />;
    case 'QUALITY_GATE':
      return <QualityGateIssues report={report} />;
    case 'LAST_CLEAN':
      return <LastCleanIssues report={report} />;
  }
}

// --- Security: group by severity ---

function SecurityIssues({ report }: { report: SecurityReport }) {
  const groups = groupBySeverity(report.issues);

  if (report.issues.length === 0) {
    return <EmptyIssues label="No security issues found" />;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Security Issues</h4>
      {(['high', 'medium', 'low'] as const).map((severity) => {
        const issues = groups[severity];
        if (!issues || issues.length === 0) return null;
        return (
          <SeverityGroup key={severity} severity={severity} issues={issues} />
        );
      })}
    </div>
  );
}

function SeverityGroup({ severity, issues }: { severity: 'high' | 'medium' | 'low'; issues: ReportIssue[] }) {
  const colors: Record<string, string> = {
    high: 'text-ctp-red',
    medium: 'text-ctp-yellow',
    low: 'text-ctp-blue',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className={`h-3.5 w-3.5 ${colors[severity]}`} />
        <span className={`text-xs font-medium capitalize ${colors[severity]}`}>
          {severity} ({issues.length})
        </span>
      </div>
      <IssueList issues={issues} />
    </div>
  );
}

// --- Compliance: group by category ---

function ComplianceIssues({ report }: { report: ComplianceReport }) {
  if (report.issues.length === 0) {
    return <EmptyIssues label="No compliance issues found" />;
  }

  const groups = groupByCategory(report.issues);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Compliance Issues</h4>
      {Object.entries(groups).map(([category, issues]) => (
        <div key={category} className="space-y-1">
          <span className="text-xs font-medium text-foreground">{category} ({issues.length})</span>
          <IssueList issues={issues} />
        </div>
      ))}
    </div>
  );
}

// --- Tests: auto-fixed vs non-fixable ---

function TestsIssues({ report }: { report: TestsReport }) {
  const total = report.autoFixed.length + report.nonFixable.length;
  if (total === 0) {
    return <EmptyIssues label="All tests passing" />;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Test Issues</h4>
      {report.autoFixed.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-ctp-green" />
            <span className="text-xs font-medium text-ctp-green">
              Auto-fixed ({report.autoFixed.length})
            </span>
          </div>
          <IssueList issues={report.autoFixed} />
        </div>
      )}
      {report.nonFixable.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-ctp-red" />
            <span className="text-xs font-medium text-ctp-red">
              Non-fixable ({report.nonFixable.length})
            </span>
          </div>
          <IssueList issues={report.nonFixable} />
        </div>
      )}
    </div>
  );
}

// --- Spec Sync: synced vs drifted ---

function SpecSyncIssues({ report }: { report: SpecSyncReport }) {
  if (report.specs.length === 0) {
    return <EmptyIssues label="No specs tracked" />;
  }

  const synced = report.specs.filter(s => s.status === 'synced');
  const drifted = report.specs.filter(s => s.status === 'drifted');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Spec Sync Status</h4>
      {drifted.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-ctp-yellow" />
            <span className="text-xs font-medium text-ctp-yellow">Drifted ({drifted.length})</span>
          </div>
          {drifted.map((spec) => (
            <div key={spec.specPath} className="aurora-glass rounded-md px-3 py-2 space-y-0.5">
              <p className="text-xs font-mono text-foreground">{spec.specPath}</p>
              {spec.drift && <p className="text-xs text-muted-foreground">{spec.drift}</p>}
            </div>
          ))}
        </div>
      )}
      {synced.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-ctp-green" />
            <span className="text-xs font-medium text-ctp-green">Synced ({synced.length})</span>
          </div>
          {synced.map((spec) => (
            <div key={spec.specPath} className="aurora-glass rounded-md px-3 py-2">
              <p className="text-xs font-mono text-foreground">{spec.specPath}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Quality Gate: dimension breakdown ---

function QualityGateIssues({ report }: { report: QualityGateReport }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Quality Gate Dimensions</h4>
      {report.dimensions.length > 0 && (
        <div className="aurora-glass rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Dimension</th>
                <th className="text-right px-3 py-1.5 text-muted-foreground font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {report.dimensions.map((dim) => (
                <tr key={dim.name} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5 text-foreground">{dim.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-foreground">
                    {dim.score !== null ? dim.score : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {report.recentTickets.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Recent SHIP Tickets</span>
          </div>
          {report.recentTickets.map((t) => (
            <div key={t.ticketKey} className="flex items-center justify-between aurora-glass rounded-md px-3 py-1.5">
              <span className="text-xs font-mono text-foreground">{t.ticketKey}</span>
              <span className="text-xs font-mono text-muted-foreground">
                {t.score !== null ? t.score : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Last Clean: summary card ---

function LastCleanIssues({ report }: { report: LastCleanReport }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Last Cleanup Summary</h4>
      <div className="aurora-glass rounded-md p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-ctp-green" />
          <span className="text-xs text-foreground">{report.filesCleaned} files cleaned</span>
        </div>
        {report.remainingIssues > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-ctp-yellow" />
            <span className="text-xs text-foreground">{report.remainingIssues} remaining issues</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{report.summary}</p>
      </div>
    </div>
  );
}

// --- Shared helpers ---

function IssueList({ issues }: { issues: ReportIssue[] }) {
  return (
    <div className="space-y-1 pl-5">
      {issues.map((issue) => (
        <div key={issue.id} className="space-y-0.5">
          <p className="text-xs text-foreground">• {issue.description}</p>
          {issue.file && (
            <p className="text-[10px] text-muted-foreground font-mono pl-2.5">
              {issue.file}{issue.line ? `:${issue.line}` : ''}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function EmptyIssues({ label }: { label: string }) {
  return (
    <div className="text-center py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function groupBySeverity(issues: ReportIssue[]): Record<string, ReportIssue[]> {
  const groups: Record<string, ReportIssue[]> = {};
  for (const issue of issues) {
    const key = issue.severity;
    if (!groups[key]) groups[key] = [];
    groups[key].push(issue);
  }
  return groups;
}

function groupByCategory(issues: ReportIssue[]): Record<string, ReportIssue[]> {
  const groups: Record<string, ReportIssue[]> = {};
  for (const issue of issues) {
    const key = issue.category ?? 'Uncategorized';
    if (!groups[key]) groups[key] = [];
    groups[key].push(issue);
  }
  return groups;
}
