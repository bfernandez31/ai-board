import { PrismaClient } from '@prisma/client';

/**
 * Script to create development project (ID 3) using test user
 * Run with: npx tsx scripts/create-dev-project-simple.ts
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creating development project with test user...');

  // Find or create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      id: 'test-user-id',
      email: 'test@e2e.local',
      name: 'E2E Test User',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`✅ Using test user: ${testUser.email}`);

  // Delete any existing project with githubOwner/githubRepo to avoid unique constraint
  await prisma.project.deleteMany({
    where: {
      githubOwner: 'bfernandez31',
      githubRepo: 'ai-board',
    },
  });

  console.log('📝 Creating project 3 for development...');
  const project = await prisma.project.create({
    data: {
      id: 3,
      name: 'AI Board Development',
      description: 'Main development project for AI Board kanban application',
      githubOwner: 'bfernandez31',
      githubRepo: 'ai-board',
      userId: testUser.id,
      updatedAt: new Date(),
    },
  });

  console.log('✅ Development project created successfully!');
  console.log(JSON.stringify(project, null, 2));
  console.log('\n📋 Project Details:');
  console.log(`   ID: ${project.id}`);
  console.log(`   Name: ${project.name}`);
  console.log(`   Owner: ${testUser.name || testUser.email}`);
  console.log(`   GitHub: ${project.githubOwner}/${project.githubRepo}`);
  console.log(`   Board URL: http://localhost:3000/projects/${project.id}/board`);
  console.log('\n💡 Use this project for all development work to avoid test interference.');
}

main()
  .catch((e) => {
    console.error('❌ Error creating project:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
