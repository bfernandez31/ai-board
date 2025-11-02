import { PrismaClient } from "@prisma/client";
import { createTicket } from "../lib/db/tickets";

const prisma = new PrismaClient();

async function main() {
  const githubOwner = process.env.GITHUB_OWNER;
  const githubRepo = process.env.GITHUB_REPO;

  if (!githubOwner || !githubRepo) {
    throw new Error(
      "GITHUB_OWNER and GITHUB_REPO environment variables are required"
    );
  }

  // Ensure admin user exists
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ai-board.local' },
    update: {},
    create: {
      id: 'admin-user-id',
      email: 'admin@ai-board.local',
      name: 'Admin User',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  // Create AI-BOARD system user
  const aiBoardUser = await prisma.user.upsert({
    where: { email: 'ai-board@system.local' },
    update: {},
    create: {
      id: 'ai-board-system-user',
      email: 'ai-board@system.local',
      name: 'AI-BOARD Assistant',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('Created/verified AI-BOARD user:', aiBoardUser);

  // Check if default project already exists
  let project = await prisma.project.findUnique({
    where: {
      githubOwner_githubRepo: {
        githubOwner,
        githubRepo,
      },
    },
  });

  if (project) {
    console.log("Default project already exists:", project);
  } else {
    // Create default project
    project = await prisma.project.create({
      data: {
        name: "ai-board",
        key: "AIB", // Default project key
        description: "AI-powered project management board",
        githubOwner,
        githubRepo,
        userId: admin.id,
        updatedAt: new Date(),
      },
    });

    console.log("Created default project:", project);
  }

  // Check if tickets already exist
  const existingTickets = await prisma.ticket.count({
    where: { projectId: project.id },
  });

  if (existingTickets > 0) {
    console.log(`Project already has ${existingTickets} tickets`);
    return;
  }

  // Create sample tickets for the project using createTicket helper
  // This ensures ticketNumber and ticketKey are properly generated
  const sampleTickets: Array<{
    title: string;
    description: string;
    stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP';
  }> = [
    {
      title: "Setup project structure",
      description: "Initialize the project with basic folder structure and dependencies",
      stage: "SHIP",
    },
    {
      title: "Design database schema",
      description: "Create Prisma schema with all required models and relations",
      stage: "SHIP",
    },
    {
      title: "Implement ticket creation API",
      description: "Add POST endpoint for creating new tickets",
      stage: "VERIFY",
    },
    {
      title: "Add drag-and-drop functionality",
      description: "Enable users to drag tickets between columns",
      stage: "BUILD",
    },
    {
      title: "Create ticket detail modal",
      description: "Design and implement modal for viewing/editing ticket details",
      stage: "PLAN",
    },
    {
      title: "Add user authentication",
      description: "Implement authentication system with GitHub OAuth",
      stage: "SPECIFY",
    },
    {
      title: "Setup CI/CD pipeline",
      description: "Configure automated testing and deployment workflow",
      stage: "INBOX",
    },
  ];

  // Create tickets one by one to generate proper ticketNumber and ticketKey
  for (const ticketData of sampleTickets) {
    const ticket = await createTicket(project.id, {
      title: ticketData.title,
      description: ticketData.description,
      clarificationPolicy: undefined,
      attachments: undefined,
    });

    // Update stage if not INBOX
    if (ticketData.stage !== 'INBOX') {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { stage: ticketData.stage },
      });
    }
  }

  console.log(`Created ${sampleTickets.length} sample tickets for project`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
