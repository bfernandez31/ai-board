export type FrictionLevel = 'low' | 'med' | 'high';

export function frictionLevelForIssueCount(
  count: number | null
): FrictionLevel | null {
  if (count === null) return null;
  if (!Number.isFinite(count)) return null;
  if (count < 0) return null;
  if (count === 0) return 'low';
  if (count <= 2) return 'med';
  return 'high';
}
