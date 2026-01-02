/**
 * Comparison Report Generator
 *
 * Generates markdown comparison reports for ticket analysis.
 */

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

/**
 * Format date for report filename
 */
function formatDateForFilename(date: Date): string {
  return format(date, 'yyyyMMdd-HHmmss');
}

/**
 * Format date for display
 */
function formatDateForDisplay(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Generate comparison report filename
 *
 * @param sourceTicket - Source ticket key
 * @param comparedTickets - Array of compared ticket keys
 * @param date - Report generation date
 * @returns Filename in format: {timestamp}-vs-{keys}.md
 */
export function generateReportFilename(
  _sourceTicket: string,
  comparedTickets: string[],
  date: Date = new Date()
): string {
  const timestamp = formatDateForFilename(date);
  const keys = comparedTickets.join('-');
  return `${timestamp}-vs-${keys}.md`;
}

/**
 * Generate comparison report file path
 *
 * @param branch - Git branch where report will be stored
 * @param filename - Report filename
 * @returns Full path to report file
 */
export function generateReportPath(branch: string, filename: string): string {
  return `specs/${branch}/comparisons/${filename}`;
}

/**
 * Generate executive summary section
 */
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

/**
 * Generate feature alignment section
 */
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

/**
 * Generate implementation metrics section
 */
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

  // Add changed files detail if available
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

/**
 * Generate constitution compliance section
 */
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

  // Detailed breakdown for first entry
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

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDurationMs(ms: number): string {
  if (ms <= 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format cost value with proper handling
 */
function formatCost(costUsd: number): string {
  if (costUsd <= 0) return 'N/A';
  if (costUsd < 0.01) return `$${costUsd.toFixed(6)}`;
  return `$${costUsd.toFixed(4)}`;
}

/**
 * Calculate percentage difference with proper handling
 */
function calculatePercentDiff(base: number, current: number): string {
  if (base <= 0) return current > 0 ? '+∞%' : '0%';
  const diff = ((current - base) / base) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}%`;
}

/**
 * Generate telemetry/cost section with comparison table
 */
function generateTelemetrySection(
  telemetry: Record<string, TicketTelemetry>
): string {
  const entries = Object.values(telemetry);

  if (entries.length === 0) {
    return `## Cost & Telemetry\n\nNo telemetry data available.\n`;
  }

  let section = `## Cost & Telemetry\n\n`;

  // Main comparison table
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

  // Token breakdown for tickets with data
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

  // Cost comparison table (only if 2+ tickets have data)
  if (withData.length >= 2) {
    section += `### Cost Comparison\n\n`;

    // Use first ticket as baseline
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

  // Tools used summary
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

  // Summary totals
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

/**
 * Generate warnings section
 */
function generateWarningsSection(warnings: string[]): string {
  if (warnings.length === 0) return '';

  let section = `## Warnings\n\n`;
  for (const warning of warnings) {
    section += `> ⚠️ ${warning}\n\n`;
  }

  return section;
}

/**
 * Generate recommendation section
 */
function generateRecommendationSection(recommendation: string): string {
  if (!recommendation) return '';

  return `## Recommendation\n\n${recommendation}\n\n`;
}

/**
 * Generate full comparison report markdown
 *
 * @param report - Comparison report data
 * @returns Markdown content
 */
export function generateReportMarkdown(report: ComparisonReport): string {
  const { metadata, alignment, implementation, compliance, telemetry, recommendation, warnings } = report;

  let markdown = '';

  // Header
  markdown += `# Comparison Report: ${metadata.comparedTickets.join(' vs ')}\n\n`;
  markdown += `**Generated**: ${formatDateForDisplay(metadata.generatedAt)}\n`;
  markdown += `**Source Ticket**: ${metadata.sourceTicket}\n`;
  markdown += `**Compared Tickets**: ${metadata.comparedTickets.join(', ')}\n\n`;
  markdown += `---\n\n`;

  // Executive summary
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

  // Alignment
  markdown += generateAlignmentSection(alignment);
  markdown += '\n---\n\n';

  // Implementation metrics
  markdown += generateMetricsSection(implementation);
  markdown += '\n---\n\n';

  // Constitution compliance
  markdown += generateComplianceSection(compliance);
  markdown += '\n---\n\n';

  // Telemetry
  markdown += generateTelemetrySection(telemetry);

  // Warnings
  if (warnings.length > 0) {
    markdown += '\n---\n\n';
    markdown += generateWarningsSection(warnings);
  }

  // Recommendation
  if (recommendation) {
    markdown += '\n---\n\n';
    markdown += generateRecommendationSection(recommendation);
  }

  // Footer
  markdown += '\n---\n\n';
  markdown += `*Report generated by ai-board /compare command*\n`;

  return markdown;
}

/**
 * Create a comparison report object
 */
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

  // Generate summary from alignment
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

/**
 * Parse comparison report metadata from filename
 */
export function parseReportFilename(filename: string): {
  timestamp: string;
  comparedTickets: string[];
} | null {
  // Pattern: YYYYMMDD-HHMMSS-vs-KEY1-KEY2.md
  const match = filename.match(/^(\d{8}-\d{6})-vs-(.+)\.md$/);
  if (!match) return null;

  const timestamp = match[1]!;
  const keysStr = match[2]!;

  // Split keys (they're separated by -)
  // This is tricky because keys themselves contain -, e.g., AIB-123
  // Pattern: Project key is 3-6 uppercase alphanumeric, followed by dash and number
  const keyPattern = /[A-Z0-9]{3,6}-\d+/g;
  const comparedTickets = keysStr.match(keyPattern) || [];

  return { timestamp, comparedTickets };
}
