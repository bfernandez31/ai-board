/**
 * Unit Tests: Constitution Scoring
 *
 * Tests the constitution compliance scoring for ticket comparison.
 */

import { describe, it, expect } from 'vitest';
import {
  CONSTITUTION_PRINCIPLES,
  scoreConstitutionCompliance,
  calculateComplianceScore,
  formatComplianceResult,
  checkPrincipleCompliance,
} from '@/lib/comparison/constitution-scoring';
import type { ConstitutionComplianceScore } from '@/lib/types/comparison';

describe('CONSTITUTION_PRINCIPLES', () => {
  it('should have 6 principles', () => {
    expect(CONSTITUTION_PRINCIPLES).toHaveLength(6);
  });

  it('should have sequential section numbers', () => {
    const sections = CONSTITUTION_PRINCIPLES.map((p) => p.section);
    expect(sections).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI']);
  });

  it('should have all required principle properties', () => {
    for (const principle of CONSTITUTION_PRINCIPLES) {
      expect(principle).toHaveProperty('section');
      expect(principle).toHaveProperty('name');
      expect(principle).toHaveProperty('description');
      expect(principle).toHaveProperty('checkPatterns');
      expect(principle.checkPatterns).toHaveProperty('positive');
      expect(principle.checkPatterns).toHaveProperty('negative');
      expect(Array.isArray(principle.checkPatterns.positive)).toBe(true);
      expect(Array.isArray(principle.checkPatterns.negative)).toBe(true);
    }
  });

  it('should include TypeScript-First Development', () => {
    const tsFirst = CONSTITUTION_PRINCIPLES.find(
      (p) => p.name === 'TypeScript-First Development'
    );
    expect(tsFirst).toBeDefined();
    expect(tsFirst?.section).toBe('I');
  });

  it('should include AI-First Development Model', () => {
    const aiFirst = CONSTITUTION_PRINCIPLES.find(
      (p) => p.name === 'AI-First Development Model'
    );
    expect(aiFirst).toBeDefined();
    expect(aiFirst?.section).toBe('VI');
  });
});

describe('checkPrincipleCompliance', () => {
  it('should pass TypeScript-First for code with strict types', () => {
    const code = `
      interface User {
        id: number;
        name: string;
      }

      function getUser(id: number): User {
        return { id, name: 'Test' };
      }
    `;

    const result = checkPrincipleCompliance(
      CONSTITUTION_PRINCIPLES[0]!, // TypeScript-First
      code,
      ''
    );

    expect(result.passed).toBe(true);
  });

  it('should fail TypeScript-First for code with any types', () => {
    const code = `
      function processData(data: any): any {
        return data;
      }
    `;

    const result = checkPrincipleCompliance(
      CONSTITUTION_PRINCIPLES[0]!, // TypeScript-First
      code,
      ''
    );

    expect(result.passed).toBe(false);
    expect(result.notes).toContain('any');
  });

  it('should pass Component-Driven for proper shadcn usage', () => {
    const code = `
      import { Button } from '@/components/ui/button';
      import { Dialog } from '@/components/ui/dialog';

      export function MyComponent() {
        return <Button>Click me</Button>;
      }
    `;

    const result = checkPrincipleCompliance(
      CONSTITUTION_PRINCIPLES[1]!, // Component-Driven
      code,
      ''
    );

    expect(result.passed).toBe(true);
  });

  it('should pass Test-Driven when tests exist', () => {
    const result = checkPrincipleCompliance(
      CONSTITUTION_PRINCIPLES[2]!, // Test-Driven
      '',
      'describe("test", () => { it("works", () => { expect(true).toBe(true); }) });'
    );

    expect(result.passed).toBe(true);
  });

  it('should fail Test-Driven when no tests exist', () => {
    const result = checkPrincipleCompliance(
      CONSTITUTION_PRINCIPLES[2]!, // Test-Driven
      '',
      ''
    );

    expect(result.passed).toBe(false);
    expect(result.notes).toContain('test');
  });

  it('should pass Security-First with validation patterns', () => {
    const code = `
      import { z } from 'zod';

      const schema = z.object({
        name: z.string(),
      });

      const validated = schema.parse(input);
    `;

    const result = checkPrincipleCompliance(
      CONSTITUTION_PRINCIPLES[3]!, // Security-First
      code,
      ''
    );

    expect(result.passed).toBe(true);
  });

  it('should fail Security-First with raw SQL', () => {
    const code = `
      const query = "SELECT * FROM users WHERE id = " + userId;
      await db.execute(query);
    `;

    const result = checkPrincipleCompliance(
      CONSTITUTION_PRINCIPLES[3]!, // Security-First
      code,
      ''
    );

    expect(result.passed).toBe(false);
  });

  it('should pass Database Integrity with Prisma patterns', () => {
    const code = `
      import { prisma } from '@/lib/db';

      await prisma.user.create({
        data: { name: 'Test' }
      });
    `;

    const result = checkPrincipleCompliance(
      CONSTITUTION_PRINCIPLES[4]!, // Database Integrity
      code,
      ''
    );

    expect(result.passed).toBe(true);
  });

  it('should pass AI-First Development for spec-driven code', () => {
    const planContent = `
      ## Summary
      This feature implements ticket comparison.

      ## Technical Context
      Uses TypeScript and Prisma.
    `;

    const result = checkPrincipleCompliance(
      CONSTITUTION_PRINCIPLES[5]!, // AI-First
      '',
      '',
      planContent
    );

    expect(result.passed).toBe(true);
  });
});

