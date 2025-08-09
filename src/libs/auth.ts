import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcrypt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
    user: JWTPayload
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate
    requireAdvisor: typeof requireAdvisor
    requireAuth: typeof requireAuth
  }
}

export interface JWTPayload {
  id: string
  email: string
  role: string
}

// Hash password utility
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10)
}

// Compare password utility
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

// JWT Authentication middleware
export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const token = await request.jwtVerify<JWTPayload>()
    request.user = token
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' })
  }
}

// Role-based authorization middleware
export const authorize = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
  }
}

// Middleware for advisor role (read/write access)
export const requireAdvisor = authorize(['advisor'])

// Middleware for viewer or advisor role (read access)
export const requireAuth = authorize(['advisor', 'viewer'])

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate('authenticate', authenticate)
  app.decorate('requireAdvisor', requireAdvisor)
  app.decorate('requireAuth', requireAuth)
})
