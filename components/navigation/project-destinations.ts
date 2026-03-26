import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  KanbanSquare,
  Settings,
} from 'lucide-react';
import type {
  ProjectNavigationDestination,
  ProjectNavigationDestinationId,
} from '@/lib/types';

interface DestinationDefinition
  extends Omit<ProjectNavigationDestination, 'href' | 'isActive'> {
  icon: LucideIcon;
}

const DESTINATION_DEFINITIONS: readonly DestinationDefinition[] = [
  {
    id: 'board',
    label: 'Board',
    description: 'Project board',
    iconKey: 'kanban-square',
    icon: KanbanSquare,
    group: 'primary',
    keywords: ['board', 'kanban', 'tickets', 'work'],
  },
  {
    id: 'activity',
    label: 'Activity',
    description: 'Project activity',
    iconKey: 'activity',
    icon: Activity,
    group: 'primary',
    keywords: ['activity', 'events', 'timeline', 'history'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Project analytics',
    iconKey: 'bar-chart-3',
    icon: BarChart3,
    group: 'primary',
    keywords: ['analytics', 'metrics', 'reporting', 'insights'],
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Project settings',
    iconKey: 'settings',
    icon: Settings,
    group: 'footer',
    keywords: ['settings', 'preferences', 'configuration'],
  },
] as const;

export const projectDestinationIcons = Object.fromEntries(
  DESTINATION_DEFINITIONS.map((definition) => [definition.id, definition.icon])
) as Record<ProjectNavigationDestinationId, LucideIcon>;

export function buildProjectDestinationHref(
  projectId: number,
  destinationId: ProjectNavigationDestinationId
): string {
  return `/projects/${projectId}/${destinationId}`;
}

export function getProjectDestinationIdForPathname(
  pathname: string | null | undefined
): ProjectNavigationDestinationId | null {
  if (!pathname) {
    return null;
  }

  const match = pathname.match(/^\/projects\/\d+\/(board|activity|analytics|settings)(?:\/)?$/);
  return (match?.[1] as ProjectNavigationDestinationId | undefined) ?? null;
}

export function isProjectDestinationActive(
  pathname: string | null | undefined,
  destinationId: ProjectNavigationDestinationId
): boolean {
  return getProjectDestinationIdForPathname(pathname) === destinationId;
}

export function getProjectDestinations(
  projectId: number,
  pathname?: string | null
): ProjectNavigationDestination[] {
  return DESTINATION_DEFINITIONS.map(({ icon, ...definition }) => ({
    ...definition,
    href: buildProjectDestinationHref(projectId, definition.id),
    isActive: isProjectDestinationActive(pathname, definition.id),
  }));
}
