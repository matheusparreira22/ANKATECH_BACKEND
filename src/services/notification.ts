import { PrismaClient, NotificationType, NotificationStatus } from '@prisma/client'

export interface CreateNotificationData {
  clientId: string
  type: NotificationType
  title: string
  message: string
  metadata?: any
  scheduledAt?: Date
}

export interface NotificationFilters {
  clientId?: string
  type?: NotificationType
  status?: NotificationStatus
  scheduledAt?: {
    from?: Date
    to?: Date
  }
}

export interface NotificationStats {
  total: number
  unread: number
  byType: Record<NotificationType, number>
  recentCount: number
}

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData) {
    return await this.prisma.notification.create({
      data: {
        clientId: data.clientId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata,
        scheduledAt: data.scheduledAt
      },
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
  }

  /**
   * Get notifications for a client
   */
  async getClientNotifications(
    clientId: string,
    filters: NotificationFilters = {},
    page = 1,
    limit = 20
  ) {
    const where: any = {
      clientId,
      ...filters.type && { type: filters.type },
      ...filters.status && { status: filters.status },
      ...filters.scheduledAt && {
        scheduledAt: {
          ...filters.scheduledAt.from && { gte: filters.scheduledAt.from },
          ...filters.scheduledAt.to && { lte: filters.scheduledAt.to }
        }
      }
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      this.prisma.notification.count({ where })
    ])

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, clientId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, clientId }
    })

    if (!notification) {
      throw new Error('Notificação não encontrada')
    }

    return await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date()
      }
    })
  }

  /**
   * Mark all notifications as read for a client
   */
  async markAllAsRead(clientId: string) {
    return await this.prisma.notification.updateMany({
      where: {
        clientId,
        status: NotificationStatus.UNREAD
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date()
      }
    })
  }

  /**
   * Archive notification
   */
  async archiveNotification(notificationId: string, clientId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, clientId }
    })

    if (!notification) {
      throw new Error('Notificação não encontrada')
    }

    return await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.ARCHIVED }
    })
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, clientId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, clientId }
    })

    if (!notification) {
      throw new Error('Notificação não encontrada')
    }

    return await this.prisma.notification.delete({
      where: { id: notificationId }
    })
  }

  /**
   * Get notification statistics for a client
   */
  async getClientStats(clientId: string): Promise<NotificationStats> {
    const [total, unread, byType, recent] = await Promise.all([
      this.prisma.notification.count({
        where: { clientId }
      }),
      this.prisma.notification.count({
        where: { clientId, status: NotificationStatus.UNREAD }
      }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: { clientId },
        _count: { type: true }
      }),
      this.prisma.notification.count({
        where: {
          clientId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    ])

    const typeStats = Object.values(NotificationType).reduce((acc, type) => {
      acc[type] = byType.find(item => item.type === type)?._count.type || 0
      return acc
    }, {} as Record<NotificationType, number>)

    return {
      total,
      unread,
      byType: typeStats,
      recentCount: recent
    }
  }

  /**
   * Create insurance expiration alerts
   */
  async createInsuranceExpirationAlerts() {
    const expiringInsurances = await this.prisma.insurance.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
        }
      },
      include: {
        client: true
      }
    })

    const notifications = []

    for (const insurance of expiringInsurances) {
      const daysUntilExpiry = Math.ceil(
        (insurance.endDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      )

      // Check if notification already exists
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          clientId: insurance.clientId,
          type: NotificationType.INSURANCE_EXPIRING,
          metadata: {
            path: ['insuranceId'],
            equals: insurance.id
          }
        }
      })

      if (!existingNotification) {
        const notification = await this.createNotification({
          clientId: insurance.clientId,
          type: NotificationType.INSURANCE_EXPIRING,
          title: 'Seguro Vencendo',
          message: `Seu seguro ${insurance.type} vence em ${daysUntilExpiry} dias`,
          metadata: {
            insuranceId: insurance.id,
            daysUntilExpiry,
            provider: insurance.provider
          }
        })

        notifications.push(notification)
      }
    }

    return notifications
  }

  /**
   * Create goal deadline alerts
   */
  async createGoalDeadlineAlerts() {
    const approachingGoals = await this.prisma.goal.findMany({
      where: {
        targetAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // Next 60 days
        }
      },
      include: {
        client: true
      }
    })

    const notifications = []

    for (const goal of approachingGoals) {
      const daysUntilDeadline = Math.ceil(
        (goal.targetAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      )

      // Check if notification already exists
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          clientId: goal.clientId,
          type: NotificationType.GOAL_DEADLINE,
          metadata: {
            path: ['goalId'],
            equals: goal.id
          }
        }
      })

      if (!existingNotification) {
        const notification = await this.createNotification({
          clientId: goal.clientId,
          type: NotificationType.GOAL_DEADLINE,
          title: 'Meta Próxima do Prazo',
          message: `Sua meta "${goal.type}" tem prazo em ${daysUntilDeadline} dias`,
          metadata: {
            goalId: goal.id,
            daysUntilDeadline,
            amount: goal.amount.toString()
          }
        })

        notifications.push(notification)
      }
    }

    return notifications
  }

  /**
   * Get scheduled notifications that should be sent now
   */
  async getScheduledNotifications() {
    return await this.prisma.notification.findMany({
      where: {
        scheduledAt: {
          lte: new Date()
        },
        status: NotificationStatus.UNREAD
      },
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
  }

  /**
   * Process scheduled notifications (to be called by cron job)
   */
  async processScheduledNotifications() {
    const notifications = await this.getScheduledNotifications()
    
    // Here you would integrate with push notification service, email, etc.
    // For now, we'll just log them
    console.log(`Processing ${notifications.length} scheduled notifications`)
    
    return notifications
  }
}
