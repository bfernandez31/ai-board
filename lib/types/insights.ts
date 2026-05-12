export type AnalysisType = 'CODE_QUALITY' | 'PERFORMANCE' | 'SECURITY' | 'ARCHITECTURE'

export type ReportStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface InsightsReport {
  id: string
  createdAt: Date
  analysisType: AnalysisType
  status: ReportStatus
  metadata: {
    ticketCount: number
    linesAnalyzed: number
    filesAnalyzed: number
    findingsCount: number
    [key: string]: unknown
  }
  content?: string
  blobUrl?: string
}

export interface AnalysisJob {
  id: string
  reportId: string
  status: ReportStatus
  createdAt: Date
  updatedAt: Date
  progress?: number
  error?: string
}

export interface ClaudeAnalysisRequest {
  tickets: string[]
  analysisType: AnalysisType
  force?: boolean
}

export interface ClaudeAnalysisResponse {
  reportId: string
  jobId: string
  status: ReportStatus
}
