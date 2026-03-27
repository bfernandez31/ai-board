import { LayoutDashboard, Activity, BarChart3, GitCompare, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  group: 'views' | 'bottom';
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'board', label: 'Board', icon: LayoutDashboard, href: '/board', group: 'views' },
  { id: 'activity', label: 'Activity', icon: Activity, href: '/activity', group: 'views' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics', group: 'views' },
  { id: 'comparisons', label: 'Comparisons', icon: GitCompare, href: '/comparisons', group: 'views' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings', group: 'bottom' },
];
