import type { HealthScanType } from '@prisma/client';
import type {
  ReportIssue,
  SecurityReport,
  ComplianceReport,
  TestsReport,
  SpecSyncReport,
  ReviewQualityReport,
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
    case 'REVIEW_QUALITY':
      return groupReviewQualityIssues(report as ReviewQualityReport);
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

function formatFileList(issues: Pick<ReportIssue, 'file' | 'line' | 'description' | 'exploitScenario' | 'recommendation'>[]): string {
  return issues
    .filter((i) => i.file)
    .map((i) => {
      let line = `- **${i.file}${i.line ? `:${i.line}` : ''}**: ${i.description}`;
      if (i.exploitScenario) line += `\n  > **Exploit:** ${i.exploitScenario}`;
      if (i.recommendation) line += `\n  > **Fix:** ${i.recommendation}`;
      return line;
    })
    .join('\n\n') || 'See scan report for details.';
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count > 1 ? 's' : ''}`;
}

const MAX_DESCRIPTION_LENGTH = 9900;

function truncateDescription(desc: string): string {
  return desc.length > MAX_DESCRIPTION_LENGTH ? desc.slice(0, MAX_DESCRIPTION_LENGTH) + '…' : desc;
}

function groupSecurityIssues(report: SecurityReport): RemediationTicket[] {
  const groups = groupBy(report.issues, (i) => i.severity);
  const tickets: RemediationTicket[] = [];

  for (const [severity, issues] of groups) {
    const label = `${severity.toUpperCase()} severity`;
    const desc = `Health scan found ${plural(issues.length, `${label} security issue`)}:\n\n${formatFileList(issues)}`;
    tickets.push({
      title: `[Security] Fix ${plural(issues.length, `${label} issue`)}`,
      description: truncateDescription(desc),
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
      title: `[Compliance] Fix ${plural(issues.length, 'violation')} - ${category}`,
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

function shortSpecName(specPath: string): string {
  return specPath
    .replace(/^specs\/specifications\//, '')
    .replace(/\.md$/, '');
}

function groupSpecSyncIssues(report: SpecSyncReport): RemediationTicket[] {
  return report.specs
    .filter((spec) => spec.status === 'drifted')
    .map((spec) => ({
      title: `[Spec Sync] ${shortSpecName(spec.specPath)}`,
      description: `Health scan detected spec drift:\n\n- **Spec**: ${spec.specPath}\n- **Drift**: ${spec.drift || 'Specification out of sync with implementation'}`,
      stage: 'INBOX',
      workflowType: 'QUICK',
    }));
}

function groupReviewQualityIssues(report: ReviewQualityReport): RemediationTicket[] {
  const patterns = report.cumulativeAnalysis?.recurringPatterns ?? [];
  return patterns
    .filter((p) => !p.alreadyTicketed)
    .map((p) => {
      const displayCategory = p.category.replace(/-/g, ' ');
      const prList = p.prNumbers.map((n) => `#${n}`).join(', ');
      const desc = truncateDescription(
        `Health scan detected a recurring review gap pattern.\n\n` +
        `**Category**: ${p.category}\n` +
        `**Occurrences**: ${p.occurrences} PRs (${prList})\n\n` +
        `**Suggested Rule**:\n> ${p.suggestedRule}\n\n` +
        `**Target**: ${p.target}`
      );
      return {
        title: `[Review Gap] Add rule for ${displayCategory}`,
        description: desc,
        stage: 'INBOX',
        workflowType: 'QUICK',
      };
    });
}
