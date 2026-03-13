'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AgentFilterProps {
  value: string | null;
  onChange: (agent: string | null) => void;
  agents: string[];
}

const ALL_AGENTS_VALUE = '__all__';

export function AgentFilter({ value, onChange, agents }: AgentFilterProps) {
  return (
    <Select
      value={value ?? ALL_AGENTS_VALUE}
      onValueChange={(v) => onChange(v === ALL_AGENTS_VALUE ? null : v)}
    >
      <SelectTrigger className="w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_AGENTS_VALUE}>All Agents</SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent} value={agent}>
            {agent}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
