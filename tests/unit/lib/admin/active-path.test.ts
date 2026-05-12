import { describe, it, expect } from 'vitest';
import { isAdminItemActive } from '@/lib/admin/active-path';

describe('isAdminItemActive (AIB-796, D-3)', () => {
  it('returns true for an exact match', () => {
    expect(isAdminItemActive('/admin', '/admin')).toBe(true);
    expect(isAdminItemActive('/admin/insights', '/admin/insights')).toBe(true);
  });

  it('returns true for a nested path that starts with href + "/"', () => {
    expect(isAdminItemActive('/admin/insights/runs/42', '/admin/insights')).toBe(true);
  });

  it('returns false for an adversarial incidental prefix (FR-009)', () => {
    expect(isAdminItemActive('/admin/insights-fake', '/admin/insights')).toBe(false);
  });

  it('returns false for the root href when pathname is a nested admin section (root carve-out)', () => {
    expect(isAdminItemActive('/admin/insights', '/admin')).toBe(false);
  });

  it('returns false for the inverse-root case (pathname=/admin, href=/admin/insights)', () => {
    expect(isAdminItemActive('/admin', '/admin/insights')).toBe(false);
  });

  it('returns false for unrelated paths', () => {
    expect(isAdminItemActive('/projects/1', '/admin')).toBe(false);
    expect(isAdminItemActive('/', '/admin')).toBe(false);
  });
});
