import { auth } from '@/lib/auth';

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

export async function requireAdmin(): Promise<AdminUser> {
  const session = await auth();
  const email = session?.user?.email;
  const id = session?.user?.id;
  if (!session || !email || !id) {
    throw new AdminAccessDenied();
  }
  if (!isAdminEmail(email)) {
    throw new AdminAccessDenied();
  }
  return { id, email };
}
