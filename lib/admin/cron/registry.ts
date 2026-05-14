import { CriticalCron } from '@prisma/client';

export interface CriticalCronEntry {
  key: CriticalCron;
  label: string;
  thresholdHours: number;
}

export const CRITICAL_CRONS: CriticalCronEntry[] = [
  {
    key: CriticalCron.NIGHTLY_LOG_PRUNE,
    label: 'Nightly log prune',
    thresholdHours: 36,
  },
  {
    key: CriticalCron.NIGHTLY_HEALTH_SCANS,
    label: 'Nightly health scans',
    thresholdHours: 36,
  },
  {
    key: CriticalCron.BILLING_RECONCILE,
    label: 'Billing reconcile',
    thresholdHours: 36,
  },
];
