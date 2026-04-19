import type { HeatmapDay } from '@/lib/analytics/heatmap-types';

function formatCost(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatDisplayDate(dayKey: string): string {
  const [yearStr, monthStr, dayStr] = dayKey.split('-');
  const year = parseInt(yearStr ?? '1970', 10);
  const month = parseInt(monthStr ?? '01', 10);
  const day = parseInt(dayStr ?? '01', 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  try {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dayKey;
  }
}

export function HeatmapTooltipContent({ day }: { day: HeatmapDay }) {
  return (
    <div className="space-y-1 text-xs" data-testid="activity-heatmap-tooltip">
      <div className="font-medium">{formatDisplayDate(day.date)}</div>
      <div>
        {day.jobCount === 0
          ? 'No AI activity'
          : `${day.jobCount} ${day.jobCount === 1 ? 'job' : 'jobs'}`}
      </div>
      {day.shippedTickets.length > 0 && (
        <ul className="space-y-0.5 pt-1">
          {day.shippedTickets.map((t) => (
            <li key={t.ticketKey}>
              <span className="font-mono">{t.ticketKey}</span> — {t.title}
            </li>
          ))}
        </ul>
      )}
      {day.totalCost !== null && (
        <div className="pt-1 text-muted-foreground">Cost: {formatCost(day.totalCost)}</div>
      )}
    </div>
  );
}
