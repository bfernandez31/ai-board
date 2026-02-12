export const CONSTITUTION_PATH = '.ai-board/memory/constitution.md';

/** Returned by GET /api/projects/[projectId]/constitution */
export interface ConstitutionContent {
  content: string;
  /** Git blob SHA for file versioning */
  sha: string;
  path: string;
  updatedAt?: string;
}

/** Response when constitution file doesn't exist */
export interface ConstitutionNotFound {
  error: string;
  exists: false;
  guidance?: string;
}

export interface ConstitutionCommitAuthor {
  name: string;
  email: string;
  /** ISO 8601 format */
  date: string;
}

export interface ConstitutionCommit {
  sha: string;
  author: ConstitutionCommitAuthor;
  message: string;
  /** GitHub web URL for the commit */
  url: string;
}

/** Returned by GET /api/projects/[projectId]/constitution/history */
export interface ConstitutionHistoryResponse {
  commits: ConstitutionCommit[];
}

export interface ConstitutionDiffFile {
  filename: string;
  status: 'added' | 'modified' | 'removed';
  additions: number;
  deletions: number;
  /** Unified diff patch (unavailable for binary files) */
  patch?: string;
}

/** Returned by GET /api/projects/[projectId]/constitution/diff?sha=... */
export interface ConstitutionDiffResponse {
  sha: string;
  files: ConstitutionDiffFile[];
}

/** Used by PUT /api/projects/[projectId]/constitution */
export interface ConstitutionUpdateRequest {
  content: string;
  commitMessage?: string;
}

export interface ConstitutionUpdateResponse {
  success: boolean;
  commitSha: string;
  updatedAt: string;
  message: string;
}

export interface ConstitutionError {
  error: string;
  code?: string;
}
