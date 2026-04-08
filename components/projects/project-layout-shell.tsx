'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { CommandPalette } from '@/components/navigation/command-palette';
import { IconRailSidebar } from '@/components/navigation/icon-rail-sidebar';

type ProjectLayoutShellProps = {
  projectId: number;
  children: ReactNode;
};

export function ProjectLayoutShell({
  projectId,
  children,
}: ProjectLayoutShellProps): React.JSX.Element {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <div className="lg:grid lg:grid-cols-[48px_1fr]">
      <IconRailSidebar projectId={projectId} />
      <main className="min-w-0">{children}</main>
      <CommandPalette
        projectId={projectId}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  );
}
