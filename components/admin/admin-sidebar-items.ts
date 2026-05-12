import type { LucideIcon } from 'lucide-react';
import { Home, Sparkles } from 'lucide-react';

export interface AdminSidebarItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminSidebarDivider {
  id: string;
  kind: 'divider';
}

export type AdminSidebarEntry = AdminSidebarItem | AdminSidebarDivider;

export const ADMIN_SIDEBAR_ITEMS: ReadonlyArray<AdminSidebarEntry> = [
  { id: 'accueil', label: 'Accueil', href: '/admin', icon: Home },
  { id: 'insights', label: 'Insights LLM', href: '/admin/insights', icon: Sparkles },
] as const;
