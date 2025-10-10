'use client'

import { Clock, Pen, CheckCircle2, XCircle, Ban } from 'lucide-react'
import { JobStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

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
  className,
  animated = true,
  ariaLabel,
}: JobStatusIndicatorProps) {
  // Map status to icon, color, and animation
  const statusConfig = getStatusConfig(status)

  // Compute final aria label
  const finalAriaLabel =
    ariaLabel || `Job ${command} is ${status.toLowerCase()}`

  // Apply animation only for RUNNING status and if animated is true
  const shouldAnimate = status === 'RUNNING' && animated

  return (
    <div
      data-testid="job-status-indicator"
      className={cn(
        'flex items-center gap-2',
        className
      )}
      role="img"
      aria-label={finalAriaLabel}
    >
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
