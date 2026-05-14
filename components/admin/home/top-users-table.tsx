'use client';

import type { TopUserRow } from '@/lib/admin/home/types';

interface TopUsersTableProps {
  data: TopUserRow[];
}

export function TopUsersTable({ data }: TopUsersTableProps) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No activity this month</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Email</th>
            <th className="pb-2 pr-3 font-medium">Plan</th>
            <th className="pb-2 font-medium text-right">Jobs</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 5).map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 truncate max-w-[140px]">{row.email}</td>
              <td className="py-1.5 pr-3 font-medium">{row.plan}</td>
              <td className="py-1.5 text-right tabular-nums">{row.jobsThisMonth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
