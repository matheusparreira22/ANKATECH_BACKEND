import { PrismaClient, Insurance, InsuranceType, InsuranceStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

export interface CreateInsuranceInput {
  clientId: string
  type: InsuranceType
  provider: string
  policyNumber?: string
  coverage: number
  premium: number
  startDate: Date
  endDate?: Date
  beneficiaries?: Array<{
    name: string
    relationship: string
    percentage: number
  }>
  details?: Record<string, any>
}

export interface UpdateInsuranceInput {
  type?: InsuranceType
  provider?: string
  policyNumber?: string
  coverage?: number
  premium?: number
  startDate?: Date
  endDate?: Date
  status?: InsuranceStatus
  beneficiaries?: Array<{
    name: string
    relationship: string
    percentage: number
  }>
  details?: Record<string, any>
}

export interface InsuranceWithClient extends Insurance {
  client: {
    id: string
    name: string
    email: string
  }
}

export interface InsuranceSummary {
  totalPolicies: number
  totalCoverage: number
  totalPremiums: number
  byType: Record<InsuranceType, {
    count: number
    totalCoverage: number
    totalPremiums: number
  }>
  byStatus: Record<InsuranceStatus, number>
  expiringPolicies: Array<{
    id: string
    type: InsuranceType
    provider: string
    endDate: Date
    daysUntilExpiry: number
  }>
}

export class InsuranceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Cria uma nova apólice de seguro
   */
  async createInsurance(data: CreateInsuranceInput): Promise<Insurance> {
    // Verificar se o cliente existe
    const client = await this.prisma.client.findUnique({
      where: { id: data.clientId }
    })

    if (!client) {
      throw new Error('Cliente não encontrado')
    }

    // Validar beneficiários se fornecidos
    if (data.beneficiaries) {
      const totalPercentage = data.beneficiaries.reduce((sum, b) => sum + b.percentage, 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error('A soma das porcentagens dos beneficiários deve ser 100%')
      }
    }

    const insurance = await this.prisma.insurance.create({
      data: {
        clientId: data.clientId,
        type: data.type,
        provider: data.provider,
        policyNumber: data.policyNumber,
        coverage: new Decimal(data.coverage),
        premium: new Decimal(data.premium),
        startDate: data.startDate,
        endDate: data.endDate,
        beneficiaries: data.beneficiaries as any,
        details: data.details as any
      }
    })

    return insurance
  }

  /**
   * Lista seguros de um cliente
   */
  async getClientInsurances(
    clientId: string,
    options: {
      type?: InsuranceType
      status?: InsuranceStatus
      includeExpired?: boolean
    } = {}
  ): Promise<Insurance[]> {
    const where: any = { clientId }

    if (options.type) {
      where.type = options.type
    }

    if (options.status) {
      where.status = options.status
    }

    if (!options.includeExpired) {
      where.OR = [
        { endDate: null },
        { endDate: { gt: new Date() } }
      ]
    }

    return this.prisma.insurance.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Busca seguro por ID
   */
  async getInsuranceById(id: string): Promise<InsuranceWithClient | null> {
    return this.prisma.insurance.findUnique({
      where: { id },
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
   * Atualiza um seguro
   */
  async updateInsurance(id: string, data: UpdateInsuranceInput): Promise<Insurance> {
    const existingInsurance = await this.prisma.insurance.findUnique({
      where: { id }
    })

    if (!existingInsurance) {
      throw new Error('Seguro não encontrado')
    }

    // Validar beneficiários se fornecidos
    if (data.beneficiaries) {
      const totalPercentage = data.beneficiaries.reduce((sum, b) => sum + b.percentage, 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error('A soma das porcentagens dos beneficiários deve ser 100%')
      }
    }

    const updateData: any = { ...data }
    
    if (data.coverage !== undefined) {
      updateData.coverage = new Decimal(data.coverage)
    }
    
    if (data.premium !== undefined) {
      updateData.premium = new Decimal(data.premium)
    }

    return this.prisma.insurance.update({
      where: { id },
      data: updateData
    })
  }

  /**
   * Deleta um seguro
   */
  async deleteInsurance(id: string): Promise<void> {
    const insurance = await this.prisma.insurance.findUnique({
      where: { id }
    })

    if (!insurance) {
      throw new Error('Seguro não encontrado')
    }

    await this.prisma.insurance.delete({
      where: { id }
    })
  }

  /**
   * Obtém resumo dos seguros de um cliente
   */
  async getClientInsuranceSummary(clientId: string): Promise<InsuranceSummary> {
    const insurances = await this.prisma.insurance.findMany({
      where: { clientId }
    })

    const totalCoverage = insurances.reduce((sum, ins) => sum + Number(ins.coverage), 0)
    const totalPremiums = insurances.reduce((sum, ins) => sum + Number(ins.premium), 0)

    // Agrupar por tipo
    const byType: Record<string, any> = {}
    Object.values(InsuranceType).forEach(type => {
      const typeInsurances = insurances.filter(ins => ins.type === type)
      byType[type] = {
        count: typeInsurances.length,
        totalCoverage: typeInsurances.reduce((sum, ins) => sum + Number(ins.coverage), 0),
        totalPremiums: typeInsurances.reduce((sum, ins) => sum + Number(ins.premium), 0)
      }
    })

    // Agrupar por status
    const byStatus: Record<string, number> = {}
    Object.values(InsuranceStatus).forEach(status => {
      byStatus[status] = insurances.filter(ins => ins.status === status).length
    })

    // Apólices expirando nos próximos 30 dias
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const expiringPolicies = insurances
      .filter(ins => ins.endDate && ins.endDate <= thirtyDaysFromNow && ins.endDate > new Date())
      .map(ins => ({
        id: ins.id,
        type: ins.type,
        provider: ins.provider,
        endDate: ins.endDate!,
        daysUntilExpiry: Math.ceil((ins.endDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)

    return {
      totalPolicies: insurances.length,
      totalCoverage,
      totalPremiums,
      byType: byType as any,
      byStatus: byStatus as any,
      expiringPolicies
    }
  }

  /**
   * Lista todos os seguros com paginação
   */
  async getAllInsurances(options: {
    page?: number
    limit?: number
    type?: InsuranceType
    status?: InsuranceStatus
    provider?: string
  } = {}): Promise<{
    insurances: InsuranceWithClient[]
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
      type,
      status,
      provider
    } = options

    const skip = (page - 1) * limit
    const where: any = {}

    if (type) where.type = type
    if (status) where.status = status
    if (provider) where.provider = { contains: provider, mode: 'insensitive' }

    const [insurances, total] = await Promise.all([
      this.prisma.insurance.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.insurance.count({ where })
    ])

    return {
      insurances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Calcula o valor total de cobertura por tipo de seguro
   */
  async getCoverageByType(): Promise<Record<InsuranceType, number>> {
    const result: Record<string, number> = {}

    for (const type of Object.values(InsuranceType)) {
      const insurances = await this.prisma.insurance.findMany({
        where: { 
          type,
          status: InsuranceStatus.ACTIVE
        }
      })

      result[type] = insurances.reduce((sum, ins) => sum + Number(ins.coverage), 0)
    }

    return result as Record<InsuranceType, number>
  }

  /**
   * Verifica apólices expirando e atualiza status automaticamente
   */
  async updateExpiredPolicies(): Promise<number> {
    const now = new Date()

    const expiredPolicies = await this.prisma.insurance.updateMany({
      where: {
        endDate: { lt: now },
        status: { not: InsuranceStatus.EXPIRED }
      },
      data: {
        status: InsuranceStatus.EXPIRED
      }
    })

    return expiredPolicies.count
  }
}
