'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Agent } from '@prisma/client';
import {
  getAgentLabel,
  getAgentDescription,
} from '@/app/lib/utils/agent-icons';
import { AgentIcon } from '@/components/ui/agent-icon';
import { Loader2 } from 'lucide-react';

interface AgentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAgent: Agent | null;
  projectDefaultAgent: Agent;
  onSave: (agent: Agent | null) => Promise<void>;
}

/**
 * AgentEditDialog Component
 *
 * Dialog for editing ticket agent with override capabilities.
 * Mirrors PolicyEditDialog pattern exactly.
 */
export function AgentEditDialog({
  open,
  onOpenChange,
  currentAgent,
  projectDefaultAgent,
  onSave,
}: AgentEditDialogProps) {
  const [selectedAgent, setSelectedAgent] = React.useState<string>(
    currentAgent ?? 'project-default'
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset selection when dialog opens or currentAgent changes
  React.useEffect(() => {
    if (open) {
      setSelectedAgent(currentAgent ?? 'project-default');
      setError(null);
    }
  }, [open, currentAgent]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const agentValue =
        selectedAgent === 'project-default'
          ? null
          : (selectedAgent as Agent);

      await onSave(agentValue);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update agent'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const hasChanges = selectedAgent !== (currentAgent ?? 'project-default');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit AI Agent</DialogTitle>
          <DialogDescription>
            Choose an agent for this ticket or use the project default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          <div className="rounded-md bg-muted p-3 space-y-1">
            <p className="text-sm font-medium">Current Agent</p>
            <p className="text-sm text-muted-foreground">
              {currentAgent ? (
                <span className="inline-flex items-center gap-1">
                  <AgentIcon agent={currentAgent} size={14} />
                  {getAgentLabel(currentAgent)} (override)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <AgentIcon agent={projectDefaultAgent} size={14} />
                  {getAgentLabel(projectDefaultAgent)} (project default)
                </span>
              )}
            </p>
          </div>

          {/* Agent Selection */}
          <div className="space-y-2">
            <Label htmlFor="agent-select">New Agent</Label>
            <Select
              value={selectedAgent}
              onValueChange={setSelectedAgent}
              disabled={isSaving}
            >
              <SelectTrigger id="agent-select">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project-default">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">Use project default</span>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <AgentIcon agent={projectDefaultAgent} size={12} />
                      {getAgentLabel(projectDefaultAgent)} -{' '}
                      {getAgentDescription(projectDefaultAgent)}
                    </span>
                  </div>
                </SelectItem>
                {Object.values(Agent).map((agentValue) => (
                  <SelectItem key={agentValue} value={agentValue}>
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-medium inline-flex items-center gap-1">
                        <AgentIcon agent={agentValue} size={14} />
                        {getAgentLabel(agentValue)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {getAgentDescription(agentValue)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Agent overrides apply only to this ticket and take precedence
              over project defaults.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
