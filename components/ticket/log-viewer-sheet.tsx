'use client';

import { Download, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useJobLogRaw } from '@/app/lib/hooks/queries/useJobLogRaw';
import { LogEventRow } from './log-event-row';

interface LogViewerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  ticketId: number;
  jobId: number;
  commandLabel: string;
}

export function LogViewerSheet({
  open,
  onOpenChange,
  projectId,
  ticketId,
  jobId,
  commandLabel,
}: LogViewerSheetProps) {
  const { data, isLoading, isError, error } = useJobLogRaw(projectId, ticketId, jobId, open);

  const rawUrl = `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw?format=jsonl`;
  const fileName = `job-${jobId}.jsonl.gz`;
  const isBlobError = error instanceof Error && /HTTP 502/.test(error.message);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="sm:max-w-xl w-full flex flex-col"
        data-testid="log-viewer-sheet"
      >
        <SheetHeader>
          <SheetTitle>Agent logs — {commandLabel}</SheetTitle>
          <SheetDescription>
            Normalized event stream captured during this job run.
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1"
          data-testid="log-viewer-body"
        >
          {isLoading && (
            <div className="space-y-2" data-testid="log-viewer-loading">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading transcript…
              </div>
            </div>
          )}

          {isError && (
            <div
              className="rounded-md border border-ctp-red/40 p-3 text-sm text-ctp-red"
              data-testid="log-viewer-error"
            >
              {isBlobError
                ? 'Log storage is temporarily unavailable. Try again in a moment.'
                : `Failed to load logs${error instanceof Error ? `: ${error.message}` : '.'}`}
            </div>
          )}

          {data && data.events.length === 0 && (
            <div className="text-sm text-muted-foreground" data-testid="log-viewer-empty">
              No events recorded for this job.
            </div>
          )}

          {data &&
            data.events.map((event, index) => (
              <LogEventRow key={`${event.ts}-${index}`} event={event} />
            ))}
        </div>

        <SheetFooter className="mt-4">
          <a
            href={rawUrl}
            download={fileName}
            data-testid="log-viewer-download"
          >
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={!data || isError}
              className="gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Download raw
            </Button>
          </a>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
