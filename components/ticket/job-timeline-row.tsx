'use client';

import { useState } from 'react';
import { Check, X, Clock, Loader2, Ban, ChevronDown, ChevronRight } from 'lucide-react';
import type { TicketJobWithStats } from '@/lib/types/job-types';
import { formatDuration, formatCost, formatNumber } from '@/lib/analytics/aggregations';
import { getStageFromCommand } from '@/lib/analytics/aggregations';

interface JobTimelineRowProps {
  job: TicketJobWithStats;
}

interface StatusConfig {
  icon: React.ReactNode;
  textColor: string;
  bgColor: string;
}

const defaultConfig: StatusConfig = {
  icon: <Clock className="w-4 h-4" />,
  textColor: 'text-[#a6adc8]',
  bgColor: 'bg-[#a6adc8]/10',
};

const statusConfig: Record<string, StatusConfig> = {
  COMPLETED: {
    icon: <Check className="w-4 h-4" />,
    textColor: 'text-[#a6e3a1]',
    bgColor: 'bg-[#a6e3a1]/10',
  },
  FAILED: {
    icon: <X className="w-4 h-4" />,
    textColor: 'text-[#f38ba8]',
    bgColor: 'bg-[#f38ba8]/10',
  },
  CANCELLED: {
    icon: <Ban className="w-4 h-4" />,
    textColor: 'text-[#6c7086]',
    bgColor: 'bg-[#6c7086]/10',
  },
  RUNNING: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    textColor: 'text-[#89b4fa]',
    bgColor: 'bg-[#89b4fa]/10',
  },
  PENDING: defaultConfig,
};

export function JobTimelineRow({ job }: JobTimelineRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const config = statusConfig[job.status] ?? defaultConfig;
  const stage = getStageFromCommand(job.command);

  // Determine if we have token data to show
  const hasTokenData =
    job.inputTokens !== null ||
    job.outputTokens !== null ||
    job.cacheReadTokens !== null ||
    job.cacheCreationTokens !== null;

  const isExpandable = hasTokenData;

  return (
    <div className="border-b border-[#313244] last:border-b-0">
      <button
        onClick={() => isExpandable && setIsExpanded(!isExpanded)}
        disabled={!isExpandable}
        className={`w-full px-3 py-2.5 flex items-center gap-3 transition-colors
          ${isExpandable ? 'hover:bg-[#313244]/50 cursor-pointer' : 'cursor-default'}
        `}
        aria-expanded={isExpanded}
        aria-label={`${job.command} job, status ${job.status}`}
      >
        {/* Expand/Collapse indicator */}
        <div className="w-4 flex-shrink-0">
          {isExpandable &&
            (isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#6c7086]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#6c7086]" />
            ))}
        </div>

        {/* Status icon */}
        <div className={`flex-shrink-0 ${config.textColor}`}>{config.icon}</div>

        {/* Stage/Command */}
        <div className="flex-1 min-w-0 text-left">
          <span className="text-sm font-medium text-[#cdd6f4]">
            {stage || job.command}
          </span>
          <span className="text-xs text-[#6c7086] ml-2">{job.command}</span>
        </div>

        {/* Duration */}
        <div className="text-xs text-[#a6adc8] w-16 text-right">
          {job.durationMs !== null ? formatDuration(job.durationMs) : '—'}
        </div>

        {/* Cost */}
        <div className="text-xs text-[#a6adc8] w-16 text-right">
          {job.costUsd !== null ? formatCost(job.costUsd) : '—'}
        </div>

        {/* Model - truncate long names */}
        <div className="text-xs text-[#6c7086] w-24 text-right truncate">
          {job.model || '—'}
        </div>
      </button>

      {/* Expanded content - token breakdown */}
      {isExpanded && hasTokenData && (
        <div className="px-3 pb-3 pl-10">
          <div className="bg-[#1e1e2e] rounded-lg p-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-[#6c7086] mb-0.5">Input Tokens</p>
              <p className="text-sm font-medium text-[#cdd6f4]">
                {job.inputTokens !== null ? formatNumber(job.inputTokens) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6c7086] mb-0.5">Output Tokens</p>
              <p className="text-sm font-medium text-[#cdd6f4]">
                {job.outputTokens !== null ? formatNumber(job.outputTokens) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6c7086] mb-0.5">Cache Read</p>
              <p className="text-sm font-medium text-[#cdd6f4]">
                {job.cacheReadTokens !== null
                  ? formatNumber(job.cacheReadTokens)
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6c7086] mb-0.5">Cache Created</p>
              <p className="text-sm font-medium text-[#cdd6f4]">
                {job.cacheCreationTokens !== null
                  ? formatNumber(job.cacheCreationTokens)
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
