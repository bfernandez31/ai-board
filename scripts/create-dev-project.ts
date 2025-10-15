import { PrismaClient } from '@prisma/client';

/**
 * Script to create development project (ID 3)
 * Run with: npx tsx scripts/create-dev-project.ts
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creating development project...');

  // Find user with GitHub account (assumes you've signed in at least once)
  const githubAccount = await prisma.account.findFirst({
    where: {
      provider: 'github',
    },
    include: {
      user: true,
    },
  });

  if (!githubAccount) {
    console.error('❌ No GitHub authenticated user found.');
    console.error('   Please sign in at least once with GitHub OAuth before running this script.');
    process.exit(1);
  }

  const userId = githubAccount.userId;
  console.log(`✅ Found GitHub user: ${githubAccount.user.name || githubAccount.user.email}`);

  const project = await prisma.project.upsert({
    where: { id: 3 },
    update: {
      name: 'AI Board Development',
      description: 'Main development project for AI Board kanban application',
      githubOwner: 'bfernandez31',
      githubRepo: 'ai-board',
      userId,
    },
    create: {
      id: 3,
      name: 'AI Board Development',
      description: 'Main development project for AI Board kanban application',
      githubOwner: 'bfernandez31',
      githubRepo: 'ai-board',
      userId,
      updatedAt: new Date(),
    },
  });

  console.log('✅ Development project created successfully!');
  console.log(JSON.stringify(project, null, 2));
  console.log('\n📋 Project Details:');
  console.log(`   ID: ${project.id}`);
  console.log(`   Name: ${project.name}`);
  console.log(`   Owner: ${githubAccount.user.name || githubAccount.user.email}`);
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
