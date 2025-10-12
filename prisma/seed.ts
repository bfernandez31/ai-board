import { PrismaClient } from "@prisma/client";

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
      email: 'admin@ai-board.local',
      name: 'Admin User',
      emailVerified: new Date(),
    },
  });

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
        description: "AI-powered project management board",
        githubOwner,
        githubRepo,
        userId: admin.id,
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

  // Create sample tickets for the project
  const sampleTickets = [
    {
      title: "Setup project structure",
      description: "Initialize the project with basic folder structure and dependencies",
      stage: "SHIP" as const,
      projectId: project.id,
    },
    {
      title: "Design database schema",
      description: "Create Prisma schema with all required models and relations",
      stage: "SHIP" as const,
      projectId: project.id,
    },
    {
      title: "Implement ticket creation API",
      description: "Add POST endpoint for creating new tickets",
      stage: "VERIFY" as const,
      projectId: project.id,
    },
    {
      title: "Add drag-and-drop functionality",
      description: "Enable users to drag tickets between columns",
      stage: "BUILD" as const,
      projectId: project.id,
    },
    {
      title: "Create ticket detail modal",
      description: "Design and implement modal for viewing/editing ticket details",
      stage: "PLAN" as const,
      projectId: project.id,
    },
    {
      title: "Add user authentication",
      description: "Implement authentication system with GitHub OAuth",
      stage: "SPECIFY" as const,
      projectId: project.id,
    },
    {
      title: "Setup CI/CD pipeline",
      description: "Configure automated testing and deployment workflow",
      stage: "INBOX" as const,
      projectId: project.id,
    },
  ];

  await prisma.ticket.createMany({
    data: sampleTickets,
  });

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
