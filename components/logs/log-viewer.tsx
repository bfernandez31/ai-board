'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useJobLogs } from '@/app/lib/hooks/queries/use-job-logs';
import { LogEntryRow } from './log-entry-row';
import type { NormalizedLogEntry } from '@/lib/logs/types';

interface LogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number;
  jobCommand: string;
  agentType: string;
  timestamp: string;
}

function getCommandDisplayName(command: string): string {
  const names: Record<string, string> = {
    specify: 'Specification',
    plan: 'Planning',
    implement: 'Implementation',
    verify: 'Verification',
    ship: 'Shipping',
    'quick-impl': 'Quick Implementation',
    'deploy-preview': 'Preview Deployment',
    iterate: 'Iteration',
  };
  return names[command] ?? command;
}

export function LogViewer({ open, onOpenChange, jobId, jobCommand, agentType, timestamp }: LogViewerProps) {
  const { data, isLoading, error } = useJobLogs(jobId, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="aurora-dialog-overlay max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getCommandDisplayName(jobCommand)} Logs
            <Badge variant="outline" className="text-xs">{agentType}</Badge>
            <span className="text-xs text-muted-foreground font-normal">
              {new Date(timestamp).toLocaleString()}
            </span>
          </DialogTitle>
        </DialogHeader>

        {data?.truncated && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 text-amber-500 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Output was truncated (original size: {(data.rawSize / 1024).toFixed(0)} KB)
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading logs...
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-500 text-sm">
              Failed to load logs. Please try again.
            </div>
          )}

          {data && !isLoading && data.entries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No log entries captured.
            </div>
          )}

          {data && data.entries.length > 0 && (
            <div className="divide-y divide-border">
              {(data.entries as NormalizedLogEntry[]).map((entry, i) => (
                <LogEntryRow key={i} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
