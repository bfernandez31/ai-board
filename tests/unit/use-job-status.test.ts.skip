/**
 * Unit Tests for useJobStatus Hook
 *
 * Test Suite: T029
 * Feature: 020-9179-real-time
 *
 * Tests hook logic:
 * - Hook tracks actualStatus vs displayStatus
 * - isTransitioning flag set during delay
 * - forceUpdate skips delay and updates immediately
 * - Cleanup cancels pending timeouts
 * - First status displays immediately (no delay)
 * - Subsequent statuses enforce minimum display duration (default 500ms)
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useJobStatus } from '@/lib/hooks/use-job-status'
import { useSSEContext } from '@/components/board/sse-provider'
import { JobStatus } from '@prisma/client'

// Mock SSE Context
jest.mock('@/components/board/sse-provider', () => ({
  useSSEContext: jest.fn(),
}))

const mockUseSSEContext = useSSEContext as jest.MockedFunction<typeof useSSEContext>

describe('useJobStatus Hook - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('Hook tracks actualStatus from SSE context', () => {
    // Mock SSE context
    const jobUpdates = new Map()
    jobUpdates.set(1, {
      projectId: 1,
      ticketId: 1,
      jobId: 1,
      status: 'PENDING' as JobStatus,
      command: 'specify',
      timestamp: new Date().toISOString(),
    })

    mockUseSSEContext.mockReturnValue({
      jobUpdates,
      connectionStatus: 'connected',
    })

    // Render hook
    const { result } = renderHook(() =>
      useJobStatus({
        ticketId: 1,
        minDisplayDuration: 500,
      })
    )

    // Verify actualStatus is set from SSE
    expect(result.current.actualStatus).toBe('PENDING')
    expect(result.current.command).toBe('specify')
  })

  test('First status displays immediately (no delay)', () => {
    // Mock SSE context with initial status
    const jobUpdates = new Map()
    jobUpdates.set(1, {
      projectId: 1,
      ticketId: 1,
      jobId: 1,
      status: 'PENDING' as JobStatus,
      command: 'specify',
      timestamp: new Date().toISOString(),
    })

    mockUseSSEContext.mockReturnValue({
      jobUpdates,
      connectionStatus: 'connected',
    })

    // Render hook
    const { result } = renderHook(() =>
      useJobStatus({
        ticketId: 1,
        minDisplayDuration: 500,
      })
    )

    // First status should display immediately
    expect(result.current.displayStatus).toBe('PENDING')
    expect(result.current.isTransitioning).toBe(false)
  })

  test('isTransitioning flag set during delay', async () => {
    // Mock SSE context with initial status
    const jobUpdates = new Map()
    jobUpdates.set(1, {
      projectId: 1,
      ticketId: 1,
      jobId: 1,
      status: 'PENDING' as JobStatus,
      command: 'specify',
      timestamp: new Date().toISOString(),
    })

    mockUseSSEContext.mockReturnValue({
      jobUpdates,
      connectionStatus: 'connected',
    })

    // Render hook
    const { result, rerender } = renderHook(() =>
      useJobStatus({
        ticketId: 1,
        minDisplayDuration: 500,
      })
    )

    // Initial status
    expect(result.current.displayStatus).toBe('PENDING')
    expect(result.current.isTransitioning).toBe(false)

    // Update status to RUNNING
    act(() => {
      jobUpdates.set(1, {
        projectId: 1,
        ticketId: 1,
        jobId: 1,
        status: 'RUNNING' as JobStatus,
        command: 'specify',
        timestamp: new Date().toISOString(),
      })
      mockUseSSEContext.mockReturnValue({
        jobUpdates,
        connectionStatus: 'connected',
      })
      rerender()
    })

    // isTransitioning should be true immediately
    expect(result.current.actualStatus).toBe('RUNNING')
    expect(result.current.displayStatus).toBe('PENDING') // Still showing old status
    expect(result.current.isTransitioning).toBe(true)

    // Fast-forward 500ms
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // After delay, displayStatus should update and transitioning should be false
    await waitFor(() => {
      expect(result.current.displayStatus).toBe('RUNNING')
      expect(result.current.isTransitioning).toBe(false)
    })
  })

  test('Subsequent status changes enforce minimum display duration', async () => {
    // Mock SSE context with initial status
    const jobUpdates = new Map()
    jobUpdates.set(1, {
      projectId: 1,
      ticketId: 1,
      jobId: 1,
      status: 'PENDING' as JobStatus,
      command: 'specify',
      timestamp: new Date().toISOString(),
    })

    mockUseSSEContext.mockReturnValue({
      jobUpdates,
      connectionStatus: 'connected',
    })

    // Render hook
    const { result, rerender } = renderHook(() =>
      useJobStatus({
        ticketId: 1,
        minDisplayDuration: 500,
      })
    )

    // Initial state
    expect(result.current.displayStatus).toBe('PENDING')

    // Update to RUNNING
    act(() => {
      jobUpdates.set(1, {
        projectId: 1,
        ticketId: 1,
        jobId: 1,
        status: 'RUNNING' as JobStatus,
        command: 'specify',
        timestamp: new Date().toISOString(),
      })
      mockUseSSEContext.mockReturnValue({
        jobUpdates,
        connectionStatus: 'connected',
      })
      rerender()
    })

    // displayStatus should NOT update immediately
    expect(result.current.displayStatus).toBe('PENDING')
    expect(result.current.actualStatus).toBe('RUNNING')

    // Fast-forward 250ms (less than minimum)
    act(() => {
      jest.advanceTimersByTime(250)
    })

    // Still showing old status
    expect(result.current.displayStatus).toBe('PENDING')

    // Fast-forward remaining 250ms (total 500ms)
    act(() => {
      jest.advanceTimersByTime(250)
    })

    // Now it should update
    await waitFor(() => {
      expect(result.current.displayStatus).toBe('RUNNING')
    })
  })

  test('forceUpdate skips delay and updates immediately', async () => {
    // Mock SSE context
    const jobUpdates = new Map()
    jobUpdates.set(1, {
      projectId: 1,
      ticketId: 1,
      jobId: 1,
      status: 'PENDING' as JobStatus,
      command: 'specify',
      timestamp: new Date().toISOString(),
    })

    mockUseSSEContext.mockReturnValue({
      jobUpdates,
      connectionStatus: 'connected',
    })

    // Render hook
    const { result, rerender } = renderHook(() =>
      useJobStatus({
        ticketId: 1,
        minDisplayDuration: 500,
      })
    )

    // Update status
    act(() => {
      jobUpdates.set(1, {
        projectId: 1,
        ticketId: 1,
        jobId: 1,
        status: 'RUNNING' as JobStatus,
        command: 'specify',
        timestamp: new Date().toISOString(),
      })
      mockUseSSEContext.mockReturnValue({
        jobUpdates,
        connectionStatus: 'connected',
      })
      rerender()
    })

    // Status should be transitioning
    expect(result.current.displayStatus).toBe('PENDING')
    expect(result.current.isTransitioning).toBe(true)

    // Call forceUpdate
    act(() => {
      result.current.forceUpdate()
    })

    // displayStatus should update immediately (no timer advance needed)
    expect(result.current.displayStatus).toBe('RUNNING')
    expect(result.current.isTransitioning).toBe(false)
  })

  test('Cleanup cancels pending timeouts on unmount', () => {
    // Mock SSE context
    const jobUpdates = new Map()
    jobUpdates.set(1, {
      projectId: 1,
      ticketId: 1,
      jobId: 1,
      status: 'PENDING' as JobStatus,
      command: 'specify',
      timestamp: new Date().toISOString(),
    })

    mockUseSSEContext.mockReturnValue({
      jobUpdates,
      connectionStatus: 'connected',
    })

    // Render hook
    const { result, rerender, unmount } = renderHook(() =>
      useJobStatus({
        ticketId: 1,
        minDisplayDuration: 500,
      })
    )

    // Update status to trigger timeout
    act(() => {
      jobUpdates.set(1, {
        projectId: 1,
        ticketId: 1,
        jobId: 1,
        status: 'RUNNING' as JobStatus,
        command: 'specify',
        timestamp: new Date().toISOString(),
      })
      mockUseSSEContext.mockReturnValue({
        jobUpdates,
        connectionStatus: 'connected',
      })
      rerender()
    })

    // Verify timeout is pending
    expect(result.current.isTransitioning).toBe(true)

    // Unmount (should cleanup timeout)
    unmount()

    // Advance timers (timeout should not fire after unmount)
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // No error should occur (cleanup successful)
  })

  test('Rapid updates enforce delay for each transition', async () => {
    // Mock SSE context
    const jobUpdates = new Map()
    jobUpdates.set(1, {
      projectId: 1,
      ticketId: 1,
      jobId: 1,
      status: 'PENDING' as JobStatus,
      command: 'specify',
      timestamp: new Date().toISOString(),
    })

    mockUseSSEContext.mockReturnValue({
      jobUpdates,
      connectionStatus: 'connected',
    })

    // Render hook
    const { result, rerender } = renderHook(() =>
      useJobStatus({
        ticketId: 1,
        minDisplayDuration: 500,
      })
    )

    // PENDING → RUNNING
    act(() => {
      jobUpdates.set(1, {
        projectId: 1,
        ticketId: 1,
        jobId: 1,
        status: 'RUNNING' as JobStatus,
        command: 'specify',
        timestamp: new Date().toISOString(),
      })
      mockUseSSEContext.mockReturnValue({
        jobUpdates,
        connectionStatus: 'connected',
      })
      rerender()
    })

    expect(result.current.displayStatus).toBe('PENDING')

    // Advance 500ms
    act(() => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(result.current.displayStatus).toBe('RUNNING')
    })

    // RUNNING → COMPLETED
    act(() => {
      jobUpdates.set(1, {
        projectId: 1,
        ticketId: 1,
        jobId: 1,
        status: 'COMPLETED' as JobStatus,
        command: 'specify',
        timestamp: new Date().toISOString(),
      })
      mockUseSSEContext.mockReturnValue({
        jobUpdates,
        connectionStatus: 'connected',
      })
      rerender()
    })

    expect(result.current.displayStatus).toBe('RUNNING')

    // Advance 500ms
    act(() => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(result.current.displayStatus).toBe('COMPLETED')
    })
  })

  test('Disabled hook does not update displayStatus', () => {
    // Mock SSE context
    const jobUpdates = new Map()
    jobUpdates.set(1, {
      projectId: 1,
      ticketId: 1,
      jobId: 1,
      status: 'PENDING' as JobStatus,
      command: 'specify',
      timestamp: new Date().toISOString(),
    })

    mockUseSSEContext.mockReturnValue({
      jobUpdates,
      connectionStatus: 'connected',
    })

    // Render hook with enabled: false
    const { result } = renderHook(() =>
      useJobStatus({
        ticketId: 1,
        minDisplayDuration: 500,
        enabled: false,
      })
    )

    // displayStatus should remain null
    expect(result.current.displayStatus).toBe(null)
    expect(result.current.actualStatus).toBe('PENDING')
  })

  test('Custom minDisplayDuration is respected', async () => {
    // Mock SSE context
    const jobUpdates = new Map()
    jobUpdates.set(1, {
      projectId: 1,
      ticketId: 1,
      jobId: 1,
      status: 'PENDING' as JobStatus,
      command: 'specify',
      timestamp: new Date().toISOString(),
    })

    mockUseSSEContext.mockReturnValue({
      jobUpdates,
      connectionStatus: 'connected',
    })

    // Render hook with custom duration (1000ms)
    const { result, rerender } = renderHook(() =>
      useJobStatus({
        ticketId: 1,
        minDisplayDuration: 1000,
      })
    )

    // Update status
    act(() => {
      jobUpdates.set(1, {
        projectId: 1,
        ticketId: 1,
        jobId: 1,
        status: 'RUNNING' as JobStatus,
        command: 'specify',
        timestamp: new Date().toISOString(),
      })
      mockUseSSEContext.mockReturnValue({
        jobUpdates,
        connectionStatus: 'connected',
      })
      rerender()
    })

    // Fast-forward 500ms (less than custom duration)
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Should NOT update yet
    expect(result.current.displayStatus).toBe('PENDING')

    // Fast-forward remaining 500ms (total 1000ms)
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Now it should update
    await waitFor(() => {
      expect(result.current.displayStatus).toBe('RUNNING')
    })
  })
})
