'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AgentIcon } from '@/components/ui/agent-icon';

export type AgentOption = 'CLAUDE' | 'CODEX';

interface AgentSelectorProps {
  value: AgentOption;
  onChange: (agent: AgentOption) => void;
  disabled?: boolean;
}

const AGENT_OPTIONS: { value: AgentOption; label: string; description: string }[] = [
  {
    value: 'CLAUDE',
    label: 'Claude Code',
    description: 'Anthropic — recommended for most projects',
  },
  {
    value: 'CODEX',
    label: 'Codex',
    description: 'OpenAI — alternative agent',
  },
];

export function AgentSelector({ value, onChange, disabled }: AgentSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-foreground">Select AI Agent</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as AgentOption)}
        disabled={disabled}
        className="grid gap-3"
      >
        {AGENT_OPTIONS.map((option) => (
          <Label
            key={option.value}
            htmlFor={`agent-${option.value}`}
            className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors
              ${value === option.value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RadioGroupItem value={option.value} id={`agent-${option.value}`} />
            <AgentIcon agent={option.value} size={20} />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{option.label}</div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </div>
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}
