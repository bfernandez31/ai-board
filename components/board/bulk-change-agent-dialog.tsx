'use client';

import * as React from 'react';
import { Agent } from '@prisma/client';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { AgentIcon } from '@/components/ui/agent-icon';
import { getAgentDescription, getAgentLabel } from '@/app/lib/utils/agent-icons';

interface BulkChangeAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  projectDefaultAgent: Agent;
  onSave: (agent: Agent | null) => Promise<void>;
}

export function BulkChangeAgentDialog({
  open,
  onOpenChange,
  selectedCount,
  projectDefaultAgent,
  onSave,
}: BulkChangeAgentDialogProps) {
  const [selectedAgent, setSelectedAgent] = React.useState<string>('project-default');
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSelectedAgent('project-default');
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(selectedAgent === 'project-default' ? null : (selectedAgent as Agent));
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update agents');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change agent for {selectedCount} tickets</DialogTitle>
          <DialogDescription>
            Apply one ticket-level agent override across the current INBOX selection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-agent-select">New agent</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={isSaving}>
              <SelectTrigger id="bulk-agent-select">
                <span className="inline-flex items-center gap-1.5">
                  {selectedAgent === 'project-default' ? (
                    <>
                      <AgentIcon agent={projectDefaultAgent} size={14} />
                      Use project default
                    </>
                  ) : (
                    <>
                      <AgentIcon agent={selectedAgent as Agent} size={14} />
                      {getAgentLabel(selectedAgent as Agent)}
                    </>
                  )}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project-default">Use project default</SelectItem>
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
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving} className="flex items-center gap-2" aria-label="Apply agent change">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
