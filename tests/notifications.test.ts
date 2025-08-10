import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import { prismaPlugin } from '../src/libs/prisma'
import { authPlugin } from '../src/libs/auth'
import authRoutes from '../src/routes/auth'
import notificationRoutes from '../src/routes/notifications'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://planner:plannerpw@localhost:5432/plannerdb'
    }
  }
})

describe('Notifications', () => {
  let app: any
  let advisorToken: string
  let viewerToken: string
  let clientId: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.notification.deleteMany()
    await prisma.client.deleteMany()

    app = Fastify({ logger: false })
    app.register(jwt, { secret: 'test-secret' })
    app.register(prismaPlugin)
    app.register(authPlugin)
    app.register(authRoutes, { prefix: '/api/auth' })
    app.register(notificationRoutes, { prefix: '/api' })
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
    await prisma.client.deleteMany()
    await prisma.$disconnect()
  })

  describe('POST /api/notifications', () => {
    it('should create notification (advisor only)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/notifications',
        headers: {
          authorization: `Bearer ${advisorToken}`,
          'content-type': 'application/json'
        },
        payload: {
          clientId,
          type: 'SYSTEM_ALERT',
          title: 'Test Notification',
          message: 'This is a test notification'
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.title).toBe('Test Notification')
      expect(body.data.type).toBe('SYSTEM_ALERT')
    })

    it('should not allow viewer to create notifications', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/notifications',
        headers: {
          authorization: `Bearer ${viewerToken}`,
          'content-type': 'application/json'
        },
        payload: {
          clientId,
          type: 'SYSTEM_ALERT',
          title: 'Test Notification',
          message: 'This is a test notification'
        }
      })

      expect(response.statusCode).toBe(403)
    })

    it('should validate notification data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/notifications',
        headers: {
          authorization: `Bearer ${advisorToken}`,
          'content-type': 'application/json'
        },
        payload: {
          clientId,
          type: 'INVALID_TYPE',
          title: '',
          message: ''
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/notifications/client/:id', () => {
    beforeEach(async () => {
      // Create test notifications
      await prisma.notification.createMany({
        data: [
          {
            clientId,
            type: 'SYSTEM_ALERT',
            title: 'Test 1',
            message: 'Message 1',
            status: 'UNREAD'
          },
          {
            clientId,
            type: 'REMINDER',
            title: 'Test 2',
            message: 'Message 2',
            status: 'READ'
          }
        ]
      })
    })

    it('should get client notifications', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/notifications/client/${clientId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.notifications.length).toBe(2)
      expect(body.data.pagination.total).toBe(2)
    })

    it('should allow client to see own notifications', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/notifications/client/${clientId}`,
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(200)
    })

    it('should filter notifications by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/notifications/client/${clientId}?type=SYSTEM_ALERT`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.notifications.length).toBe(1)
      expect(body.data.notifications[0].type).toBe('SYSTEM_ALERT')
    })

    it('should filter notifications by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/notifications/client/${clientId}?status=UNREAD`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.notifications.length).toBe(1)
      expect(body.data.notifications[0].status).toBe('UNREAD')
    })
  })

  describe('GET /api/notifications/client/:id/stats', () => {
    beforeEach(async () => {
      await prisma.notification.createMany({
        data: [
          {
            clientId,
            type: 'SYSTEM_ALERT',
            title: 'Test 1',
            message: 'Message 1',
            status: 'UNREAD'
          },
          {
            clientId,
            type: 'REMINDER',
            title: 'Test 2',
            message: 'Message 2',
            status: 'UNREAD'
          },
          {
            clientId,
            type: 'SYSTEM_ALERT',
            title: 'Test 3',
            message: 'Message 3',
            status: 'READ'
          }
        ]
      })
    })

    it('should get notification statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/notifications/client/${clientId}/stats`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.total).toBe(3)
      expect(body.data.unread).toBe(2)
      expect(body.data.byType.SYSTEM_ALERT).toBe(2)
      expect(body.data.byType.REMINDER).toBe(1)
    })
  })

  describe('PUT /api/notifications/:id/read', () => {
    let notificationId: string

    beforeEach(async () => {
      const notification = await prisma.notification.create({
        data: {
          clientId,
          type: 'SYSTEM_ALERT',
          title: 'Test Notification',
          message: 'Test Message',
          status: 'UNREAD'
        }
      })
      notificationId = notification.id
    })

    it('should mark notification as read', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/notifications/${notificationId}/read`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.status).toBe('READ')
      expect(body.data.readAt).toBeTruthy()
    })

    it('should allow client to mark own notification as read', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/notifications/${notificationId}/read`,
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('PUT /api/notifications/client/:id/read-all', () => {
    beforeEach(async () => {
      await prisma.notification.createMany({
        data: [
          {
            clientId,
            type: 'SYSTEM_ALERT',
            title: 'Test 1',
            message: 'Message 1',
            status: 'UNREAD'
          },
          {
            clientId,
            type: 'REMINDER',
            title: 'Test 2',
            message: 'Message 2',
            status: 'UNREAD'
          }
        ]
      })
    })

    it('should mark all notifications as read', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/notifications/client/${clientId}/read-all`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.updatedCount).toBe(2)
    })
  })

  describe('POST /api/notifications/alerts/generate', () => {
    it('should generate automatic alerts (advisor only)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/notifications/alerts/generate',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('insuranceAlerts')
      expect(body.data).toHaveProperty('goalAlerts')
      expect(body.data).toHaveProperty('total')
    })

    it('should not allow viewer to generate alerts', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/notifications/alerts/generate',
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('DELETE /api/notifications/:id', () => {
    let notificationId: string

    beforeEach(async () => {
      const notification = await prisma.notification.create({
        data: {
          clientId,
          type: 'SYSTEM_ALERT',
          title: 'Test Notification',
          message: 'Test Message',
          status: 'UNREAD'
        }
      })
      notificationId = notification.id
    })

    it('should delete notification', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/notifications/${notificationId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.message).toContain('deletada com sucesso')
    })

    it('should allow client to delete own notification', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/notifications/${notificationId}`,
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(200)
    })

    it('should return 404 for non-existent notification', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/notifications/non-existent-id',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
