import { isUserAdmin } from './admin';

/**
 * Project creation and import can be closed to the public by setting
 * `PROJECT_CREATION_DISABLED=true` (e.g. during demos). Admins listed in
 * `ADMIN_ALLOWLIST` keep the ability. Read on every call so toggling the
 * env var takes effect without a restart.
 */
export function isProjectCreationAllowed(email: string | null | undefined): boolean {
  if (process.env.PROJECT_CREATION_DISABLED !== 'true') return true;
  return isUserAdmin(email);
}

export const PROJECT_CREATION_DISABLED_ERROR = {
  error: 'Project creation is currently invite-only.',
  code: 'PROJECT_CREATION_DISABLED',
} as const;
