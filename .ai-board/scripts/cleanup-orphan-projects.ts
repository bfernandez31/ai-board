/**
 * Script to manually cleanup orphan projects without [e2e] prefix
 * These are projects created by tests that didn't follow naming convention
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up orphan projects...\n');

  // Find projects without [e2e] prefix and ID > 3 (not protected)
  const orphanProjects = await prisma.project.findMany({
    where: {
      id: { gt: 3 },
      name: { not: { startsWith: '[e2e]' } },
    },
    include: {
      _count: {
        select: { tickets: true },
      },
    },
  });

  if (orphanProjects.length === 0) {
    console.log('✅ No orphan projects found. Database is clean!');
    return;
  }

  console.log(`Found ${orphanProjects.length} orphan project(s):\n`);

  orphanProjects.forEach((project) => {
    console.log(`  - ID ${project.id}: "${project.name}"`);
    console.log(`    ${project.githubOwner}/${project.githubRepo}`);
    console.log(`    Tickets: ${project._count.tickets}`);
    console.log();
  });

  // Delete orphan projects (cascade will delete tickets)
  const result = await prisma.project.deleteMany({
    where: {
      id: { gt: 3 },
      name: { not: { startsWith: '[e2e]' } },
    },
  });

  console.log(`✅ Deleted ${result.count} orphan project(s)`);
  console.log('\n📊 Remaining projects:');

  const remaining = await prisma.project.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      _count: {
        select: { tickets: true },
      },
    },
  });

  remaining.forEach((p) => {
    const status = p.id <= 3 ? '🔒 Protected' : '✅ Clean';
    console.log(`  ${status} - ID ${p.id}: "${p.name}" (${p._count.tickets} tickets)`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
