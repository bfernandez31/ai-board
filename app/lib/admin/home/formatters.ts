import type { Delta } from './types';

export function formatPriceCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const euros = abs / 100;
  const formatted = euros.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? '-' : ''}€${formatted}`;
}

export function formatDelta(delta: Delta): string {
  const sign = delta.value > 0 ? '+' : delta.value < 0 ? '−' : '';
  const abs = Math.abs(delta.value);
  if (delta.unit === 'percent') {
    const pct = Math.round(abs * 100);
    if (delta.value === 0) return '0%';
    return `${sign}${pct}%`;
  }
  if (delta.value === 0) return '0';
  return `${sign}${abs}`;
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null || Number.isNaN(ratio) || !Number.isFinite(ratio)) {
    return '—';
  }
  return `${Math.round(ratio * 100)}%`;
}

export function formatCountWithSpacedThousands(count: number): string {
  return count.toLocaleString('fr-FR').replace(/ | /g, ' ');
}
