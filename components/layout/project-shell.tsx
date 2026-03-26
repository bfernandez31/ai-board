import type { ReactNode } from 'react';
import { DesktopProjectRail } from '@/components/navigation/desktop-project-rail';

interface ProjectShellProps {
  projectId: number;
  children: ReactNode;
}

export function ProjectShell({ projectId, children }: ProjectShellProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] lg:flex">
      <DesktopProjectRail projectId={projectId} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
