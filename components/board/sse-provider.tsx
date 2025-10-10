'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useSSE, type UseSSEResult } from '@/lib/sse-client'

/**
 * SSE Context Value
 */
export type SSEContextValue = UseSSEResult

/**
 * SSE Context
 */
const SSEContext = createContext<SSEContextValue | null>(null)

/**
 * SSEProvider Props
 */
export interface SSEProviderProps {
  /**
   * Project ID to subscribe to
   */
  projectId: number

  /**
   * Child components
   */
  children: ReactNode

  /**
   * SSE URL (optional, defaults to /api/sse)
   */
  sseUrl?: string

  /**
   * Connection status change callback (optional)
   */
  onConnectionChange?: (status: string) => void
}

/**
 * SSEProvider Component
 *
 * Provides Server-Sent Events connection and job status updates to child components.
 * Automatically subscribes to project on mount.
 *
 * Much simpler than WebSocketProvider - no manual subscription management needed!
 */
export function SSEProvider({
  projectId,
  children,
  sseUrl,
  onConnectionChange,
}: SSEProviderProps) {
  const sse = useSSE({
    projectId,
    ...(sseUrl ? { url: sseUrl } : {}),
  })

  // Notify connection status changes
  if (onConnectionChange) {
    onConnectionChange(sse.status)
  }

  return (
    <SSEContext.Provider value={sse}>
      {children}
    </SSEContext.Provider>
  )
}

/**
 * useSSEContext Hook
 *
 * Access SSE context from child components.
 * Throws error if used outside SSEProvider.
 */
export function useSSEContext(): SSEContextValue {
  const context = useContext(SSEContext)

  if (!context) {
    throw new Error('useSSEContext must be used within SSEProvider')
  }

  return context
}
