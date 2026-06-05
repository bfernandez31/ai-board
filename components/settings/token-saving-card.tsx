'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { getTokenSavingIcon } from '@/app/lib/utils/token-saving-icons';
import { useRouter } from 'next/navigation';

interface TokenSavingCardProps {
  project: {
    id: number;
    tokenSaving: boolean;
  };
  /** Only the project owner may change token saving; members see a read-only toggle (FR-001). */
  isOwner: boolean;
}

/**
 * TokenSavingCard Component
 *
 * Project-level Token saving default (default OFF). Owner-editable; read-only
 * for members. Mirrors ClarificationPolicyCard / DefaultAgentCard. (US1, FR-001)
 */
export function TokenSavingCard({ project, isOwner }: TokenSavingCardProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean>(project.tokenSaving);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleToggle(next: boolean) {
    if (!isOwner) return;
    setIsUpdating(true);
    setEnabled(next);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenSaving: next }),
      });

      if (!response.ok) {
        throw new Error('Failed to update token saving');
      }

      router.refresh();
    } catch (error) {
      console.error('Error updating token saving:', error);
      setEnabled(project.tokenSaving);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{getTokenSavingIcon()}</span>
          Token Saving
        </CardTitle>
        <CardDescription>
          Compress command output with RTK on Claude runs to reduce token usage.
          Applied to all tickets unless overridden at ticket level.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={enabled}
            onCheckedChange={(value) => handleToggle(value === true)}
            disabled={isUpdating || !isOwner}
            data-testid="token-saving-toggle"
          />
          <div className="flex flex-col">
            <span className="font-medium">{enabled ? 'Enabled' : 'Disabled'}</span>
            <span className="text-xs text-muted-foreground">
              {isOwner
                ? 'Only the project owner can change this setting.'
                : 'Only the project owner can change this setting (read-only).'}
            </span>
          </div>
        </label>
      </CardContent>
    </Card>
  );
}
