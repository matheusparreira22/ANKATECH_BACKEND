import type { FastifyInstance } from 'fastify'
import { SuggestionService } from '../services/suggestions'
import { ProjectionService } from '../services/projection'
import { validateParams, validateBody } from '../libs/validation'
import { idParamSchema } from '../schemas'
import { z } from 'zod'

const suggestionSimulationSchema = z.object({
  suggestionId: z.string(),
  type: z.enum(['increase_contribution', 'reduce_expenses', 'adjust_allocation', 'extend_timeline', 'reduce_goal']),
  impact: z.object({
    monthlyAmount: z.number().optional(),
    totalAmount: z.number().optional(),
    timeframe: z.number().optional()
  })
})

export default async function suggestionRoutes(app: FastifyInstance) {
  const projectionService = new ProjectionService(app.prisma)
  const suggestionService = new SuggestionService(app.prisma, projectionService)

  // Obter análise e sugestões para um cliente
  app.get('/suggestions/client/:id', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      const analysis = await suggestionService.generateSuggestions(id)
      
      reply.send({
        success: true,
        data: analysis
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Cliente não encontrado') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Obter apenas as sugestões (sem projeção completa)
  app.get('/suggestions/client/:id/summary', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      const analysis = await suggestionService.generateSuggestions(id)
      
      reply.send({
        success: true,
        data: {
          clientId: analysis.clientId,
          overallAlignment: analysis.overallAlignment,
          totalSuggestions: analysis.suggestions.length,
          highPrioritySuggestions: analysis.suggestions.filter(s => s.priority === 'high').length,
          suggestions: analysis.suggestions,
          goalsSummary: {
            total: analysis.goals.length,
            feasible: analysis.goals.filter(g => g.feasible).length,
            totalGap: analysis.goals.reduce((sum, goal) => sum + Math.max(0, goal.gap), 0)
          }
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

  // Simular impacto de uma sugestão
  app.post('/suggestions/client/:id/simulate', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema), validateBody(suggestionSimulationSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const suggestionData = request.body as any

      // Criar objeto de sugestão para simulação
      const suggestion = {
        id: suggestionData.suggestionId,
        type: suggestionData.type,
        title: 'Simulação',
        description: 'Simulação de impacto',
        impact: suggestionData.impact,
        priority: 'medium' as const,
        category: 'contribution' as const
      }

      const impactProjection = await suggestionService.simulateSuggestionImpact(id, suggestion)
      const originalProjection = await projectionService.createClientProjection(id)

      // Calcular diferença
      const improvement = impactProjection.finalValue - originalProjection.finalValue
      const improvementPercentage = (improvement / originalProjection.finalValue) * 100

      reply.send({
        success: true,
        data: {
          suggestion,
          originalProjection: {
            finalValue: originalProjection.finalValue,
            totalReturn: originalProjection.totalReturn
          },
          impactProjection: {
            finalValue: impactProjection.finalValue,
            totalReturn: impactProjection.totalReturn
          },
          improvement: {
            absoluteValue: improvement,
            percentage: improvementPercentage,
            description: improvement > 0 
              ? `Melhoria de R$ ${improvement.toLocaleString('pt-BR')} (${improvementPercentage.toFixed(2)}%)`
              : `Redução de R$ ${Math.abs(improvement).toLocaleString('pt-BR')} (${Math.abs(improvementPercentage).toFixed(2)}%)`
          }
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

  // Obter sugestões por categoria
  app.get('/suggestions/client/:id/category/:category', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(z.object({
      id: z.string().cuid(),
      category: z.enum(['contribution', 'allocation', 'timeline', 'goal'])
    }))]
  }, async (request, reply) => {
    try {
      const { id, category } = request.params as any

      const analysis = await suggestionService.generateSuggestions(id)
      const categorySuggestions = analysis.suggestions.filter(s => s.category === category)
      
      reply.send({
        success: true,
        data: {
          clientId: id,
          category,
          suggestions: categorySuggestions,
          total: categorySuggestions.length
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

  // Obter análise de alinhamento das metas
  app.get('/suggestions/client/:id/alignment', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      const analysis = await suggestionService.generateSuggestions(id)
      
      reply.send({
        success: true,
        data: {
          clientId: analysis.clientId,
          overallAlignment: analysis.overallAlignment,
          goals: analysis.goals.map(goal => ({
            id: goal.id,
            type: goal.type,
            amount: goal.amount,
            targetDate: goal.targetDate,
            gap: goal.gap,
            feasible: goal.feasible,
            alignmentPercentage: goal.feasible ? 100 : Math.max(0, 100 - (Math.abs(goal.gap) / goal.amount) * 100)
          })),
          summary: {
            totalGoals: analysis.goals.length,
            feasibleGoals: analysis.goals.filter(g => g.feasible).length,
            totalGapAmount: analysis.goals.reduce((sum, goal) => sum + Math.max(0, goal.gap), 0),
            averageAlignment: analysis.overallAlignment
          }
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

  // Endpoint para obter estatísticas gerais de sugestões
  app.get('/suggestions/stats', {
    preHandler: [app.authenticate, app.requireAuth]
  }, async (request, reply) => {
    try {
      // Buscar todos os clientes para estatísticas gerais
      const clients = await app.prisma.client.findMany({
        select: { id: true }
      })

      let totalSuggestions = 0
      let totalHighPriority = 0
      let totalClients = clients.length
      let clientsWithGoals = 0

      // Processar uma amostra de clientes para estatísticas
      const sampleSize = Math.min(10, clients.length)
      for (let i = 0; i < sampleSize; i++) {
        try {
          const analysis = await suggestionService.generateSuggestions(clients[i].id)
          totalSuggestions += analysis.suggestions.length
          totalHighPriority += analysis.suggestions.filter(s => s.priority === 'high').length
          if (analysis.goals.length > 0) clientsWithGoals++
        } catch (error) {
          // Ignorar erros de clientes individuais
          continue
        }
      }

      reply.send({
        success: true,
        data: {
          totalClients,
          clientsWithGoals,
          averageSuggestionsPerClient: sampleSize > 0 ? Math.round(totalSuggestions / sampleSize) : 0,
          averageHighPriorityPerClient: sampleSize > 0 ? Math.round(totalHighPriority / sampleSize) : 0,
          sampleSize
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}
