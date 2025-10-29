import { describe, it, expect } from 'vitest';
import {
  classifyJobType,
  getJobTypeConfig,
} from '@/lib/utils/job-type-classifier';
import { JobType } from '@/lib/types/job-types';

describe('Job Type Classifier', () => {
  describe('classifyJobType', () => {
    it('should classify workflow commands as WORKFLOW', () => {
      expect(classifyJobType('specify')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('plan')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('tasks')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('implement')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('quick-impl')).toBe(JobType.WORKFLOW);
    });

    it('should classify AI-BOARD commands as AI_BOARD', () => {
      expect(classifyJobType('comment-specify')).toBe(JobType.AI_BOARD);
      expect(classifyJobType('comment-plan')).toBe(JobType.AI_BOARD);
      expect(classifyJobType('comment-build')).toBe(JobType.AI_BOARD);
      expect(classifyJobType('comment-verify')).toBe(JobType.AI_BOARD);
    });

    it('should default unknown commands to WORKFLOW', () => {
      expect(classifyJobType('unknown-command')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('')).toBe(JobType.WORKFLOW);
    });
  });

  describe('getJobTypeConfig', () => {
    it('should return correct config for WORKFLOW', () => {
      const config = getJobTypeConfig(JobType.WORKFLOW);
      expect(config.label).toBe('Workflow');
      expect(config.iconName).toBe('Cog');
      expect(config.iconColor).toBe('text-blue-600');
      expect(config.textColor).toBe('text-blue-600');
      expect(config.ariaLabel).toBe('Automated workflow job');
    });

    it('should return correct config for AI_BOARD', () => {
      const config = getJobTypeConfig(JobType.AI_BOARD);
      expect(config.label).toBe('AI-BOARD');
      expect(config.iconName).toBe('MessageSquare');
      expect(config.iconColor).toBe('text-purple-600');
      expect(config.textColor).toBe('text-purple-600');
      expect(config.ariaLabel).toBe('AI-BOARD assistance job');
    });
  });
});
