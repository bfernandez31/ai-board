import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getCurrentUserOrNull } from '@/lib/db/users';

export interface AdminUser {
  id: string;
  email: string;
}

export function getAdminAllowlistEmails(): Set<string> {
  const raw = process.env.ADMIN_ALLOWLIST_EMAILS ?? '';
  const set = new Set<string>();
  for (const part of raw.split(',')) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed.length > 0) {
      set.add(trimmed);
    }
  }
  return set;
}

export function isAdminEmail(
  email: string | null | undefined,
  set: Set<string> = getAdminAllowlistEmails()
): boolean {
  if (!email) return false;
  return set.has(email.trim().toLowerCase());
}

export class AdminAccessDenied extends Error {
  constructor() {
    super('Not Found');
    this.name = 'AdminAccessDenied';
  }
}

/**
 * Resolve the admin user. Supports both:
 *   - NextAuth session via auth()
 *   - x-test-user-id test override path (for integration tests)
 *
 * Throws AdminAccessDenied on missing/invalid auth or non-allowlisted email.
 */
export async function requireAdmin(
  request?: NextRequest
): Promise<AdminUser> {
  let id: string | null = null;
  let email: string | null = null;

  try {
    const sessionUser = await getCurrentUserOrNull(request);
    if (sessionUser) {
      id = sessionUser.id;
      email = sessionUser.email;
    }
  } catch {
    // fall through to AdminAccessDenied
  }

  if (!id || !email) {
    // Last-resort plain auth() (no test override) for callers that don't
    // pass the request reference.
    if (!request) {
      try {
        const session = await auth();
        if (session?.user?.id && session.user.email) {
          id = session.user.id;
          email = session.user.email;
        }
      } catch {
        // ignored
      }
    }
  }

  if (!id || !email) {
    throw new AdminAccessDenied();
  }
  if (!isAdminEmail(email)) {
    throw new AdminAccessDenied();
  }
  return { id, email };
}
