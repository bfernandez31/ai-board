/**
 * Spec Section Parser
 *
 * Parses specification markdown documents to extract structured sections
 * for feature alignment calculation.
 */

import { remark } from 'remark';
import type { Root, Heading } from 'mdast';
import type { SpecSections } from '@/lib/types/comparison';
import { tokenize } from './similarity-algorithms';

/**
 * Extract text content from an mdast node recursively
 */
function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';

  const typedNode = node as { type?: string; value?: string; children?: unknown[] };

  if (typedNode.type === 'text' && typeof typedNode.value === 'string') {
    return typedNode.value;
  }

  if (Array.isArray(typedNode.children)) {
    return typedNode.children.map(extractText).join(' ');
  }

  return '';
}

/**
 * Get heading text from an mdast heading node
 */
function getHeadingText(node: Heading): string {
  return extractText(node).trim();
}

/**
 * Check if a node is a heading
 */
function isHeading(node: unknown): node is Heading {
  return !!node && typeof node === 'object' && (node as { type?: string }).type === 'heading';
}

/**
 * Extract sections from markdown AST
 *
 * Groups content by headings, creating a map of section name to content.
 */
function extractSectionsByHeading(ast: Root): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentSection = 'intro';
  let currentContent: string[] = [];

  for (const node of ast.children) {
    if (isHeading(node)) {
      // Save previous section
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n');
      }

      // Start new section
      currentSection = getHeadingText(node).toLowerCase();
      currentContent = [];
    } else {
      // Add content to current section
      currentContent.push(extractText(node));
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n');
  }

  return sections;
}

/**
 * Extract functional requirements (FR-XXX pattern)
 */
function extractRequirements(content: string): string[] {
  const reqRegex = /\bFR-\d{3}\b/g;
  const matches = content.match(reqRegex);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Extract user scenarios (US-XXX or "User Story" patterns)
 */
function extractScenarios(content: string): string[] {
  const scenarios: string[] = [];

  // Match US-XXX pattern
  const usRegex = /\bUS-?\d+\b/gi;
  const usMatches = content.match(usRegex);
  if (usMatches) {
    scenarios.push(...usMatches.map((m) => m.toUpperCase()));
  }

  // Match "User Story X" pattern
  const storyRegex = /User Story\s*\d+/gi;
  const storyMatches = content.match(storyRegex);
  if (storyMatches) {
    scenarios.push(...storyMatches.map((m) => m.replace(/\s+/g, ' ')));
  }

  // Match priority patterns like "P1:", "P2:", "P3:" with context
  const priorityRegex = /\((P[123])\)/g;
  const priorityMatches = content.match(priorityRegex);
  if (priorityMatches) {
    scenarios.push(...priorityMatches);
  }

  return Array.from(new Set(scenarios));
}

/**
 * Extract entity names from content
 *
 * Looks for PascalCase words, words in backticks, and words after "Entity:" or similar patterns.
 */
function extractEntities(content: string): string[] {
  const entities: string[] = [];

  // Match PascalCase words (likely entity names)
  const pascalRegex = /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g;
  const pascalMatches = content.match(pascalRegex);
  if (pascalMatches) {
    entities.push(...pascalMatches);
  }

  // Match words in backticks that look like entity names
  const backtickRegex = /`([A-Z][a-zA-Z]+)`/g;
  let match;
  while ((match = backtickRegex.exec(content)) !== null) {
    if (match[1]) entities.push(match[1]);
  }

  // Match explicit entity declarations
  const entityDeclRegex = /(?:Entity|Model|Table|Interface):\s*`?(\w+)`?/gi;
  while ((match = entityDeclRegex.exec(content)) !== null) {
    if (match[1]) entities.push(match[1]);
  }

  // Match TypeScript interface declarations
  const interfaceRegex = /interface\s+(\w+)/g;
  while ((match = interfaceRegex.exec(content)) !== null) {
    if (match[1]) entities.push(match[1]);
  }

  return Array.from(new Set(entities));
}

/**
 * Extract keywords from content
 *
 * Returns significant words after removing common stopwords.
 */
function extractKeywords(content: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'can', 'will', 'just', 'should', 'now', 'also', 'use', 'using', 'used',
    'be', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'doing', 'would', 'could', 'shall', 'may', 'might',
    'must', 'need', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'its', 'his', 'her',
    'their', 'my', 'your', 'our', 'if', 'as', 'vs', 'etc', 'ie', 'eg',
  ]);

  const tokens = tokenize(content, 3); // Minimum 3 chars
  return tokens.filter((t) => !stopwords.has(t) && t.length <= 30);
}

