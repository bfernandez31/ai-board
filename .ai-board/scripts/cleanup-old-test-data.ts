import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Cleaning up old test data without [e2e] prefix...');

  // Find all projects without [e2e] prefix (except projects 1, 2, 3)
  const projectsToDelete = await prisma.project.findMany({
    where: {
      AND: [
        { id: { notIn: [1, 2, 3] } },
        { name: { not: { startsWith: '[e2e]' } } },
      ],
    },
    select: { id: true, name: true },
  });

  console.log(`Found ${projectsToDelete.length} projects to delete:`, projectsToDelete);

  // Delete projects (cascade will delete tickets)
  for (const project of projectsToDelete) {
    console.log(`Deleting project ${project.id}: ${project.name}`);
    await prisma.project.delete({ where: { id: project.id } });
  }

  // Find all tickets without [e2e] prefix in projects 4+
  const ticketsToDelete = await prisma.ticket.findMany({
    where: {
      AND: [
        { projectId: { gte: 4 } },
        { title: { not: { startsWith: '[e2e]' } } },
      ],
    },
    select: { id: true, title: true, projectId: true },
  });

  console.log(`Found ${ticketsToDelete.length} tickets to delete:`, ticketsToDelete);

  // Delete tickets
  for (const ticket of ticketsToDelete) {
    console.log(`Deleting ticket ${ticket.id} from project ${ticket.projectId}: ${ticket.title}`);
    await prisma.ticket.delete({ where: { id: ticket.id } });
  }

  console.log('✅ Cleanup complete!');
}

cleanup()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
