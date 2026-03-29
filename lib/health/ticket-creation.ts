import type { HealthScanType } from '@prisma/client';
import type {
  SecurityReport,
  ComplianceReport,
  TestsReport,
  SpecSyncReport,
  ScanReport,
} from '@/lib/health/types';

export interface RemediationTicket {
  title: string;
  description: string;
  stage: 'INBOX';
  workflowType: 'QUICK';
}

/**
 * Groups scan report issues into remediation tickets based on scan-type-specific rules:
 * - SECURITY: One ticket per severity level (HIGH, MEDIUM, LOW)
 * - COMPLIANCE: One ticket per violated constitution principle (category)
 * - TESTS: One ticket per unfixable test failure
 * - SPEC_SYNC: One ticket per desynchronized spec
 */
export function groupIssuesIntoTickets(
  scanType: HealthScanType,
  report: ScanReport
): RemediationTicket[] {
  switch (scanType) {
    case 'SECURITY':
      return groupSecurityIssues(report as SecurityReport);
    case 'COMPLIANCE':
      return groupComplianceIssues(report as ComplianceReport);
    case 'TESTS':
      return groupTestIssues(report as TestsReport);
    case 'SPEC_SYNC':
      return groupSpecSyncIssues(report as SpecSyncReport);
    default:
      return [];
  }
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  return groups;
}

function formatFileList(issues: { file?: string | undefined; line?: number | undefined; description: string }[]): string {
  return issues
    .filter((i) => i.file)
    .map((i) => `- ${i.file}${i.line ? `:${i.line}` : ''}: ${i.description}`)
    .join('\n') || 'See scan report for details.';
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count > 1 ? 's' : ''}`;
}

function groupSecurityIssues(report: SecurityReport): RemediationTicket[] {
  const groups = groupBy(report.issues, (i) => i.severity);
  const tickets: RemediationTicket[] = [];

  for (const [severity, issues] of groups) {
    const label = `${severity.toUpperCase()} severity`;
    tickets.push({
      title: `[Security] Fix ${plural(issues.length, `${label} issue`)}`,
      description: `Health scan found ${plural(issues.length, `${label} security issue`)}:\n\n${formatFileList(issues)}`,
      stage: 'INBOX',
      workflowType: 'QUICK',
    });
  }

  return tickets;
}

function groupComplianceIssues(report: ComplianceReport): RemediationTicket[] {
  const groups = groupBy(report.issues, (i) => i.category || 'General');
  const tickets: RemediationTicket[] = [];

  for (const [category, issues] of groups) {
    tickets.push({
      title: `[Compliance] Fix ${plural(issues.length, 'violation')} — ${category}`,
      description: `Health scan found ${plural(issues.length, 'compliance violation')} for principle "${category}":\n\n${formatFileList(issues)}`,
      stage: 'INBOX',
      workflowType: 'QUICK',
    });
  }

  return tickets;
}

function groupTestIssues(report: TestsReport): RemediationTicket[] {
  return report.nonFixable.map((issue) => ({
    title: `[Tests] Fix failing test: ${issue.description.slice(0, 80)}`,
    description: `Health scan found a non-fixable test failure:\n\n- **Test**: ${issue.description}\n- **File**: ${issue.file || 'Unknown'}\n- **ID**: ${issue.id}`,
    stage: 'INBOX',
    workflowType: 'QUICK',
  }));
}

function groupSpecSyncIssues(report: SpecSyncReport): RemediationTicket[] {
  return report.specs
    .filter((spec) => spec.status === 'drifted')
    .map((spec) => ({
      title: `[Spec Sync] Resynchronize ${spec.specPath}`,
      description: `Health scan detected spec drift:\n\n- **Spec**: ${spec.specPath}\n- **Drift**: ${spec.drift || 'Specification out of sync with implementation'}`,
      stage: 'INBOX',
      workflowType: 'QUICK',
    }));
}
