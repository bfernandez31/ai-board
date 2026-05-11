import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface AnalysisControlsProps {
  onRunAnalysis: () => void
  isRunning: boolean
}

export default function AnalysisControls({ onRunAnalysis, isRunning }: AnalysisControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button 
        onClick={onRunAnalysis}
        disabled={isRunning}
        className="flex items-center gap-2"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <span>Run new analysis</span>
          </>
        )}
      </Button>
    </div>
  )
}
