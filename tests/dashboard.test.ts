import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import { prismaPlugin } from '../src/libs/prisma'
import { authPlugin } from '../src/libs/auth'
import authRoutes from '../src/routes/auth'
import dashboardRoutes from '../src/routes/dashboard'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://planner:plannerpw@localhost:5432/plannerdb'
    }
  }
})

describe('Dashboard', () => {
  let app: any
  let advisorToken: string
  let viewerToken: string
  let clientId: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.notification.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.insurance.deleteMany()
    await prisma.simulation.deleteMany()
    await prisma.goal.deleteMany()
    await prisma.client.deleteMany()

    app = Fastify({ logger: false })
    app.register(jwt, { secret: 'test-secret' })
    app.register(prismaPlugin)
    app.register(authPlugin)
    app.register(authRoutes, { prefix: '/api/auth' })
    app.register(dashboardRoutes, { prefix: '/api' })
    await app.ready()

    // Create advisor user and get token
    const advisorResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Test Advisor',
        email: 'advisor@test.com',
        password: 'password123',
        role: 'advisor'
      }
    })

    const advisorLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'advisor@test.com',
        password: 'password123'
      }
    })
    advisorToken = JSON.parse(advisorLogin.body).token

    // Create viewer user and get token
    const viewerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Test Viewer',
        email: 'viewer@test.com',
        password: 'password123',
        role: 'viewer'
      }
    })

    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'viewer@test.com',
        password: 'password123'
      }
    })
    viewerToken = JSON.parse(viewerLogin.body).token
    clientId = JSON.parse(viewerResponse.body).id
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    // Clean up database after all tests
    await prisma.notification.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.insurance.deleteMany()
    await prisma.simulation.deleteMany()
    await prisma.goal.deleteMany()
    await prisma.client.deleteMany()
    await prisma.$disconnect()
  })

  describe('GET /api/dashboard/metrics', () => {
    beforeEach(async () => {
      // Create test data
      await prisma.simulation.create({
        data: {
          clientId,
          payload: {
            currentValue: 10000,
            finalValue: 15000,
            annualRate: 0.05
          }
        }
      })

      await prisma.insurance.create({
        data: {
          clientId,
          type: 'LIFE',
          provider: 'Test Insurance',
          coverage: 100000,
          premium: 500,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE'
        }
      })

      await prisma.goal.create({
        data: {
          clientId,
          type: 'RETIREMENT',
          amount: 50000,
          targetAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      })

      await prisma.notification.create({
        data: {
          clientId,
          type: 'SYSTEM_ALERT',
          title: 'Test Notification',
          message: 'Test Message',
          status: 'UNREAD'
        }
      })
    })

    it('should get dashboard metrics (advisor only)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/metrics',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('clients')
      expect(body.data).toHaveProperty('projections')
      expect(body.data).toHaveProperty('insurances')
      expect(body.data).toHaveProperty('goals')
      expect(body.data).toHaveProperty('notifications')
      expect(body.data).toHaveProperty('activity')

      expect(body.data.clients.total).toBe(2) // advisor + viewer
      expect(body.data.projections.total).toBe(1)
      expect(body.data.insurances.total).toBe(1)
      expect(body.data.goals.total).toBe(1)
      expect(body.data.notifications.total).toBe(1)
    })

    it('should not allow viewer to access metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/metrics',
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(403)
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/metrics'
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/dashboard/client/:id/analytics', () => {
    beforeEach(async () => {
      await prisma.simulation.create({
        data: {
          clientId,
          payload: {
            currentValue: 10000,
            finalValue: 15000,
            annualRate: 0.05
          }
        }
      })

      await prisma.insurance.create({
        data: {
          clientId,
          type: 'LIFE',
          provider: 'Test Insurance',
          coverage: 100000,
          premium: 500,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE'
        }
      })

      await prisma.goal.create({
        data: {
          clientId,
          type: 'RETIREMENT',
          amount: 50000,
          targetAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      })
    })

    it('should get client analytics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/dashboard/client/${clientId}/analytics`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('clientId', clientId)
      expect(body.data).toHaveProperty('totalAssets')
      expect(body.data).toHaveProperty('projectedGrowth')
      expect(body.data).toHaveProperty('riskScore')
      expect(body.data).toHaveProperty('goalProgress')
      expect(body.data).toHaveProperty('insuranceCoverage')
      expect(body.data).toHaveProperty('lastActivity')
      expect(body.data).toHaveProperty('engagementScore')

      expect(body.data.totalAssets).toBe(10000)
      expect(body.data.projectedGrowth).toBe(50) // (15000-10000)/10000 * 100
      expect(body.data.insuranceCoverage).toBe(100000)
    })

    it('should allow client to see own analytics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/dashboard/client/${clientId}/analytics`,
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(200)
    })

    it('should return 404 for non-existent client', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/client/non-existent-id/analytics',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /api/dashboard/reports/financial', () => {
    beforeEach(async () => {
      await prisma.simulation.create({
        data: {
          clientId,
          payload: {
            currentValue: 10000,
            finalValue: 15000,
            annualRate: 0.05
          }
        }
      })
    })

    it('should generate financial report (advisor only)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/reports/financial?period=monthly',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('period')
      expect(body.data).toHaveProperty('totalAssets')
      expect(body.data).toHaveProperty('projectedValue')
      expect(body.data).toHaveProperty('growth')
      expect(body.data).toHaveProperty('riskDistribution')
      expect(body.data).toHaveProperty('topPerformers')
      expect(body.data).toHaveProperty('insights')

      expect(body.data.period).toContain('monthly')
      expect(Array.isArray(body.data.topPerformers)).toBe(true)
      expect(Array.isArray(body.data.insights)).toBe(true)
    })

    it('should support different periods', async () => {
      const periods = ['monthly', 'quarterly', 'yearly']

      for (const period of periods) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/dashboard/reports/financial?period=${period}`,
          headers: {
            authorization: `Bearer ${advisorToken}`
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.data.period).toContain(period)
      }
    })

    it('should not allow viewer to generate reports', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/reports/financial',
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /api/dashboard/health', () => {
    it('should get system health (advisor only)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/health',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('status')
      expect(body.data).toHaveProperty('totalUsers')
      expect(body.data).toHaveProperty('activeUsers')
      expect(body.data).toHaveProperty('errorLogs')
      expect(body.data).toHaveProperty('avgResponseTime')
      expect(body.data).toHaveProperty('systemLoad')
      expect(body.data).toHaveProperty('uptime')
      expect(body.data).toHaveProperty('timestamp')

      expect(['healthy', 'warning']).toContain(body.data.status)
      expect(typeof body.data.uptime).toBe('number')
    })

    it('should not allow viewer to access health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/health',
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /api/dashboard/trends', () => {
    it('should get performance trends (advisor only)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/trends?days=7',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBe(7)

      if (body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('date')
        expect(body.data[0]).toHaveProperty('logins')
        expect(body.data[0]).toHaveProperty('simulations')
        expect(body.data[0]).toHaveProperty('notifications')
      }
    })

    it('should validate days parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/trends?days=400', // > 365
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/dashboard/realtime', () => {
    it('should get real-time statistics (advisor only)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/realtime',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('timestamp')
      expect(body.data).toHaveProperty('activeUsers')
      expect(body.data).toHaveProperty('recentActions')
      expect(body.data).toHaveProperty('recentLogins')
      expect(body.data).toHaveProperty('systemLoad')
      expect(body.data).toHaveProperty('memoryUsage')
      expect(body.data).toHaveProperty('uptime')

      expect(body.data.memoryUsage).toHaveProperty('rss')
      expect(body.data.memoryUsage).toHaveProperty('heapUsed')
      expect(body.data.memoryUsage).toHaveProperty('heapTotal')
    })
  })

  describe('GET /api/dashboard/alerts', () => {
    it('should get alerts and warnings (advisor only)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/alerts',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)

      // Should return empty array when no alerts
      body.data.forEach((alert: any) => {
        expect(alert).toHaveProperty('type')
        expect(alert).toHaveProperty('title')
        expect(alert).toHaveProperty('message')
        expect(alert).toHaveProperty('count')
        expect(['info', 'warning', 'error']).toContain(alert.type)
      })
    })
  })
})
