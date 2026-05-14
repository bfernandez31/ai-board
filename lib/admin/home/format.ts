export function formatDelta(current: number, prior: number): string {
  if (current === 0 && prior === 0) return '—';
  if (prior === 0) return `+${current}`;
  const pct = ((current - prior) / prior) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatCountDelta(delta: number): string {
  if (delta === 0) return '—';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatUsdCents(cents: number): string {
  return usdFormatter.format(cents / 100);
}
