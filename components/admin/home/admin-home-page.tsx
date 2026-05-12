'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AlertStack } from './alert-stack';
import { PulseStrip } from './pulse-strip';
import type { AdminHomeSnapshot } from '@/lib/admin/home/types';

async function fetchSnapshot(): Promise<AdminHomeSnapshot> {
  const res = await fetch('/api/admin/home');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface AdminHomePageProps {
  initialData: AdminHomeSnapshot;
}

export function AdminHomePage({ initialData }: AdminHomePageProps) {
  const { data, isError } = useQuery({
    queryKey: ['admin', 'home'],
    queryFn: fetchSnapshot,
    initialData,
    refetchInterval: 30_000,
    staleTime: 25_000,
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {isError && (
        <p
          aria-live="polite"
          className="text-xs text-muted-foreground"
        >
          Last refresh failed — showing previous data
        </p>
      )}

      {/* Alertes */}
      <section aria-label="Alertes">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Alertes
        </h2>
        <AlertStack alerts={data?.alerts ?? []} />
      </section>

      {/* Pulse KPIs */}
      <PulseStrip pulse={data?.pulse ?? initialData.pulse} />

      {/* Santé Business placeholder */}
      <section aria-label="Santé Business">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Santé Business
        </h2>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Business health panels coming soon
        </div>
      </section>

      {/* Tendances placeholder */}
      <section aria-label="Tendances">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tendances
        </h2>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Trend charts coming soon
        </div>
      </section>

      {/* Détails actionnables placeholder */}
      <section aria-label="Détails actionnables">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Détails actionnables
        </h2>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Detail tables coming soon
        </div>
      </section>
    </div>
  );
}
