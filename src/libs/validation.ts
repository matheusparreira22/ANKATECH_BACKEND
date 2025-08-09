import type { FastifyRequest, FastifyReply } from 'fastify'
import { ZodSchema, ZodError, ZodIssue } from 'zod'

export const validateBody = (schema: ZodSchema) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.body = schema.parse(request.body)
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.issues.map((err: ZodIssue) => ({
            path: err.path.join('.'),
            message: err.message
          }))
        })
      }
      return reply.code(400).send({ error: 'Invalid request body' })
    }
  }
}

export const validateParams = (schema: ZodSchema) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.params = schema.parse(request.params)
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.issues.map((err: ZodIssue) => ({
            path: err.path.join('.'),
            message: err.message
          }))
        })
      }
      return reply.code(400).send({ error: 'Invalid request parameters' })
    }
  }
}

export const validateQuery = (schema: ZodSchema) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.query = schema.parse(request.query)
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.issues.map((err: ZodIssue) => ({
            path: err.path.join('.'),
            message: err.message
          }))
        })
      }
      return reply.code(400).send({ error: 'Invalid query parameters' })
    }
  }
}
