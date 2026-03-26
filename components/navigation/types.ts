import type { LucideIcon } from 'lucide-react';

export interface CommandPaletteNavigationResult {
  type: 'navigation';
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface CommandPaletteTicketResult {
  type: 'ticket';
  id: number;
  ticketKey: string;
  title: string;
  href: string;
}

export type CommandPaletteResult = CommandPaletteNavigationResult | CommandPaletteTicketResult;
