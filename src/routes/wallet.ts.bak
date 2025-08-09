import type { FastifyInstance } from 'fastify'
import { createWalletSchema, updateWalletSchema, idParamSchema } from '../schemas'
import { validateBody, validateParams } from '../libs/validation'

export default async function walletRoutes(app: FastifyInstance) {
  // Create or update wallet
  app.post('/wallets', {
    preHandler: [app.authenticate, app.requireAdvisor, validateBody(createWalletSchema)]
  }, async (request, reply) => {
    try {
      const walletData = request.body as any

      // Verify client exists
      const client = await app.prisma.client.findUnique({
        where: { id: walletData.clientId }
      })

      if (!client) {
        return reply.code(400).send({ error: 'Client not found' })
      }

      // Check if wallet already exists for this client
      const existingWallet = await app.prisma.wallet.findUnique({
        where: { clientId: walletData.clientId }
      })

      let wallet
      if (existingWallet) {
        // Update existing wallet
        wallet = await app.prisma.wallet.update({
          where: { clientId: walletData.clientId },
          data: {
            totalValue: walletData.totalValue,
            allocation: walletData.allocation
          }
        })
      } else {
        // Create new wallet
        wallet = await app.prisma.wallet.create({
          data: walletData
        })
      }

      // Calculate alignment (simplified: assume target allocation is equal distribution)
      const allocationValues = Object.values(walletData.allocation as Record<string, number>)
      const targetAllocation = 100 / allocationValues.length
      const alignment = allocationValues.reduce((acc: number, current: number) => {
        return acc + Math.abs(current - targetAllocation)
      }, 0)
      const alignmentPercentage = Math.max(0, 100 - alignment)

      reply.code(existingWallet ? 200 : 201).send({
        ...wallet,
        alignment: alignmentPercentage
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Get wallet by client ID
  app.get<{
    Params: { clientId: string }
  }>('/wallets/client/:clientId', {
    preHandler: [app.authenticate, app.requireAuth],
    schema: {
      params: {
        type: 'object',
        properties: {
          clientId: { type: 'string' }
        },
        required: ['clientId']
      },
      tags: ['Wallets'],
      summary: 'Get wallet by client ID',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            clientId: { type: 'string' },
            totalValue: { type: 'number' },
            allocation: { type: 'object' },
            alignment: { type: 'number' },
            client: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { clientId } = request.params

      const wallet = await app.prisma.wallet.findUnique({
        where: { clientId },
        include: {
          client: {
            select: {
              name: true,
              email: true
            }
          }
        }
      })

      if (!wallet) {
        return reply.code(404).send({ error: 'Wallet not found' })
      }

      // Calculate alignment
      const allocation = wallet.allocation as Record<string, number>
      const allocationValues = Object.values(allocation)
      const targetAllocation = 100 / allocationValues.length
      const alignment = allocationValues.reduce((acc, current) => {
        return acc + Math.abs(current - targetAllocation)
      }, 0)
      const alignmentPercentage = Math.max(0, 100 - alignment)

      reply.send({
        ...wallet,
        alignment: alignmentPercentage
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Update wallet
  app.put<{
    Params: IdParam
    Body: UpdateWalletInput
  }>('/wallets/:id', {
    preHandler: [app.authenticate, app.requireAdvisor],
    schema: {
      params: idParamSchema,
      body: updateWalletSchema,
      tags: ['Wallets'],
      summary: 'Update wallet',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            clientId: { type: 'string' },
            totalValue: { type: 'number' },
            allocation: { type: 'object' },
            alignment: { type: 'number' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const updateData = request.body

      // Check if wallet exists
      const existingWallet = await app.prisma.wallet.findUnique({
        where: { id }
      })

      if (!existingWallet) {
        return reply.code(404).send({ error: 'Wallet not found' })
      }

      const updatedWallet = await app.prisma.wallet.update({
        where: { id },
        data: updateData
      })

      // Calculate alignment
      const allocation = (updateData.allocation || existingWallet.allocation) as Record<string, number>
      const allocationValues = Object.values(allocation)
      const targetAllocation = 100 / allocationValues.length
      const alignment = allocationValues.reduce((acc, current) => {
        return acc + Math.abs(current - targetAllocation)
      }, 0)
      const alignmentPercentage = Math.max(0, 100 - alignment)

      reply.send({
        ...updatedWallet,
        alignment: alignmentPercentage
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Delete wallet
  app.delete<{
    Params: IdParam
  }>('/wallets/:id', {
    preHandler: [app.authenticate, app.requireAdvisor],
    schema: {
      params: idParamSchema,
      tags: ['Wallets'],
      summary: 'Delete wallet',
      security: [{ bearerAuth: [] }],
      response: {
        204: {
          type: 'null'
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params

      // Check if wallet exists
      const existingWallet = await app.prisma.wallet.findUnique({
        where: { id }
      })

      if (!existingWallet) {
        return reply.code(404).send({ error: 'Wallet not found' })
      }

      await app.prisma.wallet.delete({
        where: { id }
      })

      reply.code(204).send()
    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
