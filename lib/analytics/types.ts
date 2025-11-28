/**
 * TypeScript types for Project Analytics Dashboard
 *
 * All types match the data model defined in specs/AIB-83-project-analytics-dashboard/data-model.md
 */

export interface AnalyticsSummary {
  totalCostUsd: number;
  costTrendPercent: number | null;
  successRatePercent: number | null;
  avgDurationMs: number | null;
  ticketsShippedThisMonth: number;
}

export interface CostOverTimeDataPoint {
  date: Date;
  costUsd: number;
  jobCount: number;
}

export interface CostByStageDataPoint {
  stage: string;
  costUsd: number;
  jobCount: number;
  percentage: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
}

export interface TopToolDataPoint {
  toolName: string;
  usageCount: number;
  percentage: number;
}

export interface CacheEfficiency {
  efficiencyPercent: number;
  cacheReadTokens: number;
  freshInputTokens: number;
  totalInputTokens: number;
}

export interface WorkflowDistributionDataPoint {
  workflowType: string;
  ticketCount: number;
  percentage: number;
}

export interface VelocityDataPoint {
  weekStartDate: Date;
  ticketsShipped: number;
  weekLabel: string;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  costOverTime: CostOverTimeDataPoint[];
  costByStage: CostByStageDataPoint[];
  tokenUsage: TokenUsage;
  topTools: TopToolDataPoint[];
  cacheEfficiency: CacheEfficiency;
  workflowDistribution: WorkflowDistributionDataPoint[];
  velocity: VelocityDataPoint[];
}

/**
 * Command-to-Stage mapping lookup table
 * Maps Job.command values to workflow stages for cost-by-stage aggregation
 */
export const COMMAND_TO_STAGE: Record<string, string> = {
  'specify': 'SPECIFY',
  'plan': 'PLAN',
  'implement': 'BUILD',
  'verify': 'VERIFY',
  'deploy-preview': 'VERIFY',
  'comment-specify': 'SPECIFY',
  'comment-plan': 'PLAN',
  'comment-build': 'BUILD',
  'comment-verify': 'VERIFY',
  'quick-impl': 'BUILD',
  'clean': 'BUILD',
  'rollback-reset': 'PLAN',
};