describe('calculateComplianceScore', () => {
  it('should return 100% for all passed principles', () => {
    const principles = [
      { section: 'I', name: 'Test 1', passed: true, notes: '' },
      { section: 'II', name: 'Test 2', passed: true, notes: '' },
      { section: 'III', name: 'Test 3', passed: true, notes: '' },
    ];

    const score = calculateComplianceScore(principles);

    expect(score.overall).toBe(100);
    expect(score.passedPrinciples).toBe(3);
    expect(score.totalPrinciples).toBe(3);
  });

  it('should return 0% for all failed principles', () => {
    const principles = [
      { section: 'I', name: 'Test 1', passed: false, notes: 'Failed' },
      { section: 'II', name: 'Test 2', passed: false, notes: 'Failed' },
    ];

    const score = calculateComplianceScore(principles);

    expect(score.overall).toBe(0);
    expect(score.passedPrinciples).toBe(0);
    expect(score.totalPrinciples).toBe(2);
  });

  it('should calculate partial compliance correctly', () => {
    const principles = [
      { section: 'I', name: 'Test 1', passed: true, notes: '' },
      { section: 'II', name: 'Test 2', passed: true, notes: '' },
      { section: 'III', name: 'Test 3', passed: false, notes: 'Failed' },
      { section: 'IV', name: 'Test 4', passed: true, notes: '' },
    ];

    const score = calculateComplianceScore(principles);

    expect(score.overall).toBe(75);
    expect(score.passedPrinciples).toBe(3);
    expect(score.totalPrinciples).toBe(4);
  });

  it('should round to nearest integer', () => {
    const principles = [
      { section: 'I', name: 'Test 1', passed: true, notes: '' },
      { section: 'II', name: 'Test 2', passed: false, notes: 'Failed' },
      { section: 'III', name: 'Test 3', passed: false, notes: 'Failed' },
    ];

    const score = calculateComplianceScore(principles);

    expect(Number.isInteger(score.overall)).toBe(true);
    expect(score.overall).toBe(33);
  });

  it('should include all principles in result', () => {
    const principles = [
      { section: 'I', name: 'Test 1', passed: true, notes: 'Good' },
      { section: 'II', name: 'Test 2', passed: false, notes: 'Bad' },
    ];

    const score = calculateComplianceScore(principles);

    expect(score.principles).toHaveLength(2);
    expect(score.principles[0]).toEqual(principles[0]);
    expect(score.principles[1]).toEqual(principles[1]);
  });
});

describe('scoreConstitutionCompliance', () => {
  it('should score all 6 principles', () => {
    const result = scoreConstitutionCompliance(
      'const x: string = "test";',
      'describe("test", () => { it("works", () => {}) });',
      '## Plan content'
    );

    expect(result.totalPrinciples).toBe(6);
    expect(result.principles).toHaveLength(6);
  });

  it('should return high score for compliant code', () => {
    const code = `
      import { z } from 'zod';
      import { prisma } from '@/lib/db';
      import { Button } from '@/components/ui/button';

      interface User {
        id: number;
        name: string;
      }

      const schema = z.object({ name: z.string() });

      export async function getUser(id: number): Promise<User> {
        return prisma.user.findUnique({ where: { id } });
      }
    `;

    const testContent = 'describe("User", () => { it("works", () => {}) });';
    const planContent = '## Summary\nImplementation plan.';

    const result = scoreConstitutionCompliance(code, testContent, planContent);

    expect(result.overall).toBeGreaterThanOrEqual(80);
  });

  it('should return low score for non-compliant code', () => {
    const code = `
      function process(data: any): any {
        const query = "SELECT * FROM users WHERE id = " + data.id;
        return fetch(query);
      }
    `;

    const result = scoreConstitutionCompliance(code, '', '');

    // At least some principles should fail due to 'any' usage and raw SQL
    expect(result.overall).toBeLessThanOrEqual(67); // At most 4/6 principles pass
    expect(result.passedPrinciples).toBeLessThan(5);
  });

  it('should handle empty inputs gracefully', () => {
    const result = scoreConstitutionCompliance('', '', '');

    expect(result.totalPrinciples).toBe(6);
    expect(typeof result.overall).toBe('number');
  });
});

describe('formatComplianceResult', () => {
  it('should format passing score with checkmark', () => {
    const score: ConstitutionComplianceScore = {
      overall: 100,
      totalPrinciples: 6,
      passedPrinciples: 6,
      principles: [],
    };

    const formatted = formatComplianceResult(score);

    expect(formatted).toContain('100%');
    expect(formatted).toContain('6/6');
  });

  it('should format failing score with warning', () => {
    const score: ConstitutionComplianceScore = {
      overall: 50,
      totalPrinciples: 6,
      passedPrinciples: 3,
      principles: [],
    };

    const formatted = formatComplianceResult(score);

    expect(formatted).toContain('50%');
    expect(formatted).toContain('3/6');
  });

  it('should include principle details when requested', () => {
    const score: ConstitutionComplianceScore = {
      overall: 83,
      totalPrinciples: 6,
      passedPrinciples: 5,
      principles: [
        {
          section: 'I',
          name: 'TypeScript-First',
          passed: true,
          notes: 'All types explicit',
        },
        {
          section: 'II',
          name: 'Component-Driven',
          passed: false,
          notes: 'Missing shadcn usage',
        },
      ],
    };

    const formatted = formatComplianceResult(score, true);

    expect(formatted).toContain('TypeScript-First');
    expect(formatted).toContain('Component-Driven');
    expect(formatted).toContain('Missing shadcn usage');
  });
});
