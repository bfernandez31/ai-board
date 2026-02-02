#!/usr/bin/env node

/**
 * Analyze test execution times from Playwright JSON report
 * Identifies slowest tests for optimization
 *
 * Usage: node analyze-slow-tests.js <json-report-file>
 */

const fs = require('fs');
const path = require('path');

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function analyzeTestReport(reportFile) {
  if (!fs.existsSync(reportFile)) {
    console.error(`❌ Report file not found: ${reportFile}`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
  const testDurations = [];

  // Extract all test durations
  report.suites?.forEach(suite => {
    suite.specs?.forEach(spec => {
      spec.tests?.forEach(test => {
        if (test.results?.[0]?.duration) {
          testDurations.push({
            file: spec.file || suite.file,
            title: spec.title,
            testName: test.title,
            duration: test.results[0].duration,
            status: test.results[0].status,
          });
        }
      });
    });
  });

  // Sort by duration (slowest first)
  testDurations.sort((a, b) => b.duration - a.duration);

  // Calculate statistics
  const totalDuration = testDurations.reduce((sum, t) => sum + t.duration, 0);
  const avgDuration = testDurations.length > 0 ? totalDuration / testDurations.length : 0;

  console.log('\n📊 Test Performance Analysis\n');
  console.log(`Total tests: ${testDurations.length}`);
  console.log(`Total duration: ${formatDuration(totalDuration)}`);
  console.log(`Average duration: ${formatDuration(avgDuration)}`);

  // Show slowest tests
  console.log('\n🐌 Top 10 Slowest Tests:\n');
  testDurations.slice(0, 10).forEach((test, index) => {
    console.log(`${index + 1}. ${formatDuration(test.duration).padEnd(8)} - ${test.title}`);
    console.log(`   File: ${test.file}`);
    console.log(`   Test: ${test.testName}`);
    console.log('');
  });

  // Show tests that could be optimized (>5s)
  const slowTests = testDurations.filter(t => t.duration > 5000);
  if (slowTests.length > 0) {
    console.log(`⚠️  ${slowTests.length} tests take longer than 5 seconds`);
    console.log(`   These tests account for ${formatDuration(slowTests.reduce((sum, t) => sum + t.duration, 0))} of total time`);
    console.log(`   Consider optimizing or splitting these tests\n`);
  }

  // Suggest parallel execution improvement
  const estimatedParallelTime = testDurations[0]?.duration || 0; // Longest test determines parallel time
  const potentialSavings = totalDuration - estimatedParallelTime;
  console.log('⚡ Parallel Execution Potential:');
  console.log(`   Sequential time: ${formatDuration(totalDuration)}`);
  console.log(`   Estimated parallel time (4 workers): ${formatDuration(totalDuration / 4)}`);
  console.log(`   Potential time savings: ${formatDuration(totalDuration * 0.75)}`);
}

// Main execution
const reportFile = process.argv[2] || 'e2e-results.json';
analyzeTestReport(reportFile);