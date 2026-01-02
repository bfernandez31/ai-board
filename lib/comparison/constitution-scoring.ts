/**
 * Constitution Compliance Scoring
 *
 * Scores ticket implementations against project constitution principles.
 * Each principle is evaluated with a binary pass/fail based on pattern matching.
 */

import type {
  ConstitutionComplianceScore,
  ConstitutionPrinciple,
} from '@/lib/types/comparison';

/**
 * Constitution principle definition with check patterns
 */
interface PrincipleDefinition {
  section: string;
  name: string;
  description: string;
  checkPatterns: {
    positive: RegExp[]; // Patterns that indicate compliance
    negative: RegExp[]; // Patterns that indicate violation
    required: boolean; // Whether positive patterns must be found
  };
}

/**
 * The 6 constitution principles with check patterns
 */
export const CONSTITUTION_PRINCIPLES: PrincipleDefinition[] = [
  {
    section: 'I',
    name: 'TypeScript-First Development',
    description:
      'All code uses TypeScript strict mode with explicit type annotations, no any types',
    checkPatterns: {
      positive: [
        /interface\s+\w+/,
        /type\s+\w+\s*=/,
        /:\s*(string|number|boolean|object|Promise|Record|Array)/,
        /function\s+\w+\([^)]*\):\s*\w+/,
        /=>\s*\w+\s*{/,
      ],
      negative: [
        /:\s*any\b(?!\s*\/\/\s*justified)/i,
        /as\s+any\b/,
        /<any>/,
      ],
      required: false,
    },
  },
  {
    section: 'II',
    name: 'Component-Driven Architecture',
    description:
      'UI uses shadcn/ui components, follows feature folder structure',
    checkPatterns: {
      positive: [
        /@\/components\/ui\//,
        /from\s+['"]@\/components/,
        /"use client"/,
        /export\s+(default\s+)?function\s+\w+/,
      ],
      negative: [
        /import.*from\s+['"]@mui\//,
        /import.*from\s+['"]antd/,
        /import.*from\s+['"]bootstrap/,
        /styled-components/,
      ],
      required: false,
    },
  },
  {
    section: 'III',
    name: 'Test-Driven Development',
    description:
      'Tests verify behavior using Testing Trophy strategy (unit, integration, E2E)',
    checkPatterns: {
      positive: [
        /describe\s*\(/,
        /it\s*\(/,
        /test\s*\(/,
        /expect\s*\(/,
        /\.test\.ts/,
        /\.spec\.ts/,
      ],
      negative: [],
      required: true,
    },
  },
  {
    section: 'IV',
    name: 'Security-First Design',
    description:
      'Input validation with Zod, Prisma parameterized queries, no exposed secrets',
    checkPatterns: {
      positive: [
        /z\.(object|string|number|boolean|array)/,
        /\.parse\(/,
        /\.safeParse\(/,
        /prisma\.\w+\.(find|create|update|delete)/,
        /getServerSession/,
        /verifyProjectAccess/,
      ],
      negative: [
        /SELECT\s+.*FROM\s+.*WHERE\s+.*\+/i,
        /INSERT\s+INTO.*\+/i,
        /process\.env\.\w+.*\+.*query/i,
        /password\s*[=:]\s*['"][^'"]+['"]/,
        /apiKey\s*[=:]\s*['"][^'"]+['"]/,
      ],
      required: false,
    },
  },
  {
    section: 'V',
    name: 'Database Integrity',
    description:
      'All schema changes via Prisma migrations, transactions for multi-step operations',
    checkPatterns: {
      positive: [
        /prisma\./,
        /\$transaction/,
        /\.create\(/,
        /\.update\(/,
        /\.delete\(/,
        /\.findUnique\(/,
        /\.findMany\(/,
      ],
      negative: [
        /raw\s*\(/,
        /\$executeRaw(?!Unsafe)/,
        /\$queryRaw(?!Unsafe)/,
      ],
      required: false,
    },
  },
  {
    section: 'VI',
    name: 'AI-First Development Model',
    description:
      'Spec-driven development, no human-oriented documentation at project root',
    checkPatterns: {
      positive: [
        /##\s+(Summary|Technical|Requirements)/,
        /spec\.md/,
        /plan\.md/,
        /tasks\.md/,
        /specs\//,
      ],
      negative: [
        /README\.md.*tutorial/i,
        /GUIDE\.md/i,
        /HOW-TO/i,
        /getting-started/i,
      ],
      required: false,
    },
  },
];

/**
 * Check compliance for a single principle
 */
export function checkPrincipleCompliance(
  principle: PrincipleDefinition,
  codeContent: string,
  testContent: string,
  planContent: string = ''
): ConstitutionPrinciple {
  const allContent = `${codeContent}\n${testContent}\n${planContent}`;

  // Check for negative patterns (violations)
  const violations: string[] = [];
  for (const pattern of principle.checkPatterns.negative) {
    if (pattern.test(allContent)) {
      violations.push(pattern.source);
    }
  }

  // Check for positive patterns (compliance indicators)
  const compliant: string[] = [];
  for (const pattern of principle.checkPatterns.positive) {
    if (pattern.test(allContent)) {
      compliant.push(pattern.source);
    }
  }

  // Determine pass/fail
  let passed: boolean;
  let notes: string;

  if (violations.length > 0) {
    // Any violation means fail
    passed = false;
    notes = `Violations found: ${violations.slice(0, 2).join(', ')}`;
  } else if (principle.checkPatterns.required && compliant.length === 0) {
    // Required patterns not found
    passed = false;
    notes = `No ${principle.name.toLowerCase().replace(/-/g, ' ')} patterns detected`;
  } else if (compliant.length > 0) {
    // Has positive patterns, no violations
    passed = true;
    notes = `Compliant (${compliant.length} patterns matched)`;
  } else {
    // No patterns either way, default to pass for non-required
    passed = true;
    notes = 'No relevant code detected';
  }

  return {
    section: principle.section,
    name: principle.name,
    passed,
    notes,
  };
}

/**
 * Calculate overall compliance score from principle results
 */
export function calculateComplianceScore(
  principles: ConstitutionPrinciple[]
): ConstitutionComplianceScore {
  const totalPrinciples = principles.length;
  const passedPrinciples = principles.filter((p) => p.passed).length;

  const overall =
    totalPrinciples > 0
      ? Math.round((passedPrinciples / totalPrinciples) * 100)
      : 0;

  return {
    overall,
    totalPrinciples,
    passedPrinciples,
    principles,
  };
}

/**
 * Score constitution compliance for a ticket's implementation
 *
 * @param codeContent - Combined code content from implementation files
 * @param testContent - Combined test file content
 * @param planContent - Plan/spec document content
 * @returns Compliance score with principle breakdown
 */
export function scoreConstitutionCompliance(
  codeContent: string,
  testContent: string,
  planContent: string = ''
): ConstitutionComplianceScore {
  const principles: ConstitutionPrinciple[] = [];

  for (const definition of CONSTITUTION_PRINCIPLES) {
    const result = checkPrincipleCompliance(
      definition,
      codeContent,
      testContent,
      planContent
    );
    principles.push(result);
  }

  return calculateComplianceScore(principles);
}

/**
 * Create an empty/unknown compliance score
 */
export function createEmptyComplianceScore(
  _ticketKey: string
): ConstitutionComplianceScore {
  return {
    overall: 0,
    totalPrinciples: 6,
    passedPrinciples: 0,
    principles: CONSTITUTION_PRINCIPLES.map((p) => ({
      section: p.section,
      name: p.name,
      passed: false,
      notes: 'Unable to analyze - no code available',
    })),
  };
}

/**
 * Format compliance result for display
 *
 * @param score - Compliance score to format
 * @param includeDetails - Whether to include principle-level details
 * @returns Formatted string representation
 */
export function formatComplianceResult(
  score: ConstitutionComplianceScore,
  includeDetails: boolean = false
): string {
  let result = `Constitution Compliance: ${score.overall}% (${score.passedPrinciples}/${score.totalPrinciples} principles)`;

  if (includeDetails && score.principles.length > 0) {
    result += '\n\nPrinciple Breakdown:\n';
    for (const p of score.principles) {
      const status = p.passed ? '✅' : '❌';
      result += `${status} ${p.section}. ${p.name}: ${p.notes}\n`;
    }
  }

  return result;
}

/**
 * Compare compliance scores between two tickets
 */
export function compareComplianceScores(
  score1: ConstitutionComplianceScore,
  score2: ConstitutionComplianceScore
): {
  overallDiff: number;
  principlesDiff: number;
  betterScore: 'first' | 'second' | 'equal';
} {
  const overallDiff = score2.overall - score1.overall;
  const principlesDiff = score2.passedPrinciples - score1.passedPrinciples;

  let betterScore: 'first' | 'second' | 'equal';
  if (overallDiff > 0) {
    betterScore = 'second';
  } else if (overallDiff < 0) {
    betterScore = 'first';
  } else {
    betterScore = 'equal';
  }

  return { overallDiff, principlesDiff, betterScore };
}
