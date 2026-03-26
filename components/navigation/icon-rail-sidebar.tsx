'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAVIGATION_ITEMS } from './nav-items';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface IconRailSidebarProps {
  projectId: number;
  onOpenCommandPalette?: () => void;
}

export function IconRailSidebar({ projectId }: IconRailSidebarProps) {
  const pathname = usePathname();

  const viewItems = NAVIGATION_ITEMS.filter((item) => item.group === 'views');
  const bottomItems = NAVIGATION_ITEMS.filter((item) => item.group === 'bottom');

  function isActive(href: string): boolean {
    const fullHref = `/projects/${projectId}${href}`;
    return pathname === fullHref || pathname?.startsWith(`${fullHref}/`) || false;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        aria-label="Project navigation"
        className="hidden lg:flex flex-col justify-between h-[calc(100vh-64px)] w-12 border-r bg-background py-2"
      >
        <div className="flex flex-col items-center gap-1">
          {viewItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Link
                    href={`/projects/${projectId}${item.href}`}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center justify-center w-10 h-10 rounded-md transition-colors ${
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
          })}
        </div>

        <div className="flex flex-col items-center gap-1 border-t pt-2">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Link
                    href={`/projects/${projectId}${item.href}`}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center justify-center w-10 h-10 rounded-md transition-colors ${
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
          })}
        </div>
      </nav>
    </TooltipProvider>
  );
}
