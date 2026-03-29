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

function groupSecurityIssues(report: SecurityReport): RemediationTicket[] {
  const bySeverity = new Map<string, typeof report.issues>();

  for (const issue of report.issues) {
    const severity = issue.severity;
    if (!bySeverity.has(severity)) {
      bySeverity.set(severity, []);
    }
    bySeverity.get(severity)!.push(issue);
  }

  const tickets: RemediationTicket[] = [];
  for (const [severity, issues] of bySeverity) {
    const fileList = issues
      .filter((i) => i.file)
      .map((i) => `- ${i.file}${i.line ? `:${i.line}` : ''}: ${i.description}`)
      .join('\n');

    tickets.push({
      title: `[Security] Fix ${issues.length} ${severity.toUpperCase()} severity issue${issues.length > 1 ? 's' : ''}`,
      description: `Health scan found ${issues.length} ${severity.toUpperCase()} severity security issue${issues.length > 1 ? 's' : ''}:\n\n${fileList || 'See scan report for details.'}`,
      stage: 'INBOX',
      workflowType: 'QUICK',
    });
  }

  return tickets;
}

function groupComplianceIssues(report: ComplianceReport): RemediationTicket[] {
  const byCategory = new Map<string, typeof report.issues>();

  for (const issue of report.issues) {
    const category = issue.category || 'General';
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(issue);
  }

  const tickets: RemediationTicket[] = [];
  for (const [category, issues] of byCategory) {
    const fileList = issues
      .filter((i) => i.file)
      .map((i) => `- ${i.file}${i.line ? `:${i.line}` : ''}: ${i.description}`)
      .join('\n');

    tickets.push({
      title: `[Compliance] Fix ${issues.length} violation${issues.length > 1 ? 's' : ''} — ${category}`,
      description: `Health scan found ${issues.length} compliance violation${issues.length > 1 ? 's' : ''} for principle "${category}":\n\n${fileList || 'See scan report for details.'}`,
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
    stage: 'INBOX' as const,
    workflowType: 'QUICK' as const,
  }));
}

function groupSpecSyncIssues(report: SpecSyncReport): RemediationTicket[] {
  return report.specs
    .filter((spec) => spec.status === 'drifted')
    .map((spec) => ({
      title: `[Spec Sync] Resynchronize ${spec.specPath}`,
      description: `Health scan detected spec drift:\n\n- **Spec**: ${spec.specPath}\n- **Drift**: ${spec.drift || 'Specification out of sync with implementation'}`,
      stage: 'INBOX' as const,
      workflowType: 'QUICK' as const,
    }));
}
