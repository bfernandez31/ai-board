/**
 * Admin API Contracts
 * 
 * Defines TypeScript interfaces for admin-related API endpoints
 */

import { ReportStatus } from '@prisma/client'

/**
 * Admin Insights Response
 * Returned by GET /api/admin/insights
 */
export interface AdminInsightsResponse {
  /** List of all available reports (metadata only) */
  reports: InsightsReportMetadata[]
  
  /** Latest completed report with full content */
  currentReport: InsightsReportWithContent | null
  
  /** Whether user can trigger new analysis */
  canRunAnalysis: boolean
  
  /** Whether an analysis is currently running */
  isGenerating: boolean
}

/**
 * Insights Report Metadata
 * Lightweight representation for listing reports
 */
export interface InsightsReportMetadata {
  id: string
  generatedAt: string // ISO 8601 timestamp
  periodStart: string // ISO 8601 timestamp
  periodEnd: string // ISO 8601 timestamp
  sessionCount: number
  ticketCount: number
  status: ReportStatus
  createdBy: string // User ID
}

/**
 * Insights Report with Content
 * Full representation including HTML content
 */
export interface InsightsReportWithContent {
  metadata: InsightsReportMetadata
  htmlContent: string // HTML report content
}

/**
 * Run Analysis Request
 * Request body for POST /api/admin/insights/analyze
 */
export interface RunAnalysisRequest {
  // Currently empty - may add filters in future
  // Example future fields:
  // projectId?: number
  // periodStart?: string
  // periodEnd?: string
}

/**
 * Run Analysis Response
 * Response from POST /api/admin/insights/analyze
 */
export interface RunAnalysisResponse {
  jobId: number
  status: 'queued' | 'running'
  message: string
}

/**
 * Get Report Response
 * Returned by GET /api/admin/insights/:reportId
 */
export interface GetReportResponse {
  report: InsightsReportWithContent
}

/**
 * Admin Access Check Response
 * Returned by GET /api/admin/access-check
 */
export interface AdminAccessCheckResponse {
  hasAccess: boolean
  reason?: string
}

/**
 * Analysis Job Status
 * Returned by GET /api/admin/insights/job-status
 */
export interface AnalysisJobStatus {
  jobId: number | null
  status: 'idle' | 'running' | 'completed' | 'failed'
  progress?: number // 0-100
  message?: string
}
