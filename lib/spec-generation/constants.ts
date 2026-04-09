import type { SpecDepth } from '@prisma/client';

export const DEPTH_OPTIONS: { value: SpecDepth; label: string; description: string; time: string }[] = [
  {
    value: 'QUICK',
    label: 'Quick',
    description: 'Single overview document covering project purpose and structure',
    time: '~5 min',
  },
  {
    value: 'STANDARD',
    label: 'Standard',
    description: 'Architecture, API endpoints, and data model documentation',
    time: '~10 min',
  },
  {
    value: 'COMPREHENSIVE',
    label: 'Comprehensive',
    description: 'Full functional specs, technical specs, and cross-references',
    time: '~20 min',
  },
];
