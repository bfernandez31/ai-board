import { PrismaClient } from '@prisma/client';

/**
 * Script to assign project 3 to the GitHub authenticated user
 * Run with: npx tsx scripts/assign-project-to-github-user.ts
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Looking for GitHub authenticated user...');

  // Find user with GitHub account
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
    console.error('   Please sign in at least once with GitHub OAuth at http://localhost:3000');
    process.exit(1);
  }

  const userId = githubAccount.userId;
  console.log(`✅ Found GitHub user: ${githubAccount.user.name || githubAccount.user.email}`);
  console.log(`   User ID: ${userId}`);

  // Update project 3 to belong to this user
  const project = await prisma.project.update({
    where: { id: 3 },
    data: {
      userId,
    },
  });

  console.log('\n✅ Project 3 assigned successfully!');
  console.log(JSON.stringify(project, null, 2));
  console.log('\n📋 Project Details:');
  console.log(`   ID: ${project.id}`);
  console.log(`   Name: ${project.name}`);
  console.log(`   Owner: ${githubAccount.user.name || githubAccount.user.email}`);
  console.log(`   GitHub: ${project.githubOwner}/${project.githubRepo}`);
  console.log(`   Board URL: http://localhost:3000/projects/${project.id}/board`);
  console.log('\n💡 You can now access this project at the board URL!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
