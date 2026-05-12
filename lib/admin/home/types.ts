export interface Alert {
  kind: 'LOW_SUCCESS_RATE' | 'STRIPE_WEBHOOK_ERRORS' | 'STALE_CRITICAL_CRON';
  message: string;
  href: string;
}

export interface TrendPoint {
  d: string;
  v: number;
}

export interface JobTrendPoint {
  d: string;
  completed: number;
  failed: number;
}

export interface MrrMonthPoint {
  m: string;
  v: number;
}

export interface PulseTile {
  value: number;
  spark: TrendPoint[];
}

export interface UsersTile extends PulseTile {
  delta7d: number;
  delta30d: number;
}

export interface MauTile extends PulseTile {
  deltaPrev30d: number;
  shareOfBase: number | null;
}

export interface MrrTile extends PulseTile {
  valueUsd: number;
  deltaUsdThisMonth: number;
  proCount: number;
  teamCount: number;
  proUsd: number;
  teamUsd: number;
}

export interface ActivePayingTile extends PulseTile {
  delta30d: number;
  conversionRate: number | null;
}

export interface PulseSnapshot {
  users: UsersTile;
  mau: MauTile;
  mrr: MrrTile;
  activePaying: ActivePayingTile;
}

export interface PlanDistributionRow {
  plan: 'FREE' | 'PRO' | 'TEAM';
  count: number;
}

export interface FunnelStep {
  key: 'SIGNUP' | 'FIRST_PROJECT' | 'FIRST_JOB' | 'FIRST_PAID';
  count: number;
  stepRate: number | null;
}

export interface ActivationFunnel {
  cohortSize: number;
  steps: FunnelStep[];
}

export interface Churn {
  cancellations: number;
  downgrades: number;
  mrrLostUsd: number;
  netMrrDeltaUsd: number;
}

export interface BusinessSnapshot {
  planDistribution: PlanDistributionRow[];
  activationFunnel: ActivationFunnel;
  churn: Churn;
}

export interface TrendsSnapshot {
  signupsDaily: TrendPoint[];
  jobsDaily: JobTrendPoint[];
  mrrMonthly: MrrMonthPoint[];
}

export interface NewPayingRow {
  email: string;
  plan: 'PRO' | 'TEAM';
  accountAgeDays: number;
  subscribedAt: string;
}

export interface CancellationRow {
  email: string;
  lostPlan: 'PRO' | 'TEAM';
  accountAgeDays: number;
  canceledAt: string;
}

export interface TopUserRow {
  email: string;
  plan: string;
  jobsThisMonth: number;
}

export interface TopProjectRow {
  projectKey: string;
  ownerEmail: string;
  jobsThisMonth: number;
}

export interface TablesSnapshot {
  newPaying: NewPayingRow[];
  cancellations: CancellationRow[];
  topUsers: TopUserRow[];
  topProjects: TopProjectRow[];
}

export interface AdminHomeSnapshot {
  generatedAt: string;
  alerts: Alert[];
  pulse: PulseSnapshot;
  business: BusinessSnapshot;
  trends: TrendsSnapshot;
  tables: TablesSnapshot;
}
