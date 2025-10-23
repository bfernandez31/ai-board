'use client'

import { Clock, Pen, CheckCircle2, XCircle, Ban, Cog, MessageSquare } from 'lucide-react'
import { JobStatus } from '@prisma/client'
import { cn } from '@/lib/utils'
import { JobType } from '@/lib/types/job-types'
import { getJobTypeConfig } from '@/lib/utils/job-type-classifier'

/**
 * JobStatusIndicator Component Props
 */
export interface JobStatusIndicatorProps {
  /**
   * Current job status to display
   */
  status: JobStatus

  /**
   * Job command for context (e.g., "specify", "plan", "build")
   */
  command: string

  /**
   * Optional: Job type for visual distinction
   * If not provided, no job type indicator is rendered
   */
  jobType?: JobType

  /**
   * Optional CSS class name for styling
   */
  className?: string

  /**
   * Whether to show animation (for RUNNING status)
   * @default true
   */
  animated?: boolean

  /**
   * Accessibility label for screen readers
   */
  ariaLabel?: string
}

/**
 * JobStatusIndicator Component
 *
 * Displays job status with animated visual indicators.
 * Implements the visual states defined in contracts/component-interfaces.md
 *
 * Features:
 * - 5 distinct status states with unique icons and colors
 * - GPU-accelerated animation for RUNNING status
 * - Respects prefers-reduced-motion media query
 * - Full accessibility support
 */
export function JobStatusIndicator({
  status,
  command,
  jobType,
  className,
  animated = true,
  ariaLabel,
}: JobStatusIndicatorProps) {
  // Map status to icon, color, and animation
  const statusConfig = getStatusConfig(status)

  // Get job type config if jobType is provided
  const jobTypeConfig = jobType ? getJobTypeConfig(jobType) : null

  // Build aria label
  const statusLabel = ariaLabel || `Job ${command} is ${status.toLowerCase()}`
  const jobTypeLabel = jobTypeConfig ? `. ${jobTypeConfig.ariaLabel}` : ''
  const finalAriaLabel = `${statusLabel}${jobTypeLabel}`

  // Apply animation only for RUNNING status and if animated is true
  const shouldAnimate = status === 'RUNNING' && animated

  // Icon component mapping
  const JobTypeIcon = jobTypeConfig
    ? jobTypeConfig.iconName === 'Cog'
      ? Cog
      : MessageSquare
    : null

  return (
    <div
      data-testid="job-status-indicator"
      className={cn(
        'flex items-center gap-3',
        className
      )}
      role="img"
      aria-label={finalAriaLabel}
    >
      {/* Status indicator (existing) */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex items-center justify-center',
            shouldAnimate && 'animate-quill-writing'
          )}
          style={
            shouldAnimate
              ? {
                  willChange: 'transform',
                }
              : undefined
          }
        >
          {statusConfig.icon}
        </div>
        <span className={cn('text-sm font-medium', statusConfig.textColor)}>
          {status}
        </span>
      </div>

      {/* Job type indicator (new) */}
      {jobTypeConfig && JobTypeIcon && (
        <div
          data-testid="job-type-indicator"
          className="flex items-center gap-1.5 text-xs"
        >
          <JobTypeIcon
            className={cn('h-4 w-4', jobTypeConfig.iconColor)}
          />
          <span className={cn('font-medium', jobTypeConfig.textColor)}>
            {jobTypeConfig.label}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Get Status Configuration
 *
 * Maps status to icon component, colors, and visual properties.
 */
function getStatusConfig(status: JobStatus) {
  const configs = {
    PENDING: {
      icon: <Clock className="h-4 w-4 text-gray-500" />,
      textColor: 'text-gray-500',
      bgColor: 'bg-gray-100',
    },
    RUNNING: {
      icon: <Pen className="h-4 w-4 text-blue-500" />,
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-100',
    },
    COMPLETED: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      textColor: 'text-green-500',
      bgColor: 'bg-green-100',
    },
    FAILED: {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      textColor: 'text-red-500',
      bgColor: 'bg-red-100',
    },
    CANCELLED: {
      icon: <Ban className="h-4 w-4 text-gray-400" />,
      textColor: 'text-gray-400',
      bgColor: 'bg-gray-100',
    },
  }

  return configs[status]
}
