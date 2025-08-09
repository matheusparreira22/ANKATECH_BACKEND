import type { FastifyInstance } from 'fastify'
import { hashPassword, comparePassword } from '../libs/auth'
import { loginSchema, createClientSchema } from '../schemas'
import { validateBody } from '../libs/validation'
import type { LoginInput, CreateClientInput } from '../schemas'

export default async function authRoutes(app: FastifyInstance) {
  // Register new user
  app.post<{
    Body: CreateClientInput
  }>('/register', {
    preHandler: [validateBody(createClientSchema)]
  }, async (request, reply) => {
    try {
      const { password, ...userData } = request.body

      // Check if user already exists
      const existingUser = await app.prisma.client.findUnique({
        where: { email: userData.email }
      })

      if (existingUser) {
        return reply.code(400).send({ error: 'User already exists' })
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password)
      const user = await app.prisma.client.create({
        data: {
          ...userData,
          password: hashedPassword
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      })

      reply.code(201).send(user)
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Login user
  app.post<{
    Body: LoginInput
  }>('/login', {
    preHandler: [validateBody(loginSchema)]
  }, async (request, reply) => {
    try {
      const { email, password } = request.body

      // Find user
      const user = await app.prisma.client.findUnique({
        where: { email }
      })

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' })
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.password)
      if (!isValidPassword) {
        return reply.code(401).send({ error: 'Invalid credentials' })
      }

      // Generate JWT token
      const token = app.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role
      })

      reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Get current user profile
  app.get('/me', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    try {
      const user = await app.prisma.client.findUnique({
        where: { id: request.user!.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          age: true,
          status: true,
          perfilFamilia: true
        }
      })

      if (!user) {
        return reply.code(404).send({ error: 'User not found' })
      }

      reply.send(user)
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
