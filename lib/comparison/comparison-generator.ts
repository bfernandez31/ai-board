import type {
  ComparisonReport,
  ComparisonReportMetadata,
  FeatureAlignmentScore,
  ImplementationMetrics,
  ConstitutionComplianceScore,
  TicketTelemetry,
  ComparisonTarget,
} from '@/lib/types/comparison';
import { format } from 'date-fns';
import { getAlignmentLevel, generateAlignmentSummary } from './feature-alignment';
import { calculateTestRatio } from './implementation-metrics';
import { formatDurationMs } from './format-duration';
import {
  createCompareRunKey,
  createComparisonPersistenceRequest,
  getComparisonDataArtifactPath,
} from './comparison-payload';
import type { Agent, Stage, WorkflowType } from '@prisma/client';

function formatDateForFilename(date: Date): string {
  return format(date, 'yyyyMMdd-HHmmss');
}

function formatDateForDisplay(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

export function generateReportFilename(
  _sourceTicket: string,
  comparedTickets: string[],
  date: Date = new Date()
): string {
  const timestamp = formatDateForFilename(date);
  const keys = comparedTickets.join('-');
  return `${timestamp}-vs-${keys}.md`;
}

export function generateReportPath(branch: string, filename: string): string {
  return `specs/${branch}/comparisons/${filename}`;
}

function withPersistedReportPath(
  report: ComparisonReport,
  markdownPath: string
): ComparisonReport {
  return {
    ...report,
    metadata: {
      ...report.metadata,
      filePath: markdownPath,
    },
  };
}

function generateExecutiveSummary(
  alignment: FeatureAlignmentScore,
  targets: ComparisonTarget[]
): string {
  const level = getAlignmentLevel(alignment.overall);
  const availableCount = targets.filter((t) => t.status === 'resolved').length;
  const totalCount = targets.length;

  let summary = `## Executive Summary\n\n`;
  summary += `**Feature Alignment**: ${alignment.overall}% (${level})\n\n`;
  summary += `**Tickets Analyzed**: ${availableCount}/${totalCount} fully resolved\n\n`;

  if (alignment.isAligned) {
    summary += `These tickets share significant feature overlap and the comparison is meaningful.\n`;
  } else {
    summary += `> ⚠️ **Low Alignment Warning**: These tickets have limited overlap (${alignment.overall}% < 30%). `;
    summary += `Comparison results may be less meaningful.\n`;
  }

  if (alignment.matchingRequirements.length > 0) {
    summary += `\n**Matching Requirements**: ${alignment.matchingRequirements.join(', ')}\n`;
  }

  if (alignment.matchingEntities.length > 0) {
    summary += `\n**Shared Entities**: ${alignment.matchingEntities.join(', ')}\n`;
  }

  return summary;
}

function generateAlignmentSection(alignment: FeatureAlignmentScore): string {
  let section = `## Feature Alignment Analysis\n\n`;

  section += `| Dimension | Score | Weight |\n`;
  section += `|-----------|-------|--------|\n`;
  section += `| Requirements | ${alignment.dimensions.requirements}% | 40% |\n`;
  section += `| User Scenarios | ${alignment.dimensions.scenarios}% | 30% |\n`;
  section += `| Entities | ${alignment.dimensions.entities}% | 20% |\n`;
  section += `| Keywords | ${alignment.dimensions.keywords}% | 10% |\n`;
  section += `| **Overall** | **${alignment.overall}%** | 100% |\n\n`;

  section += generateAlignmentSummary(alignment);
  section += '\n';

  return section;
}

function generateMetricsSection(
  metrics: Record<string, ImplementationMetrics>
): string {
  const entries = Object.values(metrics);

  if (entries.length === 0) {
    return `## Implementation Metrics\n\nNo metrics available.\n`;
  }

  let section = `## Implementation Metrics\n\n`;
  section += `| Ticket | Lines Changed | Files | Test Files | Test Ratio |\n`;
  section += `|--------|---------------|-------|------------|------------|\n`;

  for (const m of entries) {
    if (m.hasData) {
      const testRatio = calculateTestRatio(m);
      section += `| ${m.ticketKey} | +${m.linesAdded}/-${m.linesRemoved} (${m.linesChanged}) | ${m.filesChanged} | ${m.testFilesChanged} | ${Math.round(testRatio * 100)}% |\n`;
    } else {
      section += `| ${m.ticketKey} | N/A | N/A | N/A | N/A |\n`;
    }
  }

  section += '\n';

  const withData = entries.filter((m) => m.hasData && m.changedFiles.length > 0);
  if (withData.length > 0) {
    section += `### Changed Files by Ticket\n\n`;
    for (const m of withData) {
      section += `<details>\n<summary>${m.ticketKey} (${m.filesChanged} files)</summary>\n\n`;
      section += '```\n';
      section += m.changedFiles.slice(0, 50).join('\n'); // Limit to 50 files
      if (m.changedFiles.length > 50) {
        section += `\n... and ${m.changedFiles.length - 50} more files`;
      }
      section += '\n```\n</details>\n\n';
    }
  }

  return section;
}

function generateComplianceSection(
  compliance: Record<string, ConstitutionComplianceScore>
): string {
  const entries = Object.entries(compliance);

  if (entries.length === 0) {
    return `## Constitution Compliance\n\nNo compliance data available.\n`;
  }

  let section = `## Constitution Compliance\n\n`;
  section += `| Ticket | Overall | Passed | Total |\n`;
  section += `|--------|---------|--------|-------|\n`;

  for (const [ticketKey, score] of entries) {
    const emoji = score.overall >= 80 ? '✅' : score.overall >= 50 ? '⚠️' : '❌';
    section += `| ${ticketKey} | ${emoji} ${score.overall}% | ${score.passedPrinciples} | ${score.totalPrinciples} |\n`;
  }

  section += '\n';

  if (entries.length > 0) {
    const [firstKey, firstScore] = entries[0]!;
    section += `### ${firstKey} - Detailed Breakdown\n\n`;
    section += `| Principle | Status | Notes |\n`;
    section += `|-----------|--------|-------|\n`;

    for (const principle of firstScore.principles) {
      const status = principle.passed ? '✅ Pass' : '❌ Fail';
      section += `| ${principle.section}. ${principle.name} | ${status} | ${principle.notes || '-'} |\n`;
    }
    section += '\n';
  }

  return section;
}

function formatCost(costUsd: number): string {
  if (costUsd <= 0) return 'N/A';
  if (costUsd < 0.01) return `$${costUsd.toFixed(6)}`;
  return `$${costUsd.toFixed(4)}`;
}

function calculatePercentDiff(base: number, current: number): string {
  if (base <= 0) return current > 0 ? '+∞%' : '0%';
  const diff = ((current - base) / base) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}%`;
}

function generateTelemetrySection(
  telemetry: Record<string, TicketTelemetry>
): string {
  const entries = Object.values(telemetry);

  if (entries.length === 0) {
    return `## Cost & Telemetry\n\nNo telemetry data available.\n`;
  }

  let section = `## Cost & Telemetry\n\n`;

  section += `### Cost Overview\n\n`;
  section += `| Ticket | Total Tokens | Cost (USD) | Duration | Jobs | Model |\n`;
  section += `|--------|--------------|------------|----------|------|-------|\n`;

  for (const t of entries) {
    if (t.hasData) {
      const tokens = t.inputTokens + t.outputTokens;
      const duration = formatDurationMs(t.durationMs);
      const cost = formatCost(t.costUsd);
      const model = t.model ?? 'N/A';
      section += `| ${t.ticketKey} | ${tokens.toLocaleString()} | ${cost} | ${duration} | ${t.jobCount} | ${model} |\n`;
    } else {
      section += `| ${t.ticketKey} | N/A | N/A | N/A | N/A | N/A |\n`;
    }
  }

  section += '\n';

  const withData = entries.filter((t) => t.hasData);
  if (withData.length > 0) {
    section += `### Token Breakdown\n\n`;
    section += `| Ticket | Input | Output | Cache Read | Cache Creation |\n`;
    section += `|--------|-------|--------|------------|----------------|\n`;

    for (const t of withData) {
      section += `| ${t.ticketKey} | ${t.inputTokens.toLocaleString()} | ${t.outputTokens.toLocaleString()} | ${t.cacheReadTokens.toLocaleString()} | ${t.cacheCreationTokens.toLocaleString()} |\n`;
    }
    section += '\n';
  }

  if (withData.length >= 2) {
    section += `### Cost Comparison\n\n`;

    const baseline = withData[0]!;
    const baseTokens = baseline.inputTokens + baseline.outputTokens;

    section += `*Baseline: ${baseline.ticketKey}*\n\n`;
    section += `| Ticket | Token Δ | Cost Δ | Duration Δ |\n`;
    section += `|--------|---------|--------|------------|\n`;

    for (let i = 1; i < withData.length; i++) {
      const t = withData[i]!;
      const tokens = t.inputTokens + t.outputTokens;
      const tokenDiff = tokens - baseTokens;
      const tokenDiffStr = tokenDiff >= 0 ? `+${tokenDiff.toLocaleString()}` : tokenDiff.toLocaleString();
      const tokenPercent = calculatePercentDiff(baseTokens, tokens);

      const costDiff = t.costUsd - baseline.costUsd;
      const costDiffStr = costDiff >= 0 ? `+${formatCost(costDiff)}` : `-${formatCost(Math.abs(costDiff))}`;
      const costPercent = calculatePercentDiff(baseline.costUsd, t.costUsd);

      const durationDiff = t.durationMs - baseline.durationMs;
      const durationDiffStr = durationDiff >= 0 ? `+${formatDurationMs(durationDiff)}` : `-${formatDurationMs(Math.abs(durationDiff))}`;
      const durationPercent = calculatePercentDiff(baseline.durationMs, t.durationMs);

      section += `| ${t.ticketKey} | ${tokenDiffStr} (${tokenPercent}) | ${costDiffStr} (${costPercent}) | ${durationDiffStr} (${durationPercent}) |\n`;
    }
    section += '\n';
  }

  if (withData.length > 0) {
    const allTools = new Set<string>();
    for (const t of withData) {
      for (const tool of t.toolsUsed) {
        allTools.add(tool);
      }
    }

    if (allTools.size > 0) {
      section += `### Tools Used\n\n`;
      section += `| Ticket | Tools |\n`;
      section += `|--------|-------|\n`;

      for (const t of withData) {
        const toolsList = t.toolsUsed.length > 0 ? t.toolsUsed.join(', ') : 'None';
        section += `| ${t.ticketKey} | ${toolsList} |\n`;
      }
      section += '\n';
    }
  }

  if (withData.length > 1) {
    const totalTokens = withData.reduce((sum, t) => sum + t.inputTokens + t.outputTokens, 0);
    const totalCost = withData.reduce((sum, t) => sum + t.costUsd, 0);
    const totalDuration = withData.reduce((sum, t) => sum + t.durationMs, 0);
    const totalJobs = withData.reduce((sum, t) => sum + t.jobCount, 0);

    section += `### Summary\n\n`;
    section += `- **Total Tokens**: ${totalTokens.toLocaleString()}\n`;
    section += `- **Total Cost**: ${formatCost(totalCost)}\n`;
    section += `- **Total Duration**: ${formatDurationMs(totalDuration)}\n`;
    section += `- **Total Jobs**: ${totalJobs}\n\n`;
  }

  return section;
}

