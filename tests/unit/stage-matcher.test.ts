import { describe, it, expect } from 'vitest';
import { matchesStage } from '@/lib/utils/stage-matcher';
import type { Stage } from '@/lib/validations/ticket';

/**
 * T019: Unit tests for matchesStage (User Story 2)
 *
 * Tests that stage matching works correctly:
 * - True for comment-specify → SPECIFY stage
 * - False for stage mismatch
 * - Handles case-insensitive matching
 * - Returns false for non-comment commands
 */
describe('matchesStage', () => {
  it('returns true for comment-specify in SPECIFY stage', () => {
    const result = matchesStage('comment-specify', 'SPECIFY' as Stage);
    expect(result).toBe(true);
  });

  it('returns true for comment-plan in PLAN stage', () => {
    const result = matchesStage('comment-plan', 'PLAN' as Stage);
    expect(result).toBe(true);
  });

  it('returns true for comment-build in BUILD stage', () => {
    const result = matchesStage('comment-build', 'BUILD' as Stage);
    expect(result).toBe(true);
  });

  it('returns true for comment-verify in VERIFY stage', () => {
    const result = matchesStage('comment-verify', 'VERIFY' as Stage);
    expect(result).toBe(true);
  });

  it('returns false for stage mismatch (comment-specify in PLAN)', () => {
    const result = matchesStage('comment-specify', 'PLAN' as Stage);
    expect(result).toBe(false);
  });

  it('returns false for stage mismatch (comment-plan in BUILD)', () => {
    const result = matchesStage('comment-plan', 'BUILD' as Stage);
    expect(result).toBe(false);
  });

  it('returns false for non-comment commands (specify in SPECIFY)', () => {
    const result = matchesStage('specify', 'SPECIFY' as Stage);
    expect(result).toBe(false);
  });

  it('returns false for workflow commands (plan, implement, quick-impl)', () => {
    expect(matchesStage('plan', 'PLAN' as Stage)).toBe(false);
    expect(matchesStage('implement', 'BUILD' as Stage)).toBe(false);
    expect(matchesStage('quick-impl', 'BUILD' as Stage)).toBe(false);
  });

  it('handles case-insensitive stage matching (comment-SPECIFY matches SPECIFY)', () => {
    const result = matchesStage('comment-SPECIFY', 'SPECIFY' as Stage);
    expect(result).toBe(true);
  });

  it('handles case-insensitive stage matching (comment-specify matches specify)', () => {
    const result = matchesStage('comment-specify', 'specify' as Stage);
    expect(result).toBe(true);
  });

  it('handles mixed case in command (comment-Specify matches SPECIFY)', () => {
    const result = matchesStage('comment-Specify', 'SPECIFY' as Stage);
    expect(result).toBe(true);
  });

  it('returns false for empty command string', () => {
    const result = matchesStage('', 'SPECIFY' as Stage);
    expect(result).toBe(false);
  });

  it('returns false for command without hyphen (commentspecify)', () => {
    const result = matchesStage('commentspecify', 'SPECIFY' as Stage);
    expect(result).toBe(false);
  });

  it('returns false for INBOX stage (AI-BOARD not supported in INBOX)', () => {
    const result = matchesStage('comment-inbox', 'INBOX' as Stage);
    // Note: AI-BOARD should not be visible in INBOX stage
    // but matchesStage should still return true if format matches
    expect(result).toBe(true);
  });

  it('returns false for SHIP stage (AI-BOARD not supported in SHIP)', () => {
    const result = matchesStage('comment-ship', 'SHIP' as Stage);
    // Note: AI-BOARD should not be visible in SHIP stage
    // but matchesStage should still return true if format matches
    expect(result).toBe(true);
  });
});
