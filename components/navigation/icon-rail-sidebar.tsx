'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAVIGATION_ITEMS } from './nav-items';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface IconRailSidebarProps {
  projectId: number;
}

export function IconRailSidebar({ projectId }: IconRailSidebarProps) {
  const pathname = usePathname();

  const viewItems = NAVIGATION_ITEMS.filter((item) => item.group === 'views');
  const bottomItems = NAVIGATION_ITEMS.filter((item) => item.group === 'bottom');

  function isActive(href: string): boolean {
    const fullHref = `/projects/${projectId}${href}`;
    return pathname === fullHref || pathname?.startsWith(`${fullHref}/`) || false;
  }

  function renderNavItem(item: (typeof NAVIGATION_ITEMS)[number]): React.ReactNode {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Tooltip key={item.id} delayDuration={300}>
        <TooltipTrigger asChild>
          <Link
            href={`/projects/${projectId}${item.href}`}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-center w-10 h-10 rounded-md transition-colors ${
              active
                ? 'aurora-bg-tint text-ctp-mauve border border-ctp-mauve/20'
                : 'text-muted-foreground hover:aurora-bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-5 h-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <nav
      aria-label="Project navigation"
      className="hidden lg:flex flex-col justify-between h-[calc(100vh-64px)] w-12 border-r bg-background py-2"
    >
      <div className="flex flex-col items-center gap-1">
        {viewItems.map(renderNavItem)}
      </div>

      <div className="flex flex-col items-center gap-1 border-t pt-2">
        {bottomItems.map(renderNavItem)}
      </div>
    </nav>
  );
}
