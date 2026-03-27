/**
 * Unit Test: Navigation Items
 * Feature: AIB-358-comparisons-hub-page
 *
 * Tests for the Comparisons entry in the navigation configuration.
 */

import { describe, it, expect } from 'vitest';
import { NAVIGATION_ITEMS } from '@/components/navigation/nav-items';

describe('NAVIGATION_ITEMS', () => {
  it('should include a Comparisons entry', () => {
    const comparisons = NAVIGATION_ITEMS.find((item) => item.id === 'comparisons');
    expect(comparisons).toBeDefined();
  });

  it('should have correct properties for Comparisons entry', () => {
    const comparisons = NAVIGATION_ITEMS.find((item) => item.id === 'comparisons')!;

    expect(comparisons.label).toBe('Comparisons');
    expect(comparisons.href).toBe('/comparisons');
    expect(comparisons.group).toBe('views');
    expect(comparisons.icon).toBeDefined();
  });

  it('should position Comparisons after Analytics in the views group', () => {
    const viewsItems = NAVIGATION_ITEMS.filter((item) => item.group === 'views');
    const analyticsIndex = viewsItems.findIndex((item) => item.id === 'analytics');
    const comparisonsIndex = viewsItems.findIndex((item) => item.id === 'comparisons');

    expect(comparisonsIndex).toBeGreaterThan(analyticsIndex);
  });

  it('should keep Settings in the bottom group', () => {
    const settings = NAVIGATION_ITEMS.find((item) => item.id === 'settings');
    expect(settings?.group).toBe('bottom');
  });
});
