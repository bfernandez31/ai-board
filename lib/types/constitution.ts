/**
 * TypeScript Interfaces for Constitution Feature
 *
 * Defines types for constitution document viewing, editing, and history tracking.
 * Used by API routes, hooks, and components.
 */

/**
 * Constitution content response from API
 * Returned by GET /api/projects/[projectId]/constitution
 */
export interface ConstitutionContent {
  /** Raw markdown content of the constitution */
  content: string;
  /** Git blob SHA for file versioning */
  sha: string;
  /** File path in repository */
  path: string;
  /** Last modification timestamp (optional) */
  updatedAt?: string;
}

/**
 * Response when constitution file doesn't exist
 */
export interface ConstitutionNotFound {
  /** Error message */
  error: string;
  /** Indicates file doesn't exist */
  exists: false;
  /** Guidance on how to create the constitution */
  guidance?: string;
}

/**
 * Commit author information
 */
export interface ConstitutionCommitAuthor {
  /** Author's display name */
  name: string;
  /** Author's email address */
  email: string;
  /** Commit timestamp in ISO 8601 format */
  date: string;
}

/**
 * Single commit in constitution history
 */
export interface ConstitutionCommit {
  /** 40-character commit SHA */
  sha: string;
  /** Commit author details */
  author: ConstitutionCommitAuthor;
  /** Commit message */
  message: string;
  /** GitHub web URL for the commit */
  url: string;
}

/**
 * Response for constitution history endpoint
 * Returned by GET /api/projects/[projectId]/constitution/history
 */
export interface ConstitutionHistoryResponse {
  /** Array of commits that modified the constitution */
  commits: ConstitutionCommit[];
}

/**
 * Single file in a commit diff
 */
export interface ConstitutionDiffFile {
  /** File path changed */
  filename: string;
  /** Change type */
  status: 'added' | 'modified' | 'removed';
  /** Lines added */
  additions: number;
  /** Lines removed */
  deletions: number;
  /** Unified diff format patch (optional - may not be available for binary files) */
  patch?: string;
}

/**
 * Response for constitution diff endpoint
 * Returned by GET /api/projects/[projectId]/constitution/diff?sha=...
 */
export interface ConstitutionDiffResponse {
  /** Commit SHA */
  sha: string;
  /** Files changed in the commit */
  files: ConstitutionDiffFile[];
}

/**
 * Request body for updating constitution
 * Used by PUT /api/projects/[projectId]/constitution
 */
export interface ConstitutionUpdateRequest {
  /** Updated markdown content */
  content: string;
  /** Custom commit message (optional, defaults to standard message) */
  commitMessage?: string;
}

/**
 * Response for successful constitution update
 */
export interface ConstitutionUpdateResponse {
  /** Operation success status */
  success: boolean;
  /** New commit SHA */
  commitSha: string;
  /** Update timestamp in ISO 8601 format */
  updatedAt: string;
  /** Success message */
  message: string;
}

/**
 * API error response
 */
export interface ConstitutionError {
  /** Error message */
  error: string;
  /** Error code for programmatic handling */
  code?: string;
}

/**
 * Path to constitution file in repository
 */
export const CONSTITUTION_PATH = '.ai-board/memory/constitution.md';
