/**
 * Activity Empty State Component
 * Feature: AIB-172 Project Activity Feed
 *
 * Displays friendly message when no activity exists
 */

import { Activity } from 'lucide-react';

interface ActivityEmptyStateProps {
  className?: string;
}

/**
 * Empty state component for activity feed
 *
 * Shows when there are no activity events in the 30-day window
 */
export function ActivityEmptyState({ className = '' }: ActivityEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-surface0 flex items-center justify-center mb-4">
        <Activity className="w-8 h-8 text-subtext0" />
      </div>
      <h3 className="text-lg font-medium text-text mb-2">No recent activity</h3>
      <p className="text-sm text-subtext0 max-w-sm">
        When tickets are created, jobs run, or comments are posted, the activity will appear here.
      </p>
    </div>
  );
}
