'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { ReauthPrompt } from './reauth-prompt';
import { RepoPicker } from './repo-picker';
import type { RepoPickerItemData } from './repo-picker-item';

interface ImportProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AuthStatusResponse {
  hasGitHubAccount: boolean;
  hasRepoScope: boolean;
}

interface ImportResponse {
  project: {
    id: number;
    name: string;
    key: string;
    githubOwner: string;
    githubRepo: string;
    hasConfig: boolean;
  };
  redirectTo: string;
}

type Step = 'loading' | 'reauth' | 'picker' | 'confirm';

export function ImportProjectModal({ open, onOpenChange }: ImportProjectModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('loading');
  const [selectedRepo, setSelectedRepo] = useState<RepoPickerItemData | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Check auth status on open
  const { data: authData, isLoading: isCheckingAuth } = useQuery<AuthStatusResponse>({
    queryKey: ['github-auth-status'],
    queryFn: async () => {
      const res = await fetch('/api/github/auth-status');
      if (!res.ok) throw new Error('Failed to check auth status');
      return res.json();
    },
    enabled: open,
    refetchOnWindowFocus: true,
  });

  // Derive the current step from auth data when not in confirm state
  const effectiveStep = useMemo((): Step => {
    if (step === 'confirm') return 'confirm';
    if (isCheckingAuth || !authData) return 'loading';
    if (!authData.hasGitHubAccount || !authData.hasRepoScope) return 'reauth';
    return 'picker';
  }, [step, isCheckingAuth, authData]);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: {
      githubOwner: string;
      githubRepo: string;
      name?: string;
      description?: string;
    }) => {
      const res = await fetch('/api/projects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to import project');
      }

      return res.json() as Promise<ImportResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
      router.push(data.redirectTo);
    },
    onError: (error: Error) => {
      setImportError(error.message);
    },
  });

  const handleRepoSelect = (repo: RepoPickerItemData) => {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    setProjectDescription(repo.description ?? '');
    setImportError(null);
    setStep('confirm');
  };

  const handleConfirmImport = () => {
    if (!selectedRepo) return;
    setImportError(null);

    const mutateData: {
      githubOwner: string;
      githubRepo: string;
      name?: string;
      description?: string;
    } = {
      githubOwner: selectedRepo.owner,
      githubRepo: selectedRepo.name,
    };
    if (projectName) mutateData.name = projectName;
    if (projectDescription) mutateData.description = projectDescription;
    importMutation.mutate(mutateData);
  };

  const handleBack = () => {
    setSelectedRepo(null);
    setImportError(null);
    setStep('picker');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state on close
      setStep('loading');
      setSelectedRepo(null);
      setProjectName('');
      setProjectDescription('');
      setImportError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="aurora-card sm:max-w-[600px] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Import Project</DialogTitle>
          <DialogDescription>
            Import an existing GitHub repository as an AI Board project.
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {effectiveStep === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Checking GitHub access...
            </span>
          </div>
        )}

        {/* Reauth prompt */}
        {effectiveStep === 'reauth' && (
          <ReauthPrompt onDismiss={() => handleOpenChange(false)} />
        )}

        {/* Repo picker */}
        {effectiveStep === 'picker' && (
          <RepoPicker onSelect={handleRepoSelect} />
        )}

        {/* Confirm step */}
        {effectiveStep === 'confirm' && selectedRepo && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                {selectedRepo.fullName}
              </p>
              {selectedRepo.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedRepo.description}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={selectedRepo.name}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="project-description">Description</Label>
                <Input
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Optional project description"
                />
              </div>
            </div>

            {importError && (
              <p className="text-sm text-destructive">{importError}</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Project'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
