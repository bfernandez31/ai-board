import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ticket = await prisma.ticket.findUnique({
    where: { id: 17123 },
    select: {
      id: true,
      title: true,
      branch: true,
      stage: true,
      projectId: true
    }
  });

  console.log(JSON.stringify(ticket, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
