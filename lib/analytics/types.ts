/**
 * Analytics Types
 *
 * Shared filter and payload definitions for the analytics dashboard.
 */

export const TIME_RANGE_VALUES = ['7d', '30d', '90d', 'all'] as const;
export const STATUS_SCOPE_VALUES = ['shipped', 'closed', 'shipped+closed'] as const;
export const ANALYTICS_AGENT_VALUES = ['CLAUDE', 'CODEX'] as const;

export type TimeRange = (typeof TIME_RANGE_VALUES)[number];
export type StatusScope = (typeof STATUS_SCOPE_VALUES)[number];
export type AnalyticsAgent = (typeof ANALYTICS_AGENT_VALUES)[number];
export type AgentScope = 'all' | AnalyticsAgent;

export interface AnalyticsFilterState {
  timeRange: TimeRange;
  statusScope: StatusScope;
  agentScope: AgentScope;
  periodLabel: string;
}

export interface AnalyticsQueryState {
  range: TimeRange;
  statusScope: StatusScope;
  agentScope: AgentScope;
}

export interface AgentOption {
  value: AnalyticsAgent;
  label: string;
  jobCount: number;
}

export function getPeriodLabel(range: TimeRange): string {
  switch (range) {
    case '7d':
      return 'Last 7 days';
    case '30d':
      return 'Last 30 days';
    case '90d':
      return 'Last 90 days';
    case 'all':
      return 'All time';
  }
}

export function getStatusScopeLabel(scope: StatusScope): string {
  switch (scope) {
    case 'shipped':
      return 'Shipped only';
    case 'closed':
      return 'Closed only';
    case 'shipped+closed':
      return 'Shipped + Closed';
  }
}

export function getAgentLabel(agent: AnalyticsAgent): string {
  switch (agent) {
    case 'CLAUDE':
      return 'Claude';
    case 'CODEX':
      return 'Codex';
  }
}

export function normalizeAnalyticsQueryState(
  input?: Partial<Record<'range' | 'statusScope' | 'agentScope', string | null>>
): AnalyticsQueryState {
  const range = TIME_RANGE_VALUES.includes((input?.range ?? '') as TimeRange)
    ? ((input?.range as TimeRange) ?? '30d')
    : '30d';
  const statusScope = STATUS_SCOPE_VALUES.includes((input?.statusScope ?? '') as StatusScope)
    ? ((input?.statusScope as StatusScope) ?? 'shipped')
    : 'shipped';
  const agentScope =
    input?.agentScope === 'CLAUDE' || input?.agentScope === 'CODEX' ? input.agentScope : 'all';

  return {
    range,
    statusScope,
    agentScope,
  };
}

export interface OverviewMetrics {
  totalCost: number;
  costTrend: number;
  successRate: number;
  avgDuration: number;
  ticketsShipped: number;
  ticketsClosed: number;
  ticketPeriodLabel: string;
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
  week: string;
  ticketsShipped: number;
}

export interface AnalyticsData {
  filters: AnalyticsFilterState;
  availableAgents: AgentOption[];
  overview: OverviewMetrics;
  costOverTime: CostDataPoint[];
  costByStage: StageCost[];
  tokenUsage: TokenBreakdown;
  cacheEfficiency: CacheMetrics;
  topTools: ToolUsage[];
  workflowDistribution: WorkflowBreakdown[];
  velocity: WeeklyVelocity[];
  timeRange: TimeRange;
  /** ISO timestamp of when data was generated */
  generatedAt: string;
  jobCount: number;
  hasData: boolean;
}
