'use client'

import { Clock, Pen, CheckCircle2, XCircle, Ban, Cog, MessageSquare, BotMessageSquare, Rocket } from 'lucide-react'
import { JobStatus } from '@prisma/client'
import { cn } from '@/lib/utils'
import { JobType } from '@/lib/types/job-types'
import { getJobTypeConfig } from '@/lib/utils/job-type-classifier'
import { getContextualLabel } from '@/lib/utils/job-label-transformer'
import { formatTimestamp } from '@/lib/utils/format-timestamp'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
   * Optional: Current ticket stage for context (e.g., "SPECIFY", "PLAN")
   * Used to display stage name before status label
   */
  stage?: string

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

  /**
   * Optional: Timestamp when job completed (for AI-BOARD tooltips)
   * Used to format human-readable completion time in tooltips
   */
  completedAt?: Date | string | null
}

/**
 * Get AI-BOARD icon color based on status
 */
function getAIBoardColor(status: JobStatus): string {
  switch (status) {
    case 'PENDING':
    case 'RUNNING':
    case 'COMPLETED':
      return 'text-purple-500'
    case 'FAILED':
      return 'text-red-500'
    case 'CANCELLED':
      return 'text-gray-500'
    default:
      return 'text-purple-500'
  }
}

/**
 * Get AI-BOARD tooltip text based on status
 */
function getAIBoardTooltip(status: JobStatus, completedAt?: Date | string | null): string {
  switch (status) {
    case 'PENDING':
      return 'AI-BOARD is preparing...'
    case 'RUNNING':
      return 'AI-BOARD is working on this ticket'
    case 'COMPLETED':
      return `AI-BOARD assisted on ${formatTimestamp(completedAt || null)}`
    case 'FAILED':
      return 'AI-BOARD assistance failed'
    case 'CANCELLED':
      return 'AI-BOARD assistance cancelled'
    default:
      return 'AI-BOARD status unknown'
  }
}

/**
 * Get AI-BOARD ARIA label based on status
 */
function getAIBoardAriaLabel(status: JobStatus): string {
  switch (status) {
    case 'PENDING':
      return 'AI-BOARD is preparing'
    case 'RUNNING':
      return 'AI-BOARD is working on this ticket'
    case 'COMPLETED':
      return 'AI-BOARD assistance completed'
    case 'FAILED':
      return 'AI-BOARD assistance failed'
    case 'CANCELLED':
      return 'AI-BOARD assistance cancelled'
    default:
      return 'AI-BOARD status unknown'
  }
}

/**
 * Get Deploy icon color based on status
 * Blue for pending/running, green for completed, red for failed
 */
function getDeployColor(status: JobStatus): string {
  switch (status) {
    case 'PENDING':
    case 'RUNNING':
      return 'text-blue-500'
    case 'COMPLETED':
      return 'text-green-500'
    case 'FAILED':
      return 'text-red-500'
    case 'CANCELLED':
      return 'text-gray-500'
    default:
      return 'text-blue-500'
  }
}

/**
 * Get Deploy tooltip text based on status
 */
function getDeployTooltip(status: JobStatus, completedAt?: Date | string | null): string {
  switch (status) {
    case 'PENDING':
      return 'Deploy preview is preparing...'
    case 'RUNNING':
      return 'Deploying preview to Vercel...'
    case 'COMPLETED':
      return `Deploy completed on ${formatTimestamp(completedAt || null)}`
    case 'FAILED':
      return 'Deploy preview failed'
    case 'CANCELLED':
      return 'Deploy preview cancelled'
    default:
      return 'Deploy status unknown'
  }
}

/**
 * Get Deploy ARIA label based on status
 */
function getDeployAriaLabel(status: JobStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Deploy preview is preparing'
    case 'RUNNING':
      return 'Deploying preview to Vercel'
    case 'COMPLETED':
      return 'Deploy preview completed'
    case 'FAILED':
      return 'Deploy preview failed'
    case 'CANCELLED':
      return 'Deploy preview cancelled'
    default:
      return 'Deploy status unknown'
  }
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
 * - Compact icon-only mode for AI-BOARD jobs with tooltips
 */
export function JobStatusIndicator({
  status,
  command,
  jobType,
  stage,
  className,
  animated = true,
  ariaLabel,
  completedAt,
}: JobStatusIndicatorProps) {
  // Get contextual label (transforms RUNNING to WRITING/CODING/ASSISTING)
  const displayLabel = getContextualLabel(command, status)

  // Map status to icon, color, and animation
  const statusConfig = getStatusConfig(status)

  // Get job type config if jobType is provided
  const jobTypeConfig = jobType ? getJobTypeConfig(jobType) : null

  // Determine prefix text (stage name for workflow, "AI-BOARD" for AI-BOARD jobs)
  const prefixText = jobType === JobType.AI_BOARD ? 'AI-BOARD' : stage

  // Build aria label
  const statusLabel = ariaLabel || `Job ${command} is ${displayLabel.toLowerCase()}`
  const jobTypeLabel = jobTypeConfig ? `. ${jobTypeConfig.ariaLabel}` : ''
  const finalAriaLabel = `${statusLabel}${jobTypeLabel}`

  // Apply animation only for RUNNING status and if animated is true
  const shouldAnimate = status === 'RUNNING' && animated

  // Icon component mapping
  function resolveJobTypeIcon() {
    if (!jobTypeConfig) return null
    switch (jobTypeConfig.iconName) {
      case 'Cog': return Cog
      case 'Rocket': return Rocket
      default: return MessageSquare
    }
  }
  const JobTypeIcon = resolveJobTypeIcon()

  // Color for icon + prefix (blue for workflow, purple for AI-BOARD)
  const prefixColor = jobType === JobType.AI_BOARD
    ? 'text-purple-500'
    : 'text-blue-500'

  // AI-BOARD and DEPLOY compact modes: Icon-only with tooltip
  if (jobType === JobType.AI_BOARD || jobType === JobType.DEPLOY) {
    const isAIBoard = jobType === JobType.AI_BOARD
    const Icon = isAIBoard ? BotMessageSquare : Rocket
    const iconColor = isAIBoard ? getAIBoardColor(status) : getDeployColor(status)
    const tooltipText = isAIBoard ? getAIBoardTooltip(status, completedAt) : getDeployTooltip(status, completedAt)
    const compactAriaLabel = isAIBoard ? getAIBoardAriaLabel(status) : getDeployAriaLabel(status)
    const shouldBounce = status === 'PENDING' || status === 'RUNNING'

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              data-testid="job-status-indicator"
              className={cn('cursor-help', className)}
              role="img"
              aria-label={compactAriaLabel}
            >
              <Icon
                className={cn(
                  'h-5 w-5',
                  iconColor,
                  shouldBounce && 'animate-bounce'
                )}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Workflow mode: Standard display (US1: simplified without prefix)
  return (
    <div
      data-testid="job-status-indicator"
      className={cn(
        'flex items-center gap-1.5',
        className
      )}
      role="img"
      aria-label={finalAriaLabel}
    >
      {/* Icon + Stage/Type prefix - SKIP for WORKFLOW jobs (US1: simplified display) */}
      {jobTypeConfig && JobTypeIcon && prefixText && jobType !== JobType.WORKFLOW && (
        <div className="flex items-center gap-1">
          <JobTypeIcon className={cn('h-4 w-4', prefixColor)} />
          <span className={cn('text-sm font-medium uppercase', prefixColor)}>
            {prefixText} :
          </span>
        </div>
      )}

      {/* Status label with icon */}
      <div className="flex items-center gap-1.5">
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
          {displayLabel}
        </span>
      </div>
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
