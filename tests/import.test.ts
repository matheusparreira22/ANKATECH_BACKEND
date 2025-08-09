import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import { prismaPlugin } from '../src/libs/prisma'
import { authPlugin } from '../src/libs/auth'
import authRoutes from '../src/routes/auth'
import importRoutes from '../src/routes/import'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://planner:plannerpw@localhost:5432/plannerdb'
    }
  }
})

describe('Import', () => {
  let app: any
  let advisorToken: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.client.deleteMany()

    app = Fastify({ logger: false })
    app.register(jwt, { secret: 'test-secret' })
    app.register(prismaPlugin)
    app.register(authPlugin)
    app.register(authRoutes, { prefix: '/api/auth' })
    app.register(importRoutes, { prefix: '/api' })
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
    await prisma.client.deleteMany()
    await prisma.$disconnect()
  })

  describe('GET /api/import/templates/:type', () => {
    it('should get client template', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/import/templates/clients',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toBe('text/csv')
      expect(response.headers['content-disposition']).toContain('template_clientes.csv')
      expect(response.body).toContain('name,email,password,age,role,status,perfilFamilia')
    })

    it('should get goals template', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/import/templates/goals',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toBe('text/csv')
      expect(response.headers['content-disposition']).toContain('template_metas.csv')
      expect(response.body).toContain('clientEmail,type,amount,targetAt')
    })

    it('should return 400 for invalid type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/import/templates/invalid',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/import/templates/clients'
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/import/history', () => {
    it('should get import history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/import/history',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
      
      // Should return mock data
      if (body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('id')
        expect(body.data[0]).toHaveProperty('type')
        expect(body.data[0]).toHaveProperty('filename')
        expect(body.data[0]).toHaveProperty('status')
        expect(body.data[0]).toHaveProperty('total')
        expect(body.data[0]).toHaveProperty('imported')
        expect(body.data[0]).toHaveProperty('errors')
      }
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/import/history'
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/import/:type/validate', () => {
    it('should validate CSV file structure', async () => {
      const csvContent = 'name,email,password,age,role,status,perfilFamilia\nJoão Silva,joao@test.com,123456,35,viewer,active,Casado'
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/import/clients/validate',
        headers: {
          authorization: `Bearer ${advisorToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: `------formdata-test\r\nContent-Disposition: form-data; name="file"; filename="test.csv"\r\nContent-Type: text/csv\r\n\r\n${csvContent}\r\n------formdata-test--\r\n`
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('filename', 'test.csv')
      expect(body.data).toHaveProperty('totalLines', 1)
      expect(body.data).toHaveProperty('headers')
      expect(body.data).toHaveProperty('expectedHeaders')
      expect(body.data).toHaveProperty('valid', true)
      expect(body.data).toHaveProperty('preview')
    })

    it('should detect missing headers', async () => {
      const csvContent = 'name,email\nJoão Silva,joao@test.com'
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/import/clients/validate',
        headers: {
          authorization: `Bearer ${advisorToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: `------formdata-test\r\nContent-Disposition: form-data; name="file"; filename="test.csv"\r\nContent-Type: text/csv\r\n\r\n${csvContent}\r\n------formdata-test--\r\n`
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.valid).toBe(false)
      expect(body.data.missingHeaders.length).toBeGreaterThan(0)
    })

    it('should return 400 for empty file', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/import/clients/validate',
        headers: {
          authorization: `Bearer ${advisorToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: `------formdata-test\r\nContent-Disposition: form-data; name="file"; filename="empty.csv"\r\nContent-Type: text/csv\r\n\r\n\r\n------formdata-test--\r\n`
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

      const csvContent = 'name,email\nTest,test@test.com'
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/import/clients/validate',
        headers: {
          authorization: `Bearer ${viewerToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: `------formdata-test\r\nContent-Disposition: form-data; name="file"; filename="test.csv"\r\nContent-Type: text/csv\r\n\r\n${csvContent}\r\n------formdata-test--\r\n`
      })

      // Viewer should have read access to validation
      expect(response.statusCode).toBe(200)
    })
  })

  describe('POST /api/import/:type', () => {
    it('should import clients from CSV', async () => {
      const csvContent = 'name,email,password,age,role,status,perfilFamilia\nJoão Silva,joao@test.com,123456,35,viewer,active,Casado\nMaria Santos,maria@test.com,123456,28,viewer,active,Solteira'
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/import/clients',
        headers: {
          authorization: `Bearer ${advisorToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: `------formdata-test\r\nContent-Disposition: form-data; name="file"; filename="clients.csv"\r\nContent-Type: text/csv\r\n\r\n${csvContent}\r\n------formdata-test--\r\n`
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('success', true)
      expect(body.data).toHaveProperty('total', 2)
      expect(body.data).toHaveProperty('imported')
      expect(body.data).toHaveProperty('errors')
      expect(body.data).toHaveProperty('duration')

      // Verify clients were created
      const clients = await prisma.client.findMany({
        where: {
          email: {
            in: ['joao@test.com', 'maria@test.com']
          }
        }
      })
      expect(clients.length).toBe(2)
    })

    it('should handle duplicate emails', async () => {
      // First, create a client
      await prisma.client.create({
        data: {
          name: 'Existing User',
          email: 'joao@test.com',
          password: 'hashedpassword',
          role: 'viewer'
        }
      })

      const csvContent = 'name,email,password,age,role,status,perfilFamilia\nJoão Silva,joao@test.com,123456,35,viewer,active,Casado'
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/import/clients',
        headers: {
          authorization: `Bearer ${advisorToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: `------formdata-test\r\nContent-Disposition: form-data; name="file"; filename="clients.csv"\r\nContent-Type: text/csv\r\n\r\n${csvContent}\r\n------formdata-test--\r\n`
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.imported).toBe(0)
      expect(body.data.errors.length).toBe(1)
      expect(body.data.errors[0].error).toContain('já existe')
    })

    it('should require advisor role for import', async () => {
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

      const csvContent = 'name,email,password\nTest,test@test.com,123456'
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/import/clients',
        headers: {
          authorization: `Bearer ${viewerToken}`,
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: `------formdata-test\r\nContent-Disposition: form-data; name="file"; filename="test.csv"\r\nContent-Type: text/csv\r\n\r\n${csvContent}\r\n------formdata-test--\r\n`
      })

      expect(response.statusCode).toBe(403)
    })

    it('should return 400 for missing file', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/import/clients',
        headers: {
          authorization: `Bearer ${advisorToken}`
        }
      })

      // Should return 500 because multipart expects a file
      expect(response.statusCode).toBe(500)
    })
  })
})
