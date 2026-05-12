'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { useAdminHomeSnapshot } from '@/app/lib/hooks/queries/use-admin-home-snapshot';
import type { DashboardSnapshot } from '@/app/lib/admin/home/types';
import { AlertsStrip } from './alerts-strip';
import { KpiTile } from './kpi-tile';
import { PlanDistributionDonut } from './plan-distribution-donut';
import { ActivationFunnel } from './activation-funnel';
import { ChurnPanel } from './churn-panel';
import { TrendSignupsChart } from './trend-signups-chart';
import { TrendJobsChart } from './trend-jobs-chart';
import { TrendMrrChart } from './trend-mrr-chart';
import { ActionableTable, type ActionableColumn } from './actionable-table';
import type {
  CancellationRow,
  PaidUserRow,
  TopProjectRow,
  TopUserRow,
} from '@/app/lib/admin/home/types';

interface AdminHomeDashboardProps {
  initialData: DashboardSnapshot;
}

export function AdminHomeDashboard({ initialData }: AdminHomeDashboardProps) {
  const query = useAdminHomeSnapshot(initialData);
  const snapshot = query.data ?? initialData;

  return (
    <div className="space-y-6">
      {query.isError && (
        <Card
          role="alert"
          aria-live="polite"
          className="border-destructive/40 bg-destructive/5"
        >
          <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
              <p className="text-sm text-foreground">
                Impossible de charger le tableau de bord. Les dernières données affichées peuvent être obsolètes.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void query.refetch();
              }}
            >
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertsStrip alerts={snapshot.alerts} />

      <section aria-label="Indicateurs clés">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile tile={snapshot.pulse.users} />
          <KpiTile tile={snapshot.pulse.mau} />
          <KpiTile tile={snapshot.pulse.mrr} />
          <KpiTile tile={snapshot.pulse.paying} />
        </div>
      </section>

      <section aria-label="Santé business">
        <div className="grid gap-4 lg:grid-cols-3">
          <PlanDistributionDonut data={snapshot.businessHealth.planDistribution} />
          <ActivationFunnel steps={snapshot.businessHealth.activationFunnel} />
          <ChurnPanel data={snapshot.businessHealth.churn} />
        </div>
      </section>

      <section aria-label="Tendances">
        <div className="grid gap-4 lg:grid-cols-3">
          <TrendSignupsChart data={snapshot.trends.signupsPerDay} />
          <TrendJobsChart data={snapshot.trends.jobsPerDay} />
          <TrendMrrChart data={snapshot.trends.mrrPerMonth} />
        </div>
      </section>

      <section aria-label="Actions à faire">
        <div className="grid gap-4 lg:grid-cols-2">
          <ActionableTable<PaidUserRow>
            title="Nouveaux utilisateurs payants (30j)"
            rows={snapshot.actionable.newPayingUsers}
            total={snapshot.meta.newPayingUsersTotal}
            rowKey={(row) => row.userId}
            emptyMessage="Aucun nouvel abonnement payant ce mois-ci."
            columns={NEW_PAYING_COLUMNS}
          />
          <ActionableTable<CancellationRow>
            title="Récentes cancellations (30j)"
            rows={snapshot.actionable.recentCancellations}
            total={snapshot.meta.recentCancellationsTotal}
            rowKey={(row) => `${row.userId}-${row.canceledAt}`}
            emptyMessage="Aucune cancellation récente."
            columns={CANCELLATION_COLUMNS}
          />
          <ActionableTable<TopUserRow>
            title="Top 5 utilisateurs (mois)"
            rows={snapshot.actionable.topActiveUsers}
            rowKey={(row) => row.userId}
            emptyMessage="Pas d'activité ce mois-ci."
            columns={TOP_USER_COLUMNS}
          />
          <ActionableTable<TopProjectRow>
            title="Top 5 projets (mois)"
            rows={snapshot.actionable.topProjects}
            rowKey={(row) => row.projectId}
            emptyMessage="Pas d'activité ce mois-ci."
            columns={TOP_PROJECT_COLUMNS}
          />
        </div>
      </section>
    </div>
  );
}

const NEW_PAYING_COLUMNS: ActionableColumn<PaidUserRow>[] = [
  { key: 'email', header: 'Email', render: (r) => r.email },
  { key: 'plan', header: 'Plan', render: (r) => r.plan },
  {
    key: 'days',
    header: 'Ancienneté',
    render: (r) => `${r.daysSinceActivation}j`,
  },
];

const CANCELLATION_COLUMNS: ActionableColumn<CancellationRow>[] = [
  { key: 'email', header: 'Email', render: (r) => r.email },
  { key: 'plan', header: 'Plan perdu', render: (r) => r.lostPlan },
  {
    key: 'days',
    header: 'Ancienneté',
    render: (r) => `${r.daysSinceCancellation}j`,
  },
];

const TOP_USER_COLUMNS: ActionableColumn<TopUserRow>[] = [
  { key: 'email', header: 'Email', render: (r) => r.email },
  { key: 'plan', header: 'Plan', render: (r) => r.plan },
  { key: 'jobs', header: 'Jobs', render: (r) => r.jobCount },
];

const TOP_PROJECT_COLUMNS: ActionableColumn<TopProjectRow>[] = [
  { key: 'key', header: 'Clé', render: (r) => r.projectKey },
  { key: 'name', header: 'Nom', render: (r) => r.projectName },
  { key: 'owner', header: 'Owner', render: (r) => r.ownerEmail },
  { key: 'jobs', header: 'Jobs', render: (r) => r.jobCount },
];
