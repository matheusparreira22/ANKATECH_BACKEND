import { PrismaClient } from '@prisma/client'

export interface ProjectionEvent {
  type: string
  value: number
  frequency?: 'once' | 'monthly' | 'yearly'
  startDate?: Date
  endDate?: Date
}

export interface ProjectionPoint {
  year: number
  month: number
  projectedValue: number
  events: ProjectionEvent[]
}

export interface WealthProjection {
  clientId: string
  initialValue: number
  annualRate: number
  projectionPoints: ProjectionPoint[]
  finalValue: number
  totalReturn: number
}

export class ProjectionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Simula a curva de crescimento patrimonial
   * @param initialValue Valor inicial da carteira
   * @param events Eventos financeiros (aportes, retiradas, etc.)
   * @param annualRate Taxa de crescimento anual (ex: 0.04 para 4%)
   * @param startYear Ano inicial da projeção
   * @param endYear Ano final da projeção (padrão: 2060)
   * @returns Array com projeção mensal até o ano final
   */
  simulateWealthCurve(
    initialValue: number,
    events: ProjectionEvent[] = [],
    annualRate: number = 0.04,
    startYear: number = new Date().getFullYear(),
    endYear: number = 2060
  ): ProjectionPoint[] {
    const projectionPoints: ProjectionPoint[] = []
    let currentValue = initialValue
    const monthlyRate = annualRate / 12

    // Iterar por cada mês até o ano final
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) {
        const currentDate = new Date(year, month - 1, 1)
        const monthEvents: ProjectionEvent[] = []

        // Aplicar crescimento composto mensal
        currentValue = currentValue * (1 + monthlyRate)

        // Processar eventos para este mês
        events.forEach(event => {
          if (this.shouldApplyEvent(event, currentDate)) {
            currentValue += event.value
            monthEvents.push(event)
          }
        })

        // Adicionar ponto de projeção
        projectionPoints.push({
          year,
          month,
          projectedValue: Math.round(currentValue * 100) / 100, // Arredondar para 2 casas decimais
          events: monthEvents
        })
      }
    }

    return projectionPoints
  }

  /**
   * Verifica se um evento deve ser aplicado em uma data específica
   */
  private shouldApplyEvent(event: ProjectionEvent, currentDate: Date): boolean {
    const eventStartDate = event.startDate || new Date()
    const eventEndDate = event.endDate || new Date(2060, 11, 31)

    // Verificar se está dentro do período do evento
    if (currentDate < eventStartDate || currentDate > eventEndDate) {
      return false
    }

    switch (event.frequency) {
      case 'once':
        // Aplicar apenas no primeiro mês do período
        return currentDate.getTime() === eventStartDate.getTime()
      
      case 'monthly':
        // Aplicar todo mês dentro do período
        return true
      
      case 'yearly':
        // Aplicar apenas no mês/ano de início
        return (
          currentDate.getMonth() === eventStartDate.getMonth() &&
          currentDate.getFullYear() >= eventStartDate.getFullYear()
        )
      
      default:
        // Se não especificado, tratar como evento único
        return currentDate.getTime() === eventStartDate.getTime()
    }
  }

  /**
   * Cria uma projeção completa para um cliente
   */
  async createClientProjection(
    clientId: string,
    annualRate: number = 0.04
  ): Promise<WealthProjection> {
    // Buscar dados do cliente
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        wallet: true,
        events: true,
        goals: true
      }
    })

    if (!client) {
      throw new Error('Cliente não encontrado')
    }

    // Valor inicial da carteira
    const initialValue = client.wallet?.totalValue || 0

    // Converter eventos do banco para formato de projeção
    const projectionEvents: ProjectionEvent[] = client.events.map(event => ({
      type: event.type,
      value: Number(event.value),
      frequency: event.frequency as 'once' | 'monthly' | 'yearly' || 'once',
      startDate: event.date || new Date(),
      endDate: event.frequency === 'once' ? event.date || new Date() : new Date(2060, 11, 31)
    }))

    // Gerar projeção
    const projectionPoints = this.simulateWealthCurve(
      Number(initialValue),
      projectionEvents,
      annualRate
    )

    const finalValue = projectionPoints[projectionPoints.length - 1]?.projectedValue || Number(initialValue)
    const totalReturn = finalValue - Number(initialValue)

    return {
      clientId,
      initialValue: Number(initialValue),
      annualRate,
      projectionPoints,
      finalValue: Number(finalValue),
      totalReturn
    }
  }

  /**
   * Calcula projeção simplificada (apenas pontos anuais)
   */
  getAnnualProjection(projection: WealthProjection): Array<{year: number, projectedValue: number}> {
    const annualPoints: Array<{year: number, projectedValue: number}> = []
    
    // Pegar apenas o último mês de cada ano (dezembro)
    projection.projectionPoints.forEach(point => {
      if (point.month === 12) {
        annualPoints.push({
          year: point.year,
          projectedValue: point.projectedValue
        })
      }
    })

    return annualPoints
  }

  /**
   * Salva uma simulação no banco de dados
   */
  async saveSimulation(clientId: string, projection: WealthProjection): Promise<string> {
    const simulation = await this.prisma.simulation.create({
      data: {
        clientId,
        payload: projection as any // Cast para JSON
      }
    })

    return simulation.id
  }
}
