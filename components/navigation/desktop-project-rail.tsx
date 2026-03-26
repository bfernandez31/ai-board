'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  getProjectDestinations,
  projectDestinationIcons,
} from '@/components/navigation/project-destinations';
import { ProjectRailTooltip } from '@/components/navigation/project-rail-tooltips';

interface DesktopProjectRailProps {
  projectId: number;
}

export function DesktopProjectRail({ projectId }: DesktopProjectRailProps) {
  const pathname = usePathname();
  const destinations = getProjectDestinations(projectId, pathname);
  const primaryDestinations = destinations.filter(
    (destination) => destination.group === 'primary'
  );
  const footerDestinations = destinations.filter(
    (destination) => destination.group === 'footer'
  );

  return (
    <aside
      className="hidden w-14 shrink-0 border-r border-border/80 bg-card/60 lg:flex"
      aria-label="Project navigation rail"
      data-testid="desktop-project-rail"
    >
      <nav className="sticky top-16 flex h-[calc(100vh-4rem)] w-14 flex-col items-center py-4">
        <div className="flex w-full flex-col items-center gap-2">
          {primaryDestinations.map((destination) => {
            const Icon = projectDestinationIcons[destination.id];

            return (
              <ProjectRailTooltip key={destination.id} label={destination.label}>
                <Link
                  href={destination.href}
                  aria-label={destination.label}
                  aria-current={destination.isActive ? 'page' : undefined}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors',
                    'hover:border-border hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    destination.isActive &&
                      'border-border bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{destination.label}</span>
                </Link>
              </ProjectRailTooltip>
            );
          })}
        </div>

        <div className="mt-auto flex w-full flex-col items-center gap-2">
          {footerDestinations.map((destination) => {
            const Icon = projectDestinationIcons[destination.id];

            return (
              <ProjectRailTooltip key={destination.id} label={destination.label}>
                <Link
                  href={destination.href}
                  aria-label={destination.label}
                  aria-current={destination.isActive ? 'page' : undefined}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors',
                    'hover:border-border hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    destination.isActive &&
                      'border-border bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{destination.label}</span>
                </Link>
              </ProjectRailTooltip>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
