'use client';

import { useState } from 'react';
import { Scroll } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ConstitutionViewer from './constitution-viewer';

interface ConstitutionCardProps {
  project: {
    id: number;
    name: string;
  };
}

/**
 * ConstitutionCard Component
 *
 * Settings card that provides access to view and edit the project constitution.
 * The constitution is stored at `.specify/memory/constitution.md` in the repository.
 *
 * Features:
 * - Opens modal viewer for constitution content
 * - Supports view, edit, and history tabs
 * - Uses shadcn/ui Card component pattern
 *
 * @param project - Project object with id and name
 */
export function ConstitutionCard({ project }: ConstitutionCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scroll className="h-5 w-5" />
            Project Constitution
          </CardTitle>
          <CardDescription>
            View and edit the project constitution that defines governance principles and guidelines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setIsOpen(true)}
            data-testid="constitution-button"
          >
            Open Constitution
          </Button>
        </CardContent>
      </Card>

      <ConstitutionViewer
        projectId={project.id}
        projectName={project.name}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
