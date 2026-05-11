import type { NextRequest } from 'next/server';
import { notFound } from 'next/navigation';
import { getCurrentUserOrNull } from '@/lib/db/users';

/**
 * Parse `ADMIN_ALLOWLIST` fresh on every call. Comma-separated, trimmed,
 * lowercased, empty entries filtered. No module-level caching so operator
 * rotations take effect on the next request without restart (SC-009).
 */
export function getAdminAllowlist(): string[] {
  const raw = process.env.ADMIN_ALLOWLIST ?? '';
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Case-insensitive admin check. Treats null/undefined as not-admin.
 */
export function isUserAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return getAdminAllowlist().includes(normalized);
}

/**
 * The byte-equivalent 404 response Next.js produces for a missing API route.
 * Body is empty; Content-Type matches Next.js's default; no other headers set
 * by the response itself. Tests in `parity-404.test.ts` assert byte equality.
 *
 * Used by API routes. Page routes should call `notFound()` from
 * `next/navigation` instead so the framework renders its default 404 page.
 */
export function adminNotFoundResponse(): Response {
  return new Response(null, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function resolveAdminEmail(request: NextRequest): Promise<string | null> {
  let user: { email: string } | null = null;
  try {
    user = await getCurrentUserOrNull(request);
  } catch {
    user = null;
  }
  if (!user || !isUserAdmin(user.email)) return null;
  return user.email.trim().toLowerCase();
}

/**
 * Resolve the current admin email or, if the caller is not an admin, return
 * a byte-equivalent 404 (FR-003, D-10). This is the canonical guard for
 * `/admin/*` API endpoints.
 *
 * Returns either:
 *   - `{ ok: true, email }` for an allowlisted admin
 *   - `{ ok: false, response }` for everything else (no session, non-admin,
 *     blocked test override)
 *
 * Callers SHOULD return the response without modification.
 */
export async function requireAdminOrNotFound(
  request: NextRequest
): Promise<{ ok: true; email: string } | { ok: false; response: Response }> {
  const email = await resolveAdminEmail(request);
  if (!email) return { ok: false, response: adminNotFoundResponse() };
  return { ok: true, email };
}

/**
 * Page-route variant of `requireAdminOrNotFound`. Calls Next.js `notFound()`
 * on non-admin requests; returns the admin email otherwise.
 */
export async function requireAdminPageOrNotFound(
  request: NextRequest
): Promise<string> {
  const email = await resolveAdminEmail(request);
  if (!email) notFound();
  return email;
}
