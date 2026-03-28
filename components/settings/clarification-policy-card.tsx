'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ClarificationPolicy } from '@prisma/client';
import { getPolicyIcon, getPolicyDescription } from '@/app/lib/utils/policy-icons';
import { useRouter } from 'next/navigation';

interface ClarificationPolicyCardProps {
  project: {
    id: number;
    clarificationPolicy: ClarificationPolicy;
  };
}

/**
 * ClarificationPolicyCard Component
 *
 * Displays and allows editing of the project's default clarification policy
 * Used in project settings page
 *
 * @param project - Project object with id and clarificationPolicy
 */
export function ClarificationPolicyCard({ project }: ClarificationPolicyCardProps) {
  const router = useRouter();
  const [policy, setPolicy] = useState<ClarificationPolicy>(project.clarificationPolicy);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handlePolicyChange(newPolicy: ClarificationPolicy) {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clarificationPolicy: newPolicy }),
      });

      if (!response.ok) {
        throw new Error('Failed to update policy');
      }

      setPolicy(newPolicy);
      router.refresh(); // Revalidate server components
    } catch (error) {
      console.error('Error updating policy:', error);
      // Revert to original policy on error
      setPolicy(project.clarificationPolicy);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle>Default Clarification Policy</CardTitle>
        <CardDescription>
          Applied to all new tickets unless overridden at ticket level
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={policy}
          onValueChange={(value) => handlePolicyChange(value as ClarificationPolicy)}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ClarificationPolicy.AUTO}>
              <div className="flex items-center gap-2">
                <span>{getPolicyIcon(ClarificationPolicy.AUTO)}</span>
                <div className="flex flex-col">
                  <span className="font-medium">AUTO</span>
                  <span className="text-xs text-muted-foreground">
                    {getPolicyDescription(ClarificationPolicy.AUTO)}
                  </span>
                </div>
              </div>
            </SelectItem>
            <SelectItem value={ClarificationPolicy.CONSERVATIVE}>
              <div className="flex items-center gap-2">
                <span>{getPolicyIcon(ClarificationPolicy.CONSERVATIVE)}</span>
                <div className="flex flex-col">
                  <span className="font-medium">CONSERVATIVE</span>
                  <span className="text-xs text-muted-foreground">
                    {getPolicyDescription(ClarificationPolicy.CONSERVATIVE)}
                  </span>
                </div>
              </div>
            </SelectItem>
            <SelectItem value={ClarificationPolicy.PRAGMATIC}>
              <div className="flex items-center gap-2">
                <span>{getPolicyIcon(ClarificationPolicy.PRAGMATIC)}</span>
                <div className="flex flex-col">
                  <span className="font-medium">PRAGMATIC</span>
                  <span className="text-xs text-muted-foreground">
                    {getPolicyDescription(ClarificationPolicy.PRAGMATIC)}
                  </span>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
