import { PrismaClient } from '@prisma/client'

export interface DashboardMetrics {
  clients: {
    total: number
    active: number
    new: number
    growth: number
  }
  projections: {
    total: number
    avgValue: number
    totalValue: number
    recent: number
  }
  insurances: {
    total: number
    active: number
    expiring: number
    totalCoverage: number
  }
  goals: {
    total: number
    achieved: number
    pending: number
    avgAmount: number
  }
  notifications: {
    total: number
    unread: number
    recent: number
  }
  activity: {
    logins: number
    actions: number
    exports: number
    imports: number
  }
}

export interface ClientAnalytics {
  clientId: string
  totalAssets: number
  projectedGrowth: number
  riskScore: number
  goalProgress: number
  insuranceCoverage: number
  lastActivity: Date
  engagementScore: number
}

export interface FinancialReport {
  period: string
  totalAssets: number
  projectedValue: number
  growth: number
  riskDistribution: Record<string, number>
  topPerformers: Array<{
    clientId: string
    name: string
    value: number
    growth: number
  }>
  insights: string[]
}

export class DashboardService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const now = new Date()
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Client metrics
    const [totalClients, activeClients, newClients, previousMonthClients] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.client.count({
        where: { status: 'active' }
      }),
      this.prisma.client.count({
        where: { createdAt: { gte: last30Days } }
      }),
      this.prisma.client.count({
        where: { createdAt: { lt: last30Days } }
      })
    ])

    const clientGrowth = previousMonthClients > 0 
      ? ((newClients / previousMonthClients) * 100) 
      : 0

    // Projection metrics
    const simulations = await this.prisma.simulation.findMany({
      select: {
        payload: true,
        createdAt: true
      }
    })

    const recentSimulations = simulations.filter(s => s.createdAt >= last7Days).length
    const projectionValues = simulations.map(s => {
      const payload = s.payload as any
      return payload?.finalValue || 0
    }).filter(v => v > 0)

    const totalProjectionValue = projectionValues.reduce((sum, val) => sum + val, 0)
    const avgProjectionValue = projectionValues.length > 0 
      ? totalProjectionValue / projectionValues.length 
      : 0

    // Insurance metrics
    const [totalInsurances, activeInsurances, expiringInsurances] = await Promise.all([
      this.prisma.insurance.count(),
      this.prisma.insurance.count({
        where: { status: 'ACTIVE' }
      }),
      this.prisma.insurance.count({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: now,
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ])

    const insuranceCoverages = await this.prisma.insurance.findMany({
      where: { status: 'ACTIVE' },
      select: { coverage: true }
    })

    const totalCoverage = insuranceCoverages.reduce(
      (sum, ins) => sum + Number(ins.coverage), 
      0
    )

    // Goal metrics
    const [totalGoals, achievedGoals] = await Promise.all([
      this.prisma.goal.count(),
      this.prisma.goal.count({
        where: { targetAt: { lt: now } }
      })
    ])

    const goalAmounts = await this.prisma.goal.findMany({
      select: { amount: true }
    })

    const avgGoalAmount = goalAmounts.length > 0
      ? goalAmounts.reduce((sum, goal) => sum + Number(goal.amount), 0) / goalAmounts.length
      : 0

    // Notification metrics
    const [totalNotifications, unreadNotifications, recentNotifications] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({
        where: { status: 'UNREAD' }
      }),
      this.prisma.notification.count({
        where: { createdAt: { gte: last7Days } }
      })
    ])

    // Activity metrics
    const [logins, totalActions, exports, imports] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          action: 'LOGIN',
          createdAt: { gte: last30Days }
        }
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: last30Days } }
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'EXPORT',
          createdAt: { gte: last30Days }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'IMPORT',
          createdAt: { gte: last30Days }
        }
      })
    ])

    return {
      clients: {
        total: totalClients,
        active: activeClients,
        new: newClients,
        growth: clientGrowth
      },
      projections: {
        total: simulations.length,
        avgValue: avgProjectionValue,
        totalValue: totalProjectionValue,
        recent: recentSimulations
      },
      insurances: {
        total: totalInsurances,
        active: activeInsurances,
        expiring: expiringInsurances,
        totalCoverage
      },
      goals: {
        total: totalGoals,
        achieved: achievedGoals,
        pending: totalGoals - achievedGoals,
        avgAmount: avgGoalAmount
      },
      notifications: {
        total: totalNotifications,
        unread: unreadNotifications,
        recent: recentNotifications
      },
      activity: {
        logins,
        actions: totalActions,
        exports,
        imports
      }
    }
  }

  /**
   * Get client analytics
   */
  async getClientAnalytics(clientId: string): Promise<ClientAnalytics> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        simulations: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        goals: true,
        insurances: {
          where: { status: 'ACTIVE' }
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!client) {
      throw new Error('Cliente não encontrado')
    }

    // Calculate total assets from latest simulation
    const latestSimulation = client.simulations[0]
    const totalAssets = latestSimulation 
      ? (latestSimulation.payload as any)?.currentValue || 0 
      : 0

    // Calculate projected growth
    const projectedValue = latestSimulation 
      ? (latestSimulation.payload as any)?.finalValue || 0 
      : 0
    const projectedGrowth = totalAssets > 0 
      ? ((projectedValue - totalAssets) / totalAssets) * 100 
      : 0

    // Calculate risk score (simplified)
    const riskScore = Math.min(100, Math.max(0, 
      (client.age || 30) + (projectedGrowth > 10 ? 20 : 0) + 
      (client.insurances.length < 2 ? 30 : 0)
    ))

    // Calculate goal progress
    const totalGoals = client.goals.length
    const achievedGoals = client.goals.filter(g => g.targetAt < new Date()).length
    const goalProgress = totalGoals > 0 ? (achievedGoals / totalGoals) * 100 : 0

    // Calculate insurance coverage
    const insuranceCoverage = client.insurances.reduce(
      (sum, ins) => sum + Number(ins.coverage), 
      0
    )

    // Get last activity
    const lastActivity = client.auditLogs[0]?.createdAt || client.updatedAt

    // Calculate engagement score (simplified)
    const daysSinceLastActivity = Math.floor(
      (Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000)
    )
    const engagementScore = Math.max(0, 100 - daysSinceLastActivity * 2)

    return {
      clientId,
      totalAssets,
      projectedGrowth,
      riskScore,
      goalProgress,
      insuranceCoverage,
      lastActivity,
      engagementScore
    }
  }

  /**
   * Generate financial report
   */
  async generateFinancialReport(period: 'monthly' | 'quarterly' | 'yearly'): Promise<FinancialReport> {
    const now = new Date()
    let fromDate: Date

    switch (period) {
      case 'monthly':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3)
        fromDate = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'yearly':
        fromDate = new Date(now.getFullYear(), 0, 1)
        break
    }

    // Get simulations in period
    const simulations = await this.prisma.simulation.findMany({
      where: {
        createdAt: { gte: fromDate }
      },
      include: {
        client: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const totalAssets = simulations.reduce((sum, sim) => {
      const payload = sim.payload as any
      return sum + (payload?.currentValue || 0)
    }, 0)

    const projectedValue = simulations.reduce((sum, sim) => {
      const payload = sim.payload as any
      return sum + (payload?.finalValue || 0)
    }, 0)

    const growth = totalAssets > 0 ? ((projectedValue - totalAssets) / totalAssets) * 100 : 0

    // Risk distribution (simplified)
    const riskDistribution = {
      'Baixo': 0,
      'Médio': 0,
      'Alto': 0
    }

    // Top performers
    const clientPerformance = new Map<string, { name: string; value: number; growth: number }>()

    simulations.forEach(sim => {
      const payload = sim.payload as any
      const currentValue = payload?.currentValue || 0
      const finalValue = payload?.finalValue || 0
      const clientGrowth = currentValue > 0 ? ((finalValue - currentValue) / currentValue) * 100 : 0

      if (!clientPerformance.has(sim.client.id)) {
        clientPerformance.set(sim.client.id, {
          name: sim.client.name,
          value: currentValue,
          growth: clientGrowth
        })
      } else {
        const existing = clientPerformance.get(sim.client.id)!
        existing.value = Math.max(existing.value, currentValue)
        existing.growth = Math.max(existing.growth, clientGrowth)
      }

      // Update risk distribution
      if (clientGrowth < 5) riskDistribution['Baixo']++
      else if (clientGrowth < 15) riskDistribution['Médio']++
      else riskDistribution['Alto']++
    })

    const topPerformers = Array.from(clientPerformance.entries())
      .map(([clientId, data]) => ({ clientId, ...data }))
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 10)

    // Generate insights
    const insights = []
    if (growth > 10) {
      insights.push('Crescimento acima da média do mercado')
    }
    if (topPerformers.length > 0 && topPerformers[0].growth > 20) {
      insights.push(`Cliente ${topPerformers[0].name} apresenta excelente performance`)
    }
    if (riskDistribution['Alto'] > riskDistribution['Baixo']) {
      insights.push('Portfólio com perfil de risco elevado')
    }

    return {
      period: `${period} - ${fromDate.toLocaleDateString()} a ${now.toLocaleDateString()}`,
      totalAssets,
      projectedValue,
      growth,
      riskDistribution,
      topPerformers,
      insights
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth() {
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsers,
      errorLogs,
      avgResponseTime,
      systemLoad
    ] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.auditLog.count({
        where: {
          action: 'LOGIN',
          createdAt: { gte: last24h }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          createdAt: { gte: last24h },
          metadata: {
            path: ['error'],
            not: undefined
          }
        }
      }),
      // Simulated response time
      Promise.resolve(Math.random() * 100 + 50),
      // Simulated system load
      Promise.resolve(Math.random() * 100)
    ])

    return {
      status: errorLogs < 10 && avgResponseTime < 200 ? 'healthy' : 'warning',
      totalUsers,
      activeUsers,
      errorLogs,
      avgResponseTime: Math.round(avgResponseTime),
      systemLoad: Math.round(systemLoad),
      uptime: process.uptime(),
      timestamp: now
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(days = 30) {
    const now = new Date()
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // Get daily metrics
    const dailyMetrics = []
    for (let i = 0; i < days; i++) {
      const date = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000)
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000)

      const [logins, simulations, notifications] = await Promise.all([
        this.prisma.auditLog.count({
          where: {
            action: 'LOGIN',
            createdAt: { gte: date, lt: nextDate }
          }
        }),
        this.prisma.simulation.count({
          where: {
            createdAt: { gte: date, lt: nextDate }
          }
        }),
        this.prisma.notification.count({
          where: {
            createdAt: { gte: date, lt: nextDate }
          }
        })
      ])

      dailyMetrics.push({
        date: date.toISOString().split('T')[0],
        logins,
        simulations,
        notifications
      })
    }

    return dailyMetrics
  }
}
