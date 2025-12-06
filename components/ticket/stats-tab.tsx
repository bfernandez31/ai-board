'use client';

import { useMemo } from 'react';
import type { TicketJobWithStats } from '@/lib/types/job-types';
import { calculateTicketStats } from '@/lib/stats/ticket-stats';
import { StatsSummaryCards } from './stats-summary-cards';
import { JobTimeline } from './job-timeline';
import { ToolsUsageSection } from './tools-usage-section';

interface StatsTabProps {
  jobs: TicketJobWithStats[];
}

export function StatsTab({ jobs }: StatsTabProps) {
  const stats = useMemo(() => calculateTicketStats(jobs), [jobs]);

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[#6c7086]">
        <p>No workflow jobs to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatsSummaryCards stats={stats} />
      <JobTimeline jobs={jobs} />
      <ToolsUsageSection toolUsage={stats.toolUsage} />
    </div>
  );
}
