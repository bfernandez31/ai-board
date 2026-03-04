'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Agent } from '@prisma/client';
import { getAgentIcon, getAgentDescription } from '@/app/lib/utils/agent-icons';
import { useRouter } from 'next/navigation';

interface AgentCardProps {
  project: {
    id: number;
    defaultAgent: Agent;
  };
}

export function AgentCard({ project }: AgentCardProps) {
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
    <Card>
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
            <SelectItem value={Agent.CLAUDE}>
              <div className="flex items-center gap-2">
                <span>{getAgentIcon(Agent.CLAUDE)}</span>
                <div className="flex flex-col">
                  <span className="font-medium">Claude</span>
                  <span className="text-xs text-muted-foreground">
                    {getAgentDescription(Agent.CLAUDE)}
                  </span>
                </div>
              </div>
            </SelectItem>
            <SelectItem value={Agent.CODEX}>
              <div className="flex items-center gap-2">
                <span>{getAgentIcon(Agent.CODEX)}</span>
                <div className="flex flex-col">
                  <span className="font-medium">Codex</span>
                  <span className="text-xs text-muted-foreground">
                    {getAgentDescription(Agent.CODEX)}
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
