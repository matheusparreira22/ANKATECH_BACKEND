import type { FastifyInstance } from 'fastify'
import { NotificationService } from '../services/notification'
import { validateParams, validateQuery, validateBody } from '../libs/validation'
import { idParamSchema } from '../schemas'
import { z } from 'zod'

const notificationQuerySchema = z.object({
  type: z.enum(['INSURANCE_EXPIRING', 'GOAL_DEADLINE', 'PROJECTION_UPDATE', 'SYSTEM_ALERT', 'REMINDER', 'ACHIEVEMENT']).optional(),
  status: z.enum(['UNREAD', 'READ', 'ARCHIVED']).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20)
})

const createNotificationSchema = z.object({
  clientId: z.string(),
  type: z.enum(['INSURANCE_EXPIRING', 'GOAL_DEADLINE', 'PROJECTION_UPDATE', 'SYSTEM_ALERT', 'REMINDER', 'ACHIEVEMENT']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  metadata: z.any().optional(),
  scheduledAt: z.string().datetime().optional()
})

export default async function notificationRoutes(app: FastifyInstance) {
  const notificationService = new NotificationService(app.prisma)

  // Get client notifications
  app.get('/notifications/client/:id', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema), validateQuery(notificationQuerySchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { type, status, page, limit } = request.query as any
      const user = request.user as any

      // Check authorization
      if (user.role !== 'advisor' && user.id !== id) {
        return reply.code(403).send({ error: 'Acesso negado' })
      }

      const result = await notificationService.getClientNotifications(
        id,
        { type, status },
        page,
        limit
      )

      reply.send({
        success: true,
        data: result
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get notification statistics
  app.get('/notifications/client/:id/stats', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const user = request.user as any

      // Check authorization
      if (user.role !== 'advisor' && user.id !== id) {
        return reply.code(403).send({ error: 'Acesso negado' })
      }

      const stats = await notificationService.getClientStats(id)

      reply.send({
        success: true,
        data: stats
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Create notification (advisor only)
  app.post('/notifications', {
    preHandler: [app.authenticate, app.requireAdvisor, validateBody(createNotificationSchema)]
  }, async (request, reply) => {
    try {
      const data = request.body as any

      const notification = await notificationService.createNotification({
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined
      })

      reply.code(201).send({
        success: true,
        data: notification
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Mark notification as read
  app.put('/notifications/:id/read', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const user = request.user as any

      // For viewers, we need to check if the notification belongs to them
      let clientId = user.id
      if (user.role === 'advisor') {
        // Advisors can mark any notification as read
        const notification = await app.prisma.notification.findUnique({
          where: { id }
        })
        if (!notification) {
          return reply.code(404).send({ error: 'Notificação não encontrada' })
        }
        clientId = notification.clientId
      }

      const notification = await notificationService.markAsRead(id, clientId)

      reply.send({
        success: true,
        data: notification
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Notificação não encontrada') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Mark all notifications as read for a client
  app.put('/notifications/client/:id/read-all', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const user = request.user as any

      // Check authorization
      if (user.role !== 'advisor' && user.id !== id) {
        return reply.code(403).send({ error: 'Acesso negado' })
      }

      const result = await notificationService.markAllAsRead(id)

      reply.send({
        success: true,
        data: { updatedCount: result.count }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Archive notification
  app.put('/notifications/:id/archive', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const user = request.user as any

      // For viewers, we need to check if the notification belongs to them
      let clientId = user.id
      if (user.role === 'advisor') {
        const notification = await app.prisma.notification.findUnique({
          where: { id }
        })
        if (!notification) {
          return reply.code(404).send({ error: 'Notificação não encontrada' })
        }
        clientId = notification.clientId
      }

      const notification = await notificationService.archiveNotification(id, clientId)

      reply.send({
        success: true,
        data: notification
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Notificação não encontrada') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Delete notification
  app.delete('/notifications/:id', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const user = request.user as any

      // For viewers, we need to check if the notification belongs to them
      let clientId = user.id
      if (user.role === 'advisor') {
        const notification = await app.prisma.notification.findUnique({
          where: { id }
        })
        if (!notification) {
          return reply.code(404).send({ error: 'Notificação não encontrada' })
        }
        clientId = notification.clientId
      }

      await notificationService.deleteNotification(id, clientId)

      reply.send({
        success: true,
        message: 'Notificação deletada com sucesso'
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Notificação não encontrada') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Generate automatic alerts (advisor only)
  app.post('/notifications/alerts/generate', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const [insuranceAlerts, goalAlerts] = await Promise.all([
        notificationService.createInsuranceExpirationAlerts(),
        notificationService.createGoalDeadlineAlerts()
      ])

      reply.send({
        success: true,
        data: {
          insuranceAlerts: insuranceAlerts.length,
          goalAlerts: goalAlerts.length,
          total: insuranceAlerts.length + goalAlerts.length
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Get scheduled notifications (admin only)
  app.get('/notifications/scheduled', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const notifications = await notificationService.getScheduledNotifications()

      reply.send({
        success: true,
        data: notifications
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Process scheduled notifications (admin only)
  app.post('/notifications/scheduled/process', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const notifications = await notificationService.processScheduledNotifications()

      reply.send({
        success: true,
        data: {
          processed: notifications.length,
          notifications
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}
