/**
 * Integration Tests: Projects API with Health Score
 *
 * Verifies that GET /api/projects includes healthScore data
 * from the HealthScore relation when available.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Projects API with Health Score', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should include healthScore for projects with health data', async () => {
    const prisma = getPrismaClient();

    // Create a health score for the test project
    await prisma.healthScore.upsert({
      where: { projectId: ctx.projectId },
      update: {
        globalScore: 85,
        securityScore: 90,
        complianceScore: 80,
        testsScore: 75,
        specSyncScore: 88,
        qualityGate: 92,
        reviewQualityScore: 70,
      },
      create: {
        projectId: ctx.projectId,
        globalScore: 85,
        securityScore: 90,
        complianceScore: 80,
        testsScore: 75,
        specSyncScore: 88,
        qualityGate: 92,
        reviewQualityScore: 70,
      },
    });

    const response = await ctx.api.get<Array<{
      id: number;
      healthScore: {
        globalScore: number | null;
        securityScore: number | null;
        complianceScore: number | null;
        testsScore: number | null;
        specSyncScore: number | null;
        qualityGate: number | null;
        reviewQualityScore: number | null;
      } | null;
    }>>('/api/projects');

    expect(response.status).toBe(200);

    const project = response.data.find((p) => p.id === ctx.projectId);
    expect(project).toBeDefined();
    expect(project!.healthScore).not.toBeNull();
    expect(project!.healthScore).toEqual({
      globalScore: 85,
      securityScore: 90,
      complianceScore: 80,
      testsScore: 75,
      specSyncScore: 88,
      qualityGate: 92,
      reviewQualityScore: 70,
    });
  });

  it('should return healthScore: null for projects without health data', async () => {
    const prisma = getPrismaClient();

    // Ensure no health score exists for the test project
    await prisma.healthScore.deleteMany({
      where: { projectId: ctx.projectId },
    });

    const response = await ctx.api.get<Array<{
      id: number;
      healthScore: null;
    }>>('/api/projects');

    expect(response.status).toBe(200);

    const project = response.data.find((p) => p.id === ctx.projectId);
    expect(project).toBeDefined();
    expect(project!.healthScore).toBeNull();
  });

  it('should correctly serialize all 7 health score fields', async () => {
    const prisma = getPrismaClient();

    // Create health score with some null sub-scores
    await prisma.healthScore.upsert({
      where: { projectId: ctx.projectId },
      update: {
        globalScore: 60,
        securityScore: 70,
        complianceScore: null,
        testsScore: 50,
        specSyncScore: null,
        qualityGate: 80,
        reviewQualityScore: null,
      },
      create: {
        projectId: ctx.projectId,
        globalScore: 60,
        securityScore: 70,
        complianceScore: null,
        testsScore: 50,
        specSyncScore: null,
        qualityGate: 80,
        reviewQualityScore: null,
      },
    });

    const response = await ctx.api.get<Array<{
      id: number;
      healthScore: {
        globalScore: number | null;
        securityScore: number | null;
        complianceScore: number | null;
        testsScore: number | null;
        specSyncScore: number | null;
        qualityGate: number | null;
        reviewQualityScore: number | null;
      } | null;
    }>>('/api/projects');

    expect(response.status).toBe(200);

    const project = response.data.find((p) => p.id === ctx.projectId);
    expect(project).toBeDefined();
    expect(project!.healthScore).toEqual({
      globalScore: 60,
      securityScore: 70,
      complianceScore: null,
      testsScore: 50,
      specSyncScore: null,
      qualityGate: 80,
      reviewQualityScore: null,
    });

    // Verify all 7 fields are present
    const keys = Object.keys(project!.healthScore!);
    expect(keys).toHaveLength(7);
    expect(keys).toEqual(expect.arrayContaining([
      'globalScore', 'securityScore', 'complianceScore',
      'testsScore', 'specSyncScore', 'qualityGate', 'reviewQualityScore',
    ]));
  });

  it('should return health scores for all projects in a single request (no separate health endpoint)', async () => {
    const response = await ctx.api.get<Array<{
      id: number;
      healthScore: {
        globalScore: number | null;
        securityScore: number | null;
        complianceScore: number | null;
        testsScore: number | null;
        specSyncScore: number | null;
        qualityGate: number | null;
        reviewQualityScore: number | null;
      } | null;
    }>>('/api/projects');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);

    // Every project in the response must have a healthScore field (either object or null)
    for (const project of response.data) {
      expect(project).toHaveProperty('healthScore');
    }
  });
});
