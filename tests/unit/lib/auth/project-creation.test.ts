import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isProjectCreationAllowed } from '@/app/lib/auth/project-creation';

describe('isProjectCreationAllowed', () => {
  const originalDisabled = process.env.PROJECT_CREATION_DISABLED;
  const originalAllowlist = process.env.ADMIN_ALLOWLIST;

  beforeEach(() => {
    delete process.env.PROJECT_CREATION_DISABLED;
    process.env.ADMIN_ALLOWLIST = 'admin@example.com';
  });

  afterEach(() => {
    if (originalDisabled === undefined) delete process.env.PROJECT_CREATION_DISABLED;
    else process.env.PROJECT_CREATION_DISABLED = originalDisabled;
    if (originalAllowlist === undefined) delete process.env.ADMIN_ALLOWLIST;
    else process.env.ADMIN_ALLOWLIST = originalAllowlist;
  });

  it('allows everyone when the flag is unset', () => {
    expect(isProjectCreationAllowed('user@example.com')).toBe(true);
    expect(isProjectCreationAllowed(null)).toBe(true);
  });

  it('allows everyone when the flag is not exactly "true"', () => {
    process.env.PROJECT_CREATION_DISABLED = 'false';
    expect(isProjectCreationAllowed('user@example.com')).toBe(true);
  });

  it('blocks non-admins when the flag is "true"', () => {
    process.env.PROJECT_CREATION_DISABLED = 'true';
    expect(isProjectCreationAllowed('user@example.com')).toBe(false);
    expect(isProjectCreationAllowed(null)).toBe(false);
  });

  it('still allows admins when the flag is "true"', () => {
    process.env.PROJECT_CREATION_DISABLED = 'true';
    expect(isProjectCreationAllowed('Admin@Example.com')).toBe(true);
  });
});
