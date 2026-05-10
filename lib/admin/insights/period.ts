export type DerivePeriodInput = {
  previousHighWater: Date | null;
  earliestClaudeStartedAt: Date | null;
  now: Date;
};

export type DerivePeriodResult =
  | { periodStart: Date; periodEnd: Date }
  | { error: 'NO_CLAUDE_WORK_YET' };

export function derivePeriod(input: DerivePeriodInput): DerivePeriodResult {
  const start = input.previousHighWater ?? input.earliestClaudeStartedAt;
  if (!start) {
    return { error: 'NO_CLAUDE_WORK_YET' };
  }
  return { periodStart: start, periodEnd: input.now };
}
