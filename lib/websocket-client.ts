'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ServerMessage, JobStatusUpdate } from './websocket-schemas'
import { ServerMessageSchema } from './websocket-schemas'

/**
 * WebSocket Connection Status
 */
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

/**
 * useWebSocket Hook Options
 */
export interface UseWebSocketOptions {
  /**
   * WebSocket URL (defaults to window.location.origin + /api/ws)
   */
  url?: string

  /**
   * Project ID to subscribe to
   */
  projectId: number

  /**
   * Enable automatic reconnection
   * @default true
   */
  autoReconnect?: boolean

  /**
   * Maximum reconnection attempts
   * @default 5
   */
  maxReconnectAttempts?: number
}

/**
 * useWebSocket Hook Return Value
 */
export interface UseWebSocketResult {
  /**
   * Current connection status
   */
  status: WebSocketStatus

  /**
   * Job status updates (keyed by ticketId)
   */
  jobUpdates: Map<number, JobStatusUpdate>

  /**
   * Manually reconnect
   */
  reconnect: () => void

  /**
   * Send message to server
   */
  send: (message: any) => void
}

/**
 * useWebSocket Hook
 *
 * Manages WebSocket connection lifecycle, automatic reconnection,
 * and job status update state.
 *
 * Features:
 * - Automatic connection on mount
 * - Exponential backoff reconnection (1s, 2s, 4s, 8s, 16s max)
 * - Message validation with Zod
 * - Cleanup on unmount
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketResult {
  const {
    url,
    projectId,
    autoReconnect = true,
    maxReconnectAttempts = 5,
  } = options

  const [status, setStatus] = useState<WebSocketStatus>('connecting')
  const [jobUpdates, setJobUpdates] = useState<Map<number, JobStatusUpdate>>(new Map())

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  // Get WebSocket URL
  const wsUrl = url || (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws` : '')

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      setStatus('connecting')

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      // Expose for testing
      if (typeof window !== 'undefined') {
        ;(window as any).__ws = ws
      }

      ws.onopen = () => {
        setStatus('connected')
        reconnectAttemptRef.current = 0

        // Subscribe to project after connection
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            projectId,
          })
        )
      }

      ws.onmessage = (event) => {
        try {
          const rawMessage = JSON.parse(event.data)

          // Validate with Zod
          const result = ServerMessageSchema.safeParse(rawMessage)

          if (!result.success) {
            console.error('[WebSocket Client] Invalid message:', result.error)
            return
          }

          const message: ServerMessage = result.data

          // Handle job status updates
          if (message.type === 'job-status-update') {
            setJobUpdates((prev) => {
              const next = new Map(prev)
              next.set(message.ticketId, message)
              return next
            })
          }
        } catch (error) {
          console.error('[WebSocket Client] Message parse error:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket Client] Connection error:', error)
        setStatus('error')
      }

      ws.onclose = () => {
        setStatus('disconnected')

        // Attempt reconnection if enabled
        if (autoReconnect && reconnectAttemptRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 16000)
          reconnectAttemptRef.current++

          console.log(
            `[WebSocket Client] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts})`
          )

          setStatus('reconnecting')

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }
    } catch (error) {
      console.error('[WebSocket Client] Connection failed:', error)
      setStatus('error')
    }
  }, [wsUrl, projectId, autoReconnect, maxReconnectAttempts])

  // Connect on mount
  useEffect(() => {
    connect()

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0
    if (wsRef.current) {
      wsRef.current.close()
    }
    connect()
  }, [connect])

  // Send message
  const send = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  return {
    status,
    jobUpdates,
    reconnect,
    send,
  }
}
