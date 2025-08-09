import type { FastifyInstance } from 'fastify'
import { createEventSchema, updateEventSchema, idParamSchema } from '../schemas'
import { validateBody, validateParams } from '../libs/validation'

export default async function eventRoutes(app: FastifyInstance) {
  // Create event
  app.post<{
    Body: CreateEventInput
  }>('/events', {
    preHandler: [app.authenticate, app.requireAdvisor],
    schema: {
      body: createEventSchema,
      tags: ['Events'],
      summary: 'Create a new financial event',
      security: [{ bearerAuth: [] }],
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            clientId: { type: 'string' },
            type: { type: 'string' },
            value: { type: 'number' },
            frequency: { type: 'string' },
            date: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const eventData = request.body

      // Verify client exists
      const client = await app.prisma.client.findUnique({
        where: { id: eventData.clientId }
      })

      if (!client) {
        return reply.code(400).send({ error: 'Client not found' })
      }

      const data = {
        ...eventData,
        date: eventData.date ? new Date(eventData.date) : null
      }

      const event = await app.prisma.event.create({
        data
      })

      reply.code(201).send(event)
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // List events with pagination
  app.get<{
    Querystring: PaginationQuery & { clientId?: string; type?: string }
  }>('/events', {
    preHandler: [app.authenticate, app.requireAuth],
    schema: {
      querystring: {
        ...paginationSchema.shape,
        clientId: { type: 'string', description: 'Filter by client ID' },
        type: { type: 'string', description: 'Filter by event type' }
      },
      tags: ['Events'],
      summary: 'List events with pagination',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  clientId: { type: 'string' },
                  type: { type: 'string' },
                  value: { type: 'number' },
                  frequency: { type: 'string' },
                  date: { type: 'string' },
                  client: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      email: { type: 'string' }
                    }
                  }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, clientId, type } = request.query
      const skip = (page - 1) * limit

      const where: any = {}
      if (clientId) where.clientId = clientId
      if (type) where.type = type

      const [events, total] = await Promise.all([
        app.prisma.event.findMany({
          where,
          skip,
          take: limit,
          include: {
            client: {
              select: {
                name: true,
                email: true
              }
            }
          },
          orderBy: { date: 'desc' }
        }),
        app.prisma.event.count({ where })
      ])

      reply.send({
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Get event by ID
  app.get<{
    Params: IdParam
  }>('/events/:id', {
    preHandler: [app.authenticate, app.requireAuth],
    schema: {
      params: idParamSchema,
      tags: ['Events'],
      summary: 'Get event by ID',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            clientId: { type: 'string' },
            type: { type: 'string' },
            value: { type: 'number' },
            frequency: { type: 'string' },
            date: { type: 'string' },
            client: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params

      const event = await app.prisma.event.findUnique({
        where: { id },
        include: {
          client: {
            select: {
              name: true,
              email: true
            }
          }
        }
      })

      if (!event) {
        return reply.code(404).send({ error: 'Event not found' })
      }

      reply.send(event)
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Update event
  app.put<{
    Params: IdParam
    Body: UpdateEventInput
  }>('/events/:id', {
    preHandler: [app.authenticate, app.requireAdvisor],
    schema: {
      params: idParamSchema,
      body: updateEventSchema,
      tags: ['Events'],
      summary: 'Update event',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            clientId: { type: 'string' },
            type: { type: 'string' },
            value: { type: 'number' },
            frequency: { type: 'string' },
            date: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const updateData = request.body

      // Check if event exists
      const existingEvent = await app.prisma.event.findUnique({
        where: { id }
      })

      if (!existingEvent) {
        return reply.code(404).send({ error: 'Event not found' })
      }

      // Convert date to Date if provided
      const data = updateData.date 
        ? { ...updateData, date: new Date(updateData.date) }
        : updateData

      const updatedEvent = await app.prisma.event.update({
        where: { id },
        data
      })

      reply.send(updatedEvent)
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Delete event
  app.delete<{
    Params: IdParam
  }>('/events/:id', {
    preHandler: [app.authenticate, app.requireAdvisor],
    schema: {
      params: idParamSchema,
      tags: ['Events'],
      summary: 'Delete event',
      security: [{ bearerAuth: [] }],
      response: {
        204: {
          type: 'null'
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params

      // Check if event exists
      const existingEvent = await app.prisma.event.findUnique({
        where: { id }
      })

      if (!existingEvent) {
        return reply.code(404).send({ error: 'Event not found' })
      }

      await app.prisma.event.delete({
        where: { id }
      })

      reply.code(204).send()
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
