import { PrismaClient } from '@prisma/client';

/**
 * Script to create development project (ID 3)
 * Run with: npx tsx scripts/create-dev-project.ts
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creating development project...');

  const project = await prisma.project.upsert({
    where: { id: 3 },
    update: {
      name: 'AI Board Development',
      description: 'Main development project for AI Board kanban application',
      githubOwner: 'bfernandez31',
      githubRepo: 'ai-board',
    },
    create: {
      id: 3,
      name: 'AI Board Development',
      description: 'Main development project for AI Board kanban application',
      githubOwner: 'bfernandez31',
      githubRepo: 'ai-board',
    },
  });

  console.log('✅ Development project created successfully!');
  console.log(JSON.stringify(project, null, 2));
  console.log('\n📋 Project Details:');
  console.log(`   ID: ${project.id}`);
  console.log(`   Name: ${project.name}`);
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
