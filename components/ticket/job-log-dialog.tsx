'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock3, FileSearch, Loader2 } from 'lucide-react';
import type { TicketJobLogDetail } from '@/lib/types/job-types';
import { queryKeys } from '@/app/lib/query-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface JobLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  jobId: number | null;
  jobCommand?: string | null;
}

function getJobLogDescription(jobCommand?: string | null): string {
  if (jobCommand) {
    return `${jobCommand} job execution detail`;
  }

  return 'Full retained execution detail for this job.';
}

function availabilityLabel(availability: string): string {
  switch (availability) {
    case 'AVAILABLE':
      return 'Available';
    case 'PARTIAL':
      return 'Partial';
    case 'UNAVAILABLE':
      return 'Unavailable';
    case 'PRUNED':
      return 'Pruned';
    default:
      return availability;
  }
}

async function fetchJobLogDetail(projectId: number, jobId: number): Promise<TicketJobLogDetail> {
  const response = await fetch(`/api/projects/${projectId}/jobs/${jobId}/logs`);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || 'Failed to load execution logs');
  }

  return body as TicketJobLogDetail;
}

export function JobLogDialog({
  open,
  onOpenChange,
  projectId,
  jobId,
  jobCommand,
}: JobLogDialogProps): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.projects.jobLogDetail(projectId, jobId ?? 0),
    queryFn: () => fetchJobLogDetail(projectId, jobId ?? 0),
    enabled: open && jobId !== null,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-ctp-mauve/15">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-ctp-blue" />
            Execution Logs
          </DialogTitle>
          <DialogDescription>
            {getJobLogDescription(jobCommand)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading execution logs…
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Failed to load execution logs
            </div>
            <Button className="mt-3" variant="secondary" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        {data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{availabilityLabel(data.availability)}</Badge>
              <Badge variant="outline">{data.agent}</Badge>
              {data.retainedUntil && (
                <span className="text-xs text-muted-foreground">
                  Retained until {new Date(data.retainedUntil).toLocaleString()}
                </span>
              )}
            </div>

            <div className="rounded-lg border border-border aurora-bg-muted p-4">
              <p className="font-medium text-foreground">{data.summary.headline}</p>
              {data.summary.errorReason ? (
                <p className="mt-2 text-sm text-ctp-red">{data.summary.errorReason}</p>
              ) : null}
              {data.partialReason ? (
                <p className="mt-2 text-sm text-ctp-yellow">{data.partialReason}</p>
              ) : null}
              {data.unavailableReason ? (
                <p className="mt-2 text-sm text-muted-foreground">{data.unavailableReason}</p>
              ) : null}
            </div>

            {data.events && data.events.length > 0 ? (
              <ScrollArea className="h-[420px] rounded-lg border border-border">
                <div className="space-y-3 p-4">
                  {data.events.map((event) => (
                    <div
                      key={`${event.sequence}-${event.timestamp}`}
                      className="rounded-lg border border-border/70 bg-card p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{event.kind}</Badge>
                          <span className="text-sm font-medium text-foreground">{event.title}</span>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {event.body ? (
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded bg-background/60 p-3 text-xs text-foreground">
                          {event.body}
                        </pre>
                      ) : null}
                      {event.toolName ? (
                        <p className="mt-2 text-xs text-muted-foreground">Tool: {event.toolName}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                Detailed events are not available for this job.
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
