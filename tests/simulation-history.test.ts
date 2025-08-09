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

describe('Simulation History', () => {
  let app: any
  let advisorToken: string
  let clientId: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.simulation.deleteMany()
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
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    // Clean up database after all tests
    await prisma.simulation.deleteMany()
    await prisma.client.deleteMany()
    await prisma.$disconnect()
  })

  describe('POST /api/projections/client/:id/save', () => {
    it('should save a simulation for client', async () => {
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

    it('should return 404 for non-existent client', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projections/client/cme4bjm4q0000dmy76rmeyh00/save',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /api/projections/client/:id/history', () => {
    beforeEach(async () => {
      // Create multiple simulations
      await app.inject({
        method: 'POST',
        url: `/api/projections/client/${clientId}/save`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      await app.inject({
        method: 'POST',
        url: `/api/projections/client/${clientId}/save`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })
    })

    it('should get client simulation history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projections/client/${clientId}/history`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.simulations).toHaveLength(2)
      expect(body.data.pagination).toHaveProperty('total', 2)
      expect(body.data.simulations[0]).toHaveProperty('id')
      expect(body.data.simulations[0]).toHaveProperty('name')
      expect(body.data.simulations[0]).toHaveProperty('parameters')
      expect(body.data.simulations[0]).toHaveProperty('results')
    })

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projections/client/${clientId}/history?page=1&limit=1`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.simulations).toHaveLength(1)
      expect(body.data.pagination.totalPages).toBe(2)
    })

    it('should support sorting', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projections/client/${clientId}/history?sortBy=createdAt&sortOrder=asc`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.simulations).toHaveLength(2)
    })
  })

  describe('GET /api/projections/client/:id/stats', () => {
    beforeEach(async () => {
      // Create a simulation
      await app.inject({
        method: 'POST',
        url: `/api/projections/client/${clientId}/save`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })
    })

    it('should get client simulation statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projections/client/${clientId}/stats`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('totalSimulations', 1)
      expect(body.data).toHaveProperty('averageFinalValue')
      expect(body.data).toHaveProperty('bestSimulation')
      expect(body.data).toHaveProperty('recentActivity')
      expect(body.data.recentActivity).toHaveProperty('lastSimulation')
      expect(body.data.recentActivity).toHaveProperty('simulationsThisMonth', 1)
    })

    it('should handle client with no simulations', async () => {
      // Create another client
      const newClientResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'New Client',
          email: 'newclient@test.com',
          password: 'password123',
          role: 'viewer'
        }
      })
      const newClientId = JSON.parse(newClientResponse.body).id

      const response = await app.inject({
        method: 'GET',
        url: `/api/projections/client/${newClientId}/stats`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.totalSimulations).toBe(0)
      expect(body.data.bestSimulation).toBeNull()
      expect(body.data.recentActivity.lastSimulation).toBeNull()
    })
  })

  describe('POST /api/projections/compare', () => {
    let simulationIds: string[]

    beforeEach(async () => {
      // Create multiple simulations
      const sim1Response = await app.inject({
        method: 'POST',
        url: `/api/projections/client/${clientId}/save`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      const sim2Response = await app.inject({
        method: 'POST',
        url: `/api/projections/client/${clientId}/save`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      simulationIds = [
        JSON.parse(sim1Response.body).data.simulationId,
        JSON.parse(sim2Response.body).data.simulationId
      ]
    })

    it('should compare multiple simulations', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projections/compare',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          simulationIds
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('simulations')
      expect(body.data).toHaveProperty('comparison')
      expect(body.data.simulations).toHaveLength(2)
      expect(body.data.comparison).toHaveProperty('bestPerformance')
      expect(body.data.comparison).toHaveProperty('worstPerformance')
      expect(body.data.comparison).toHaveProperty('averageFinalValue')
      expect(body.data.comparison).toHaveProperty('averageReturn')
    })

    it('should validate minimum number of simulations', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projections/compare',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          simulationIds: [simulationIds[0]] // Only one simulation
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should validate maximum number of simulations', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projections/compare',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          simulationIds: new Array(6).fill(simulationIds[0]) // Too many simulations
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('PUT /api/projections/simulations/:id/metadata', () => {
    let simulationId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/projections/client/${clientId}/save`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })
      simulationId = JSON.parse(response.body).data.simulationId
    })

    it('should update simulation metadata', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/projections/simulations/${simulationId}/metadata`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          name: 'Updated Simulation Name',
          description: 'Updated description',
          tags: ['retirement', 'long-term']
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.message).toBe('Metadados atualizados com sucesso')
    })

    it('should return 404 for non-existent simulation', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/projections/simulations/cme4bjm4q0000dmy76rmeyh00/metadata',
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          name: 'Updated Name'
        }
      })

      expect(response.statusCode).toBe(404)
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
        method: 'PUT',
        url: `/api/projections/simulations/${simulationId}/metadata`,
        headers: {
          authorization: `Bearer ${viewerToken}`
        },
        payload: {
          name: 'Updated Name'
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('DELETE /api/projections/simulations/:id', () => {
    let simulationId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/projections/client/${clientId}/save`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })
      simulationId = JSON.parse(response.body).data.simulationId
    })

    it('should delete simulation', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projections/simulations/${simulationId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(204)

      // Verify it's deleted by checking history
      const historyResponse = await app.inject({
        method: 'GET',
        url: `/api/projections/client/${clientId}/history`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      const historyBody = JSON.parse(historyResponse.body)
      expect(historyBody.data.simulations).toHaveLength(0)
    })

    it('should return 404 for non-existent simulation', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/projections/simulations/cme4bjm4q0000dmy76rmeyh00',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
