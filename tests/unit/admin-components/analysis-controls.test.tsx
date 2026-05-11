import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AnalysisControls from '../../../components/admin/analysis-controls'
import React from 'react'

describe('Analysis Controls Component Tests', () => {
  it('should render run analysis button', () => {
    render(<AnalysisControls onRunAnalysis={() => {}} isRunning={false} />)
    expect(screen.getByText(/run new analysis/i)).toBeInTheDocument()
  })

  it('should show loading state when analysis is running', () => {
    render(<AnalysisControls onRunAnalysis={() => {}} isRunning={true} />)
    expect(screen.getByText(/analyzing.../i)).toBeInTheDocument()
  })

  it('should call onRunAnalysis when button is clicked', () => {
    const mockHandler = vitest.fn()
    render(<AnalysisControls onRunAnalysis={mockHandler} isRunning={false} />)
    fireEvent.click(screen.getByText(/run new analysis/i))
    expect(mockHandler).toHaveBeenCalled()
  })

  it('should disable button when analysis is running', () => {
    render(<AnalysisControls onRunAnalysis={() => {}} isRunning={true} />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })
})
