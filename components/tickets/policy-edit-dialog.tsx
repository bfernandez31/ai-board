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
import { ClarificationPolicy } from '@prisma/client';
import {
  getPolicyIcon,
  getPolicyLabel,
  getPolicyDescription,
} from '@/app/lib/utils/policy-icons';
import { Loader2 } from 'lucide-react';

interface PolicyEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPolicy: ClarificationPolicy | null;
  projectDefaultPolicy: ClarificationPolicy;
  onSave: (policy: ClarificationPolicy | null) => Promise<void>;
}

/**
 * PolicyEditDialog Component
 *
 * Dialog for editing ticket clarification policy with override capabilities
 * - Shows current policy (override vs default)
 * - Allows selecting new policy or resetting to project default
 * - Displays policy descriptions for guidance
 *
 * @param open - Controls dialog visibility
 * @param onOpenChange - Callback for dialog state changes
 * @param currentPolicy - Current ticket policy (null = inherited from project)
 * @param projectDefaultPolicy - Project's default policy
 * @param onSave - Async callback to save policy changes
 */
export function PolicyEditDialog({
  open,
  onOpenChange,
  currentPolicy,
  projectDefaultPolicy,
  onSave,
}: PolicyEditDialogProps) {
  const [selectedPolicy, setSelectedPolicy] = React.useState<string>(
    currentPolicy ?? 'project-default'
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset selection when dialog opens or currentPolicy changes
  React.useEffect(() => {
    if (open) {
      setSelectedPolicy(currentPolicy ?? 'project-default');
      setError(null);
    }
  }, [open, currentPolicy]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Convert selection to policy value
      const policyValue =
        selectedPolicy === 'project-default'
          ? null
          : (selectedPolicy as ClarificationPolicy);

      await onSave(policyValue);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update policy'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Check if selection has changed
  const hasChanges = selectedPolicy !== (currentPolicy ?? 'project-default');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Clarification Policy</DialogTitle>
          <DialogDescription>
            Choose a policy for this ticket or use the project default.
            Overrides allow granular control for specific requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          <div className="rounded-md bg-muted p-3 space-y-1">
            <p className="text-sm font-medium">Current Policy</p>
            <p className="text-sm text-muted-foreground">
              {currentPolicy ? (
                <>
                  {getPolicyIcon(currentPolicy)}{' '}
                  {getPolicyLabel(currentPolicy)} (override)
                </>
              ) : (
                <>
                  {getPolicyIcon(projectDefaultPolicy)}{' '}
                  {getPolicyLabel(projectDefaultPolicy)} (project default)
                </>
              )}
            </p>
          </div>

          {/* Policy Selection */}
          <div className="space-y-2">
            <Label htmlFor="policy-select">New Policy</Label>
            <Select
              value={selectedPolicy}
              onValueChange={setSelectedPolicy}
              disabled={isSaving}
            >
              <SelectTrigger id="policy-select">
                <SelectValue placeholder="Select policy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project-default">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">Use project default</span>
                    <span className="text-xs text-muted-foreground">
                      {getPolicyIcon(projectDefaultPolicy)}{' '}
                      {getPolicyLabel(projectDefaultPolicy)} -{' '}
                      {getPolicyDescription(projectDefaultPolicy)}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value={ClarificationPolicy.AUTO}>
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">
                      {getPolicyIcon(ClarificationPolicy.AUTO)}{' '}
                      {getPolicyLabel(ClarificationPolicy.AUTO)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getPolicyDescription(ClarificationPolicy.AUTO)}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value={ClarificationPolicy.CONSERVATIVE}>
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">
                      {getPolicyIcon(ClarificationPolicy.CONSERVATIVE)}{' '}
                      {getPolicyLabel(ClarificationPolicy.CONSERVATIVE)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getPolicyDescription(ClarificationPolicy.CONSERVATIVE)}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value={ClarificationPolicy.PRAGMATIC}>
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">
                      {getPolicyIcon(ClarificationPolicy.PRAGMATIC)}{' '}
                      {getPolicyLabel(ClarificationPolicy.PRAGMATIC)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getPolicyDescription(ClarificationPolicy.PRAGMATIC)}
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Policy overrides apply only to this ticket and take precedence
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
