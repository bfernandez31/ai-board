import { PrismaClient } from '@prisma/client';

/**
 * Script to show your GitHub user UUID and account details
 * Run with: npx tsx scripts/show-my-user.ts
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Fetching all users and their GitHub accounts...\n');

  const users = await prisma.user.findMany({
    include: {
      accounts: {
        where: {
          provider: 'github'
        }
      },
      projects: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (users.length === 0) {
    console.log('❌ No users found in database');
    return;
  }

  users.forEach((user) => {
    console.log('👤 User:');
    console.log(`   UUID: ${user.id}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Email: ${user.email}`);

    if (user.accounts.length > 0) {
      console.log(`   GitHub Account ID: ${user.accounts[0].providerAccountId}`);
    }

    if (user.projects.length > 0) {
      console.log(`   Projects (${user.projects.length}):`);
      user.projects.forEach(p => {
        console.log(`     - [${p.id}] ${p.name}`);
      });
    }

    console.log('');
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
