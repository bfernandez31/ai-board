import { PrismaClient } from '@prisma/client';

/**
 * Script to create project 3 with a specific UUID userId
 *
 * The userId must be the UUID from your NextAuth JWT session.
 * To find it: Sign in, open console, run:
 * fetch("/api/auth/session").then(r=>r.json()).then(d=>console.log(d.user.id))
 *
 * Run with: npx tsx scripts/create-project-uuid.ts <uuid>
 * Example: npx tsx scripts/create-project-uuid.ts 1acacaad-8e8b-4537-b2af-4ab2f80aa6d2
 */

const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  const email = process.argv[3];

  if (!userId) {
    console.error('❌ Missing userId argument.');
    console.error('');
    console.error('   Usage: npx tsx scripts/create-project-uuid.ts <uuid> [email]');
    console.error('');
    console.error('   Example: npx tsx scripts/create-project-uuid.ts 1acacaad-8e8b-4537-b2af-4ab2f80aa6d2 bruno@example.com');
    console.error('');
    console.error('   To find your JWT userId:');
    console.error('   1. Sign in to your app (local or production)');
    console.error('   2. Open browser console (F12)');
    console.error('   3. Run: fetch("/api/auth/session").then(r=>r.json()).then(d=>console.log(d.user.id))');
    console.error('   4. Copy the UUID and use it here');
    process.exit(1);
  }

  console.log('🚀 Creating project 3...');
  console.log(`   User ID (UUID): ${userId}`);

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    if (!email) {
      console.error('\n❌ User not found and no email provided.');
      console.error('   Provide email as second argument to create the user.');
      console.error(`   Example: npx tsx scripts/create-project-uuid.ts ${userId} your@email.com`);
      process.exit(1);
    }

    console.log(`   Creating user with email: ${email}`);
    user = await prisma.user.create({
      data: {
        id: userId,
        email: email,
        emailVerified: new Date(),
        name: email.split('@')[0] || null,
      },
    });
    console.log('   ✅ User created');
  } else {
    console.log(`   ✅ User found: ${user.email}`);
  }

  // Create or update project 3
  const project = await prisma.project.upsert({
    where: { id: 3 },
    update: {
      name: 'AI Board Development',
      description: 'Main development project for AI Board kanban application',
      githubOwner: 'bfernandez31',
      githubRepo: 'ai-board',
      userId: user.id,
    },
    create: {
      id: 3,
      name: 'AI Board Development',
      description: 'Main development project for AI Board kanban application',
      githubOwner: 'bfernandez31',
      githubRepo: 'ai-board',
      userId: user.id,
    },
  });

  console.log('\n✅ Project 3 created successfully!');
  console.log('\n📋 Details:');
  console.log(`   Project ID: ${project.id}`);
  console.log(`   Name: ${project.name}`);
  console.log(`   Owner: ${user.email}`);
  console.log(`   User ID: ${user.id}`);
  console.log(`   GitHub: ${project.githubOwner}/${project.githubRepo}`);
  console.log('\n🌐 Access at:');
  console.log(`   Local: http://localhost:3000/projects/3/board`);
  console.log(`   Production: https://[your-domain]/projects/3/board`);
  console.log('\n✅ Done! Your userId is now stable with UUID-based auth.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
