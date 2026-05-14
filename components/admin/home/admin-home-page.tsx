'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AlertStack } from './alert-stack';
import { PulseStrip } from './pulse-strip';
import { BusinessRow } from './business-row';
import { TrendsRow } from './trends-row';
import { DetailsGrid } from './details-grid';
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

      {/* Santé Business */}
      <BusinessRow business={data?.business ?? initialData.business} />

      {/* Tendances */}
      <TrendsRow trends={data?.trends ?? initialData.trends} />

      {/* Détails actionnables */}
      <DetailsGrid tables={data?.tables ?? initialData.tables} />
    </div>
  );
}
