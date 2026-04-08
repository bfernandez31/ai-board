'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { queryKeys } from '@/app/lib/query-keys';
import type { OnboardingArtifactDocument } from '@/lib/onboarding/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export function OnboardingArtifactsCard({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [draftOverrides, setDraftOverrides] = useState<Record<string, string>>({});

  const artifactsQuery = useQuery<{ artifacts: OnboardingArtifactDocument[] }>({
    queryKey: queryKeys.projects.onboardingArtifacts(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/settings/onboarding-artifacts`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to load onboarding artifacts');
      }
      return response.json();
    },
  });

  const drafts = useMemo(
    () =>
      Object.fromEntries(
        (artifactsQuery.data?.artifacts ?? []).map((artifact) => [
          artifact.path,
          draftOverrides[artifact.path] ?? artifact.content,
        ])
      ),
    [artifactsQuery.data?.artifacts, draftOverrides]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const editableArtifacts =
        artifactsQuery.data?.artifacts.filter((artifact) => artifact.editable) ?? [];
      const payload = {
        artifacts: editableArtifacts.map((artifact) => ({
          path: artifact.path,
          content: drafts[artifact.path] ?? artifact.content,
        })),
      };

      const response = await fetch(`/api/projects/${projectId}/settings/onboarding-artifacts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to save onboarding artifacts');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projects.onboardingArtifacts(projectId),
      });
    },
  });

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Onboarding Artifacts</CardTitle>
            <CardDescription>
              Review and edit the files generated during project onboarding.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || artifactsQuery.isLoading}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {artifactsQuery.isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {artifactsQuery.data?.artifacts.map((artifact) => (
          <div key={artifact.path} className="space-y-2 rounded-lg border border-border/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{artifact.path}</p>
                <p className="text-xs text-muted-foreground">{artifact.kind}</p>
              </div>
              <Badge variant="outline">{artifact.status}</Badge>
            </div>
            <Textarea
              value={drafts[artifact.path] ?? ''}
              onChange={(event) =>
                setDraftOverrides((current) => ({
                  ...current,
                  [artifact.path]: event.target.value,
                }))
              }
              rows={Math.min(16, Math.max(6, (drafts[artifact.path] ?? '').split('\n').length + 1))}
              readOnly={!artifact.editable}
              className="font-mono text-xs"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
