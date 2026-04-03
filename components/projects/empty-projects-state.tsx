'use client';

import { useState } from 'react';
import { FolderOpen, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { ImportProjectModal } from './import-project-modal';

export function EmptyProjectsState() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <Empty className="border-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>
            Get started by creating a new project or importing an existing one
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import Project
            </Button>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        </EmptyContent>
      </Empty>

      <ImportProjectModal open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
