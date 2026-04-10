'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { queryKeys } from '@/app/lib/query-keys';
import { NAVIGATION_ITEMS } from './nav-items';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProjectResponse {
  githubOwner?: string;
  githubRepo?: string;
  defaultBranch?: string;
}

interface IconRailSidebarProps {
  projectId: number;
}

export function IconRailSidebar({ projectId }: IconRailSidebarProps) {
  const pathname = usePathname();

  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: async (): Promise<ProjectResponse> => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`);
      return res.json() as Promise<ProjectResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const specsUrl =
    project?.githubOwner && project?.githubRepo
      ? `https://github.com/${project.githubOwner}/${project.githubRepo}/tree/${project.defaultBranch ?? 'main'}/specs/specifications`
      : null;

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
      className="hidden lg:flex flex-col justify-between h-[calc(100vh-64px)] w-12 border-r bg-background py-2 sticky top-16"
    >
      <div className="flex flex-col items-center gap-1">
        {viewItems.map(renderNavItem)}
      </div>

      <div className="flex flex-col items-center gap-1 border-t pt-2">
        {specsUrl && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <a
                href={specsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Docs"
                className="flex items-center justify-center w-10 h-10 rounded-md transition-colors text-muted-foreground hover:aurora-bg-muted hover:text-foreground"
              >
                <FileText className="w-5 h-5" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="right">Docs</TooltipContent>
          </Tooltip>
        )}
        {bottomItems.map(renderNavItem)}
      </div>
    </nav>
  );
}
