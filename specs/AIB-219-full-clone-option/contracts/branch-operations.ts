/**
 * API Contract: GitHub Branch Operations
 * Feature: AIB-219 Full Clone Option
 *
 * Internal service contract for branch creation from source
 */

// ============================================================================
// Service Types
// ============================================================================

/**
 * Input for creating a branch from an existing source branch
 */
export interface CreateBranchFromSourceInput {
  /** GitHub repository owner (e.g., "bfernandez31") */
  owner: string;
  /** GitHub repository name (e.g., "ai-board") */
  repo: string;
  /** Source branch name to copy from (e.g., "087-feature-name") */
  sourceBranch: string;
  /** New branch name to create (e.g., "219-feature-name") */
  newBranchName: string;
}

/**
 * Result of branch creation operation
 */
export interface CreateBranchResult {
  /** Whether the branch was successfully created */
  success: boolean;
  /** The SHA of the commit the new branch points to */
  commitSha: string;
  /** Full ref name (e.g., "refs/heads/219-feature-name") */
  ref: string;
}

/**
 * Error types for branch operations
 */
export type BranchOperationError =
  | { type: 'SOURCE_NOT_FOUND'; message: string }
  | { type: 'BRANCH_EXISTS'; message: string }
  | { type: 'PERMISSION_DENIED'; message: string }
  | { type: 'RATE_LIMITED'; message: string; retryAfter?: string }
  | { type: 'UNKNOWN'; message: string };

// ============================================================================
// Function Signature
// ============================================================================

/**
 * Creates a new Git branch from an existing source branch
 *
 * Implementation in: lib/github/branch-operations.ts
 *
 * @param input - Branch creation parameters
 * @returns Result with commit SHA and ref name
 * @throws BranchOperationError for known failure cases
 *
 * @example
 * ```typescript
 * import { createBranchFromSource } from '@/lib/github/branch-operations';
 *
 * const result = await createBranchFromSource({
 *   owner: 'bfernandez31',
 *   repo: 'ai-board',
 *   sourceBranch: '087-feature-name',
 *   newBranchName: '219-feature-name',
 * });
 *
 * console.log(result.commitSha); // "abc123..."
 * ```
 */
export type CreateBranchFromSourceFn = (
  input: CreateBranchFromSourceInput
) => Promise<CreateBranchResult>;

// ============================================================================
// Branch Naming Contract
// ============================================================================

/**
 * Input for generating branch name from ticket data
 */
export interface GenerateBranchNameInput {
  /** Ticket number (e.g., 219) */
  ticketNumber: number;
  /** Ticket title for slug extraction */
  title: string;
}

/**
 * Generates a branch name following project convention
 *
 * Format: {ticketNumber}-{slug}
 * Slug: First 3 words of title, lowercase, hyphenated
 *
 * @param input - Ticket data for branch name generation
 * @returns Branch name string
 *
 * @example
 * ```typescript
 * generateBranchName({ ticketNumber: 219, title: "Add Full Clone Option" });
 * // Returns: "219-add-full-clone"
 * ```
 */
export type GenerateBranchNameFn = (input: GenerateBranchNameInput) => string;
