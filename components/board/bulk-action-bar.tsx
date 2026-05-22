'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Agent } from '@prisma/client';
import { CLAUDE_MODEL_IDS, CLAUDE_MODEL_LABELS, type ClaudeModelId } from '@/lib/models/claude-models';

const BULK_LIMIT = 50;

const AGENT_OPTIONS: { value: Agent; label: string }[] = [
  { value: Agent.CLAUDE, label: 'Claude' },
  { value: Agent.CODEX, label: 'Codex' },
  { value: Agent.GEMINI, label: 'Gemini' },
  { value: Agent.MISTRAL, label: 'Mistral' },
];

const CLEAR_VALUE = '__clear__';

export interface BulkActionBarProps {
  count: number;
  onCancel: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onAgentChange: (agent: Agent | null) => void;
  onModelChange: (model: ClaudeModelId | null) => void;
  agentPending?: boolean;
  modelPending?: boolean;
  mergePending?: boolean;
  deletePending?: boolean;
}

/**
 * Floating bulk action bar (AIB-821). Visible while at least one INBOX ticket
 * is selected. Slot order matches contracts/bulk-tickets-api.md.
 */
export function BulkActionBar({
  count,
  onCancel,
  onMerge,
  onDelete,
  onAgentChange,
  onModelChange,
  agentPending = false,
  modelPending = false,
  mergePending = false,
  deletePending = false,
}: BulkActionBarProps) {
  if (count === 0) return null;

  const overLimit = count > BULK_LIMIT;
  const mergeDisabled = count < 2 || overLimit || mergePending;
  const deleteDisabled = overLimit || deletePending;
  const dropdownsDisabled = overLimit || agentPending || modelPending;

  const limitTitle = overLimit ? `Select at most ${BULK_LIMIT} tickets per bulk action` : undefined;

  return (
    <div
      data-testid="bulk-action-bar"
      role="toolbar"
      aria-label="Bulk actions"
      className="aurora-card fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border px-4 py-2 shadow-lg"
    >
      <span aria-live="polite" data-testid="bulk-count" className="text-sm font-medium text-foreground">
        {count} selected
      </span>

      <Button
        variant="default"
        size="sm"
        onClick={onMerge}
        disabled={mergeDisabled}
        title={count < 2 ? 'Select at least 2 tickets to merge' : limitTitle}
        data-testid="bulk-merge-button"
      >
        Merge
      </Button>

      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={deleteDisabled}
        title={limitTitle}
        data-testid="bulk-delete-button"
      >
        Delete
      </Button>

      <Select
        disabled={dropdownsDisabled}
        onValueChange={(value) => {
          onAgentChange(value === CLEAR_VALUE ? null : (value as Agent));
        }}
      >
        <SelectTrigger
          aria-label="Change agent"
          className="h-9 w-[140px]"
          data-testid="bulk-agent-select"
          title={limitTitle}
        >
          <SelectValue placeholder="Change agent" />
        </SelectTrigger>
        <SelectContent>
          {AGENT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
          <SelectItem value={CLEAR_VALUE}>Inherit from project</SelectItem>
        </SelectContent>
      </Select>

      <Select
        disabled={dropdownsDisabled}
        onValueChange={(value) => {
          onModelChange(value === CLEAR_VALUE ? null : (value as ClaudeModelId));
        }}
      >
        <SelectTrigger
          aria-label="Change model"
          className="h-9 w-[200px]"
          data-testid="bulk-model-select"
          title={limitTitle}
        >
          <SelectValue placeholder="Change model" />
        </SelectTrigger>
        <SelectContent>
          {CLAUDE_MODEL_IDS.map((modelId) => (
            <SelectItem key={modelId} value={modelId}>
              {CLAUDE_MODEL_LABELS[modelId]}
            </SelectItem>
          ))}
          <SelectItem value={CLEAR_VALUE}>Clear (use default)</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        data-testid="bulk-cancel-button"
      >
        Cancel
      </Button>
    </div>
  );
}
