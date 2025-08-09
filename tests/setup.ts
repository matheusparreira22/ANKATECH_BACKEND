import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://planner:plannerpw@localhost:5432/plannerdb'
    }
  }
})

global.beforeEach(async () => {
  // Clean up database before each test
  await prisma.simulation.deleteMany()
  await prisma.event.deleteMany()
  await prisma.wallet.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.client.deleteMany()
})

global.afterAll(async () => {
  // Clean up database after all tests
  await prisma.simulation.deleteMany()
  await prisma.event.deleteMany()
  await prisma.wallet.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.client.deleteMany()
  await prisma.$disconnect()
})

export { prisma }
