'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TokenSavingCardProps {
  project: {
    id: number;
    tokenSaving: boolean;
  };
}

export function TokenSavingCard({ project }: TokenSavingCardProps) {
  const router = useRouter();
  const [tokenSaving, setTokenSaving] = useState<boolean>(project.tokenSaving);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleChange(value: string) {
    const newValue = value === 'true';
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenSaving: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update token saving');
      }

      setTokenSaving(newValue);
      router.refresh();
    } catch (error) {
      console.error('Error updating token saving:', error);
      setTokenSaving(project.tokenSaving);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Token Saving
        </CardTitle>
        <CardDescription>
          Compresses large command outputs during Claude agent runs to reduce token consumption. Applied to all new runs unless overridden at ticket level.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={tokenSaving ? 'true' : 'false'}
          onValueChange={handleChange}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">
              <div className="flex items-center gap-2">
                <span className="font-medium">OFF</span>
                <span className="text-xs text-muted-foreground">No compression (default)</span>
              </div>
            </SelectItem>
            <SelectItem value="true">
              <div className="flex items-center gap-2">
                <span className="font-medium">ON</span>
                <span className="text-xs text-muted-foreground">Compress outputs via RTK</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
