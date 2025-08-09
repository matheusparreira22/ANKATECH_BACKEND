import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import { prismaPlugin } from '../src/libs/prisma'
import { authPlugin } from '../src/libs/auth'
import authRoutes from '../src/routes/auth'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://planner:plannerpw@localhost:5432/plannerdb'
    }
  }
})

describe('Authentication', () => {
  let app: any

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
    await app.ready()
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

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        age: 30,
        role: 'advisor'
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: userData
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('id')
      expect(body.email).toBe(userData.email)
      expect(body.name).toBe(userData.name)
      expect(body.role).toBe(userData.role)
      expect(body).not.toHaveProperty('password')
    })

    it('should not register user with duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'duplicate@example.com',
        password: 'password123'
      }

      // First registration
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: userData
      })

      // Second registration with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: userData
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('User already exists')
    })

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: '',
          email: 'invalid-email',
          password: '123' // too short
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Login Test User',
          email: 'login@example.com',
          password: 'password123',
          role: 'advisor'
        }
      })
    })

    it('should login with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'password123'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('token')
      expect(body).toHaveProperty('user')
      expect(body.user.email).toBe('login@example.com')
      expect(body.user.role).toBe('advisor')
    })

    it('should not login with invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'wrongpassword'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid credentials')
    })

    it('should not login with non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid credentials')
    })
  })

  describe('GET /api/auth/me', () => {
    let token: string

    beforeEach(async () => {
      // Register and login to get token
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Profile Test User',
          email: 'profile@example.com',
          password: 'password123',
          role: 'viewer',
          age: 25
        }
      })

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'profile@example.com',
          password: 'password123'
        }
      })

      const loginBody = JSON.parse(loginResponse.body)
      token = loginBody.token
    })

    it('should get user profile with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${token}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.email).toBe('profile@example.com')
      expect(body.name).toBe('Profile Test User')
      expect(body.role).toBe('viewer')
      expect(body.age).toBe(25)
      expect(body).not.toHaveProperty('password')
    })

    it('should not get profile without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me'
      })

      expect(response.statusCode).toBe(401)
    })

    it('should not get profile with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
