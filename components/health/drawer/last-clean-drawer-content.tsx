'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DrawerStates } from './drawer-states';
import type { LastCleanModuleStatus } from '@/lib/health/types';

interface LastCleanDrawerContentProps {
  module: LastCleanModuleStatus;
}

export function LastCleanDrawerContent({ module }: LastCleanDrawerContentProps) {
  if (!module.detail) {
    return (
      <DrawerStates
        moduleType="LAST_CLEAN"
        moduleStatus={module}
        isScanning={false}
      />
    );
  }

  const { summary, history } = module.detail;

  return (
    <div className="space-y-6">
      {/* Overdue Alert */}
      {module.isOverdue && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-ctp-yellow/10 text-ctp-yellow text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Last cleanup was over 30 days ago. Consider running a cleanup.</span>
        </div>
      )}

      {/* Summary Card */}
      <Card className="aurora-glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Latest Cleanup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Files cleaned</span>
              <span className="font-medium text-foreground">{module.filesCleaned}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining issues</span>
              <span className="font-medium text-foreground">{module.remainingIssues}</span>
            </div>
            {summary && (
              <p className="text-xs text-muted-foreground pt-1">{summary}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card className="aurora-glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Cleanup History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.jobId} className="flex items-start justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.completedAt).toLocaleDateString()}
                      {item.ticketKey && ` · ${item.ticketKey}`}
                    </span>
                    <span className="text-foreground text-xs">{item.summary}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.filesCleaned} files
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
