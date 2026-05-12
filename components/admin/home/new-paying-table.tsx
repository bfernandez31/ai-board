'use client';

import type { NewPayingRow } from '@/lib/admin/home/types';

interface NewPayingTableProps {
  data: NewPayingRow[];
}

export function NewPayingTable({ data }: NewPayingTableProps) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No new paying users this month</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Email</th>
            <th className="pb-2 pr-3 font-medium">Plan</th>
            <th className="pb-2 font-medium text-right">Account age</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 truncate max-w-[140px]">{row.email}</td>
              <td className="py-1.5 pr-3 font-medium">{row.plan}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{row.accountAgeDays}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
