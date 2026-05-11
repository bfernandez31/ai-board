'use client';

import { useEffect, useState } from 'react';
import { FileText, Calendar, Users, Ticket } from 'lucide-react';

interface ReportViewerProps {
  runId: number;
  periodStart: string | null;
  periodEnd: string | null;
  sessionCount: number | null;
  ticketCount: number | null;
  completedAt: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ReportViewer({
  runId,
  periodStart,
  periodEnd,
  sessionCount,
  ticketCount,
  completedAt,
}: ReportViewerProps) {
  const [prevRunId, setPrevRunId] = useState(runId);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (runId !== prevRunId) {
    setPrevRunId(runId);
    setHtml(null);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/insights/runs/${runId}/report`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load report');
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setHtml(text);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-lg aurora-bg-section p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Generated {formatDate(completedAt)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>
            {formatDate(periodStart)} &ndash; {formatDate(periodEnd)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{sessionCount ?? 0} sessions</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Ticket className="h-4 w-4" />
          <span>{ticketCount ?? 0} tickets</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center rounded-lg border border-border/40 bg-card/50 p-12">
          <p className="text-muted-foreground">Loading report...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {html && !loading && (
        <iframe
          sandbox=""
          srcDoc={html}
          title="Insights Report"
          className="h-[600px] w-full rounded-lg border border-border/40 bg-background"
        />
      )}
    </div>
  );
}
