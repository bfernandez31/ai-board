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

  // Check if default project already exists
  const existingProject = await prisma.project.findUnique({
    where: {
      githubOwner_githubRepo: {
        githubOwner,
        githubRepo,
      },
    },
  });

  if (existingProject) {
    console.log("Default project already exists:", existingProject);
    return;
  }

  // Create default project
  const project = await prisma.project.create({
    data: {
      name: "ai-board",
      description: "AI-powered project management board",
      githubOwner,
      githubRepo,
    },
  });

  console.log("Created default project:", project);
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
