'use client';

import { useUsage } from '@/hooks/use-usage';
import { UpgradePrompt } from '@/components/billing/upgrade-prompt';

export function ProjectQuotaGate() {
  const { data: usage } = useUsage();

  if (
    !usage ||
    usage.projects.max === null ||
    usage.projects.current < usage.projects.max
  ) {
    return null;
  }

  return (
    <UpgradePrompt
      title="Project limit reached"
      description={`Your ${usage.planName} plan allows ${usage.projects.max} project${usage.projects.max === 1 ? '' : 's'}. Upgrade to create more projects.`}
    />
  );
}
