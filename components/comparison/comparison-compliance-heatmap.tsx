'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getParticipantColor } from './participant-colors';
import type { ComparisonComplianceHeatmapProps } from './types';

const statusConfig: Record<string, { bg: string; label: string; textColor: string }> = {
  pass: { bg: 'bg-ctp-green/20', label: 'Pass', textColor: 'text-ctp-green' },
  mixed: { bg: 'bg-ctp-yellow/20', label: 'Mixed', textColor: 'text-ctp-yellow' },
  fail: { bg: 'bg-ctp-red/20', label: 'Fail', textColor: 'text-ctp-red' },
};

export function ComparisonComplianceHeatmap({
  rows,
  participants,
}: ComparisonComplianceHeatmapProps) {
  if (rows.length === 0) {
    return (
      <div className="space-y-1">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Compliance
        </h3>
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
          <div className="text-sm text-muted-foreground">
            No compliance data available for this comparison.
          </div>
        </div>
      </div>
    );
  }

  const sortedRows = [...rows].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-1">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Compliance
      </h3>
      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <TooltipProvider>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10">
                  <th className="sticky left-0 z-10 bg-transparent px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Principle
                  </th>
                  {participants.map((p) => {
                    const color = getParticipantColor(p.rank);
                    return (
                      <th key={p.ticketId} className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${color.text}`}>
                        {p.ticketKey}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.principleKey} className="border-b border-foreground/5 last:border-0">
                    <td className="sticky left-0 z-10 bg-transparent px-3 py-2.5 font-medium text-foreground">
                      {row.principleName}
                    </td>
                    {participants.map((p) => {
                      const assessment = row.assessments.find(
                        (a) => a.participantTicketId === p.ticketId
                      );

                      if (!assessment) {
                        return (
                          <td key={p.ticketId} className="px-3 py-2.5">
                            <div
                              data-testid="heatmap-cell"
                              className="flex h-8 w-full items-center justify-center rounded-md bg-muted"
                            />
                          </td>
                        );
                      }

                      const config = statusConfig[assessment.status] ?? { bg: 'bg-muted', label: '?', textColor: 'text-muted-foreground' };

                      return (
                        <td key={p.ticketId} className="px-3 py-2.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                data-testid="heatmap-cell"
                                className={`flex h-8 w-full cursor-pointer items-center justify-center rounded-md ${config.bg}`}
                              >
                                <span className={`text-xs font-semibold ${config.textColor}`}>
                                  {config.label}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-sm">{assessment.notes}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
