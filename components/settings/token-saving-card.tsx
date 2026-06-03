'use client';

import { useState, type ReactElement } from 'react';
import { Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TokenSavingCardProps {
  project: {
    id: number;
    tokenSavingEnabled: boolean;
  };
  canEdit: boolean;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? 'Failed to update token saving';
  } catch {
    return 'Failed to update token saving';
  }
}

function tokenSavingSwitchLabel(canEdit: boolean, enabled: boolean): string {
  if (!canEdit) {
    return 'Token saving is managed by project owners';
  }

  if (enabled) {
    return 'Disable token saving';
  }

  return 'Enable token saving';
}

export function TokenSavingCard({ project, canEdit }: TokenSavingCardProps): ReactElement {
  const router = useRouter();
  const [enabled, setEnabled] = useState(project.tokenSavingEnabled);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateTokenSaving(nextEnabled: boolean): Promise<void> {
    if (!canEdit || isUpdating) return;

    const previousEnabled = enabled;
    setEnabled(nextEnabled);
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenSavingEnabled: nextEnabled }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      router.refresh();
    } catch (updateError) {
      setEnabled(previousEnabled);
      setError(updateError instanceof Error ? updateError.message : 'Failed to update token saving');
    } finally {
      setIsUpdating(false);
    }
  }

  const switchLabel = tokenSavingSwitchLabel(canEdit, enabled);

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-ctp-yellow" />
              Token saving
            </CardTitle>
            <CardDescription>
              Claude core workflow runs record whether token saving is active, inactive, or fell back.
            </CardDescription>
          </div>
          {!canEdit && (
            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
              Owners only
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">{enabled ? 'On' : 'Off'}</p>
            <p className="text-sm text-muted-foreground">
              Applies to future tickets that inherit project defaults.
            </p>
          </div>
          <Button
            type="button"
            variant={enabled ? 'default' : 'outline'}
            role="switch"
            aria-checked={enabled}
            aria-label={switchLabel}
            disabled={!canEdit || isUpdating}
            onClick={() => void updateTokenSaving(!enabled)}
          >
            {enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
