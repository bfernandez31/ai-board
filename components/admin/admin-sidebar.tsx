'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const NAV_ITEMS = [
  { id: 'insights', label: 'Insights', href: '/admin/insights', icon: BarChart3 },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return pathname === href || pathname?.startsWith(`${href}/`) || false;
  }

  return (
    <nav className="flex w-12 flex-col items-center gap-2 border-r border-border/40 bg-card/50 py-4">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Tooltip key={item.id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                  active
                    ? 'aurora-bg-tint text-ctp-mauve border border-ctp-mauve/20'
                    : 'text-muted-foreground hover:aurora-bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
