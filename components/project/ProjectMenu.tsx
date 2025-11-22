'use client';

import { useState } from 'react';
import { Sparkles, Settings, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { CleanupConfirmDialog } from '@/components/cleanup/CleanupConfirmDialog';
import Link from 'next/link';

interface ProjectMenuProps {
  projectId: number;
  onCleanupSuccess?: () => void;
}

/**
 * Dropdown menu for project-level actions
 */
export function ProjectMenu({ projectId, onCleanupSuccess }: ProjectMenuProps) {
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Project menu">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowCleanupDialog(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Clean Project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/projects/${projectId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showCleanupDialog && (
        <CleanupConfirmDialog
          projectId={projectId}
          onClose={() => setShowCleanupDialog(false)}
          onSuccess={onCleanupSuccess || (() => {})}
        />
      )}
    </>
  );
}
