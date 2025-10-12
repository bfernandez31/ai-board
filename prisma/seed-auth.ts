import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔐 Starting authentication seed...')

  // Create default admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ai-board.local' },
    update: {},
    create: {
      email: 'admin@ai-board.local',
      name: 'Admin User',
      emailVerified: new Date(),
    },
  })

  console.log('✅ Default admin user created:', admin.email)

  // Count projects assigned to admin
  const projectCount = await prisma.project.count({
    where: { userId: admin.id },
  })

  console.log(`✅ Admin user has ${projectCount} projects`)
}

main()
  .catch((e) => {
    console.error('❌ Error during authentication seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
