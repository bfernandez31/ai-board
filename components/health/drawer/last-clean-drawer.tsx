'use client';

import { Sparkles, Loader2, Clock, FileText, AlertTriangle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useLastCleanDetails } from '@/app/lib/hooks/useLastCleanDetails';

interface LastCleanDrawerProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
}

const STALENESS_CONFIG = {
  ok: { label: 'OK', color: 'text-ctp-green', bg: 'bg-ctp-green/10' },
  warning: { label: 'Warning', color: 'text-ctp-yellow', bg: 'bg-ctp-yellow/10' },
  alert: { label: 'Alert', color: 'text-ctp-red', bg: 'bg-ctp-red/10' },
} as const;

export function LastCleanDrawer({ projectId, isOpen, onClose }: LastCleanDrawerProps) {
  const { data, isLoading } = useLastCleanDetails(projectId, isOpen);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Last Clean Details</SheetTitle>
          <SheetDescription className="sr-only">
            Detailed cleanup history for the project
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-2">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Last Clean</h2>
              <p className="text-xs text-muted-foreground">Cleanup history and status</p>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && data && data.lastCleanDate === null && (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">No cleanups yet</p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Cleanup data will appear once a cleanup workflow completes for this project.
              </p>
            </div>
          )}

          {!isLoading && data && data.lastCleanDate !== null && (
            <>
              {/* Status Summary */}
              <div className="aurora-glass rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(data.lastCleanDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.daysSinceClean} day{data.daysSinceClean !== 1 ? 's' : ''} ago
                    </p>
                  </div>
                  {data.stalenessStatus && (
                    <StalenessBadge status={data.stalenessStatus} />
                  )}
                </div>

                {/* Summary stats */}
                <div className="flex gap-4">
                  {data.filesCleaned !== null && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{data.filesCleaned} file{data.filesCleaned !== 1 ? 's' : ''} cleaned</span>
                    </div>
                  )}
                  {data.remainingIssues !== null && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{data.remainingIssues} remaining issue{data.remainingIssues !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {data.summary && (
                  <p className="text-xs text-muted-foreground">{data.summary}</p>
                )}
              </div>

              {/* Cleanup History */}
              {data.history.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Cleanup History</h3>
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {data.history.map((entry) => (
                      <div key={entry.jobId} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium">
                              {new Date(entry.completedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          {entry.summary && (
                            <p className="text-xs text-muted-foreground ml-5 truncate">{entry.summary}</p>
                          )}
                        </div>
                        {entry.filesCleaned !== null && (
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">
                            {entry.filesCleaned} file{entry.filesCleaned !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StalenessBadge({ status }: { status: 'ok' | 'warning' | 'alert' }) {
  const { label, color, bg } = STALENESS_CONFIG[status];
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${color} ${bg}`}>
      {label}
    </span>
  );
}
