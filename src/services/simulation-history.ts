import { PrismaClient } from '@prisma/client'
import { WealthProjection } from './projection'

export interface SimulationMetadata {
  id: string
  clientId: string
  name?: string
  description?: string
  parameters: {
    initialValue: number
    annualRate: number
    events: Array<{
      type: string
      value: number
      frequency?: string
    }>
  }
  results: {
    finalValue: number
    totalReturn: number
    projectionYears: number
  }
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface SimulationComparison {
  simulations: SimulationMetadata[]
  comparison: {
    bestPerformance: {
      simulationId: string
      finalValue: number
      totalReturn: number
    }
    worstPerformance: {
      simulationId: string
      finalValue: number
      totalReturn: number
    }
    averageFinalValue: number
    averageReturn: number
  }
}

export class SimulationHistoryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Salva uma simulação com metadados
   */
  async saveSimulation(
    clientId: string,
    projection: WealthProjection,
    metadata: {
      name?: string
      description?: string
      tags?: string[]
    } = {}
  ): Promise<string> {
    const simulationData = {
      clientId,
      payload: {
        ...projection,
        metadata: {
          name: metadata.name || `Simulação ${new Date().toLocaleDateString('pt-BR')}`,
          description: metadata.description,
          tags: metadata.tags || [],
          parameters: {
            initialValue: projection.initialValue,
            annualRate: projection.annualRate,
            events: projection.projectionPoints
              .filter(point => point.events.length > 0)
              .flatMap(point => point.events)
              .reduce((unique, event) => {
                const exists = unique.find(e => 
                  e.type === event.type && 
                  e.value === event.value && 
                  e.frequency === event.frequency
                )
                if (!exists) {
                  unique.push(event)
                }
                return unique
              }, [] as any[])
          },
          results: {
            finalValue: projection.finalValue,
            totalReturn: projection.totalReturn,
            projectionYears: new Date().getFullYear() - 2060
          }
        }
      } as any
    }

    const simulation = await this.prisma.simulation.create({
      data: simulationData
    })

    return simulation.id
  }

