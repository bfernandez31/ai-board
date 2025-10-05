#!/usr/bin/env node
/**
 * Performance Load Test
 *
 * Tests ticket API with 100 concurrent requests
 * Validates <200ms p95 response time requirement
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const CONCURRENT_REQUESTS = 100;

async function measureResponseTime(url, options = {}) {
  const start = performance.now();
  const response = await fetch(url, options);
  const end = performance.now();
  const responseTime = end - start;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return { responseTime, response };
}

async function runLoadTest() {
  console.log('🚀 Starting performance validation...\n');

  // 1. Setup: Create test project and tickets
  console.log('📋 Setting up test data...');
  const project = await prisma.project.create({
    data: {
      name: 'Performance Test Project',
      description: 'Load testing',
      githubOwner: 'test-owner',
      githubRepo: 'test-repo',
    },
  });

  const tickets = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      prisma.ticket.create({
        data: {
          title: `Performance Test Ticket ${i + 1}`,
          description: 'Load test ticket',
          projectId: project.id,
          branch: i % 2 === 0 ? `branch-${i}` : null,
          autoMode: i % 3 === 0,
        },
      })
    )
  );

  console.log(`✅ Created project ${project.id} with ${tickets.length} tickets\n`);

  // 2. Test GET requests (query tickets)
  console.log('🔍 Testing GET /api/projects/:projectId/tickets...');
  const getResponseTimes = [];

  const getPromises = Array.from({ length: CONCURRENT_REQUESTS }, async () => {
    const { responseTime } = await measureResponseTime(
      `${BASE_URL}/api/projects/${project.id}/tickets`
    );
    getResponseTimes.push(responseTime);
  });

  await Promise.all(getPromises);

  const getStats = calculateStats(getResponseTimes);
  console.log(`   Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`   Min: ${getStats.min.toFixed(2)}ms`);
  console.log(`   Max: ${getStats.max.toFixed(2)}ms`);
  console.log(`   Mean: ${getStats.mean.toFixed(2)}ms`);
  console.log(`   Median: ${getStats.median.toFixed(2)}ms`);
  console.log(`   P95: ${getStats.p95.toFixed(2)}ms`);
  console.log(`   P99: ${getStats.p99.toFixed(2)}ms`);

  if (getStats.p95 >= 200) {
    console.log(`   ⚠️  WARNING: P95 (${getStats.p95.toFixed(2)}ms) exceeds 200ms target\n`);
  } else {
    console.log(`   ✅ PASS: P95 is under 200ms\n`);
  }

  // 3. Test PATCH requests (update tickets)
  console.log('✏️  Testing PATCH /api/projects/:projectId/tickets/:id...');
  const patchResponseTimes = [];

  // Sequential updates to avoid version conflicts
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const ticket = tickets[i % tickets.length];

    // Fetch current version
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { version: true },
    });

    const { responseTime } = await measureResponseTime(
      `${BASE_URL}/api/projects/${project.id}/tickets/${ticket.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: `load-test-branch-${i}`,
          autoMode: i % 2 === 0,
          version: currentTicket.version,
        }),
      }
    );
    patchResponseTimes.push(responseTime);
  }

  const patchStats = calculateStats(patchResponseTimes);
  console.log(`   Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`   Min: ${patchStats.min.toFixed(2)}ms`);
  console.log(`   Max: ${patchStats.max.toFixed(2)}ms`);
  console.log(`   Mean: ${patchStats.mean.toFixed(2)}ms`);
  console.log(`   Median: ${patchStats.median.toFixed(2)}ms`);
  console.log(`   P95: ${patchStats.p95.toFixed(2)}ms`);
  console.log(`   P99: ${patchStats.p99.toFixed(2)}ms`);

  if (patchStats.p95 >= 200) {
    console.log(`   ⚠️  WARNING: P95 (${patchStats.p95.toFixed(2)}ms) exceeds 200ms target\n`);
  } else {
    console.log(`   ✅ PASS: P95 is under 200ms\n`);
  }

  // 4. Test /branch endpoint
  console.log('🌿 Testing PATCH /api/projects/:projectId/tickets/:id/branch...');
  const branchResponseTimes = [];

  const branchPromises = Array.from({ length: CONCURRENT_REQUESTS }, async (_, i) => {
    const ticket = tickets[i % tickets.length];
    const { responseTime } = await measureResponseTime(
      `${BASE_URL}/api/projects/${project.id}/tickets/${ticket.id}/branch`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: i % 3 === 0 ? null : `branch-update-${i}`,
        }),
      }
    );
    branchResponseTimes.push(responseTime);
  });

  await Promise.all(branchPromises);

  const branchStats = calculateStats(branchResponseTimes);
  console.log(`   Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`   Min: ${branchStats.min.toFixed(2)}ms`);
  console.log(`   Max: ${branchStats.max.toFixed(2)}ms`);
  console.log(`   Mean: ${branchStats.mean.toFixed(2)}ms`);
  console.log(`   Median: ${branchStats.median.toFixed(2)}ms`);
  console.log(`   P95: ${branchStats.p95.toFixed(2)}ms`);
  console.log(`   P99: ${branchStats.p99.toFixed(2)}ms`);

  if (branchStats.p95 >= 200) {
    console.log(`   ⚠️  WARNING: P95 (${branchStats.p95.toFixed(2)}ms) exceeds 200ms target\n`);
  } else {
    console.log(`   ✅ PASS: P95 is under 200ms\n`);
  }

  // 5. Cleanup
  console.log('🧹 Cleaning up test data...');
  await prisma.ticket.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.$disconnect();

  // 6. Final summary
  console.log('\n📊 Performance Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`GET  /tickets       - P95: ${getStats.p95.toFixed(2)}ms  ${getStats.p95 < 200 ? '✅' : '❌'}`);
  console.log(`PATCH /tickets/:id  - P95: ${patchStats.p95.toFixed(2)}ms  ${patchStats.p95 < 200 ? '✅' : '❌'}`);
  console.log(`PATCH /branch       - P95: ${branchStats.p95.toFixed(2)}ms  ${branchStats.p95 < 200 ? '✅' : '❌'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const allPassed = getStats.p95 < 200 && patchStats.p95 < 200 && branchStats.p95 < 200;
  if (allPassed) {
    console.log('✅ All endpoints meet <200ms P95 requirement');
    process.exit(0);
  } else {
    console.log('❌ Some endpoints exceed 200ms P95 requirement');
    process.exit(1);
  }
}

function calculateStats(responseTimes) {
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const count = sorted.length;

  return {
    min: sorted[0],
    max: sorted[count - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / count,
    median: sorted[Math.floor(count / 2)],
    p95: sorted[Math.floor(count * 0.95)],
    p99: sorted[Math.floor(count * 0.99)],
  };
}

// Run the test
runLoadTest().catch((error) => {
  console.error('❌ Performance test failed:', error);
  process.exit(1);
});
