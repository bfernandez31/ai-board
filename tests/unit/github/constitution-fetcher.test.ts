/**
 * Unit Tests: Constitution Fetcher — default branch resolution
 *
 * Verifies that fetchConstitutionContent and updateConstitutionContent
 * resolve the repository's default branch via the GitHub API when no
 * explicit branch is provided, instead of hardcoding 'main'.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetContent, mockCreateOrUpdateFileContents } = vi.hoisted(() => ({
  mockGetContent: vi.fn(),
  mockCreateOrUpdateFileContents: vi.fn(),
}));

// Mock getDefaultBranch before importing the module under test
vi.mock('@/lib/github/default-branch', () => ({
  getDefaultBranch: vi.fn().mockResolvedValue('master'),
}));

// Mock Octokit as a class so `new Octokit(...)` works
vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    repos = {
      getContent: mockGetContent,
      createOrUpdateFileContents: mockCreateOrUpdateFileContents,
    };
  },
}));

import { fetchConstitutionContent, updateConstitutionContent } from '@/lib/github/constitution-fetcher';
import { getDefaultBranch } from '@/lib/github/default-branch';

describe('Constitution Fetcher — default branch resolution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure we're NOT in test mode so real code paths execute
    process.env.TEST_MODE = 'false';
    process.env.GITHUB_TOKEN = 'ghp_validtokenvalue123456';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('fetchConstitutionContent', () => {
    it('resolves default branch from API when branch is not provided', async () => {
      vi.mocked(getDefaultBranch).mockResolvedValue('master');
      mockGetContent.mockResolvedValue({
        data: {
          content: Buffer.from('# Constitution').toString('base64'),
          sha: 'abc123',
        },
      });

      await fetchConstitutionContent({ owner: 'org', repo: 'project' });

      expect(getDefaultBranch).toHaveBeenCalledOnce();
      expect(mockGetContent).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'master' })
      );
    });

    it('uses provided branch without calling getDefaultBranch', async () => {
      mockGetContent.mockResolvedValue({
        data: {
          content: Buffer.from('# Constitution').toString('base64'),
          sha: 'abc123',
        },
      });

      await fetchConstitutionContent({
        owner: 'org',
        repo: 'project',
        branch: 'feature-branch',
      });

      expect(getDefaultBranch).not.toHaveBeenCalled();
      expect(mockGetContent).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'feature-branch' })
      );
    });

    it('works correctly for repos with non-main default branch', async () => {
      vi.mocked(getDefaultBranch).mockResolvedValue('develop');
      mockGetContent.mockResolvedValue({
        data: {
          content: Buffer.from('# Constitution content').toString('base64'),
          sha: 'def456',
        },
      });

      const result = await fetchConstitutionContent({ owner: 'org', repo: 'project' });

      expect(mockGetContent).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'develop' })
      );
      expect(result.content).toBe('# Constitution content');
    });
  });

  describe('updateConstitutionContent', () => {
    it('resolves default branch from API when branch is not provided', async () => {
      vi.mocked(getDefaultBranch).mockResolvedValue('master');
      mockCreateOrUpdateFileContents.mockResolvedValue({
        data: { commit: { sha: 'commit-sha' } },
      });

      await updateConstitutionContent({
        owner: 'org',
        repo: 'project',
        content: '# Updated',
        sha: 'old-sha',
      });

      expect(getDefaultBranch).toHaveBeenCalledOnce();
      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'master' })
      );
    });

    it('uses provided branch without calling getDefaultBranch', async () => {
      mockCreateOrUpdateFileContents.mockResolvedValue({
        data: { commit: { sha: 'commit-sha' } },
      });

      await updateConstitutionContent({
        owner: 'org',
        repo: 'project',
        branch: 'my-branch',
        content: '# Updated',
        sha: 'old-sha',
      });

      expect(getDefaultBranch).not.toHaveBeenCalled();
      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'my-branch' })
      );
    });
  });
});
