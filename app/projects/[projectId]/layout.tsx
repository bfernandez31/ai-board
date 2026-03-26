'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { IconRailSidebar } from '@/components/navigation/icon-rail-sidebar';
import { CommandPalette } from '@/components/navigation/command-palette';

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = Number(params.projectId);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const handleOpenCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  return (
    <div className="lg:grid lg:grid-cols-[48px_1fr]">
      <IconRailSidebar
        projectId={projectId}
        onOpenCommandPalette={handleOpenCommandPalette}
      />
      <main className="min-w-0">{children}</main>
      <CommandPalette
        projectId={projectId}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  );
}
