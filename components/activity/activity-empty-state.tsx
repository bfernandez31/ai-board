'use client';

/**
 * Activity Empty State Component
 * Feature: AIB-177-project-activity-feed
 *
 * Displays when there are no activity events in the project.
 */

import { Activity } from 'lucide-react';

export function ActivityEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800/50 mb-4">
        <Activity className="h-8 w-8 text-zinc-500" />
      </div>
      <h3 className="text-lg font-medium text-zinc-200 mb-2">No activity yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Events will appear here as work progresses on your tickets.
        Create tickets and start workflows to see activity.
      </p>
    </div>
  );
}
