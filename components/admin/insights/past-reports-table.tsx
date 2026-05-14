'use client';

import type { InsightsRunStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import type { ReportListEntry } from '@/app/lib/insights/repository';

interface PastReportsTableProps {
  rows: ReportListEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function formatDateFull(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function formatCompactPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return `${start} → ${end}`;
  }
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const sameDay =
    sameYear &&
    s.getUTCMonth() === e.getUTCMonth() &&
    s.getUTCDate() === e.getUTCDate();
  if (sameDay) {
    return `${s.getUTCMonth() + 1}/${s.getUTCDate()}`;
  }
  if (sameYear) {
    return `${s.getUTCMonth() + 1}/${s.getUTCDate()} → ${e.getUTCMonth() + 1}/${e.getUTCDate()}`;
  }
  const sy = String(s.getUTCFullYear()).slice(-2);
  const ey = String(e.getUTCFullYear()).slice(-2);
  return `${s.getUTCMonth() + 1}/${s.getUTCDate()}/${sy} → ${e.getUTCMonth() + 1}/${e.getUTCDate()}/${ey}`;
}

export function formatCompactDuration(
  createdAt: string,
  completedAt: string | null,
  status: InsightsRunStatus
): string {
  if (status !== 'COMPLETED' || !completedAt) return '';
  const start = new Date(createdAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '';
  const ms = end - start;
  if (ms < 1000) return '<1s';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function statusBadgeVariant(
  status: InsightsRunStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

export function PastReportsTable({
  rows,
  selectedId,
  onSelect,
}: PastReportsTableProps) {
  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-md border border-border">
      <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 border-b border-border bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Date</span>
        <span>Period</span>
        <span className="text-right">Status</span>
        <span className="text-right">Duration</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const isSelected = row.id === selectedId;
          const rowClasses = isSelected
            ? 'bg-accent/30 border-l-2 border-primary'
            : 'border-l-2 border-transparent hover:bg-accent';
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => onSelect(row.id)}
                className={`grid w-full grid-cols-[1fr_1fr_auto_auto] items-center gap-2 px-2 py-1 text-left text-xs min-h-[30px] max-h-[36px] ${rowClasses}`}
              >
                <span className="truncate font-medium text-foreground">
                  {formatDateFull(row.generatedAt)}
                </span>
                <span className="truncate text-muted-foreground">
                  {formatCompactPeriod(row.periodStart, row.periodEnd)}
                </span>
                <span className="justify-self-end">
                  <Badge variant={statusBadgeVariant(row.status)}>
                    {row.status}
                  </Badge>
                </span>
                <span className="justify-self-end tabular-nums text-muted-foreground">
                  {formatCompactDuration(row.createdAt, row.completedAt, row.status)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
