/**
 * NextAuth.js Callback Contracts
 *
 * This file documents the TypeScript contracts for NextAuth.js callbacks
 * used to implement automatic user creation for GitHub OAuth.
 *
 * These are NOT API routes (NextAuth handles OAuth internally).
 * These contracts define the callback signatures and expected behavior.
 */

import { User, Account, Profile } from 'next-auth';
import { JWT } from 'next-auth/jwt';

/**
 * GitHub OAuth Profile (extended from NextAuth Profile type)
 *
 * Fields returned by GitHub OAuth provider during authentication.
 * Source: https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 */
export interface GitHubProfile extends Profile {
  /** GitHub user ID (stable identifier) */
  id: number;

  /** GitHub username (e.g., "octocat") */
  login: string;

  /** Display name (e.g., "The Octocat") */
  name: string | null;

  /** Primary email address */
  email: string;

  /** Whether email is verified by GitHub */
  email_verified: boolean;

  /** Profile avatar URL */
  avatar_url: string;

  /** Profile bio */
  bio: string | null;

  /** Company name */
  company: string | null;

  /** Location */
  location: string | null;

  /** Account creation date */
  created_at: string;

  /** Last update date */
  updated_at: string;
}

/**
 * NextAuth SignIn Callback Contract
 *
 * Called after successful OAuth authentication, before session creation.
 * Return `false` to reject authentication.
 *
 * @param user - User object from OAuth provider
 * @param account - Account object with OAuth tokens
 * @param profile - Full profile data from OAuth provider
 * @returns Promise<boolean> - true to allow sign-in, false to reject
 */
export async function signInCallback(params: {
  user: User;
  account: Account;
  profile: GitHubProfile;
}): Promise<boolean> {
  // Implementation contract:
  // 1. Validate profile.email is present (required)
  // 2. Create or update User record in database via upsert
  // 3. Create or update Account record in database via upsert
  // 4. Use transaction to ensure atomicity
  // 5. Return false if database operation fails
  // 6. Log all errors with context for debugging

  throw new Error('Implementation required');
}

/**
 * NextAuth JWT Callback Contract
 *
 * Called whenever a JWT is created or updated.
 * Use this to add custom fields to the JWT token.
 *
 * @param token - The JWT token
 * @param user - User object (only present on sign-in)
 * @param account - Account object (only present on sign-in)
 * @returns Promise<JWT> - Modified JWT token
 */
export async function jwtCallback(params: {
  token: JWT;
  user?: User;
  account?: Account;
}): Promise<JWT> {
  // Implementation contract:
  // 1. If user is present (first sign-in), add userId to token
  // 2. If user is not present (token refresh), return token unchanged
  // 3. Never add sensitive data to JWT (it's client-visible)

  throw new Error('Implementation required');
}

/**
 * NextAuth Session Callback Contract
 *
 * Called whenever a session is checked (e.g., useSession(), getServerSession()).
 * Use this to add custom fields to the session object.
 *
 * @param session - The session object
 * @param token - The JWT token
 * @returns Promise<Session> - Modified session object
 */
export async function sessionCallback(params: {
  session: any; // NextAuth Session type
  token: JWT;
}): Promise<any> {
  // Implementation contract:
  // 1. Add userId from JWT to session.user
  // 2. Ensure session.user.id is set for downstream API routes
  // 3. Never add sensitive token data to session (it's client-visible)

  throw new Error('Implementation required');
}

/**
 * User Service Contract
 *
 * Service layer for creating/updating users during authentication.
 * Isolated for unit testing.
 */
export interface UserServiceContract {
  /**
   * Create or update User and Account records during OAuth sign-in
   *
   * @param profile - GitHub OAuth profile
   * @param account - OAuth account details
   * @returns Promise<{ id: string }> - Created/updated user ID
   * @throws Error if database operation fails
   */
  createOrUpdateUser(
    profile: GitHubProfile,
    account: Account
  ): Promise<{ id: string }>;

  /**
   * Validate that a GitHub profile contains required fields
   *
   * @param profile - GitHub OAuth profile
   * @returns boolean - true if valid, false otherwise
   */
  validateGitHubProfile(profile: GitHubProfile): boolean;
}

