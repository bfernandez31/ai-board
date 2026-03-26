'use client';

import type { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProjectRailTooltipProps {
  label: string;
  children: ReactNode;
}

export function ProjectRailTooltip({
  label,
  children,
}: ProjectRailTooltipProps) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
