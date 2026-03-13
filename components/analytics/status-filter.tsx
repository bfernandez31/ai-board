'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StatusFilter as StatusFilterType } from '@/lib/analytics/types';

interface StatusFilterProps {
  value: StatusFilterType;
  onChange: (status: StatusFilterType) => void;
}

const STATUS_OPTIONS: { value: StatusFilterType; label: string }[] = [
  { value: 'shipped', label: 'Shipped' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'Shipped + Closed' },
];

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StatusFilterType)}>
      <SelectTrigger className="w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
