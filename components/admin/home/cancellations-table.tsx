'use client';

import type { CancellationRow } from '@/lib/admin/home/types';

interface CancellationsTableProps {
  data: CancellationRow[];
}

export function CancellationsTable({ data }: CancellationsTableProps) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No cancellations this month</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Email</th>
            <th className="pb-2 pr-3 font-medium">Lost plan</th>
            <th className="pb-2 font-medium text-right">Account age</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 truncate max-w-[140px]">{row.email}</td>
              <td className="py-1.5 pr-3 font-medium text-destructive">{row.lostPlan}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{row.accountAgeDays}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
