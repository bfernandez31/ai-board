#!/usr/bin/env node

/**
 * Analyze test files to identify duplicates, overlaps, and redundancies
 *
 * This script identifies:
 * 1. Tests with similar names/descriptions
 * 2. Tests hitting the same endpoints
 * 3. Tests with identical assertions
 * 4. Tests that could be consolidated
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const TEST_DIR = path.join(process.cwd(), 'tests');
const MIN_SIMILARITY_SCORE = 0.7; // 70% similarity threshold

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[len2][len1];
}

/**
 * Calculate similarity score between two strings
 */
function similarityScore(str1, str2) {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return (maxLength - distance) / maxLength;
}

/**
 * Extract test information from file content
 */
function extractTestInfo(filePath, content) {
  const tests = [];
  const endpoints = new Set();
  const assertions = [];

  // Extract test descriptions
  const testMatches = content.matchAll(/(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g);
  for (const match of testMatches) {
    tests.push({
      description: match[1],
      file: path.relative(process.cwd(), filePath),
    });
  }

  // Extract describe blocks
  const describeMatches = content.matchAll(/describe\s*\(\s*['"`]([^'"`]+)['"`]/g);
  const describes = Array.from(describeMatches).map(m => m[1]);

  // Extract API endpoints
  const endpointMatches = content.matchAll(/(?:request|fetch|api|get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
  for (const match of endpointMatches) {
    if (match[1].includes('/api/')) {
      endpoints.add(match[1]);
    }
  }

  // Extract common assertions
  const expectMatches = content.matchAll(/expect\s*\([^)]+\)\s*\.\s*(\w+)/g);
  for (const match of expectMatches) {
    assertions.push(match[1]);
  }

  return {
    filePath,
    tests,
    describes,
    endpoints: Array.from(endpoints),
    assertions,
    testCount: tests.length,
  };
}

/**
 * Find duplicate or similar tests
 */
function findDuplicates(allTestInfo) {
  const duplicates = [];
  const similarTests = [];
  const endpointCoverage = {};
  const testCategories = {};

  // Build endpoint coverage map
  allTestInfo.forEach(info => {
    info.endpoints.forEach(endpoint => {
      if (!endpointCoverage[endpoint]) {
        endpointCoverage[endpoint] = [];
      }
      endpointCoverage[endpoint].push(info.filePath);
    });
  });

  // Find similar test descriptions across files
  for (let i = 0; i < allTestInfo.length; i++) {
    for (let j = i + 1; j < allTestInfo.length; j++) {
      const file1 = allTestInfo[i];
      const file2 = allTestInfo[j];

      file1.tests.forEach(test1 => {
        file2.tests.forEach(test2 => {
          const score = similarityScore(test1.description, test2.description);
          if (score >= MIN_SIMILARITY_SCORE) {
            similarTests.push({
              test1: test1.description,
              file1: test1.file,
              test2: test2.description,
              file2: test2.file,
              similarity: Math.round(score * 100),
            });
          }
        });
      });
    }
  }

  // Categorize tests by type
  allTestInfo.forEach(info => {
    const category = detectTestCategory(info);
    if (!testCategories[category]) {
      testCategories[category] = [];
    }
    testCategories[category].push({
      file: info.filePath,
      testCount: info.testCount,
      endpoints: info.endpoints,
    });
  });

  return {
    similarTests,
    endpointCoverage,
    testCategories,
  };
}

/**
 * Detect test category based on file path and content
 */
function detectTestCategory(testInfo) {
  const filePath = testInfo.filePath.toLowerCase();

  if (filePath.includes('/api/')) return 'API';
  if (filePath.includes('/e2e/')) return 'E2E';
  if (filePath.includes('/integration/')) return 'Integration';
  if (filePath.includes('/database/')) return 'Database';
  if (filePath.includes('/unit/')) return 'Unit';
  if (filePath.includes('ticket')) return 'Tickets';
  if (filePath.includes('project')) return 'Projects';
  if (filePath.includes('comment')) return 'Comments';
  if (filePath.includes('job')) return 'Jobs';
  if (filePath.includes('auth')) return 'Auth';

  return 'Other';
}

/**
 * Analyze test overlap and generate recommendations
 */
function analyzeOverlap(duplicates) {
  const recommendations = [];

  // Analyze endpoint coverage
  const overTestedEndpoints = Object.entries(duplicates.endpointCoverage)
    .filter(([endpoint, files]) => files.length > 2)
    .sort((a, b) => b[1].length - a[1].length);

  if (overTestedEndpoints.length > 0) {
    recommendations.push({
      type: 'OVER_TESTED_ENDPOINTS',
      severity: 'medium',
      items: overTestedEndpoints.map(([endpoint, files]) => ({
        endpoint,
        fileCount: files.length,
        files: files.map(f => path.relative(process.cwd(), f)),
      })),
    });
  }

  // Analyze similar tests
  const highSimilarity = duplicates.similarTests
    .filter(t => t.similarity >= 85)
    .sort((a, b) => b.similarity - a.similarity);

  if (highSimilarity.length > 0) {
    recommendations.push({
      type: 'DUPLICATE_TESTS',
      severity: 'high',
      items: highSimilarity,
    });
  }

  // Analyze test categories for consolidation opportunities
  const largeCategories = Object.entries(duplicates.testCategories)
    .filter(([category, files]) => files.length > 5)
    .map(([category, files]) => ({
      category,
      fileCount: files.length,
      totalTests: files.reduce((sum, f) => sum + f.testCount, 0),
      avgTestsPerFile: Math.round(files.reduce((sum, f) => sum + f.testCount, 0) / files.length),
    }));

  if (largeCategories.length > 0) {
    recommendations.push({
      type: 'CONSOLIDATION_OPPORTUNITY',
      severity: 'low',
      items: largeCategories,
    });
  }

  return recommendations;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Analyzing test files for duplicates and overlaps...\n');

  // Find all test files
  const testFiles = glob.sync('**/*.spec.ts', {
    cwd: TEST_DIR,
    ignore: ['**/node_modules/**', '**/unit/**'],
  });

  console.log(`Found ${testFiles.length} test files to analyze\n`);

  // Extract test information from each file
  const allTestInfo = [];
  let totalTests = 0;

  testFiles.forEach(file => {
    const filePath = path.join(TEST_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const info = extractTestInfo(filePath, content);
    allTestInfo.push(info);
    totalTests += info.testCount;
  });

  console.log(`Total tests found: ${totalTests}\n`);

  // Find duplicates and overlaps
  const duplicates = findDuplicates(allTestInfo);
  const recommendations = analyzeOverlap(duplicates);

  // Display results
  console.log('📊 Analysis Results\n');
  console.log('='.repeat(80));

  // Show over-tested endpoints
  const overTested = recommendations.find(r => r.type === 'OVER_TESTED_ENDPOINTS');
  if (overTested) {
    console.log('\n🔄 Over-Tested Endpoints (tested in 3+ files):\n');
    overTested.items.slice(0, 10).forEach(item => {
      console.log(`  ${item.endpoint}`);
      console.log(`    Tested in ${item.fileCount} files:`);
      item.files.slice(0, 5).forEach(f => {
        console.log(`      - ${f}`);
      });
      if (item.files.length > 5) {
        console.log(`      ... and ${item.files.length - 5} more`);
      }
      console.log('');
    });
  }

  // Show duplicate/similar tests
  const duplicateTests = recommendations.find(r => r.type === 'DUPLICATE_TESTS');
  if (duplicateTests) {
    console.log('\n🔴 Highly Similar Tests (≥85% similarity):\n');
    duplicateTests.items.slice(0, 10).forEach(item => {
      console.log(`  ${item.similarity}% Similar:`);
      console.log(`    Test 1: "${item.test1}"`);
      console.log(`    File 1: ${item.file1}`);
      console.log(`    Test 2: "${item.test2}"`);
      console.log(`    File 2: ${item.file2}`);
      console.log('');
    });
  }

  // Show consolidation opportunities
  const consolidation = recommendations.find(r => r.type === 'CONSOLIDATION_OPPORTUNITY');
  if (consolidation) {
    console.log('\n📦 Consolidation Opportunities:\n');
    consolidation.items.forEach(item => {
      console.log(`  ${item.category}:`);
      console.log(`    - ${item.fileCount} files`);
      console.log(`    - ${item.totalTests} total tests`);
      console.log(`    - ${item.avgTestsPerFile} avg tests per file`);
      console.log(`    💡 Consider consolidating into fewer files\n`);
    });
  }

  // Summary statistics
  console.log('\n📈 Summary Statistics:\n');
  console.log(`  Total test files: ${testFiles.length}`);
  console.log(`  Total test cases: ${totalTests}`);
  console.log(`  Average tests per file: ${Math.round(totalTests / testFiles.length)}`);
  console.log(`  Similar tests found: ${duplicates.similarTests.length}`);
  console.log(`  High similarity (≥85%): ${duplicates.similarTests.filter(t => t.similarity >= 85).length}`);
  console.log(`  Over-tested endpoints: ${Object.keys(duplicates.endpointCoverage).filter(e => duplicates.endpointCoverage[e].length > 2).length}`);

  // Potential savings
  const potentialTestReduction = Math.round(duplicates.similarTests.filter(t => t.similarity >= 85).length * 0.5);
  const potentialTimeReduction = potentialTestReduction * 0.5; // Assume 0.5s per test average
  console.log('\n💰 Potential Savings:\n');
  console.log(`  Tests that could be removed: ~${potentialTestReduction}`);
  console.log(`  Estimated time savings: ~${potentialTimeReduction}s`);
  console.log(`  Percentage reduction: ~${Math.round((potentialTestReduction / totalTests) * 100)}%`);

  // Export detailed report
  const reportPath = path.join(process.cwd(), 'test-duplication-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    summary: {
      totalFiles: testFiles.length,
      totalTests,
      similarTests: duplicates.similarTests.length,
      highSimilarity: duplicates.similarTests.filter(t => t.similarity >= 85).length,
    },
    recommendations,
    details: {
      similarTests: duplicates.similarTests,
      endpointCoverage: duplicates.endpointCoverage,
      testCategories: duplicates.testCategories,
    },
  }, null, 2));

  console.log(`\n📄 Detailed report saved to: ${reportPath}\n`);
}

// Run the analysis
main().catch(console.error);