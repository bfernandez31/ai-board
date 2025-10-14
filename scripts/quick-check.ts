import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  // Check column types from database
  const result = await prisma.$queryRaw<Array<{table_name: string, column_name: string, data_type: string}>>`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'User' AND column_name = 'id')
        OR (table_name = 'Project' AND column_name = 'userId'))
    ORDER BY table_name, column_name;
  `;

  console.log('Database column types:');
  result.forEach(r => console.log(`  ${r.table_name}.${r.column_name}: ${r.data_type}`));

  // Try to fetch projects
  try {
    const projects = await prisma.project.findMany({
      where: { userId: '05917af1-ba55-4f5a-b43d-eee66d489338' }
    });
    console.log('\n✅ Query succeeded!');
    console.log(`Found ${projects.length} projects`);
  } catch (e) {
    console.log('\n❌ Query failed:', e);
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