function generateWarningsSection(warnings: string[]): string {
  if (warnings.length === 0) return '';

  let section = `## Warnings\n\n`;
  for (const warning of warnings) {
    section += `> ⚠️ ${warning}\n\n`;
  }

  return section;
}

function generateRecommendationSection(recommendation: string): string {
  if (!recommendation) return '';

  return `## Recommendation\n\n${recommendation}\n\n`;
}

export function generateReportMarkdown(report: ComparisonReport): string {
  const { metadata, alignment, implementation, compliance, telemetry, recommendation, warnings } = report;

  let markdown = '';

  markdown += `# Comparison Report: ${metadata.comparedTickets.join(' vs ')}\n\n`;
  markdown += `**Generated**: ${formatDateForDisplay(metadata.generatedAt)}\n`;
  markdown += `**Source Ticket**: ${metadata.sourceTicket}\n`;
  markdown += `**Compared Tickets**: ${metadata.comparedTickets.join(', ')}\n\n`;
  markdown += `---\n\n`;

  const dummyTargets: ComparisonTarget[] = metadata.comparedTickets.map((key) => ({
    ticket: {
      id: 0,
      ticketKey: key,
      title: '',
      branch: null,
      stage: 'INBOX' as const,
      workflowType: 'FULL' as const,
    },
    status: 'resolved' as const,
  }));
  markdown += generateExecutiveSummary(alignment, dummyTargets);
  markdown += '\n---\n\n';

  markdown += generateAlignmentSection(alignment);
  markdown += '\n---\n\n';

  markdown += generateMetricsSection(implementation);
  markdown += '\n---\n\n';

  markdown += generateComplianceSection(compliance);
  markdown += '\n---\n\n';

  markdown += generateTelemetrySection(telemetry);

  if (warnings.length > 0) {
    markdown += '\n---\n\n';
    markdown += generateWarningsSection(warnings);
  }

  if (recommendation) {
    markdown += '\n---\n\n';
    markdown += generateRecommendationSection(recommendation);
  }

  markdown += '\n---\n\n';
  markdown += `*Report generated by ai-board /compare command*\n`;

  return markdown;
}

