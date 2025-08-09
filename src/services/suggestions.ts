import { PrismaClient } from '@prisma/client'
import { ProjectionService, WealthProjection } from './projection'

export interface Suggestion {
  id: string
  type: 'increase_contribution' | 'reduce_expenses' | 'adjust_allocation' | 'extend_timeline' | 'reduce_goal'
  title: string
  description: string
  impact: {
    monthlyAmount?: number
    totalAmount?: number
    timeframe?: number // em meses
    projectedGain?: number
  }
  priority: 'high' | 'medium' | 'low'
  category: 'contribution' | 'allocation' | 'timeline' | 'goal'
}

export interface SuggestionAnalysis {
  clientId: string
  currentProjection: WealthProjection
  goals: Array<{
    id: string
    type: string
    amount: number
    targetDate: Date
    gap: number // diferença entre meta e projeção
    feasible: boolean
  }>
  suggestions: Suggestion[]
  overallAlignment: number // percentual de alinhamento geral
}

export class SuggestionService {
  constructor(
    private prisma: PrismaClient,
    private projectionService: ProjectionService
  ) {}

  /**
   * Analisa a situação do cliente e gera sugestões personalizadas
   */
  async generateSuggestions(clientId: string): Promise<SuggestionAnalysis> {
    // Buscar dados do cliente
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        wallet: true,
        goals: true,
        events: true
      }
    })

    if (!client) {
      throw new Error('Cliente não encontrado')
    }

    // Gerar projeção atual
    const currentProjection = await this.projectionService.createClientProjection(clientId)

    // Analisar metas
    const goalAnalysis = this.analyzeGoals(client.goals, currentProjection)

    // Gerar sugestões baseadas na análise
    const suggestions = this.createSuggestions(client, goalAnalysis, currentProjection)

    // Calcular alinhamento geral
    const overallAlignment = this.calculateOverallAlignment(goalAnalysis)

    return {
      clientId,
      currentProjection,
      goals: goalAnalysis,
      suggestions,
      overallAlignment
    }
  }

  /**
   * Analisa as metas do cliente em relação à projeção atual
   */
  private analyzeGoals(goals: any[], projection: WealthProjection) {
    return goals.map(goal => {
      const targetYear = new Date(goal.targetAt).getFullYear()
      const targetMonth = new Date(goal.targetAt).getMonth() + 1
      
      // Encontrar projeção para a data da meta
      const projectionAtTarget = projection.projectionPoints.find(
        point => point.year === targetYear && point.month === targetMonth
      )

      const projectedValue = projectionAtTarget?.projectedValue || projection.finalValue
      const gap = Number(goal.amount) - projectedValue
      const feasible = gap <= 0

      return {
        id: goal.id,
        type: goal.type,
        amount: Number(goal.amount),
        targetDate: new Date(goal.targetAt),
        gap,
        feasible
      }
    })
  }

  /**
   * Cria sugestões baseadas na análise das metas
   */
  private createSuggestions(
    client: any,
    goalAnalysis: any[],
    projection: WealthProjection
  ): Suggestion[] {
    const suggestions: Suggestion[] = []

    goalAnalysis.forEach(goal => {
      if (!goal.feasible && goal.gap > 0) {
        // Meta não será atingida - gerar sugestões

        // Sugestão 1: Aumentar contribuição mensal
        const monthsUntilGoal = this.calculateMonthsUntilDate(goal.targetDate)
        if (monthsUntilGoal > 0) {
          const monthlyIncrease = Math.ceil(goal.gap / monthsUntilGoal)
          
          suggestions.push({
            id: `increase_contribution_${goal.id}`,
            type: 'increase_contribution',
            title: 'Aumentar Contribuição Mensal',
            description: `Para atingir a meta "${goal.type}", aumente sua contribuição mensal em R$ ${monthlyIncrease.toLocaleString('pt-BR')} pelos próximos ${monthsUntilGoal} meses.`,
            impact: {
              monthlyAmount: monthlyIncrease,
              timeframe: monthsUntilGoal,
              projectedGain: goal.gap
            },
            priority: goal.gap > 100000 ? 'high' : goal.gap > 50000 ? 'medium' : 'low',
            category: 'contribution'
          })
        }

        // Sugestão 2: Estender prazo da meta
        const extendedMonths = Math.ceil(goal.gap / 1000) // Estimativa simples
        const newTargetDate = new Date(goal.targetDate)
        newTargetDate.setMonth(newTargetDate.getMonth() + extendedMonths)

        suggestions.push({
          id: `extend_timeline_${goal.id}`,
          type: 'extend_timeline',
          title: 'Estender Prazo da Meta',
          description: `Considere estender o prazo da meta "${goal.type}" para ${newTargetDate.toLocaleDateString('pt-BR')} para torná-la mais viável.`,
          impact: {
            timeframe: extendedMonths,
            projectedGain: goal.gap
          },
          priority: 'medium',
          category: 'timeline'
        })

        // Sugestão 3: Reduzir valor da meta
        const reducedAmount = goal.amount - Math.abs(goal.gap)
        suggestions.push({
          id: `reduce_goal_${goal.id}`,
          type: 'reduce_goal',
          title: 'Ajustar Valor da Meta',
          description: `Considere reduzir o valor da meta "${goal.type}" para R$ ${reducedAmount.toLocaleString('pt-BR')} para torná-la mais realista.`,
          impact: {
            totalAmount: Math.abs(goal.gap)
          },
          priority: 'low',
          category: 'goal'
        })
      }
    })

    // Sugestões gerais de otimização
    if (client.wallet && client.wallet.allocation) {
      const allocation = client.wallet.allocation as Record<string, number>
      const conservativeAllocation = Object.values(allocation).some(value => value > 60)

      if (conservativeAllocation) {
        suggestions.push({
          id: 'optimize_allocation',
          type: 'adjust_allocation',
          title: 'Otimizar Alocação de Ativos',
          description: 'Sua carteira parece conservadora. Considere aumentar a exposição a ativos de maior rentabilidade para acelerar o crescimento.',
          impact: {
            projectedGain: projection.finalValue * 0.15 // Estimativa de 15% de ganho
          },
          priority: 'medium',
          category: 'allocation'
        })
      }
    }

    // Ordenar sugestões por prioridade
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * Calcula o alinhamento geral das metas
   */
  private calculateOverallAlignment(goalAnalysis: any[]): number {
    if (goalAnalysis.length === 0) return 100

    const feasibleGoals = goalAnalysis.filter(goal => goal.feasible).length
    return Math.round((feasibleGoals / goalAnalysis.length) * 100)
  }

  /**
   * Calcula quantos meses faltam até uma data
   */
  private calculateMonthsUntilDate(targetDate: Date): number {
    const now = new Date()
    const diffTime = targetDate.getTime() - now.getTime()
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30))
    return Math.max(0, diffMonths)
  }

  /**
   * Simula o impacto de uma sugestão
   */
  async simulateSuggestionImpact(
    clientId: string,
    suggestion: Suggestion
  ): Promise<WealthProjection> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { events: true, wallet: true }
    })

    if (!client) {
      throw new Error('Cliente não encontrado')
    }

    // Criar evento simulado baseado na sugestão
    const simulatedEvents = [...client.events]

    if (suggestion.type === 'increase_contribution' && suggestion.impact.monthlyAmount) {
      simulatedEvents.push({
        id: 'simulated',
        clientId,
        type: 'Aporte Adicional',
        value: suggestion.impact.monthlyAmount,
        frequency: 'monthly',
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)
    }

    // Gerar nova projeção com o evento simulado
    const projectionEvents = simulatedEvents.map(event => ({
      type: event.type,
      value: Number(event.value),
      frequency: event.frequency as 'once' | 'monthly' | 'yearly' || 'once',
      startDate: event.date || new Date(),
      endDate: event.frequency === 'once' ? event.date || new Date() : new Date(2060, 11, 31)
    }))

    const initialValue = Number(client.wallet?.totalValue || 0)
    const projectionPoints = this.projectionService.simulateWealthCurve(
      initialValue,
      projectionEvents
    )

    const finalValue = projectionPoints[projectionPoints.length - 1]?.projectedValue || initialValue
    const totalReturn = finalValue - initialValue

    return {
      clientId,
      initialValue,
      annualRate: 0.04,
      projectionPoints,
      finalValue,
      totalReturn
    }
  }
}
