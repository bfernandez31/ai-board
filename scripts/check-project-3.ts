import { PrismaClient } from '@prisma/client';

/**
 * Script to verify project 3 exists
 * Run with: npx tsx scripts/check-project-3.ts
 */

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: 3 },
  });

  if (project) {
    console.log('✅ Project 3 EXISTS:');
    console.log(JSON.stringify(project, null, 2));
  } else {
    console.log('❌ Project 3 NOT FOUND');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
