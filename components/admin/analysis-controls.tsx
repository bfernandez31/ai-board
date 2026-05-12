'use client'

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface AnalysisControlsProps {
  onRunAnalysis: () => void
  isRunning: boolean
}

export default function AnalysisControls({ onRunAnalysis, isRunning }: AnalysisControlsProps) {
  return (
    <Button onClick={onRunAnalysis} disabled={isRunning} className="gap-2">
      {isRunning ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analyzing...</span>
        </>
      ) : (
        'Run new analysis'
      )}
    </Button>
  )
}
