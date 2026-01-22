'use client';

/**
 * Activity Empty State Component
 * Feature: AIB-181-copy-of-project
 *
 * Displays centered message when no activity exists in the 30-day window
 */

import { Activity } from 'lucide-react';

export function ActivityEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Activity className="w-12 h-12 text-subtext0 mb-4" />
      <h3 className="text-lg font-medium text-text">No activity yet</h3>
      <p className="text-sm text-subtext0 mt-2">
        No activity in the last 30 days
      </p>
    </div>
  );
}
