'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { JobStatus } from '@prisma/client'
import { useSSEContext } from '@/components/board/sse-provider'

/**
 * useJobStatus Hook Options
 */
export interface UseJobStatusOptions {
  /**
   * Ticket ID to track
   */
  ticketId: number

  /**
   * Minimum display duration for each status (milliseconds)
   * @default 500
   */
  minDisplayDuration?: number

  /**
   * Enable status transitions
   * @default true
   */
  enabled?: boolean
}

/**
 * useJobStatus Hook Result
 */
export interface UseJobStatusResult {
  /**
   * Current displayed status (may be delayed)
   */
  displayStatus: JobStatus | null

  /**
   * Actual latest status from SSE
   */
  actualStatus: JobStatus | null

  /**
   * Whether status transition is in progress
   */
  isTransitioning: boolean

  /**
   * Job command
   */
  command: string | null

  /**
   * Force immediate status update (skip delay)
   */
  forceUpdate: () => void
}

/**
 * useJobStatus Hook
 *
 * Manages job status display with minimum display duration enforcement.
 * Prevents rapid status flickering by ensuring each status displays
 * for at least 500ms (configurable).
 *
 * Features:
 * - Enforces minimum display duration (default 500ms)
 * - First status displays immediately
 * - Subsequent changes are delayed
 * - Cleanup cancels pending timeouts
 */
export function useJobStatus(options: UseJobStatusOptions): UseJobStatusResult {
  const { ticketId, minDisplayDuration = 500, enabled = true } = options

  const { jobUpdates } = useSSEContext()

  const [displayStatus, setDisplayStatus] = useState<JobStatus | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const timeoutRef = useRef<NodeJS.Timeout>()

  // Get actual status from SSE
  const actualUpdate = jobUpdates.get(ticketId)
  const actualStatus = actualUpdate?.status ?? null
  const command = actualUpdate?.command ?? null

  // Handle status changes with delay
  useEffect(() => {
    if (!enabled || !actualStatus) return

    // First status: display immediately (no delay)
    if (!displayStatus || minDisplayDuration === 0) {
      setDisplayStatus(actualStatus)
      setIsTransitioning(false)
      return
    }

    // Status hasn't changed
    if (actualStatus === displayStatus) {
      setIsTransitioning(false)
      return
    }

    // Status changed: enforce minimum display duration
    setIsTransitioning(true)

    timeoutRef.current = setTimeout(() => {
      setDisplayStatus(actualStatus)
      setIsTransitioning(false)
    }, minDisplayDuration)

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [actualStatus, enabled, minDisplayDuration, displayStatus])

  // Force immediate update (skip delay)
  const forceUpdate = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setDisplayStatus(actualStatus)
    setIsTransitioning(false)
  }, [actualStatus])

  return {
    displayStatus,
    actualStatus,
    isTransitioning,
    command,
    forceUpdate,
  }
}
