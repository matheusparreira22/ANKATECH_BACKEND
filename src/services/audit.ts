import { PrismaClient, AuditAction } from '@prisma/client'

export interface CreateAuditLogData {
  clientId?: string
  userId?: string
  action: AuditAction
  resource: string
  resourceId?: string
  oldValues?: any
  newValues?: any
  ipAddress?: string
  userAgent?: string
  metadata?: any
}

export interface AuditFilters {
  clientId?: string
  userId?: string
  action?: AuditAction
  resource?: string
  dateRange?: {
    from: Date
    to: Date
  }
}

export interface AuditStats {
  totalActions: number
  actionsByType: Record<AuditAction, number>
  resourcesByType: Record<string, number>
  recentActivity: number
  topUsers: Array<{
    userId: string
    count: number
  }>
}

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create audit log entry
   */
  async createAuditLog(data: CreateAuditLogData) {
    return await this.prisma.auditLog.create({
      data: {
        clientId: data.clientId,
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        oldValues: data.oldValues,
        newValues: data.newValues,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata
      }
    })
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(
    filters: AuditFilters = {},
    page = 1,
    limit = 50
  ) {
    const where: any = {
      ...filters.clientId && { clientId: filters.clientId },
      ...filters.userId && { userId: filters.userId },
      ...filters.action && { action: filters.action },
      ...filters.resource && { resource: filters.resource },
      ...filters.dateRange && {
        createdAt: {
          gte: filters.dateRange.from,
          lte: filters.dateRange.to
        }
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
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
      this.prisma.auditLog.count({ where })
    ])

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(filters: AuditFilters = {}): Promise<AuditStats> {
    const where: any = {
      ...filters.clientId && { clientId: filters.clientId },
      ...filters.userId && { userId: filters.userId },
      ...filters.dateRange && {
        createdAt: {
          gte: filters.dateRange.from,
          lte: filters.dateRange.to
        }
      }
    }

    const [total, actionGroups, resourceGroups, recent, userGroups] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true }
      }),
      this.prisma.auditLog.groupBy({
        by: ['resource'],
        where,
        _count: { resource: true }
      }),
      this.prisma.auditLog.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          ...where,
          userId: { not: null }
        },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10
      })
    ])

    const actionsByType = Object.values(AuditAction).reduce((acc, action) => {
      acc[action] = actionGroups.find(item => item.action === action)?._count.action || 0
      return acc
    }, {} as Record<AuditAction, number>)

    const resourcesByType = resourceGroups.reduce((acc, item) => {
      acc[item.resource] = item._count.resource
      return acc
    }, {} as Record<string, number>)

    const topUsers = userGroups
      .filter(item => item.userId)
      .map(item => ({
        userId: item.userId!,
        count: item._count.userId
      }))

    return {
      totalActions: total,
      actionsByType,
      resourcesByType,
      recentActivity: recent,
      topUsers
    }
  }

  /**
   * Get client activity timeline
   */
  async getClientTimeline(clientId: string, days = 30) {
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    return await this.prisma.auditLog.findMany({
      where: {
        clientId,
        createdAt: { gte: fromDate }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  }

  /**
   * Track user login
   */
  async trackLogin(userId: string, ipAddress?: string, userAgent?: string) {
    return await this.createAuditLog({
      userId,
      action: AuditAction.LOGIN,
      resource: 'auth',
      ipAddress,
      userAgent,
      metadata: {
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Track user logout
   */
  async trackLogout(userId: string, ipAddress?: string, userAgent?: string) {
    return await this.createAuditLog({
      userId,
      action: AuditAction.LOGOUT,
      resource: 'auth',
      ipAddress,
      userAgent,
      metadata: {
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Track resource creation
   */
  async trackCreate(
    resource: string,
    resourceId: string,
    newValues: any,
    userId?: string,
    clientId?: string,
    metadata?: any
  ) {
    return await this.createAuditLog({
      clientId,
      userId,
      action: AuditAction.CREATE,
      resource,
      resourceId,
      newValues,
      metadata
    })
  }

  /**
   * Track resource update
   */
  async trackUpdate(
    resource: string,
    resourceId: string,
    oldValues: any,
    newValues: any,
    userId?: string,
    clientId?: string,
    metadata?: any
  ) {
    return await this.createAuditLog({
      clientId,
      userId,
      action: AuditAction.UPDATE,
      resource,
      resourceId,
      oldValues,
      newValues,
      metadata
    })
  }

  /**
   * Track resource deletion
   */
  async trackDelete(
    resource: string,
    resourceId: string,
    oldValues: any,
    userId?: string,
    clientId?: string,
    metadata?: any
  ) {
    return await this.createAuditLog({
      clientId,
      userId,
      action: AuditAction.DELETE,
      resource,
      resourceId,
      oldValues,
      metadata
    })
  }

  /**
   * Track data export
   */
  async trackExport(
    resource: string,
    userId?: string,
    clientId?: string,
    metadata?: any
  ) {
    return await this.createAuditLog({
      clientId,
      userId,
      action: AuditAction.EXPORT,
      resource,
      metadata: {
        ...metadata,
        exportedAt: new Date().toISOString()
      }
    })
  }

  /**
   * Track data import
   */
  async trackImport(
    resource: string,
    userId?: string,
    clientId?: string,
    metadata?: any
  ) {
    return await this.createAuditLog({
      clientId,
      userId,
      action: AuditAction.IMPORT,
      resource,
      metadata: {
        ...metadata,
        importedAt: new Date().toISOString()
      }
    })
  }

  /**
   * Clean old audit logs (for data retention)
   */
  async cleanOldLogs(retentionDays = 365) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    })

    return {
      deletedCount: result.count,
      cutoffDate
    }
  }
}
