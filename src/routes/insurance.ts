import type { FastifyInstance } from 'fastify'
import { InsuranceService } from '../services/insurance'
import { validateParams, validateQuery, validateBody } from '../libs/validation'
import { idParamSchema, paginationSchema } from '../schemas'
import { z } from 'zod'
import { InsuranceType, InsuranceStatus } from '@prisma/client'

// Schemas de validação
const createInsuranceSchema = z.object({
  clientId: z.string().cuid('ID do cliente inválido'),
  type: z.nativeEnum(InsuranceType),
  provider: z.string().min(1, 'Seguradora é obrigatória'),
  policyNumber: z.string().optional(),
  coverage: z.number().positive('Cobertura deve ser positiva'),
  premium: z.number().positive('Prêmio deve ser positivo'),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Data de início inválida'),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Data de fim inválida').optional(),
  beneficiaries: z.array(z.object({
    name: z.string().min(1, 'Nome do beneficiário é obrigatório'),
    relationship: z.string().min(1, 'Relacionamento é obrigatório'),
    percentage: z.number().min(0).max(100, 'Porcentagem deve estar entre 0 e 100')
  })).optional(),
  details: z.record(z.string(), z.any()).optional()
})

const updateInsuranceSchema = z.object({
  type: z.nativeEnum(InsuranceType).optional(),
  provider: z.string().min(1, 'Seguradora é obrigatória').optional(),
  policyNumber: z.string().optional(),
  coverage: z.number().positive('Cobertura deve ser positiva').optional(),
  premium: z.number().positive('Prêmio deve ser positivo').optional(),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Data de início inválida').optional(),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Data de fim inválida').optional(),
  status: z.nativeEnum(InsuranceStatus).optional(),
  beneficiaries: z.array(z.object({
    name: z.string().min(1, 'Nome do beneficiário é obrigatório'),
    relationship: z.string().min(1, 'Relacionamento é obrigatório'),
    percentage: z.number().min(0).max(100, 'Porcentagem deve estar entre 0 e 100')
  })).optional(),
  details: z.record(z.string(), z.any()).optional()
})

const insuranceQuerySchema = z.object({
  ...paginationSchema.shape,
  type: z.nativeEnum(InsuranceType).optional(),
  status: z.nativeEnum(InsuranceStatus).optional(),
  provider: z.string().optional(),
  includeExpired: z.coerce.boolean().optional().default(false)
})

export default async function insuranceRoutes(app: FastifyInstance) {
  const insuranceService = new InsuranceService(app.prisma)

  // Criar seguro
  app.post('/insurances', {
    preHandler: [app.authenticate, app.requireAdvisor, validateBody(createInsuranceSchema)]
  }, async (request, reply) => {
    try {
      const data = request.body as any

      // Converter strings de data para Date
      const insuranceData = {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined
      }

      const insurance = await insuranceService.createInsurance(insuranceData)

      reply.code(201).send({
        success: true,
        data: insurance
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error) {
        if (error.message === 'Cliente não encontrado') {
          return reply.code(404).send({ error: error.message })
        }
        if (error.message.includes('beneficiários')) {
          return reply.code(400).send({ error: error.message })
        }
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Listar todos os seguros com filtros
  app.get('/insurances', {
    preHandler: [app.authenticate, app.requireAuth, validateQuery(insuranceQuerySchema)]
  }, async (request, reply) => {
    try {
      const query = request.query as any

      const result = await insuranceService.getAllInsurances({
        page: query.page,
        limit: query.limit,
        type: query.type,
        status: query.status,
        provider: query.provider
      })

      reply.send({
        success: true,
        data: result
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Buscar seguro por ID
  app.get('/insurances/:id', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      const insurance = await insuranceService.getInsuranceById(id)

      if (!insurance) {
        return reply.code(404).send({ error: 'Seguro não encontrado' })
      }

      reply.send({
        success: true,
        data: insurance
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Atualizar seguro
  app.put('/insurances/:id', {
    preHandler: [app.authenticate, app.requireAdvisor, validateParams(idParamSchema), validateBody(updateInsuranceSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const data = request.body as any

      // Converter strings de data para Date se fornecidas
      const updateData = { ...data }
      if (data.startDate) updateData.startDate = new Date(data.startDate)
      if (data.endDate) updateData.endDate = new Date(data.endDate)

      const insurance = await insuranceService.updateInsurance(id, updateData)

      reply.send({
        success: true,
        data: insurance
      })
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error) {
        if (error.message === 'Seguro não encontrado') {
          return reply.code(404).send({ error: error.message })
        }
        if (error.message.includes('beneficiários')) {
          return reply.code(400).send({ error: error.message })
        }
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Deletar seguro
  app.delete('/insurances/:id', {
    preHandler: [app.authenticate, app.requireAdvisor, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      await insuranceService.deleteInsurance(id)

      reply.code(204).send()
    } catch (error) {
      app.log.error(error)
      if (error instanceof Error && error.message === 'Seguro não encontrado') {
        return reply.code(404).send({ error: error.message })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Listar seguros de um cliente
  app.get('/clients/:id/insurances', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema), validateQuery(z.object({
      type: z.nativeEnum(InsuranceType).optional(),
      status: z.nativeEnum(InsuranceStatus).optional(),
      includeExpired: z.coerce.boolean().optional().default(false)
    }))]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { type, status, includeExpired } = request.query as any

      const insurances = await insuranceService.getClientInsurances(id, {
        type,
        status,
        includeExpired
      })

      reply.send({
        success: true,
        data: insurances
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Resumo dos seguros de um cliente
  app.get('/clients/:id/insurances/summary', {
    preHandler: [app.authenticate, app.requireAuth, validateParams(idParamSchema)]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any

      const summary = await insuranceService.getClientInsuranceSummary(id)

      reply.send({
        success: true,
        data: summary
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Cobertura por tipo de seguro (estatísticas gerais)
  app.get('/insurances/stats/coverage-by-type', {
    preHandler: [app.authenticate, app.requireAuth]
  }, async (request, reply) => {
    try {
      const coverageByType = await insuranceService.getCoverageByType()

      reply.send({
        success: true,
        data: coverageByType
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Atualizar apólices expiradas (endpoint administrativo)
  app.post('/insurances/admin/update-expired', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const updatedCount = await insuranceService.updateExpiredPolicies()

      reply.send({
        success: true,
        data: {
          message: `${updatedCount} apólices foram marcadas como expiradas`,
          updatedCount
        }
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Tipos de seguro disponíveis
  app.get('/insurances/types', {
    preHandler: [app.authenticate, app.requireAuth]
  }, async (request, reply) => {
    try {
      const types = Object.values(InsuranceType).map(type => ({
        value: type,
        label: type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')
      }))

      reply.send({
        success: true,
        data: types
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Status de seguro disponíveis
  app.get('/insurances/statuses', {
    preHandler: [app.authenticate, app.requireAuth]
  }, async (request, reply) => {
    try {
      const statuses = Object.values(InsuranceStatus).map(status => ({
        value: status,
        label: status.charAt(0) + status.slice(1).toLowerCase()
      }))

      reply.send({
        success: true,
        data: statuses
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}