/**
 * Database Transaction Contract
 *
 * Expected behavior for User/Account upsert transaction.
 */
export interface AuthTransactionContract {
  /**
   * Transaction steps (executed atomically):
   *
   * 1. Upsert User record:
   *    - Match on: email (unique constraint)
   *    - Create: id, email, name, emailVerified, image
   *    - Update: name, image (email not updated)
   *
   * 2. Upsert Account record:
   *    - Match on: [provider, providerAccountId] (composite unique constraint)
   *    - Create: all OAuth fields
   *    - Update: access_token, refresh_token, expires_at
   *
   * 3. Return: User object with id
   *
   * Rollback conditions:
   * - Either upsert fails
   * - Database connection error
   * - Constraint violation (should not occur with upsert)
   */
}

/**
 * Error Handling Contract
 *
 * Expected error responses and logging behavior.
 */
export interface AuthErrorContract {
  /**
   * Validation Errors (return false from signIn callback):
   * - Missing email in GitHub profile
   * - Missing providerAccountId in account
   * - Non-GitHub provider (out of scope)
   *
   * Database Errors (return false from signIn callback):
   * - Connection timeout (> 20s)
   * - Transaction rollback
   * - Unique constraint violation (defensive)
   *
   * Logging Requirements:
   * - All errors logged to console.error
   * - Include: email, provider, error message, timestamp
   * - Exclude: access tokens, refresh tokens (sensitive)
   */
}

/**
 * Concurrency Contract
 *
 * Expected behavior under concurrent authentication requests.
 */
export interface ConcurrencyContract {
  /**
   * Scenario 1: Same user, concurrent requests
   * - First request: Creates User and Account
   * - Second request: Updates User and Account (upsert)
   * - Result: Both succeed, one User record exists
   *
   * Scenario 2: Different users, concurrent requests
   * - Both requests create separate User records
   * - Email uniqueness prevents collision
   * - Result: Both succeed, two User records exist
   *
   * Scenario 3: Connection pool exhaustion
   * - Requests wait up to 20s for available connection
   * - Timeout returns error, authentication rejected
   * - Result: User sees "sign-in failed" message
   *
   * Scenario 4: Database unavailable
   * - All requests fail immediately
   * - NextAuth shows error page
   * - Result: No partial state (no JWT without User record)
   */
}

/**
 * Security Contract
 *
 * Security requirements for OAuth data handling.
 */
export interface SecurityContract {
  /**
   * Input Validation:
   * - Email: Must be present, format validated by GitHub
   * - Provider: Must be 'github' (others rejected)
   * - Tokens: Must be present for OAuth flow
   *
   * Data Storage:
   * - Access tokens: Stored in Account model (encrypted by Prisma if configured)
   * - Refresh tokens: Stored in Account model (encrypted by Prisma if configured)
   * - Email: Stored in User model (plain text, indexed)
   *
   * Session Security:
   * - JWT: Signed with NEXTAUTH_SECRET (verify signature)
   * - Cookies: HTTPS-only in production (secure: true)
   * - Session duration: 30 days (configurable)
   *
   * Access Control:
   * - Only authenticated users can access protected routes
   * - userId from session used for authorization checks
   * - Project.userId foreign key enforces ownership
   */
}

/**
 * Performance Contract
 *
 * Performance requirements and constraints.
 */
export interface PerformanceContract {
  /**
   * Response Time:
   * - Target: < 500ms for signIn callback
   * - Includes: Database upsert (2 queries) + transaction overhead
   * - Measured: From OAuth redirect to session creation
   *
   * Concurrency:
   * - Support: 50 concurrent sign-ins
   * - Connection pool: 10-15 connections per serverless instance
   * - Timeout: 20 seconds for database operations
   *
   * Optimization:
   * - Use Prisma connection pooling (configured via DATABASE_URL)
   * - Use upsert (single query) instead of select + insert/update
   * - Use transaction for atomicity (minimal overhead)
   * - Index on User.email for fast lookup (already exists)
   * - Index on Account.[provider, providerAccountId] (already exists)
   */
}
