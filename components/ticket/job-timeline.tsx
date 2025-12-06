'use client';

import type { TicketJobWithStats } from '@/lib/types/job-types';
import { JobTimelineRow } from './job-timeline-row';

interface JobTimelineProps {
  jobs: TicketJobWithStats[];
}

export function JobTimeline({ jobs }: JobTimelineProps) {
  if (jobs.length === 0) {
    return null;
  }

  // Jobs are already sorted by startedAt from the API (oldest first)
  return (
    <div className="space-y-2">
      <h3 className="text-sm text-[#a6adc8] uppercase tracking-wider font-bold">
        Job History
      </h3>
      <div className="bg-[#1e1e2e] border border-[#313244] rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="px-3 py-2 bg-[#181825] border-b border-[#313244] flex items-center gap-3">
          <div className="w-4 flex-shrink-0" />
          <div className="w-4 flex-shrink-0" />
          <div className="flex-1 text-xs text-[#6c7086] uppercase tracking-wider">
            Stage
          </div>
          <div className="w-16 text-xs text-[#6c7086] uppercase tracking-wider text-right">
            Duration
          </div>
          <div className="w-16 text-xs text-[#6c7086] uppercase tracking-wider text-right">
            Cost
          </div>
          <div className="w-24 text-xs text-[#6c7086] uppercase tracking-wider text-right">
            Model
          </div>
        </div>

        {/* Job rows */}
        {jobs.map((job) => (
          <JobTimelineRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
