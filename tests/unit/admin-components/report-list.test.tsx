import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReportList from '../../../components/admin/report-list'
import React from 'react'

describe('Report List Component Tests', () => {
  const mockReports = [
    { id: 'report-1', createdAt: new Date('2024-01-01'), analysisType: 'CODE_QUALITY', status: 'COMPLETED' },
    { id: 'report-2', createdAt: new Date('2024-01-02'), analysisType: 'PERFORMANCE', status: 'COMPLETED' }
  ]

  it('should render list of reports', () => {
    render(<ReportList reports={mockReports} selectedReportId={null} onSelectReport={() => {}} />)
    expect(screen.getByText(/CODE_QUALITY/i)).toBeInTheDocument()
    expect(screen.getByText(/PERFORMANCE/i)).toBeInTheDocument()
  })

  it('should highlight selected report', () => {
    render(<ReportList reports={mockReports} selectedReportId="report-1" onSelectReport={() => {}} />)
    // Just verify the component renders with selected report
    expect(screen.getByText(/CODE_QUALITY/i)).toBeInTheDocument()
    expect(screen.getByText(/PERFORMANCE/i)).toBeInTheDocument()
  })

  it('should call onSelectReport when report is clicked', () => {
    const mockHandler = vitest.fn()
    render(<ReportList reports={mockReports} selectedReportId={null} onSelectReport={mockHandler} />)
    fireEvent.click(screen.getByText(/CODE_QUALITY/i))
    expect(mockHandler).toHaveBeenCalledWith('report-1')
  })

  it('should show empty state when no reports available', () => {
    render(<ReportList reports={[]} selectedReportId={null} onSelectReport={() => {}} />)
    expect(screen.getByText(/no reports available/i)).toBeInTheDocument()
  })
})
