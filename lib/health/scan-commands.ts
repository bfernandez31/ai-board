import type { HealthScanType } from '@prisma/client';

/** Static 1:1 mapping of scan type to Claude Code command — no dynamic construction allowed (FR-013) */
export const SCAN_COMMAND_MAP: Record<HealthScanType, string> = {
  SECURITY: 'health-security',
  COMPLIANCE: 'health-compliance',
  TESTS: 'health-tests',
  SPEC_SYNC: 'health-spec-sync',
} as const;

/** Returns the Claude Code command name for a given scan type */
export function getScanCommand(scanType: HealthScanType): string {
  const command = SCAN_COMMAND_MAP[scanType];
  if (!command) {
    throw new Error(`Unknown scan type: ${scanType}`);
  }
  return command;
}
