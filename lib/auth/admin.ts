import { getCurrentUserOrNull } from '@/lib/db/users';
import type { NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/db/users';

const ADMIN_EMAIL_ENV_VAR = 'ADMIN_USER_EMAILS';

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getAdminAllowlist(): string[] {
  const raw = process.env[ADMIN_EMAIL_ENV_VAR];
  if (!raw) {
    return [];
  }
  const entries = raw
    .split(',')
    .map(normalizeEmail)
    .filter((email) => email.length > 0);
  return Array.from(new Set(entries));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const allowlist = getAdminAllowlist();
  if (allowlist.length === 0) {
    return false;
  }
  return allowlist.includes(normalizeEmail(email));
}

export async function getCurrentAdminOrNull(
  request?: NextRequest
): Promise<AuthenticatedUser | null> {
  const user = await getCurrentUserOrNull(request);
  if (!user) {
    return null;
  }
  return isAdminEmail(user.email) ? user : null;
}

export class AdminAccessDeniedError extends Error {
  constructor() {
    super('Not found');
    this.name = 'AdminAccessDeniedError';
  }
}

/**
 * Require the request to be authenticated as an admin user. Unauthorized
 * callers (no session, or session belongs to a non-admin) are treated
 * identically so the admin area's existence isn't leaked.
 */
export async function requireAdmin(
  request?: NextRequest
): Promise<AuthenticatedUser> {
  const admin = await getCurrentAdminOrNull(request);
  if (!admin) {
    throw new AdminAccessDeniedError();
  }
  return admin;
}
