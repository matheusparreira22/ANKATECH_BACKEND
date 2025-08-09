import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import { prismaPlugin } from '../src/libs/prisma'
import { authPlugin } from '../src/libs/auth'
import authRoutes from '../src/routes/auth'
import suggestionRoutes from '../src/routes/suggestions'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://planner:plannerpw@localhost:5432/plannerdb'
    }
  }
})

describe('Suggestions', () => {
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
    app.register(suggestionRoutes, { prefix: '/api' })
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
        totalValue: 50000,
        allocation: {
          'Renda Fixa': 80,
          'Renda Variável': 20
        }
      }
    })

    // Create some events
    await prisma.event.create({
      data: {
        clientId,
        type: 'Aporte Mensal',
        value: 1000,
        frequency: 'monthly',
        date: new Date()
      }
    })

    // Create an ambitious goal that won't be met
    await prisma.goal.create({
      data: {
        clientId,
        type: 'Aposentadoria',
        amount: 2000000, // 2 milhões - meta ambiciosa
        targetAt: new Date('2030-12-31') // Prazo curto
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

  describe('GET /api/suggestions/client/:id', () => {
    it('should generate suggestions for client', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/suggestions/client/${clientId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('clientId', clientId)
      expect(body.data).toHaveProperty('currentProjection')
      expect(body.data).toHaveProperty('goals')
      expect(body.data).toHaveProperty('suggestions')
      expect(body.data).toHaveProperty('overallAlignment')
      expect(Array.isArray(body.data.suggestions)).toBe(true)
      expect(Array.isArray(body.data.goals)).toBe(true)
    })

    it('should return 404 for non-existent client', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/suggestions/client/cme4bjm4q0000dmy76rmeyh00',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/suggestions/client/${clientId}`
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/suggestions/client/:id/summary', () => {
    it('should get suggestions summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/suggestions/client/${clientId}/summary`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('clientId', clientId)
      expect(body.data).toHaveProperty('overallAlignment')
      expect(body.data).toHaveProperty('totalSuggestions')
      expect(body.data).toHaveProperty('suggestions')
      expect(body.data).toHaveProperty('goalsSummary')
      expect(typeof body.data.overallAlignment).toBe('number')
      expect(typeof body.data.totalSuggestions).toBe('number')
    })
  })

  describe('GET /api/suggestions/client/:id/alignment', () => {
    it('should get goal alignment analysis', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/suggestions/client/${clientId}/alignment`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('clientId', clientId)
      expect(body.data).toHaveProperty('overallAlignment')
      expect(body.data).toHaveProperty('goals')
      expect(body.data).toHaveProperty('summary')
      expect(Array.isArray(body.data.goals)).toBe(true)
      
      if (body.data.goals.length > 0) {
        const goal = body.data.goals[0]
        expect(goal).toHaveProperty('id')
        expect(goal).toHaveProperty('feasible')
        expect(goal).toHaveProperty('gap')
        expect(goal).toHaveProperty('alignmentPercentage')
      }
    })
  })

  describe('POST /api/suggestions/client/:id/simulate', () => {
    it('should simulate suggestion impact', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/suggestions/client/${clientId}/simulate`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          suggestionId: 'test-suggestion',
          type: 'increase_contribution',
          impact: {
            monthlyAmount: 500
          }
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('suggestion')
      expect(body.data).toHaveProperty('originalProjection')
      expect(body.data).toHaveProperty('impactProjection')
      expect(body.data).toHaveProperty('improvement')
      expect(body.data.improvement).toHaveProperty('absoluteValue')
      expect(body.data.improvement).toHaveProperty('percentage')
    })
  })

  describe('GET /api/suggestions/client/:id/category/:category', () => {
    it('should get suggestions by category', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/suggestions/client/${clientId}/category/contribution`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('clientId', clientId)
      expect(body.data).toHaveProperty('category', 'contribution')
      expect(body.data).toHaveProperty('suggestions')
      expect(body.data).toHaveProperty('total')
      expect(Array.isArray(body.data.suggestions)).toBe(true)
    })
  })

  describe('GET /api/suggestions/stats', () => {
    it('should get general suggestions statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/suggestions/stats',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('totalClients')
      expect(body.data).toHaveProperty('clientsWithGoals')
      expect(body.data).toHaveProperty('averageSuggestionsPerClient')
      expect(body.data).toHaveProperty('sampleSize')
      expect(typeof body.data.totalClients).toBe('number')
    })
  })
})
