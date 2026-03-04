'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { AlertCircle } from 'lucide-react';
import { Agent } from '@prisma/client';
import {
  getAgentIcon,
  getAgentLabel,
  getAgentDescription,
} from '@/app/lib/utils/agent-icons';

interface QuickImplModalProps {
  open: boolean;
  onConfirm: (agent?: Agent) => void;
  onCancel: () => void;
  defaultAgent?: Agent | undefined;
}

/**
 * QuickImplModal Component
 * Feature: 031-quick-implementation
 *
 * Modal confirmation for INBOX → BUILD quick implementation workflow.
 * Warns user about trade-offs between speed and documentation.
 * Includes agent selection when defaultAgent is provided.
 */
export function QuickImplModal({ open, onConfirm, onCancel, defaultAgent }: QuickImplModalProps) {
  const [selectedAgent, setSelectedAgent] = useState<string>('project-default');

  // Reset agent selection when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onCancel();
    } else {
      setSelectedAgent('project-default');
    }
  };

  const handleConfirm = () => {
    const agent = selectedAgent === 'project-default'
      ? undefined
      : (selectedAgent as Agent);
    onConfirm(agent);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="quick-impl-modal"
        className="sm:max-w-[500px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Quick Implementation
          </DialogTitle>
          <DialogDescription className="pt-2">
            You&apos;re about to skip the specification and planning phases.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">⚡ Benefits:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Faster implementation for simple fixes</li>
              <li>Direct jump to BUILD stage</li>
              <li>Ideal for typo fixes, minor UI tweaks, obvious bugs</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">⚠️ Trade-offs:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>No formal specification document</li>
              <li>Limited planning and task breakdown</li>
              <li>May require more iterations for complex changes</li>
            </ul>
          </div>

          {/* Agent Selection */}
          {defaultAgent && (
            <div className="space-y-2">
              <Label htmlFor="quick-impl-agent">AI Agent</Label>
              <Select
                value={selectedAgent}
                onValueChange={setSelectedAgent}
              >
                <SelectTrigger id="quick-impl-agent">
                  <SelectValue placeholder="Use project default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project-default">
                    Use project default ({getAgentLabel(defaultAgent)})
                  </SelectItem>
                  {Object.values(Agent).map((agentValue) => (
                    <SelectItem key={agentValue} value={agentValue}>
                      {getAgentIcon(agentValue)}{' '}
                      {getAgentLabel(agentValue)} -{' '}
                      {getAgentDescription(agentValue)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              For complex features or architectural changes, use the full workflow (INBOX → SPECIFY → PLAN → BUILD).
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            data-action="cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            data-action="proceed"
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Proceed with Quick Implementation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
