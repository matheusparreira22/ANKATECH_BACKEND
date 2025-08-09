import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import { prismaPlugin } from '../src/libs/prisma'
import { authPlugin } from '../src/libs/auth'
import authRoutes from '../src/routes/auth'
import projectionRoutes from '../src/routes/projections'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://planner:plannerpw@localhost:5432/plannerdb'
    }
  }
})

describe('Projections', () => {
  let app: any
  let advisorToken: string
  let clientId: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.simulation.deleteMany()
    await prisma.event.deleteMany()
    await prisma.wallet.deleteMany()
    await prisma.goal.deleteMany()
    await prisma.client.deleteMany()

    app = Fastify({ logger: false })
    app.register(jwt, { secret: 'test-secret' })
    app.register(prismaPlugin)
    app.register(authPlugin)
    app.register(authRoutes, { prefix: '/api/auth' })
    app.register(projectionRoutes, { prefix: '/api' })
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

    // Create wallet for the client
    await prisma.wallet.create({
      data: {
        clientId,
        totalValue: 10000,
        allocation: {
          'Renda Fixa': 60,
          'Renda Variável': 40
        }
      }
    })

    // Create some events
    await prisma.event.create({
      data: {
        clientId,
        type: 'Aporte Mensal',
        value: 500,
        frequency: 'monthly',
        date: new Date()
      }
    })

    // Create a goal
    await prisma.goal.create({
      data: {
        clientId,
        type: 'Aposentadoria',
        amount: 1000000,
        targetAt: new Date('2040-12-31')
      }
    })
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    // Clean up database after all tests
    await prisma.simulation.deleteMany()
    await prisma.event.deleteMany()
    await prisma.wallet.deleteMany()
    await prisma.goal.deleteMany()
    await prisma.client.deleteMany()
    await prisma.$disconnect()
  })

  describe('POST /api/projections/simulate', () => {
    it('should simulate wealth projection with basic parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projections/simulate',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          initialValue: 10000,
          events: [],
          annualRate: 0.04
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('initialValue', 10000)
      expect(body.data).toHaveProperty('finalValue')
      expect(body.data).toHaveProperty('totalReturn')
      expect(body.data).toHaveProperty('projectionPoints')
      expect(Array.isArray(body.data.projectionPoints)).toBe(true)
    })

    it('should simulate wealth projection with monthly contributions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projections/simulate',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          initialValue: 10000,
          events: [{
            type: 'Aporte Mensal',
            value: 500,
            frequency: 'monthly'
          }],
          annualRate: 0.04
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.finalValue).toBeGreaterThan(body.data.initialValue)
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projections/simulate',
        payload: {
          initialValue: 10000
        }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/projections/client/:id', () => {
    it('should get client projection', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projections/client/${clientId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('clientId', clientId)
      expect(body.data).toHaveProperty('initialValue', 10000)
      expect(body.data).toHaveProperty('projectionPoints')
    })

    it('should return 404 for non-existent client', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projections/client/cme4bjm4q0000dmy76rmeyh00',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /api/projections/client/:id/annual', () => {
    it('should get annual projection for client', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projections/client/${clientId}/annual`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('projectionPoints')
      expect(Array.isArray(body.data.projectionPoints)).toBe(true)
      
      // Should only have annual points (December of each year)
      if (body.data.projectionPoints.length > 0) {
        expect(body.data.projectionPoints[0]).toHaveProperty('year')
        expect(body.data.projectionPoints[0]).toHaveProperty('projectedValue')
      }
    })
  })

  describe('POST /api/projections/client/:id/save', () => {
    it('should save simulation for client', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/projections/client/${clientId}/save`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('simulationId')
      expect(body.data).toHaveProperty('projection')
    })
  })
})
