/**
 * Contract: health-scan.yml Workflow ↔ ai-board API
 *
 * Defines the interface between the GitHub Actions workflow and the
 * ai-board API for health scan execution, status reporting, and
 * remediation ticket creation.
 */

import type { HealthScanType, HealthScanStatus } from '@prisma/client';

// ─── Workflow Dispatch Inputs ────────────────────────────────────────────────

/** Inputs sent by dispatchHealthScanWorkflow() to health-scan.yml */
export interface HealthScanWorkflowInputs {
  scan_id: string;
  project_id: string;
  scan_type: HealthScanType; // 'SECURITY' | 'COMPLIANCE' | 'TESTS' | 'SPEC_SYNC'
  base_commit: string;       // SHA or '' for full scan
  head_commit: string;       // SHA or '' (resolved by workflow)
  githubRepository: string;  // format: owner/repo
}

// ─── Status Callback Contract ────────────────────────────────────────────────

/** PATCH /api/projects/{projectId}/health/scans/{scanId}/status */

/** Request: Transition to RUNNING */
export interface ScanStatusRunningRequest {
  status: 'RUNNING';
}

/** Request: Transition to COMPLETED */
export interface ScanStatusCompletedRequest {
  status: 'COMPLETED';
  score: number;             // 0-100, required
  report?: string;           // JSON string matching ScanReport schema
  issuesFound?: number;
  issuesFixed?: number;
  headCommit?: string;       // 40-char SHA
  durationMs?: number;
  tokensUsed?: number;
  costUsd?: number;
}

/** Request: Transition to FAILED */
export interface ScanStatusFailedRequest {
  status: 'FAILED';
  errorMessage?: string;     // max 2000 chars
  durationMs?: number;
}

export type ScanStatusUpdateRequest =
  | ScanStatusRunningRequest
  | ScanStatusCompletedRequest
  | ScanStatusFailedRequest;

/** Response for all status updates */
export interface ScanStatusUpdateResponse {
  scan: {
    id: number;
    status: HealthScanStatus;
    score: number | null;
  };
}

// ─── Ticket Creation Contract ────────────────────────────────────────────────

/** POST /api/projects/{projectId}/tickets (existing endpoint) */
export interface RemediationTicketCreateRequest {
  title: string;
  description: string;
  stage: 'INBOX';
  workflowType: 'QUICK';
}

// ─── Scan Command Mapping ────────────────────────────────────────────────────

/** Static 1:1 mapping — no dynamic construction allowed (FR-013) */
export const SCAN_COMMAND_MAP: Record<HealthScanType, string> = {
  SECURITY: 'health-security',
  COMPLIANCE: 'health-compliance',
  TESTS: 'health-tests',
  SPEC_SYNC: 'health-spec-sync',
} as const;

// ─── Scan Command Output Contract ────────────────────────────────────────────

/** Expected JSON output from scan commands (parsed by workflow) */
export interface ScanCommandOutput {
  score: number;             // 0-100
  issuesFound: number;
  issuesFixed: number;
  report: object;            // Matches ScanReport discriminated union
}

// ─── Valid State Transitions ─────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<HealthScanStatus, HealthScanStatus[]> = {
  PENDING: ['RUNNING', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
};
