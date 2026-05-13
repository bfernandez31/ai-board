'use client';

import { PulseTile } from './pulse-tile';
import { formatUsdCents, formatCountDelta } from '@/lib/admin/home/format';
import type { PulseSnapshot } from '@/lib/admin/home/types';

interface PulseStripProps {
  pulse: PulseSnapshot;
}

export function PulseStrip({ pulse }: PulseStripProps) {
  const { users, mau, mrr, activePaying } = pulse;

  return (
    <section aria-label="Pulse">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Pulse
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PulseTile
          title="Users"
          value={users.value}
          deltas={[
            { label: 'new 7d', value: formatCountDelta(users.delta7d) },
            { label: 'new 30d', value: formatCountDelta(users.delta30d) },
          ]}
          spark={users.spark}
          sparkStroke="hsl(var(--chart-1))"
        />
        <PulseTile
          title="MAU"
          value={mau.value}
          deltas={[
            { label: 'vs prev 30d', value: formatCountDelta(mau.deltaPrev30d) },
            {
              label: 'of base',
              value: mau.shareOfBase !== null ? `${(mau.shareOfBase * 100).toFixed(1)}%` : '—',
            },
          ]}
          spark={mau.spark}
          sparkStroke="hsl(var(--chart-2))"
        />
        <PulseTile
          title="MRR"
          value={mrr.valueUsd}
          formatter={formatUsdCents}
          deltas={[
            {
              label: 'this month',
              value: mrr.deltaUsdThisMonth >= 0
                ? `+${formatUsdCents(mrr.deltaUsdThisMonth)}`
                : formatUsdCents(mrr.deltaUsdThisMonth),
            },
            { label: 'PRO / TEAM', value: `${mrr.proCount} / ${mrr.teamCount}` },
          ]}
          spark={mrr.spark}
          sparkStroke="hsl(var(--chart-3))"
        />
        <PulseTile
          title="Active Paying"
          value={activePaying.value}
          deltas={[
            { label: '30d', value: formatCountDelta(activePaying.delta30d) },
            {
              label: 'conversion',
              value: activePaying.conversionRate !== null
                ? `${(activePaying.conversionRate * 100).toFixed(1)}%`
                : '—',
            },
          ]}
          spark={activePaying.spark}
          sparkStroke="hsl(var(--chart-4))"
        />
      </div>
    </section>
  );
}
