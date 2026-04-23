'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle } from 'lucide-react';
import { useJobLog } from '@/lib/hooks/use-job-log';
import { formatCommandName } from '@/lib/utils/format-command';

interface JobLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  ticketId: number;
  jobId: number;
  command: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const ERROR_PATTERN = /(^|\s)(error|failed|traceback|exception)(:|\s|$)/i;

function classifyLine(rest: string): string {
  if (ERROR_PATTERN.test(rest)) return 'text-ctp-red font-medium';
  if (rest.startsWith('tool_use:') || rest.startsWith('tool_result:')) return 'text-ctp-blue';
  if (rest.startsWith('assistant:')) return 'text-ctp-mauve';
  return 'text-foreground';
}

/**
 * Render a single log line with light syntax highlighting:
 * timestamps, tool_use prefixes, and ERROR lines are colored so the
 * drill-down view reads cleanly instead of as a raw JSON dump.
 */
function LogLine({ line }: { line: string }) {
  const tsMatch = line.match(/^\[([^\]]+)\]\s*/);
  const rest = tsMatch ? line.slice(tsMatch[0].length) : line;
  const restClass = classifyLine(rest);

  return (
    <div className="flex gap-2 py-0.5 text-xs font-mono">
      {tsMatch && (
        <span className="text-ctp-overlay0 flex-shrink-0 select-none">{tsMatch[1]}</span>
      )}
      <span className={`whitespace-pre-wrap break-words ${restClass}`}>{rest}</span>
    </div>
  );
}

export function JobLogDialog({
  open,
  onOpenChange,
  projectId,
  ticketId,
  jobId,
  command,
}: JobLogDialogProps) {
  const { data, isLoading, error } = useJobLog(projectId, ticketId, jobId, open);

  const lines = useMemo(() => {
    if (!data?.log?.content) return [];
    return data.log.content.split(/\r?\n/);
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[80vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Execution logs — {formatCommandName(command)}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {data?.log ? (
              <>
                {data.log.agent ?? 'agent'} · {data.log.eventCount} events ·{' '}
                {formatBytes(data.log.byteSize)}
                {data.log.truncated && ' · truncated (tail preserved)'}
              </>
            ) : (
              'Captured agent execution log.'
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading logs…
          </div>
        )}

        {error && (
          <div
            className="flex items-start gap-2 text-sm text-ctp-red bg-ctp-red/10 border border-ctp-red/30 rounded-md p-3"
            data-testid="job-log-error"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{(error as Error).message}</span>
          </div>
        )}

        {data?.log && (
          <ScrollArea className="flex-1 min-h-[400px] max-h-[60vh] rounded-md border bg-muted/30 p-3">
            <div data-testid="job-log-content">
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Log is empty.</p>
              ) : (
                lines.map((line, idx) => <LogLine key={idx} line={line} />)
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
