#!/usr/bin/env node

/**
 * Generate structured test failure report from JSON test results
 *
 * Usage:
 *   node generate-test-report.js --unit unit-results.json --e2e e2e-results.json --output test-failures.json
 *
 * Output format:
 * {
 *   summary: { totalFailures, unitFailures, e2eFailures },
 *   categories: { assertions, timeouts, errors, setup },
 *   rootCauses: [...],
 *   impactPriority: [...]
 * }
 */

const fs = require('fs');
const path = require('path');

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    config[key] = value;
  }

  return config;
}

// Read and parse JSON test results
function readTestResults(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Test results file not found: ${filePath}`);
    return null;
  }

  // Check if path is a directory instead of a file
  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    console.error(`❌ Expected file but got directory: ${filePath}`);
    console.warn(`   Skipping ${path.basename(filePath)} - no test results available`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to parse test results: ${filePath}`, error.message);
    return null;
  }
}

// Categorize test failure by type
function categorizeFailure(failure) {
  const errorMessage = failure.error?.message || '';
  const errorStack = failure.error?.stack || '';

  // Timeout failures
  if (errorMessage.includes('Timeout') || errorMessage.includes('timeout')) {
    return 'timeouts';
  }

  // Assertion failures (expect statements)
  if (errorMessage.includes('expect') || errorMessage.includes('toEqual') ||
      errorMessage.includes('toBe') || errorMessage.includes('toMatch')) {
    return 'assertions';
  }

  // Setup failures (beforeEach, afterEach, fixtures)
  if (errorStack.includes('beforeEach') || errorStack.includes('afterEach') ||
      errorStack.includes('fixture') || errorStack.includes('global-setup')) {
    return 'setup';
  }

  // Everything else is runtime error
  return 'errors';
}

// Extract root cause patterns from failures
function identifyRootCauses(failures) {
  const causeMap = new Map();

  failures.forEach(failure => {
    const errorMessage = failure.error?.message || 'Unknown error';

    // Group by similar error messages (normalize error details)
    const normalizedError = errorMessage
      .replace(/\d+/g, 'N')  // Replace numbers with N
      .replace(/['"][^'"]+['"]/g, 'STR')  // Replace string literals
      .replace(/at .+:\d+:\d+/g, '')  // Remove stack trace locations
      .trim();

    if (!causeMap.has(normalizedError)) {
      causeMap.set(normalizedError, {
        pattern: normalizedError,
        originalMessage: errorMessage,
        affectedTests: [],
        category: categorizeFailure(failure),
        count: 0,
      });
    }

    const cause = causeMap.get(normalizedError);
    cause.affectedTests.push({
      testPath: failure.testPath,
      testName: failure.testName,
      filePath: failure.filePath,
    });
    cause.count += 1;
  });

  // Convert to array and sort by impact (count)
  return Array.from(causeMap.values())
    .sort((a, b) => b.count - a.count);
}

// Calculate impact priority (which tests to fix first)
function calculateImpactPriority(rootCauses) {
  return rootCauses.map(cause => ({
    description: cause.originalMessage,
    affectedTestCount: cause.count,
    category: cause.category,
    tests: cause.affectedTests.map(t => t.testPath),
  }));
}

// Process unit test results (Vitest format)
function processUnitTests(results) {
  if (!results || !results.testResults) {
    return [];
  }

  const failures = [];

  results.testResults.forEach(file => {
    if (!file.assertionResults) return;

    file.assertionResults.forEach(test => {
      if (test.status === 'failed') {
        failures.push({
          testPath: `${file.name} > ${test.title}`,
          testName: test.title,
          filePath: file.name,
          error: {
            message: test.failureMessages?.[0] || 'Unknown error',
            stack: test.failureMessages?.join('\n') || '',
          },
          duration: test.duration || 0,
        });
      }
    });
  });

  return failures;
}

// Process E2E test results (Playwright format)
function processE2ETests(results) {
  if (!results || !results.suites) {
    return [];
  }

  const failures = [];

  function extractFailures(suite, parentPath = '') {
    const suitePath = parentPath ? `${parentPath} > ${suite.title}` : suite.title;

    // Process tests in this suite
    if (suite.specs) {
      suite.specs.forEach(spec => {
        spec.tests?.forEach(test => {
          // Playwright uses test.status = "expected" for passing tests
          // and test.status = "unexpected" for failures
          // Also check for "timedOut" and "interrupted" status
          if (test.status === 'unexpected' || test.status === 'timedOut' || test.status === 'interrupted') {
            const result = test.results?.[0];
            failures.push({
              testPath: `${suitePath} > ${spec.title}`,
              testName: spec.title,
              filePath: spec.file || suite.file,
              error: {
                message: result?.error?.message || 'Unknown error',
                stack: result?.error?.stack || '',
              },
              duration: result?.duration || 0,
            });
          }
        });
      });
    }

    // Recursively process nested suites
    if (suite.suites) {
      suite.suites.forEach(nestedSuite => {
        extractFailures(nestedSuite, suitePath);
      });
    }
  }

  results.suites.forEach(suite => extractFailures(suite));
  return failures;
}

// Generate structured failure report
function generateReport(unitResults, e2eResults) {
  const unitFailures = processUnitTests(unitResults);
  const e2eFailures = processE2ETests(e2eResults);
  const allFailures = [...unitFailures, ...e2eFailures];

  if (allFailures.length === 0) {
    return {
      summary: {
        totalFailures: 0,
        unitFailures: 0,
        e2eFailures: 0,
      },
      categories: {
        assertions: [],
        timeouts: [],
        errors: [],
        setup: [],
      },
      rootCauses: [],
      impactPriority: [],
    };
  }

  // Categorize failures
  const categories = {
    assertions: [],
    timeouts: [],
    errors: [],
    setup: [],
  };

  allFailures.forEach(failure => {
    const category = categorizeFailure(failure);
    categories[category].push(failure);
  });

  // Identify root causes
  const rootCauses = identifyRootCauses(allFailures);

  // Calculate impact priority
  const impactPriority = calculateImpactPriority(rootCauses);

  return {
    summary: {
      totalFailures: allFailures.length,
      unitFailures: unitFailures.length,
      e2eFailures: e2eFailures.length,
    },
    categories,
    rootCauses,
    impactPriority,
  };
}

// Main execution
function main() {
  const config = parseArgs();

  if (!config.output) {
    console.error('❌ Missing required argument: --output');
    process.exit(1);
  }

  console.log('📊 Generating test failure report...');

  // Read test results
  const unitResults = config.unit ? readTestResults(config.unit) : null;
  const e2eResults = config.e2e ? readTestResults(config.e2e) : null;

  // Generate report
  const report = generateReport(unitResults, e2eResults);

  // Write output
  const outputPath = path.resolve(config.output);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`✅ Report generated: ${outputPath}`);
  console.log(`   Total failures: ${report.summary.totalFailures}`);
  console.log(`   Unit failures: ${report.summary.unitFailures}`);
  console.log(`   E2E failures: ${report.summary.e2eFailures}`);
  console.log(`   Root causes identified: ${report.rootCauses.length}`);

  // Report generated successfully - always exit 0
  process.exit(0);
}

main();
