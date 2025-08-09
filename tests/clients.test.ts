import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import { prismaPlugin } from '../src/libs/prisma'
import { authPlugin } from '../src/libs/auth'
import authRoutes from '../src/routes/auth'
import clientRoutes from '../src/routes/clients'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://planner:plannerpw@localhost:5432/plannerdb'
    }
  }
})

describe('Clients', () => {
  let app: any
  let advisorToken: string
  let viewerToken: string

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
    app.register(clientRoutes, { prefix: '/api' })
    await app.ready()

    // Create advisor user and get token
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Advisor User',
        email: 'advisor@example.com',
        password: 'password123',
        role: 'advisor'
      }
    })

    const advisorLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'advisor@example.com',
        password: 'password123'
      }
    })
    advisorToken = JSON.parse(advisorLogin.body).token

    // Create viewer user and get token
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Viewer User',
        email: 'viewer@example.com',
        password: 'password123',
        role: 'viewer'
      }
    })

    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'viewer@example.com',
        password: 'password123'
      }
    })
    viewerToken = JSON.parse(viewerLogin.body).token
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

  describe('GET /api/clients', () => {
    it('should list clients for advisor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('clients')
      expect(body).toHaveProperty('pagination')
      expect(Array.isArray(body.clients)).toBe(true)
      expect(body.clients.length).toBe(2) // advisor and viewer users
    })

    it('should list clients for viewer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('clients')
      expect(body.clients.length).toBe(2)
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/clients'
      })

      expect(response.statusCode).toBe(401)
    })

    it('should handle pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/clients?page=1&limit=1',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.limit).toBe(1)
      expect(body.clients.length).toBe(1)
    })
  })

  describe('GET /api/clients/:id', () => {
    it('should get client by ID', async () => {
      // Get the advisor user ID
      const clientsList = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })
      const clients = JSON.parse(clientsList.body).clients
      const clientId = clients[0].id

      const response = await app.inject({
        method: 'GET',
        url: `/api/clients/${clientId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.id).toBe(clientId)
      expect(body).toHaveProperty('name')
      expect(body).toHaveProperty('email')
    })

    it('should return 404 for non-existent client', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/clients/cme4bjm4q0000dmy76rmeyh00', // Valid CUID format but non-existent
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /api/clients/:id', () => {
    it('should update client as advisor', async () => {
      // Get the advisor user ID
      const clientsList = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })
      const clients = JSON.parse(clientsList.body).clients
      const clientId = clients[0].id

      const response = await app.inject({
        method: 'PUT',
        url: `/api/clients/${clientId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        },
        payload: {
          name: 'Updated Name',
          age: 30
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.name).toBe('Updated Name')
      expect(body.age).toBe(30)
    })

    it('should not allow viewer to update client', async () => {
      const clientsList = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })
      const clients = JSON.parse(clientsList.body).clients
      const clientId = clients[0].id

      const response = await app.inject({
        method: 'PUT',
        url: `/api/clients/${clientId}`,
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

  describe('DELETE /api/clients/:id', () => {
    it('should delete client as advisor', async () => {
      // Create a test client first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Test Client',
          email: 'testclient@example.com',
          password: 'password123',
          role: 'viewer'
        }
      })
      const clientId = JSON.parse(createResponse.body).id

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/clients/${clientId}`,
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(204)
    })

    it('should not allow viewer to delete client', async () => {
      const clientsList = await app.inject({
        method: 'GET',
        url: '/api/clients',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })
      const clients = JSON.parse(clientsList.body).clients
      const clientId = clients[0].id

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/clients/${clientId}`,
        headers: {
          authorization: `Bearer ${viewerToken}`
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })
})
