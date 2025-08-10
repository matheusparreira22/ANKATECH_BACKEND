import type { FastifyInstance } from 'fastify'
import { AuditService } from '../services/audit'
import { validateParams, validateQuery } from '../libs/validation'
import { idParamSchema } from '../schemas'
import { z } from 'zod'

const auditQuerySchema = z.object({
  clientId: z.string().optional(),
  userId: z.string().optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT']).optional(),
  resource: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50)
})

const auditStatsQuerySchema = z.object({
  clientId: z.string().optional(),
  userId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional()
})

export default async function auditRoutes(app: FastifyInstance) {
  const auditService = new AuditService(app.prisma)

  // Get audit logs (advisor only)
  app.get('/audit/logs', {
    preHandler: [app.authenticate, app.requireAdvisor, validateQuery(auditQuerySchema)]
  }, async (request, reply) => {
    try {
      const { clientId, userId, action, resource, fromDate, toDate, page, limit } = request.query as any

      const filters: any = {
        clientId,
        userId,
        action,
        resource
      }

      if (fromDate && toDate) {
        filters.dateRange = {
          from: new Date(fromDate),
          to: new Date(toDate)
        }
      }

      const result = await auditService.getAuditLogs(filters, page, limit)

      reply.send({
        success: true,
        data: result
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get audit statistics (advisor only)
  app.get('/audit/stats', {
    preHandler: [app.authenticate, app.requireAdvisor, validateQuery(auditStatsQuerySchema)]
  }, async (request, reply) => {
    try {
      const { clientId, userId, fromDate, toDate } = request.query as any

      const filters: any = {
        clientId,
        userId
      }

      if (fromDate && toDate) {
        filters.dateRange = {
          from: new Date(fromDate),
          to: new Date(toDate)
        }
      }

      const stats = await auditService.getAuditStats(filters)

      reply.send({
        success: true,
        data: stats
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get client activity timeline
  app.get('/audit/client/:id/timeline', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema), validateQuery(z.object({
      days: z.coerce.number().min(1).max(365).optional().default(30)
    }))]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { days } = request.query as any
      const user = request.user as any

      // Check authorization
      if (user.role !== 'advisor' && user.id !== id) {
        return reply.code(403).send({ error: 'Acesso negado' })
      }

      const timeline = await auditService.getClientTimeline(id, days)

      reply.send({
        success: true,
        data: timeline
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Clean old audit logs (advisor only)
  app.post('/audit/cleanup', {
    preHandler: [app.authenticate, app.requireAdvisor, validateQuery(z.object({
      retentionDays: z.coerce.number().min(30).max(3650).optional().default(365)
    }))]
  }, async (request, reply) => {
    try {
      const { retentionDays } = request.query as any

      const result = await auditService.cleanOldLogs(retentionDays)

      reply.send({
        success: true,
        data: result
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Export audit logs (advisor only)
  app.get('/audit/export', {
    preHandler: [app.authenticate, app.requireAdvisor, validateQuery(auditQuerySchema)]
  }, async (request, reply) => {
    try {
      const { clientId, userId, action, resource, fromDate, toDate } = request.query as any
      const user = request.user as any

      const filters: any = {
        clientId,
        userId,
        action,
        resource
      }

      if (fromDate && toDate) {
        filters.dateRange = {
          from: new Date(fromDate),
          to: new Date(toDate)
        }
      }

      // Get all logs without pagination for export
      const result = await auditService.getAuditLogs(filters, 1, 10000)

      // Track the export action
      await auditService.trackExport(
        'audit_logs',
        user.id,
        undefined,
        {
          filters,
          exportedCount: result.logs.length
        }
      )

      // Convert to CSV format
      const csvHeaders = [
        'ID',
        'Client ID',
        'User ID',
        'Action',
        'Resource',
        'Resource ID',
        'IP Address',
        'User Agent',
        'Created At'
      ].join(',')

      const csvRows = result.logs.map(log => [
        log.id,
        log.clientId || '',
        log.userId || '',
        log.action,
        log.resource,
        log.resourceId || '',
        log.ipAddress || '',
        log.userAgent || '',
        log.createdAt.toISOString()
      ].join(','))

      const csvContent = [csvHeaders, ...csvRows].join('\n')

      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`)
        .send(csvContent)
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get audit summary for dashboard (advisor only)
  app.get('/audit/summary', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const now = new Date()
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const [stats24h, stats7d, stats30d, totalStats] = await Promise.all([
        auditService.getAuditStats({
          dateRange: { from: last24h, to: now }
        }),
        auditService.getAuditStats({
          dateRange: { from: last7d, to: now }
        }),
        auditService.getAuditStats({
          dateRange: { from: last30d, to: now }
        }),
        auditService.getAuditStats()
      ])

      reply.send({
        success: true,
        data: {
          last24h: stats24h,
          last7d: stats7d,
          last30d: stats30d,
          total: totalStats
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get security events (advisor only)
  app.get('/audit/security', {
    preHandler: [app.authenticate, app.requireAdvisor, validateQuery(z.object({
      page: z.coerce.number().min(1).optional().default(1),
      limit: z.coerce.number().min(1).max(100).optional().default(50)
    }))]
  }, async (request, reply) => {
    try {
      const { page, limit } = request.query as any

      // Get login/logout events
      const result = await auditService.getAuditLogs({
        action: 'LOGIN' as any // Will need to handle multiple actions
      }, page, limit)

      reply.send({
        success: true,
        data: result
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}