/**
 * Parse a specification document and extract structured sections
 *
 * @param markdown - Markdown content of the specification
 * @returns Extracted spec sections for comparison
 */
export async function parseSpecSections(markdown: string): Promise<SpecSections> {
  // Parse markdown to AST
  const ast = remark().parse(markdown);

  // Extract sections by heading
  const rawSections = extractSectionsByHeading(ast);

  // Combine all content for extraction
  const allContent = Object.values(rawSections).join('\n');

  // Extract structured data
  const requirements = extractRequirements(allContent);
  const scenarios = extractScenarios(allContent);
  const entities = extractEntities(allContent);
  const keywords = extractKeywords(allContent);

  return {
    requirements,
    scenarios,
    entities,
    keywords,
    rawSections,
  };
}

/**
 * Parse spec synchronously (for simpler use cases)
 */
export function parseSpecSectionsSync(markdown: string): SpecSections {
  // Parse markdown to AST
  const ast = remark().parse(markdown);

  // Extract sections by heading
  const rawSections = extractSectionsByHeading(ast);

  // Combine all content for extraction
  const allContent = Object.values(rawSections).join('\n');

  // Extract structured data
  const requirements = extractRequirements(allContent);
  const scenarios = extractScenarios(allContent);
  const entities = extractEntities(allContent);
  const keywords = extractKeywords(allContent);

  return {
    requirements,
    scenarios,
    entities,
    keywords,
    rawSections,
  };
}

/**
 * Get specific section content by name (case-insensitive)
 */
export function getSectionContent(
  sections: SpecSections,
  sectionName: string
): string | undefined {
  const lowerName = sectionName.toLowerCase();

  // Direct match
  if (sections.rawSections[lowerName]) {
    return sections.rawSections[lowerName];
  }

  // Partial match (section name contains search term)
  for (const [key, value] of Object.entries(sections.rawSections)) {
    if (key.includes(lowerName)) {
      return value;
    }
  }

  return undefined;
}

/**
 * Extract acceptance criteria from spec
 */
export function extractAcceptanceCriteria(sections: SpecSections): string[] {
  const criteria: string[] = [];

  // Look for sections containing acceptance criteria
  for (const [key, value] of Object.entries(sections.rawSections)) {
    if (key.includes('acceptance') || key.includes('criteria') || key.includes('given')) {
      // Extract bullet points
      const bulletRegex = /^[\s-*]+(.+)$/gm;
      let match;
      while ((match = bulletRegex.exec(value)) !== null) {
        if (match[1] && match[1].trim()) {
          criteria.push(match[1].trim());
        }
      }
    }
  }

  // Also extract Given/When/Then patterns
  const allContent = Object.values(sections.rawSections).join('\n');
  const gwtRegex = /(?:Given|When|Then)\s+(.+?)(?=\n|$)/gi;
  let match;
  while ((match = gwtRegex.exec(allContent)) !== null) {
    if (match[0]) criteria.push(match[0].trim());
  }

  return Array.from(new Set(criteria));
}

/**
 * Calculate a basic similarity score between two spec sections
 */
export function compareSpecSections(
  spec1: SpecSections,
  spec2: SpecSections
): { overlap: number; matchedItems: string[] } {
  const allItems1 = [
    ...spec1.requirements,
    ...spec1.scenarios,
    ...spec1.entities,
  ];
  const allItems2 = [
    ...spec2.requirements,
    ...spec2.scenarios,
    ...spec2.entities,
  ];

  const set1 = new Set(allItems1.map((i) => i.toLowerCase()));
  const set2 = new Set(allItems2.map((i) => i.toLowerCase()));

  const intersection = [...set1].filter((x) => set2.has(x));

  const union = new Set([...set1, ...set2]);

  return {
    overlap: union.size > 0 ? intersection.length / union.size : 0,
    matchedItems: intersection,
  };
}