  /**
   * Lista simulações de um cliente com paginação
   */
  async getClientSimulations(
    clientId: string,
    options: {
      page?: number
      limit?: number
      tags?: string[]
      sortBy?: 'createdAt' | 'finalValue' | 'totalReturn'
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): Promise<{
    simulations: SimulationMetadata[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const {
      page = 1,
      limit = 10,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options

    const skip = (page - 1) * limit

    // Construir filtros
    const where: any = { clientId }
    
    // Filtro por tags (seria implementado com uma query JSON mais complexa)
    if (tags && tags.length > 0) {
      // Por simplicidade, vamos filtrar no código por enquanto
      // Em produção, seria melhor usar uma query JSON do Prisma
    }

    // Buscar simulações
    const [simulations, total] = await Promise.all([
      this.prisma.simulation.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortBy === 'createdAt' 
          ? { createdAt: sortOrder }
          : { createdAt: 'desc' }, // Por enquanto, só ordenar por data
        include: {
          client: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }),
      this.prisma.simulation.count({ where })
    ])

    // Transformar dados
    const simulationMetadata: SimulationMetadata[] = simulations.map(sim => {
      const payload = sim.payload as any
      const metadata = payload.metadata || {}

      return {
        id: sim.id,
        clientId: sim.clientId,
        name: metadata.name || 'Simulação sem nome',
        description: metadata.description,
        parameters: metadata.parameters || {
          initialValue: payload.initialValue || 0,
          annualRate: payload.annualRate || 0.04,
          events: []
        },
        results: metadata.results || {
          finalValue: payload.finalValue || 0,
          totalReturn: payload.totalReturn || 0,
          projectionYears: 0
        },
        tags: metadata.tags || [],
        createdAt: sim.createdAt,
        updatedAt: sim.updatedAt
      }
    })

    // Filtrar por tags se necessário
    const filteredSimulations = tags && tags.length > 0
      ? simulationMetadata.filter(sim => 
          tags.some(tag => sim.tags?.includes(tag))
        )
      : simulationMetadata

    // Ordenar se não for por data
    if (sortBy !== 'createdAt') {
      filteredSimulations.sort((a, b) => {
        const aValue = sortBy === 'finalValue' 
          ? a.results.finalValue 
          : a.results.totalReturn
        const bValue = sortBy === 'finalValue' 
          ? b.results.finalValue 
          : b.results.totalReturn

        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      })
    }

    return {
      simulations: filteredSimulations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Compara múltiplas simulações
   */
  async compareSimulations(simulationIds: string[]): Promise<SimulationComparison> {
    const simulations = await this.prisma.simulation.findMany({
      where: {
        id: { in: simulationIds }
      },
      include: {
        client: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    const simulationMetadata: SimulationMetadata[] = simulations.map(sim => {
      const payload = sim.payload as any
      const metadata = payload.metadata || {}

      return {
        id: sim.id,
        clientId: sim.clientId,
        name: metadata.name || 'Simulação sem nome',
        description: metadata.description,
        parameters: metadata.parameters || {
          initialValue: payload.initialValue || 0,
          annualRate: payload.annualRate || 0.04,
          events: []
        },
        results: metadata.results || {
          finalValue: payload.finalValue || 0,
          totalReturn: payload.totalReturn || 0,
          projectionYears: 0
        },
        tags: metadata.tags || [],
        createdAt: sim.createdAt,
        updatedAt: sim.updatedAt
      }
    })

    // Calcular comparações
    const finalValues = simulationMetadata.map(s => s.results.finalValue)
    const totalReturns = simulationMetadata.map(s => s.results.totalReturn)

    const bestPerformanceIndex = finalValues.indexOf(Math.max(...finalValues))
    const worstPerformanceIndex = finalValues.indexOf(Math.min(...finalValues))

    const comparison = {
      bestPerformance: {
        simulationId: simulationMetadata[bestPerformanceIndex].id,
        finalValue: finalValues[bestPerformanceIndex],
        totalReturn: totalReturns[bestPerformanceIndex]
      },
      worstPerformance: {
        simulationId: simulationMetadata[worstPerformanceIndex].id,
        finalValue: finalValues[worstPerformanceIndex],
        totalReturn: totalReturns[worstPerformanceIndex]
      },
      averageFinalValue: finalValues.reduce((sum, val) => sum + val, 0) / finalValues.length,
      averageReturn: totalReturns.reduce((sum, val) => sum + val, 0) / totalReturns.length
    }

    return {
      simulations: simulationMetadata,
      comparison
    }
  }

  /**
   * Atualiza metadados de uma simulação
   */
  async updateSimulationMetadata(
    simulationId: string,
    metadata: {
      name?: string
      description?: string
      tags?: string[]
    }
  ): Promise<void> {
    const simulation = await this.prisma.simulation.findUnique({
      where: { id: simulationId }
    })

    if (!simulation) {
      throw new Error('Simulação não encontrada')
    }

    const currentPayload = simulation.payload as any
    const updatedPayload = {
      ...currentPayload,
      metadata: {
        ...currentPayload.metadata,
        ...metadata,
        updatedAt: new Date()
      }
    }

    await this.prisma.simulation.update({
      where: { id: simulationId },
      data: {
        payload: updatedPayload
      }
    })
  }

  /**
   * Deleta uma simulação
   */
  async deleteSimulation(simulationId: string): Promise<void> {
    await this.prisma.simulation.delete({
      where: { id: simulationId }
    })
  }

  /**
   * Obtém estatísticas das simulações de um cliente
   */
  async getClientSimulationStats(clientId: string): Promise<{
    totalSimulations: number
    averageFinalValue: number
    bestSimulation: {
      id: string
      name: string
      finalValue: number
    } | null
    recentActivity: {
      lastSimulation: Date | null
      simulationsThisMonth: number
    }
  }> {
    const simulations = await this.prisma.simulation.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' }
    })

    if (simulations.length === 0) {
      return {
        totalSimulations: 0,
        averageFinalValue: 0,
        bestSimulation: null,
        recentActivity: {
          lastSimulation: null,
          simulationsThisMonth: 0
        }
      }
    }

    const simulationData = simulations.map(sim => {
      const payload = sim.payload as any
      return {
        id: sim.id,
        name: payload.metadata?.name || 'Simulação sem nome',
        finalValue: payload.finalValue || 0,
        createdAt: sim.createdAt
      }
    })

    const finalValues = simulationData.map(s => s.finalValue)
    const bestSimulation = simulationData.reduce((best, current) => 
      current.finalValue > best.finalValue ? current : best
    )

    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)

    const simulationsThisMonth = simulations.filter(
      sim => sim.createdAt >= thisMonth
    ).length

    return {
      totalSimulations: simulations.length,
      averageFinalValue: finalValues.reduce((sum, val) => sum + val, 0) / finalValues.length,
      bestSimulation: {
        id: bestSimulation.id,
        name: bestSimulation.name,
        finalValue: bestSimulation.finalValue
      },
      recentActivity: {
        lastSimulation: simulations[0].createdAt,
        simulationsThisMonth
      }
    }
  }
}
