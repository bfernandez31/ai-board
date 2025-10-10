'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useWebSocket, type UseWebSocketResult } from '@/lib/websocket-client'

/**
 * WebSocket Context Value
 */
export type WebSocketContextValue = UseWebSocketResult

/**
 * WebSocket Context
 */
const WebSocketContext = createContext<WebSocketContextValue | null>(null)

/**
 * WebSocketProvider Props
 */
export interface WebSocketProviderProps {
  /**
   * Project ID to subscribe to
   */
  projectId: number

  /**
   * Child components
   */
  children: ReactNode

  /**
   * WebSocket URL (optional)
   */
  wsUrl?: string

  /**
   * Connection status change callback (optional)
   */
  onConnectionChange?: (status: string) => void
}

/**
 * WebSocketProvider Component
 *
 * Provides WebSocket connection and job status updates to child components.
 * Automatically subscribes to project on mount.
 */
export function WebSocketProvider({
  projectId,
  children,
  wsUrl,
  onConnectionChange,
}: WebSocketProviderProps) {
  const websocket = useWebSocket({
    url: wsUrl,
    projectId,
  })

  // Notify connection status changes
  if (onConnectionChange) {
    onConnectionChange(websocket.status)
  }

  return (
    <WebSocketContext.Provider value={websocket}>
      {children}
    </WebSocketContext.Provider>
  )
}

/**
 * useWebSocketContext Hook
 *
 * Access WebSocket context from child components.
 * Throws error if used outside WebSocketProvider.
 */
export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext)

  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider')
  }

  return context
}
