import type { DimensionComparison } from '@/lib/analytics/types';

function getDisplayOrderValue(displayOrder?: number): number {
  return displayOrder ?? Number.MAX_SAFE_INTEGER;
}

export function compareDimensionComparisons(
  left: DimensionComparison,
  right: DimensionComparison
): number {
  const orderDiff =
    getDisplayOrderValue(left.displayOrder) - getDisplayOrderValue(right.displayOrder);

  if (orderDiff !== 0) {
    return orderDiff;
  }

  const weightDiff = right.weight - left.weight;
  if (weightDiff !== 0) {
    return weightDiff;
  }

  return left.dimension.localeCompare(right.dimension);
}

export function sortDimensionComparisons(
  dimensions: DimensionComparison[]
): DimensionComparison[] {
  return [...dimensions].sort(compareDimensionComparisons);
}
