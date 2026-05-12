'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { useAdminHomeSnapshot } from '@/app/lib/hooks/queries/use-admin-home-snapshot';
import type { DashboardSnapshot } from '@/app/lib/admin/home/types';
import { AlertsStrip } from './alerts-strip';
import { KpiTile } from './kpi-tile';

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
    </div>
  );
}
