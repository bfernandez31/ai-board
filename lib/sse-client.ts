'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { JobStatusUpdate } from './sse-schemas'
import { parseJobStatusUpdate } from './sse-schemas'

/**
 * SSE Connection Status
 */
export type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * useSSE Hook Options
 */
export interface UseSSEOptions {
  /**
   * Project ID to subscribe to
   */
  projectId: number

  /**
   * SSE URL (defaults to /api/sse)
   */
  url?: string

  /**
   * Enable connection
   * @default true
   */
  enabled?: boolean
}

/**
 * useSSE Hook Result
 */
export interface UseSSEResult {
  /**
   * Current connection status
   */
  status: SSEStatus

  /**
   * Job status updates (keyed by ticketId)
   */
  jobUpdates: Map<number, JobStatusUpdate>

  /**
   * Manually reconnect
   */
  reconnect: () => void
}

/**
 * useSSE Hook
 *
 * Manages Server-Sent Events connection lifecycle and job status updates.
 * Much simpler than WebSocket - EventSource API handles reconnection automatically!
 *
 * Features:
 * - Automatic connection on mount
 * - Automatic reconnection with exponential backoff (built into EventSource)
 * - Message validation with Zod
 * - Cleanup on unmount
 */
export function useSSE(options: UseSSEOptions): UseSSEResult {
  const { projectId, url = '/api/sse', enabled = true } = options

  const [status, setStatus] = useState<SSEStatus>('connecting')
  const [jobUpdates, setJobUpdates] = useState<Map<number, JobStatusUpdate>>(new Map())

  const eventSourceRef = useRef<EventSource | null>(null)

  // Build SSE URL with projectId
  const sseUrl = `${url}?projectId=${projectId}`

  // Connect to SSE
  const connect = useCallback(() => {
    if (typeof window === 'undefined') {
      console.log('[SSE Client] Skipping connection - window undefined')
      return
    }

    if (!enabled) {
      console.log('[SSE Client] SSE disabled - setting disconnected status')
      setStatus('disconnected')
      return
    }

    try {
      console.log('[SSE Client] Attempting to connect to:', sseUrl)
      setStatus('connecting')

      const eventSource = new EventSource(sseUrl)
      eventSourceRef.current = eventSource

      console.log('[SSE Client] EventSource created, initial readyState:', eventSource.readyState)

      // Expose for testing (allows Playwright tests to inspect connection state)
      if (typeof window !== 'undefined') {
        (window as any).__eventSource = eventSource
        console.log('[SSE Client] EventSource exposed on window, readyState:', eventSource.readyState)
      }

      eventSource.onopen = () => {
        console.log('[SSE Client] Connected, readyState:', eventSource.readyState)
        setStatus('connected')
        // Update exposed instance after connection
        if (typeof window !== 'undefined') {
          (window as any).__eventSource = eventSource
        }
      }

      eventSource.onmessage = (event) => {
        try {
          const rawData = JSON.parse(event.data)

          // Validate with Zod
          const update = parseJobStatusUpdate(rawData)

          if (!update) {
            console.error('[SSE Client] Invalid message received')
            return
          }

          // Update job status map
          setJobUpdates((prev) => {
            const next = new Map(prev)
            next.set(update.ticketId, update)
            console.log('[SSE Client] Updated jobUpdates Map, size:', next.size, 'entries:', Array.from(next.entries()))
            return next
          })

          console.log('[SSE Client] Job status update received:', update)
        } catch (error) {
          console.error('[SSE Client] Message parse error:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('[SSE Client] Connection error:', error)
        setStatus('error')

        // EventSource automatically reconnects with exponential backoff
        // We just need to update the status
        setTimeout(() => {
          if (eventSource.readyState === EventSource.CONNECTING) {
            setStatus('connecting')
          } else if (eventSource.readyState === EventSource.CLOSED) {
            setStatus('disconnected')
          }
        }, 1000)
      }
    } catch (error) {
      console.error('[SSE Client] Connection failed:', error)
      setStatus('error')
    }
  }, [sseUrl, enabled])

  // Connect on mount
  useEffect(() => {
    connect()

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log('[SSE Client] Closing connection')
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    connect()
  }, [connect])

  return {
    status,
    jobUpdates,
    reconnect,
  }
}
