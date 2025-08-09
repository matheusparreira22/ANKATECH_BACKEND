import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import { prismaPlugin } from '../src/libs/prisma'
import { authPlugin } from '../src/libs/auth'
import authRoutes from '../src/routes/auth'
import insuranceRoutes from '../src/routes/insurance'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://planner:plannerpw@localhost:5432/plannerdb'
    }
  }
})

describe('Insurance', () => {
  let app: any
  let advisorToken: string
  let clientId: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.insurance.deleteMany()
    await prisma.client.deleteMany()

    app = Fastify({ logger: false })
    app.register(jwt, { secret: 'test-secret' })
    app.register(prismaPlugin)
    app.register(authPlugin)
    app.register(authRoutes, { prefix: '/api/auth' })
    app.register(insuranceRoutes, { prefix: '/api' })
    await app.ready()

    // Create advisor user and get token
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Test Advisor',
        email: 'advisor@test.com',
        password: 'password123',
        role: 'advisor'
      }
    })

    clientId = JSON.parse(registerResponse.body).id

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'advisor@test.com',
        password: 'password123'
      }
    })
    advisorToken = JSON.parse(loginResponse.body).token
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    // Clean up database after all tests
    await prisma.insurance.deleteMany()
    await prisma.client.deleteMany()
    await prisma.$disconnect()
  })

  describe('POST /api/insurances', () => {
    it('should create a new insurance policy', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          clientId,
          type: 'LIFE',
          provider: 'Test Insurance Co',
          coverage: 500000,
          premium: 150,
          startDate: '2024-01-01',
          endDate: '2034-01-01'
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('id')
      expect(body.data.type).toBe('LIFE')
      expect(body.data.provider).toBe('Test Insurance Co')
      expect(body.data.coverage).toBe('500000')
      expect(body.data.premium).toBe('150')
    })

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          clientId,
          type: 'LIFE'
          // Missing required fields
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should require advisor role', async () => {
      // Create viewer user
      const viewerRegister = await app.inject({
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
      const viewerToken = JSON.parse(viewerLogin.body).token

      const response = await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${viewerToken}`
        },
        payload: {
          clientId,
          type: 'LIFE',
          provider: 'Test Insurance Co',
          coverage: 500000,
          premium: 150,
          startDate: '2024-01-01'
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /api/insurances', () => {
    beforeEach(async () => {
      // Create test insurance policies
      await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          clientId,
          type: 'LIFE',
          provider: 'Life Insurance Co',
          coverage: 500000,
          premium: 150,
          startDate: '2024-01-01'
        }
      })

      await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          clientId,
          type: 'AUTO',
          provider: 'Auto Insurance Co',
          coverage: 100000,
          premium: 80,
          startDate: '2024-01-01'
        }
      })
    })

    it('should list all insurance policies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.insurances).toHaveLength(2)
      expect(body.data.pagination).toHaveProperty('total', 2)
    })

    it('should filter by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/insurances?type=LIFE',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.insurances).toHaveLength(1)
      expect(body.data.insurances[0].type).toBe('LIFE')
    })

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/insurances?page=1&limit=1',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.insurances).toHaveLength(1)
      expect(body.data.pagination.totalPages).toBe(2)
    })
  })

  describe('GET /api/insurances/:id', () => {
    let insuranceId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          clientId,
          type: 'LIFE',
          provider: 'Test Insurance Co',
          coverage: 500000,
          premium: 150,
          startDate: '2024-01-01'
        }
      })
      insuranceId = JSON.parse(createResponse.body).data.id
    })

    it('should get insurance by id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/insurances/${insuranceId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.id).toBe(insuranceId)
      expect(body.data.client).toHaveProperty('name')
    })

    it('should return 404 for non-existent insurance', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/insurances/cme4bjm4q0000dmy76rmeyh00',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /api/insurances/:id', () => {
    let insuranceId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          clientId,
          type: 'LIFE',
          provider: 'Test Insurance Co',
          coverage: 500000,
          premium: 150,
          startDate: '2024-01-01'
        }
      })
      insuranceId = JSON.parse(createResponse.body).data.id
    })

    it('should update insurance policy', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/insurances/${insuranceId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          premium: 200,
          status: 'INACTIVE'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.premium).toBe('200')
      expect(body.data.status).toBe('INACTIVE')
    })

    it('should require advisor role for updates', async () => {
      // Create viewer user
      const viewerRegister = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Test Viewer',
          email: 'viewer2@test.com',
          password: 'password123',
          role: 'viewer'
        }
      })

      const viewerLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'viewer2@test.com',
          password: 'password123'
        }
      })
      const viewerToken = JSON.parse(viewerLogin.body).token

      const response = await app.inject({
        method: 'PUT',
        url: `/api/insurances/${insuranceId}`,
        headers: {
          authorization: `Bearer ${viewerToken}`
        },
        payload: {
          premium: 200
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('DELETE /api/insurances/:id', () => {
    let insuranceId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          clientId,
          type: 'LIFE',
          provider: 'Test Insurance Co',
          coverage: 500000,
          premium: 150,
          startDate: '2024-01-01'
        }
      })
      insuranceId = JSON.parse(createResponse.body).data.id
    })

    it('should delete insurance policy', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/insurances/${insuranceId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(204)

      // Verify it's deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/insurances/${insuranceId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(getResponse.statusCode).toBe(404)
    })
  })

  describe('GET /api/clients/:id/insurances/summary', () => {
    beforeEach(async () => {
      // Create multiple insurance policies
      await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          clientId,
          type: 'LIFE',
          provider: 'Life Insurance Co',
          coverage: 500000,
          premium: 150,
          startDate: '2024-01-01'
        }
      })

      await app.inject({
        method: 'POST',
        url: '/api/insurances',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          clientId,
          type: 'AUTO',
          provider: 'Auto Insurance Co',
          coverage: 100000,
          premium: 80,
          startDate: '2024-01-01'
        }
      })
    })

    it('should get client insurance summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/clients/${clientId}/insurances/summary`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.totalPolicies).toBe(2)
      expect(body.data.totalCoverage).toBe(600000)
      expect(body.data.totalPremiums).toBe(230)
      expect(body.data.byType).toHaveProperty('LIFE')
      expect(body.data.byType).toHaveProperty('AUTO')
    })
  })

  describe('GET /api/insurances/types', () => {
    it('should get available insurance types', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/insurances/types',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)
      expect(body.data[0]).toHaveProperty('value')
      expect(body.data[0]).toHaveProperty('label')
    })
  })
})
