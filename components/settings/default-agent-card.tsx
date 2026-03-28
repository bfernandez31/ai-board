'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Agent } from '@prisma/client';
import { getAgentLabel, getAgentDescription } from '@/app/lib/utils/agent-icons';
import { AgentIcon } from '@/components/ui/agent-icon';
import { useRouter } from 'next/navigation';

interface DefaultAgentCardProps {
  project: {
    id: number;
    defaultAgent: Agent;
  };
}

/**
 * DefaultAgentCard Component
 *
 * Displays and allows editing of the project's default AI agent
 * Used in project settings page. Mirrors ClarificationPolicyCard pattern.
 */
export function DefaultAgentCard({ project }: DefaultAgentCardProps) {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent>(project.defaultAgent);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleAgentChange(newAgent: Agent) {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultAgent: newAgent }),
      });

      if (!response.ok) {
        throw new Error('Failed to update agent');
      }

      setAgent(newAgent);
      router.refresh();
    } catch (error) {
      console.error('Error updating agent:', error);
      setAgent(project.defaultAgent);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle>Default AI Agent</CardTitle>
        <CardDescription>
          Applied to all new tickets unless overridden at ticket level
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={agent}
          onValueChange={(value) => handleAgentChange(value as Agent)}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-full" data-testid="agent-select-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(Agent).map((agentValue) => (
              <SelectItem key={agentValue} value={agentValue}>
                <div className="flex items-center gap-2">
                  <AgentIcon agent={agentValue} size={16} />
                  <div className="flex flex-col">
                    <span className="font-medium">{getAgentLabel(agentValue)}</span>
                    <span className="text-xs text-muted-foreground">
                      {getAgentDescription(agentValue)}
                    </span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
