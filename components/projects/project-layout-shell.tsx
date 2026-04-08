'use client';

import { useState } from 'react';
import { IconRailSidebar } from '@/components/navigation/icon-rail-sidebar';
import { CommandPalette } from '@/components/navigation/command-palette';

export function ProjectLayoutShell({
  projectId,
  children,
}: {
  projectId: number;
  children: React.ReactNode;
}) {
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
