'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Plus } from 'lucide-react';
import { ImportProjectModal } from './import-project-modal';

export function ProjectsHeaderActions() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import Project
        </Button>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </div>

      <ImportProjectModal open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
