import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InsightsPage from '../../../components/admin/insights-page'
import React from 'react'

describe('Insights Page Component Tests', () => {
  it('should render loading state initially', () => {
    render(<InsightsPage loading={true} report={null} error={null} />)
    // Using skeleton components for loading state - check for animate-pulse class
    const skeletonElements = screen.getAllByText((content, element) => {
      const el = element as HTMLElement
      return el.classList.contains('animate-pulse')
    })
    expect(skeletonElements).toHaveLength(3)
  })

  it('should render error state when error occurs', () => {
    render(<InsightsPage loading={false} report={null} error="Failed to load report" />)
    expect(screen.getByText(/failed to load report/i)).toBeInTheDocument()
  })

  it('should render report data when available', () => {
    const mockReport = {
      id: 'report-1',
      createdAt: new Date(),
      analysisType: 'CODE_QUALITY',
      status: 'COMPLETED',
      metadata: { ticketCount: 10, linesAnalyzed: 1000 }
    }
    render(<InsightsPage loading={false} report={mockReport} error={null} />)
    expect(screen.getByText(/CODE_QUALITY/i)).toBeInTheDocument()
    expect(screen.getByText(/Claude Code Insights Report/i)).toBeInTheDocument()
  })

  it('should show access denied when user has no access', () => {
    render(<InsightsPage loading={false} report={null} error={null} hasAccess={false} />)
    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
  })
})
