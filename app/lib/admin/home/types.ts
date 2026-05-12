export type AlertKind = 'job-success' | 'stripe-webhook' | 'cron';

export type JobSuccessAlertPayload = {
  kind: 'job-success';
  successRatePct: number;
  failedCount: number;
  windowDays: 7;
};

export type StripeWebhookAlertPayload = {
  kind: 'stripe-webhook';
  transitionsInWindow: number;
  windowHours: 24;
};

export type CronAlertPayload = {
  kind: 'cron';
  workflowName: string;
  lastSuccessAt: string | null;
  hoursSinceLastSuccess: number | null;
};

export type AlertPayload =
  | JobSuccessAlertPayload
  | StripeWebhookAlertPayload
  | CronAlertPayload;

export interface AlertCard {
  kind: AlertKind;
  id: string;
  payload: AlertPayload;
  actionLabel: string;
  actionHref: string;
}

export type KpiId = 'users' | 'mau' | 'mrr' | 'paying';

export interface Delta {
  label: string;
  value: number;
  unit: 'absolute' | 'percent';
  goodDirection: 'up' | 'down';
}

export interface KpiTile {
  id: KpiId;
  label: string;
  value: number;
  unit: 'count' | 'cents' | 'percent';
  deltas: [Delta, Delta];
  sparkline: number[];
  tooltip: string;
}

export interface PlanDistribution {
  free: number;
  pro: number;
  team: number;
}

export type FunnelStepId = 'signups' | 'first_project' | 'first_job' | 'paid';

export interface FunnelStep {
  id: FunnelStepId;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
}

export interface ChurnPanel {
  cancellationsCount: number;
  downgradesCount: number;
  mrrLostCents: number;
  netMrrDeltaCents: number;
}

export interface DailyPoint {
  date: string;
  value: number;
}

export interface JobsDailyPoint {
  date: string;
  completed: number;
  failed: number;
}

export interface MonthlyPoint {
  month: string;
  mrrCents: number;
}

export interface PaidUserRow {
  userId: string;
  email: string;
  plan: 'PRO' | 'TEAM';
  activatedAt: string;
  daysSinceActivation: number;
}

export interface CancellationRow {
  userId: string;
  email: string;
  lostPlan: 'PRO' | 'TEAM' | 'FREE';
  canceledAt: string;
  daysSinceCancellation: number;
}

export interface TopUserRow {
  userId: string;
  email: string;
  plan: 'FREE' | 'PRO' | 'TEAM';
  jobCount: number;
  lastJobAt: string;
}

export interface TopProjectRow {
  projectId: number;
  projectKey: string;
  projectName: string;
  ownerEmail: string;
  jobCount: number;
  lastJobAt: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  alerts: AlertCard[];
  pulse: {
    users: KpiTile;
    mau: KpiTile;
    mrr: KpiTile;
    paying: KpiTile;
  };
  businessHealth: {
    planDistribution: PlanDistribution;
    activationFunnel: FunnelStep[];
    churn: ChurnPanel;
  };
  trends: {
    signupsPerDay: DailyPoint[];
    jobsPerDay: JobsDailyPoint[];
    mrrPerMonth: MonthlyPoint[];
  };
  actionable: {
    newPayingUsers: PaidUserRow[];
    recentCancellations: CancellationRow[];
    topActiveUsers: TopUserRow[];
    topProjects: TopProjectRow[];
  };
  meta: {
    newPayingUsersTotal: number;
    recentCancellationsTotal: number;
    currencyMinorUnit: 'cents';
  };
}
