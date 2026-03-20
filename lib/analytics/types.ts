/**
 * Analytics Types
 *
 * TypeScript interfaces for analytics dashboard data structures.
 * These types match the API contract defined in contracts/analytics-api.yaml.
 */

export type TimeRange = '7d' | '30d' | '90d' | 'all';
export type TicketOutcomeFilter = 'shipped' | 'closed' | 'all-completed';
export type NamedAgent = 'CLAUDE' | 'CODEX';
export type AgentFilter = 'all' | NamedAgent;

export interface AnalyticsFilters {
  range: TimeRange;
  outcome: TicketOutcomeFilter;
  agent: AgentFilter;
}

export interface CompletionMetric {
  count: number;
  label: string;
}

export interface AgentOption {
  value: AgentFilter;
  label: string;
  jobCount: number;
  isDefault: boolean;
}

export interface OverviewMetrics {
  /** Total cost in USD for the period */
  totalCost: number;
  /** Percentage change compared to previous equivalent period */
  costTrend: number;
  /** Percentage of successful jobs (COMPLETED / (COMPLETED + FAILED)) */
  successRate: number;
  /** Average job duration in milliseconds */
  avgDuration: number;
  /** Number of shipped tickets for the active filters */
  ticketsShipped: CompletionMetric;
  /** Number of closed tickets for the active filters */
  ticketsClosed: CompletionMetric;
}

export interface CostDataPoint {
  /** ISO date (YYYY-MM-DD) or week identifier (YYYY-Www) */
  date: string;
  /** Cost in USD for that period */
  cost: number;
}

export type StageKey = 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';

export interface StageCost {
  stage: StageKey;
  /** Total cost in USD for this stage */
  cost: number;
  /** Percentage of total cost (0-100) */
  percentage: number;
}

export interface TokenBreakdown {
  /** Total input tokens consumed */
  inputTokens: number;
  /** Total output tokens generated */
  outputTokens: number;
  /** Total cache tokens (read + creation) */
  cacheTokens: number;
}

export interface CacheMetrics {
  /** Total tokens processed */
  totalTokens: number;
  /** Tokens served from cache */
  cacheTokens: number;
  /** Cache hit rate as percentage (0-100) */
  savingsPercentage: number;
  /** Estimated cost savings from cache hits in USD */
  estimatedSavingsUsd: number;
}

export interface ToolUsage {
  /** Tool name (Edit, Read, Bash, Write, Glob, etc.) */
  tool: string;
  /** Usage frequency */
  count: number;
}

export type WorkflowTypeKey = 'FULL' | 'QUICK' | 'CLEAN';

export interface WorkflowBreakdown {
  type: WorkflowTypeKey;
  count: number;
  /** Percentage of total workflows (0-100) */
  percentage: number;
}

export interface WeeklyVelocity {
  /** ISO week identifier (YYYY-Www) */
  week: string;
  ticketsShipped: number;
}

export interface QualityScoreDataPoint {
  date: string;
  averageScore: number;
  count: number;
}

export interface DimensionComparison {
  dimension: string;
  averageScore: number;
  weight: number;
  displayOrder?: number;
}

export interface QualityScoreAnalytics {
  scoreTrend: QualityScoreDataPoint[];
  dimensionComparison: DimensionComparison[];
  overallAverage: number | null;
  totalScoredJobs: number;
}

export interface AnalyticsData {
  overview: OverviewMetrics;
  costOverTime: CostDataPoint[];
  costByStage: StageCost[];
  tokenUsage: TokenBreakdown;
  cacheEfficiency: CacheMetrics;
  topTools: ToolUsage[];
  workflowDistribution: WorkflowBreakdown[];
  velocity: WeeklyVelocity[];
  qualityScore?: QualityScoreAnalytics | null;
  filters: AnalyticsFilters;
  availableAgents: AgentOption[];
  /** ISO timestamp of when data was generated */
  generatedAt: string;
  /** Total filtered jobs in range */
  jobCount: number;
  /** False if no filtered completed jobs with telemetry data */
  hasData: boolean;
}
