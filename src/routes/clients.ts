import type { FastifyInstance } from 'fastify'
import { updateClientSchema, idParamSchema, paginationSchema } from '../schemas'
import { validateBody, validateParams, validateQuery } from '../libs/validation'
import type { UpdateClientInput, IdParam, PaginationQuery } from '../schemas'

export default async function clientRoutes(app: FastifyInstance) {
  // List clients with pagination
  app.get<{
    Querystring: PaginationQuery
  }>('/clients', {
    preHandler: [app.authenticate, app.requireAuth, validateQuery(paginationSchema)]
  }, async (request, reply) => {
    try {
      const { page, limit } = request.query
      const skip = (page - 1) * limit

      const [clients, total] = await Promise.all([
        app.prisma.client.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            age: true,
            status: true,
            perfilFamilia: true,
            role: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        app.prisma.client.count()
      ])

      reply.send({
        clients,
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

  // Get client by ID
  app.get<{
    Params: IdParam
  }>('/clients/:id', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params

      const client = await app.prisma.client.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          age: true,
          status: true,
          perfilFamilia: true,
          role: true,
          createdAt: true,
          goals: {
            select: {
              id: true,
              type: true,
              amount: true,
              targetAt: true
            }
          },
          wallet: {
            select: {
              id: true,
              totalValue: true,
              allocation: true
            }
          }
        }
      })

      if (!client) {
        return reply.code(404).send({ error: 'Client not found' })
      }

      reply.send(client)
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Update client
  app.put<{
    Params: IdParam
    Body: UpdateClientInput
  }>('/clients/:id', {
    preHandler: [app.authenticate, app.requireAdvisor, validateParams(idParamSchema), validateBody(updateClientSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const updateData = request.body

      // Check if client exists
      const existingClient = await app.prisma.client.findUnique({
        where: { id }
      })

      if (!existingClient) {
        return reply.code(404).send({ error: 'Client not found' })
      }

      // Check if email is being updated and if it's already taken
      if (updateData.email && updateData.email !== existingClient.email) {
        const emailExists = await app.prisma.client.findUnique({
          where: { email: updateData.email }
        })
        if (emailExists) {
          return reply.code(400).send({ error: 'Email already exists' })
        }
      }

      const updatedClient = await app.prisma.client.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          age: true,
          status: true,
          perfilFamilia: true,
          role: true
        }
      })

      reply.send(updatedClient)
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Delete client
  app.delete<{
    Params: IdParam
  }>('/clients/:id', {
    preHandler: [app.authenticate, app.requireAdvisor, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params

      // Check if client exists
      const existingClient = await app.prisma.client.findUnique({
        where: { id }
      })

      if (!existingClient) {
        return reply.code(404).send({ error: 'Client not found' })
      }

      // Delete client (cascade will handle related records)
      await app.prisma.client.delete({
        where: { id }
      })

      reply.code(204).send()
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
