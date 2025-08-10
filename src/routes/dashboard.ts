import type { FastifyInstance } from 'fastify'
import { DashboardService } from '../services/dashboard'
import { validateParams, validateQuery } from '../libs/validation'
import { idParamSchema } from '../schemas'
import { z } from 'zod'

const reportQuerySchema = z.object({
  period: z.enum(['monthly', 'quarterly', 'yearly']).optional().default('monthly')
})

const trendsQuerySchema = z.object({
  days: z.coerce.number().min(7).max(365).optional().default(30)
})

export default async function dashboardRoutes(app: FastifyInstance) {
  const dashboardService = new DashboardService(app.prisma)

  // Get dashboard metrics (advisor only)
  app.get('/dashboard/metrics', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const metrics = await dashboardService.getDashboardMetrics()

      reply.send({
        success: true,
        data: metrics
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get client analytics
  app.get('/dashboard/client/:id/analytics', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const user = request.user as any

      // Check authorization
      if (user.role !== 'advisor' && user.id !== id) {
        return reply.code(403).send({ error: 'Acesso negado' })
      }

      const analytics = await dashboardService.getClientAnalytics(id)

      reply.send({
        success: true,
        data: analytics
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Cliente não encontrado') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Generate financial report (advisor only)
  app.get('/dashboard/reports/financial', {
    preHandler: [app.authenticate, app.requireAdvisor, validateQuery(reportQuerySchema)]
  }, async (request, reply) => {
    try {
      const { period } = request.query as any

      const report = await dashboardService.generateFinancialReport(period)

      reply.send({
        success: true,
        data: report
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get system health (advisor only)
  app.get('/dashboard/health', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const health = await dashboardService.getSystemHealth()

      reply.send({
        success: true,
        data: health
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get performance trends (advisor only)
  app.get('/dashboard/trends', {
    preHandler: [app.authenticate, app.requireAdvisor, validateQuery(trendsQuerySchema)]
  }, async (request, reply) => {
    try {
      const { days } = request.query as any

      const trends = await dashboardService.getPerformanceTrends(days)

      reply.send({
        success: true,
        data: trends
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Export dashboard data (advisor only)
  app.get('/dashboard/export', {
    preHandler: [app.authenticate, app.requireAdvisor, validateQuery(reportQuerySchema)]
  }, async (request, reply) => {
    try {
      const { period } = request.query as any

      const [metrics, report] = await Promise.all([
        dashboardService.getDashboardMetrics(),
        dashboardService.generateFinancialReport(period)
      ])

      const exportData = {
        generatedAt: new Date().toISOString(),
        period,
        metrics,
        report,
        summary: {
          totalClients: metrics.clients.total,
          totalAssets: report.totalAssets,
          projectedGrowth: report.growth,
          activeInsurances: metrics.insurances.active
        }
      }

      reply
        .header('Content-Type', 'application/json')
        .header('Content-Disposition', `attachment; filename="dashboard_export_${new Date().toISOString().split('T')[0]}.json"`)
        .send(exportData)
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get real-time statistics (advisor only)
  app.get('/dashboard/realtime', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const now = new Date()
      const last5min = new Date(now.getTime() - 5 * 60 * 1000)
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000)

      const [
        activeUsers,
        recentActions,
        recentLogins,
        systemLoad,
        memoryUsage
      ] = await Promise.all([
        app.prisma.auditLog.count({
          where: {
            createdAt: { gte: last5min }
          }
        }),
        app.prisma.auditLog.count({
          where: {
            createdAt: { gte: lastHour }
          }
        }),
        app.prisma.auditLog.count({
          where: {
            action: 'LOGIN',
            createdAt: { gte: lastHour }
          }
        }),
        // Simulated metrics
        Promise.resolve(Math.random() * 100),
        Promise.resolve(process.memoryUsage())
      ])

      reply.send({
        success: true,
        data: {
          timestamp: now,
          activeUsers,
          recentActions,
          recentLogins,
          systemLoad: Math.round(systemLoad),
          memoryUsage: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) // MB
          },
          uptime: process.uptime()
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get client comparison (advisor only)
  app.get('/dashboard/clients/comparison', {
    preHandler: [app.authenticate, app.requireAdvisor, validateQuery(z.object({
      clientIds: z.string().transform(str => str.split(',')).optional(),
      metric: z.enum(['assets', 'growth', 'risk', 'engagement']).optional().default('assets')
    }))]
  }, async (request, reply) => {
    try {
      const { clientIds, metric } = request.query as any

      let clients
      if (clientIds && clientIds.length > 0) {
        clients = await app.prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true }
        })
      } else {
        clients = await app.prisma.client.findMany({
          take: 10,
          select: { id: true, name: true }
        })
      }

      const comparisons = await Promise.all(
        clients.map(async (client) => {
          const analytics = await dashboardService.getClientAnalytics(client.id)
          return {
            clientId: client.id,
            name: client.name,
            value: analytics[metric === 'assets' ? 'totalAssets' : 
                           metric === 'growth' ? 'projectedGrowth' :
                           metric === 'risk' ? 'riskScore' : 'engagementScore']
          }
        })
      )

      reply.send({
        success: true,
        data: {
          metric,
          comparisons: comparisons.sort((a, b) => b.value - a.value)
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get alerts and warnings (advisor only)
  app.get('/dashboard/alerts', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const now = new Date()
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      const [
        expiringInsurances,
        approachingGoals,
        inactiveClients,
        systemErrors
      ] = await Promise.all([
        app.prisma.insurance.count({
          where: {
            status: 'ACTIVE',
            endDate: { gte: now, lte: next30Days }
          }
        }),
        app.prisma.goal.count({
          where: {
            targetAt: { gte: now, lte: next30Days }
          }
        }),
        app.prisma.client.count({
          where: {
            updatedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            status: 'active'
          }
        }),
        app.prisma.auditLog.count({
          where: {
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            metadata: {
              path: ['error'],
              not: undefined
            }
          }
        })
      ])

      const alerts = []

      if (expiringInsurances > 0) {
        alerts.push({
          type: 'warning',
          title: 'Seguros Vencendo',
          message: `${expiringInsurances} seguros vencem nos próximos 30 dias`,
          count: expiringInsurances
        })
      }

      if (approachingGoals > 0) {
        alerts.push({
          type: 'info',
          title: 'Metas Próximas',
          message: `${approachingGoals} metas têm prazo nos próximos 30 dias`,
          count: approachingGoals
        })
      }

      if (inactiveClients > 0) {
        alerts.push({
          type: 'warning',
          title: 'Clientes Inativos',
          message: `${inactiveClients} clientes sem atividade há mais de 30 dias`,
          count: inactiveClients
        })
      }

      if (systemErrors > 0) {
        alerts.push({
          type: 'error',
          title: 'Erros do Sistema',
          message: `${systemErrors} erros registrados nas últimas 24 horas`,
          count: systemErrors
        })
      }

      reply.send({
        success: true,
        data: alerts
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}
