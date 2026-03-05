/**
 * Integration Tests: /review Command Routing
 *
 * Tests for the /review command workflow routing configuration.
 * Since we can't execute GitHub workflows in tests, these tests verify:
 * 1. Workflow file contains correct routing patterns
 * 2. Error message templates are correctly formatted
 * 3. Command detection regex matches expected patterns
 *
 * Actual workflow execution is validated manually or via workflow test runs.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('/review Command Workflow Configuration', () => {
  let workflowContent: string;

  beforeAll(() => {
    const workflowPath = join(
      process.cwd(),
      '.github/workflows/ai-board-assist.yml'
    );
    workflowContent = readFileSync(workflowPath, 'utf-8');
  });

  describe('Command Pattern Detection', () => {
    it('should have /review command routing after /compare', () => {
      // Verify /review routing exists in workflow
      expect(workflowContent).toContain('grep -qE "/review\\b"');
    });

    it('should route /review to code-review with --force flag', () => {
      expect(workflowContent).toContain('/ai-board.code-review $PR_NUMBER --force');
    });

    it('should detect /review pattern before general ai-board-assist', () => {
      const compareIndex = workflowContent.indexOf('grep -qE "/compare\\b"');
      const reviewIndex = workflowContent.indexOf('grep -qE "/review\\b"');
      const generalIndex = workflowContent.indexOf(
        'Using ai-board.assist for general request'
      );

      // /review routing should be after /compare but before general handler
      expect(reviewIndex).toBeGreaterThan(compareIndex);
      expect(reviewIndex).toBeLessThan(generalIndex);
    });
  });

  describe('Stage Validation', () => {
    it('should check for verify stage before processing /review', () => {
      expect(workflowContent).toContain('"$STAGE" != "verify"');
    });

    it('should return error message for wrong stage', () => {
      expect(workflowContent).toContain(
        '/review command is only available in VERIFY stage'
      );
    });

    it('should include current stage in error message', () => {
      expect(workflowContent).toContain('Current stage: %s');
    });
  });

  describe('PR Lookup', () => {
    it('should use gh pr list to find PR by branch', () => {
      expect(workflowContent).toContain(
        'gh pr list --head "$BRANCH" --json number'
      );
    });

    it('should extract PR number with jq', () => {
      expect(workflowContent).toContain("--jq '.[0].number'");
    });

    it('should return error when no PR found', () => {
      expect(workflowContent).toContain('No PR found for branch');
    });
  });

  describe('Error Response Format', () => {
    it('should format wrong stage error with user mention', () => {
      // Check the error message template includes user mention pattern (printf format)
      expect(workflowContent).toContain('@[%s:%s] ❌ **Review Failed**');
    });

    it('should include actionable guidance in no-PR error', () => {
      expect(workflowContent).toContain(
        'Please ensure a PR has been created before requesting a review'
      );
    });
  });

  describe('Success Response Format', () => {
    it('should wrap response with user mention if not already present', () => {
      expect(workflowContent).toContain('@[%s:%s] ✅ **Code Review Complete**');
    });

    it('should include PR number in success message', () => {
      expect(workflowContent).toContain('Reviewed PR #%s');
    });

    it('should include branch name in success message', () => {
      expect(workflowContent).toContain('for branch `%s`');
    });
  });
});

describe('/review Command Code-Review Integration', () => {
  let codeReviewContent: string;

  beforeAll(() => {
    const codeReviewPath = join(
      process.cwd(),
      '.claude/commands/ai-board.code-review.md'
    );
    codeReviewContent = readFileSync(codeReviewPath, 'utf-8');
  });

  describe('--force Flag Support', () => {
    it('should document --force flag in command description', () => {
      expect(codeReviewContent).toContain('--force');
    });

    it('should explain --force flag skips existing review check', () => {
      expect(codeReviewContent).toContain(
        'skip check (d)'
      );
    });

    it('should mention --force allows re-reviews', () => {
      expect(codeReviewContent).toContain('re-review');
    });

    it('should preserve original eligibility checks (a, b, c)', () => {
      // The original checks should still be present
      expect(codeReviewContent).toContain('(a) is closed');
      expect(codeReviewContent).toContain('(b) is a draft');
      expect(codeReviewContent).toContain('(c) is very simple and obviously ok');
    });

    it('should conditionally skip check (d) based on --force flag', () => {
      // The new conditional logic for check (d)
      expect(codeReviewContent).toContain(
        'If the `--force` flag is provided in the arguments, skip check (d)'
      );
    });
  });
});
