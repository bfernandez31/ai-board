/**
 * Insights Analysis Workflow Contract
 * 
 * Defines the workflow for generating Claude Code Insights reports
 */

export interface InsightsAnalysisWorkflow {
  /** Workflow identifier */
  id: string
  
  /** Workflow type */
  type: 'CLAUDE_CODE_INSIGHTS'
  
  /** Input parameters */
  input: InsightsAnalysisInput
  
  /** Current state */
  state: InsightsWorkflowState
  
  /** Execution phases */
  phases: InsightsWorkflowPhase[]
  
  /** Output specification */
  output: InsightsAnalysisOutput
}

/**
 * Workflow Input
 */
export interface InsightsAnalysisInput {
  /** User ID who triggered the analysis */
  requestedBy: string
  
  /** Analysis period (optional - defaults to "since last run") */
  period?: {
    start: string // ISO 8601
    end: string // ISO 8601
  }
  
  /** Project filter (optional - defaults to all projects) */
  projectId?: number
  
  /** Session filters */
  sessionFilters?: {
    agentType?: string
    minDuration?: number
  }
}

/**
 * Workflow State
 */
export interface InsightsWorkflowState {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  currentPhase?: string
  progress: number // 0-100
  startedAt?: string // ISO 8601
  completedAt?: string // ISO 8601
  error?: WorkflowError
}

/**
 * Workflow Phases
 */
export type InsightsWorkflowPhase =
  | PreFlightPhase
  | SessionDownloadPhase
  | AnalysisExecutionPhase
  | ReportPersistencePhase
  | MetadataStoragePhase

interface BasePhase {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export interface PreFlightPhase extends BasePhase {
  id: 'pre-flight'
  name: 'Pre-flight Check'
  description: 'Verify new tickets exist since last run'
  result?: {
    hasNewTickets: boolean
    lastRunAt?: string
    ticketCountSinceLastRun: number
  }
}

export interface SessionDownloadPhase extends BasePhase {
  id: 'session-download'
  name: 'Session Download'
  description: 'Fetch session artifacts from storage'
  result?: {
    sessionCount: number
    downloadedSize: number
    artifacts: string[] // Artifact keys
  }
}

export interface AnalysisExecutionPhase extends BasePhase {
  id: 'analysis-execution'
  name: 'Analysis Execution'
  description: 'Call Claude Code /insights endpoint'
  result?: {
    analysisId: string
    modelUsed: string
    inputTokens: number
    outputTokens: number
    durationMs: number
  }
}

export interface ReportPersistencePhase extends BasePhase {
  id: 'report-persistence'
  name: 'Report Persistence'
  description: 'Store HTML report to blob storage'
  result?: {
    reportKey: string
    reportSize: number
    storageProvider: string
  }
}

export interface MetadataStoragePhase extends BasePhase {
  id: 'metadata-storage'
  name: 'Metadata Storage'
  description: 'Save report metadata to database'
  result?: {
    reportId: string
    jobId: number
  }
}

/**
 * Workflow Output
 */
export interface InsightsAnalysisOutput {
  /** Generated report */
  report: {
    id: string
    reportKey: string
    reportSize: number
    generatedAt: string
    periodStart: string
    periodEnd: string
    sessionCount: number
    ticketCount: number
  }
  
  /** Job information */
  job: {
    id: number
    status: string
    completedAt?: string
  }
  
  /** Analysis metrics */
  metrics: {
    analysisDurationMs: number
    totalTokens: number
    costUsd?: number
  }
}

/**
 * Error Handling
 */
export interface WorkflowError {
  code: string
  message: string
  details?: any
  isRetryable: boolean
  phase?: string
}

export interface PreFlightError extends WorkflowError {
  code: 'PRE_FLIGHT_FAILED'
  details: {
    reason: 'NO_NEW_TICKETS' | 'ALREADY_RUNNING' | 'INVALID_PERIOD'
    lastRunAt?: string
  }
}

export interface AnalysisExecutionError extends WorkflowError {
  code: 'ANALYSIS_FAILED'
  details: {
    claudErrorCode?: string
    claudErrorMessage?: string
    retryable: boolean
  }
}

export interface StorageError extends WorkflowError {
  code: 'STORAGE_FAILED'
  details: {
    provider: string
    operation: 'upload' | 'download'
    path?: string
  }
}

/**
 * Workflow Command Specification
 */
export interface InsightsAnalysisCommand {
  /** Command name */
  command: 'analyze-insights'
  
  /** Command description */
  description: 'Generate Claude Code Insights report'
  
  /** Required permissions */
  requiredPermissions: ['admin:insights:run']
  
  /** Input schema */
  inputSchema: {
    type: 'object'
    properties: {
      period?: {
        type: 'object'
        properties: {
          start: { type: 'string', format: 'date-time' }
          end: { type: 'string', format: 'date-time' }
        }
      }
      projectId?: { type: 'number' }
    }
  }
  
  /** Output schema */
  outputSchema: {
    type: 'object'
    properties: {
      jobId: { type: 'number' }
      status: { type: 'string', enum: ['queued', 'running'] }
      message: { type: 'string' }
    }
  }
  
  /** Callback specification */
  callbacks: {
    statusCheck: {
      endpoint: '/api/admin/insights/job-status'
      method: 'GET'
      intervalMs: 2000
    }
    completion: {
      endpoint: '/api/admin/insights'
      method: 'GET'
      trigger: 'polling'
    }
  }
}

/**
 * Reporting Contract
 */
export interface InsightsReportingContract {
  /** Status reporting */
  reportStatus: (status: InsightsWorkflowState) => Promise<void>
  
  /** Progress reporting */
  reportProgress: (phase: string, progress: number, message?: string) => Promise<void>
  
  /** Error reporting */
  reportError: (error: WorkflowError) => Promise<void>
  
  /** Completion reporting */
  reportCompletion: (output: InsightsAnalysisOutput) => Promise<void>
}
