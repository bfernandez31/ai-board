'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComparisonComplianceHeatmapProps } from './types';

/** Aurora-styled status colors with gradients */
const statusStyles: Record<string, { className: string; style: React.CSSProperties }> = {
  pass: {
    className: 'h-8 w-full cursor-pointer rounded',
    style: {
      background: 'linear-gradient(135deg, hsl(var(--ctp-green) / 0.12), hsl(var(--ctp-teal) / 0.08))',
      border: '1px solid hsl(var(--ctp-green) / 0.15)',
    },
  },
  mixed: {
    className: 'h-8 w-full cursor-pointer rounded',
    style: {
      background: 'linear-gradient(135deg, hsl(var(--ctp-yellow) / 0.12), hsl(var(--ctp-peach) / 0.08))',
      border: '1px solid hsl(var(--ctp-yellow) / 0.15)',
    },
  },
  fail: {
    className: 'h-8 w-full cursor-pointer rounded',
    style: {
      background: 'linear-gradient(135deg, hsl(var(--ctp-red) / 0.12), hsl(var(--ctp-maroon) / 0.08))',
      border: '1px solid hsl(var(--ctp-red) / 0.15)',
    },
  },
};

const defaultStatusStyle = { className: 'h-8 w-full rounded bg-muted', style: {} };

export function ComparisonComplianceHeatmap({
  rows,
  participants,
}: ComparisonComplianceHeatmapProps) {
  if (rows.length === 0) {
    return (
      <Card
        className="border-ctp-mauve/15"
        style={{ background: 'hsl(var(--ctp-mauve) / 0.03)' }}
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
      className="border-ctp-mauve/15"
      style={{ background: 'hsl(var(--ctp-mauve) / 0.03)' }}
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
                <th className="sticky left-0 z-10 px-3 py-2 text-left font-medium text-muted-foreground" style={{ background: 'hsl(var(--ctp-mauve) / 0.03)' }}>
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
                  <td className="sticky left-0 z-10 px-3 py-2 font-medium text-foreground" style={{ background: 'hsl(var(--ctp-mauve) / 0.03)' }}>
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
                              style={cellStyle.style}
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
