'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComparisonComplianceHeatmapProps } from './types';

/** Aurora-styled status colors with visible gradients */
const statusStyles: Record<string, { className: string }> = {
  pass: {
    className: 'h-8 w-full cursor-pointer rounded aurora-cell-pass',
  },
  mixed: {
    className: 'h-8 w-full cursor-pointer rounded aurora-cell-mixed',
  },
  fail: {
    className: 'h-8 w-full cursor-pointer rounded aurora-cell-fail',
  },
};

const defaultStatusStyle = { className: 'h-8 w-full rounded bg-muted' };

export function ComparisonComplianceHeatmap({
  rows,
  participants,
}: ComparisonComplianceHeatmapProps) {
  if (rows.length === 0) {
    return (
      <Card
        className="border-ctp-mauve/15 aurora-bg-subtle"
      >
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-ctp-subtext0">
            Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No compliance data available for this comparison.
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedRows = [...rows].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <Card
      className="border-ctp-mauve/15 aurora-bg-subtle"
    >
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-ctp-subtext0">
          Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <TooltipProvider>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ctp-mauve/10">
                <th className="sticky left-0 z-10 px-3 py-2 text-left font-medium text-muted-foreground aurora-bg-subtle">
                  Principle
                </th>
                {participants.map((p) => (
                  <th key={p.ticketId} className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {p.ticketKey}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.principleKey} className="border-b border-ctp-mauve/10 last:border-0">
                  <td className="sticky left-0 z-10 px-3 py-2 font-medium text-foreground aurora-bg-subtle">
                    {row.principleName}
                  </td>
                  {participants.map((p) => {
                    const assessment = row.assessments.find(
                      (a) => a.participantTicketId === p.ticketId
                    );

                    if (!assessment) {
                      return (
                        <td key={p.ticketId} className="px-3 py-2">
                          <div
                            data-testid="heatmap-cell"
                            className="h-8 w-full rounded bg-muted"
                          />
                        </td>
                      );
                    }

                    const cellStyle = statusStyles[assessment.status] ?? defaultStatusStyle;

                    return (
                      <td key={p.ticketId} className="px-3 py-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              data-testid="heatmap-cell"
                              data-status={assessment.status}
                              className={cellStyle.className}
                            />
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
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
