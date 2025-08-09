import type { FastifyInstance } from 'fastify'
import { ProjectionService } from '../services/projection'
import { SimulationHistoryService } from '../services/simulation-history'
import { cache, CacheService } from '../services/cache'
import { validateParams, validateQuery, validateBody } from '../libs/validation'
import { idParamSchema } from '../schemas'
import { z } from 'zod'

const projectionQuerySchema = z.object({
  annualRate: z.coerce.number().min(0).max(1).optional().default(0.04),
  startYear: z.coerce.number().int().min(2020).optional(),
  endYear: z.coerce.number().int().max(2100).optional().default(2060)
})

const simulationBodySchema = z.object({
  initialValue: z.number().positive(),
  events: z.array(z.object({
    type: z.string(),
    value: z.number(),
    frequency: z.enum(['once', 'monthly', 'yearly']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })).optional().default([]),
  annualRate: z.number().min(0).max(1).optional().default(0.04),
  startYear: z.number().int().min(2020).optional(),
  endYear: z.number().int().max(2100).optional().default(2060)
})

export default async function projectionRoutes(app: FastifyInstance) {
  const projectionService = new ProjectionService(app.prisma)
  const simulationHistoryService = new SimulationHistoryService(app.prisma)

  // Obter projeção patrimonial de um cliente
  app.get('/projections/client/:id', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema), validateQuery(projectionQuerySchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { annualRate } = request.query as any

      // Generate cache key
      const cacheKey = CacheService.projectionKey(id, { annualRate })

      // Try to get from cache first
      const projection = await cache.getOrSet(
        cacheKey,
        () => projectionService.createClientProjection(id, annualRate),
        2 * 60 * 1000 // 2 minutes cache
      )
      
      reply.send({
        success: true,
        data: projection
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Cliente não encontrado') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Obter projeção anual simplificada de um cliente
  app.get('/projections/client/:id/annual', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema), validateQuery(projectionQuerySchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { annualRate } = request.query as any

      const projection = await projectionService.createClientProjection(id, annualRate)
      const annualProjection = projectionService.getAnnualProjection(projection)
      
      reply.send({
        success: true,
        data: {
          clientId: projection.clientId,
          initialValue: projection.initialValue,
          finalValue: projection.finalValue,
          totalReturn: projection.totalReturn,
          annualRate: projection.annualRate,
          projectionPoints: annualProjection
        }
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Cliente não encontrado') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Simular projeção com parâmetros customizados
  app.post('/projections/simulate', {
    preHandler: [app.authenticate, app.requireAuth, validateBody(simulationBodySchema)]
  }, async (request, reply) => {
    try {
      const { initialValue, events, annualRate, startYear, endYear } = request.body as any

      // Converter eventos para formato correto
      const projectionEvents = events.map((event: any) => ({
        ...event,
        startDate: event.startDate ? new Date(event.startDate) : new Date(),
        endDate: event.endDate ? new Date(event.endDate) : new Date(2060, 11, 31)
      }))

      const projectionPoints = projectionService.simulateWealthCurve(
        initialValue,
        projectionEvents,
        annualRate,
        startYear || new Date().getFullYear(),
        endYear
      )

      const finalValue = projectionPoints[projectionPoints.length - 1]?.projectedValue || initialValue
      const totalReturn = finalValue - initialValue

      reply.send({
        success: true,
        data: {
          initialValue,
          finalValue,
          totalReturn,
          annualRate,
          projectionPoints: projectionPoints.filter(point => point.month === 12) // Apenas pontos anuais
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Salvar simulação para um cliente
  app.post('/projections/client/:id/save', {
    preHandler: [app.authenticate, app.requireAdvisor, validateParams(idParamSchema), validateQuery(projectionQuerySchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { annualRate } = request.query as any

      const projection = await projectionService.createClientProjection(id, annualRate)
      const simulationId = await projectionService.saveSimulation(id, projection)
      
      reply.code(201).send({
        success: true,
        data: {
          simulationId,
          projection
        }
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Cliente não encontrado') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Listar simulações salvas de um cliente
  app.get('/projections/client/:id/simulations', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      const simulations = await app.prisma.simulation.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        take: 10 // Limitar a 10 simulações mais recentes
      })

      reply.send({
        success: true,
        data: simulations
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Obter simulação específica
  app.get('/projections/simulations/:id', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      const simulation = await app.prisma.simulation.findUnique({
        where: { id },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      if (!simulation) {
        return reply.code(404).send({ error: 'Simulação não encontrada' })
      }

      reply.send({
        success: true,
        data: simulation
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Deletar simulação
  app.delete('/projections/simulations/:id', {
    preHandler: [app.authenticate, app.requireAdvisor, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      const simulation = await app.prisma.simulation.findUnique({
        where: { id }
      })

      if (!simulation) {
        return reply.code(404).send({ error: 'Simulação não encontrada' })
      }

      await app.prisma.simulation.delete({
        where: { id }
      })

      reply.code(204).send()
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Salvar simulação com metadados
  app.post('/projections/client/:id/save-with-metadata', {
    preHandler: [app.authenticate, app.requireAdvisor, validateParams(idParamSchema), validateBody(z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      annualRate: z.number().min(0).max(1).optional().default(0.04)
    }))]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { name, description, tags, annualRate } = request.body as any

      const projection = await projectionService.createClientProjection(id, annualRate)
      const simulationId = await simulationHistoryService.saveSimulation(id, projection, {
        name,
        description,
        tags
      })

      reply.code(201).send({
        success: true,
        data: {
          simulationId,
          projection
        }
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Cliente não encontrado') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Listar simulações de um cliente com filtros
  app.get('/projections/client/:id/history', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema), validateQuery(z.object({
      page: z.coerce.number().int().positive().optional().default(1),
      limit: z.coerce.number().int().positive().max(50).optional().default(10),
      tags: z.string().optional(),
      sortBy: z.enum(['createdAt', 'finalValue', 'totalReturn']).optional().default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
    }))]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { page, limit, tags, sortBy, sortOrder } = request.query as any

      const tagsArray = tags ? tags.split(',').map((tag: string) => tag.trim()) : undefined

      const result = await simulationHistoryService.getClientSimulations(id, {
        page,
        limit,
        tags: tagsArray,
        sortBy,
        sortOrder
      })

      reply.send({
        success: true,
        data: result
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Comparar simulações
  app.post('/projections/compare', {
    preHandler: [app.authenticate, app.requireAuth, validateBody(z.object({
      simulationIds: z.array(z.string().cuid()).min(2).max(5)
    }))]
  }, async (request, reply) => {
    try {
      const { simulationIds } = request.body as any

      const comparison = await simulationHistoryService.compareSimulations(simulationIds)

      reply.send({
        success: true,
        data: comparison
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Atualizar metadados de simulação
  app.put('/projections/simulations/:id/metadata', {
    preHandler: [app.authenticate, app.requireAdvisor, validateParams(idParamSchema), validateBody(z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional()
    }))]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const metadata = request.body as any

      await simulationHistoryService.updateSimulationMetadata(id, metadata)

      reply.send({
        success: true,
        message: 'Metadados atualizados com sucesso'
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Simulação não encontrada') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Estatísticas de simulações do cliente
  app.get('/projections/client/:id/stats', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      const stats = await simulationHistoryService.getClientSimulationStats(id)

      reply.send({
        success: true,
        data: stats
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}