export function createComparisonReport(
  sourceTicket: string,
  comparedTickets: string[],
  alignment: FeatureAlignmentScore,
  implementation: Record<string, ImplementationMetrics>,
  compliance: Record<string, ConstitutionComplianceScore>,
  telemetry: Record<string, TicketTelemetry>,
  recommendation: string = '',
  warnings: string[] = []
): ComparisonReport {
  const generatedAt = new Date();
  const filename = generateReportFilename(sourceTicket, comparedTickets, generatedAt);

  const metadata: ComparisonReportMetadata = {
    generatedAt,
    sourceTicket,
    comparedTickets,
    filePath: filename,
  };

  const summary = generateAlignmentSummary(alignment);

  return {
    metadata,
    summary,
    alignment,
    implementation,
    compliance,
    telemetry,
    recommendation,
    warnings,
  };
}

export async function persistGeneratedComparisonArtifacts(input: {
  projectId: number;
  sourceTicket: {
    id: number;
    ticketKey: string;
    title: string;
    stage: Stage;
    workflowType: WorkflowType;
    agent: Agent | null;
  };
  participants: Array<{
    id: number;
    ticketKey: string;
    title: string;
    stage: Stage;
    workflowType: WorkflowType;
    agent: Agent | null;
  }>;
  branch: string;
  report: ComparisonReport;
}): Promise<{
  filename: string;
  markdownPath: string;
  compareRunKey: string;
  markdown: string;
  artifactPath: string;
  comparisonDataJson: string | null;
  requestPayload: ReturnType<typeof createComparisonPersistenceRequest>;
}> {
  const filename = input.report.metadata.filePath;
  const markdownPath = generateReportPath(input.branch, filename);
  const compareRunKey = createCompareRunKey(
    input.sourceTicket.ticketKey,
    input.report.metadata.comparedTickets,
    input.report.metadata.generatedAt
  );
  const persistedReport = withPersistedReportPath(input.report, markdownPath);
  const markdown = generateReportMarkdown(persistedReport);
  const requestPayload = createComparisonPersistenceRequest({
    compareRunKey,
    projectId: input.projectId,
    sourceTicketKey: input.sourceTicket.ticketKey,
    participantTicketKeys: input.participants.map((participant) => participant.ticketKey),
    markdownPath,
    report: persistedReport,
  });
  let comparisonDataJson: string | null = null;

  try {
    comparisonDataJson = JSON.stringify(requestPayload, null, 2);
  } catch (error) {
    console.error('[comparison-generator] Failed to serialize comparison-data.json:', error);
  }

  return {
    filename,
    markdownPath,
    compareRunKey,
    markdown,
    artifactPath: getComparisonDataArtifactPath(markdownPath),
    comparisonDataJson,
    requestPayload,
  };
}

export function parseReportFilename(filename: string): {
  timestamp: string;
  comparedTickets: string[];
} | null {
  const match = filename.match(/^(\d{8}(?:-\d{6})?)-vs-(.+)\.md$/);
  if (!match) return null;

  const timestamp = match[1]!;
  const keysStr = match[2]!;

  const keyPattern = /[A-Z0-9]{3,6}-\d+/g;
  const comparedTickets = keysStr.match(keyPattern) || [];

  return { timestamp, comparedTickets };
}
