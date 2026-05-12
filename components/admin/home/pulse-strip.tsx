'use client';

import { PulseTile } from './pulse-tile';
import { formatUsdCents, formatDelta } from '@/lib/admin/home/format';
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
            { label: '7d', value: formatDelta(users.delta7d, 0) },
            { label: '30d', value: formatDelta(users.delta30d, 0) },
          ]}
          spark={users.spark}
        />
        <PulseTile
          title="MAU"
          value={mau.value}
          deltas={[
            { label: 'vs prev 30d', value: formatDelta(mau.value, mau.value - mau.deltaPrev30d) },
            {
              label: 'of base',
              value: mau.shareOfBase !== null ? `${(mau.shareOfBase * 100).toFixed(1)}%` : '—',
            },
          ]}
          spark={mau.spark}
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
            { label: `${mrr.proCount} PRO / ${mrr.teamCount} TEAM`, value: '' },
          ]}
          spark={mrr.spark}
        />
        <PulseTile
          title="Active Paying"
          value={activePaying.value}
          deltas={[
            { label: '30d', value: formatDelta(activePaying.value, activePaying.value - activePaying.delta30d) },
            {
              label: 'conversion',
              value: activePaying.conversionRate !== null
                ? `${(activePaying.conversionRate * 100).toFixed(1)}%`
                : '—',
            },
          ]}
          spark={activePaying.spark}
        />
      </div>
    </section>
  );
}
