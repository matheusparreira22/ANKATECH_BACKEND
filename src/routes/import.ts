import type { FastifyInstance } from 'fastify'
import { CsvImportService } from '../services/csv-import'
import { z } from 'zod'

const importTypeSchema = z.enum(['clients', 'goals', 'events'])

export default async function importRoutes(app: FastifyInstance) {
  const csvImportService = new CsvImportService(app.prisma)

  // Registrar plugin multipart
  const multipart = await import('@fastify/multipart')
  await app.register(multipart.default, {
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB
    }
  })

  // Endpoint SSE para importação de CSV
  app.post('/import/:type/sse', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const { type } = request.params as { type: string }
      
      // Validar tipo de importação
      const validType = importTypeSchema.parse(type)

      // Configurar SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      })

      const sendEvent = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\n`)
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      // Obter arquivo do upload
      const data = await (request as any).file()
      if (!data) {
        sendEvent('error', { message: 'Nenhum arquivo enviado' })
        reply.raw.end()
        return
      }

      const buffer = await data.toBuffer()

      // Enviar evento de início
      sendEvent('start', { 
        message: `Iniciando importação de ${validType}`,
        filename: data.filename 
      })

      // Callback de progresso
      const onProgress = (progress: any) => {
        sendEvent('progress', progress)
      }

      // Executar importação baseada no tipo
      let result
      switch (validType) {
        case 'clients':
          result = await csvImportService.importClients(buffer, onProgress)
          break
        case 'goals':
          result = await csvImportService.importGoals(buffer, onProgress)
          break
        default:
          sendEvent('error', { message: 'Tipo de importação não implementado' })
          reply.raw.end()
          return
      }

      // Enviar resultado final
      sendEvent('complete', result)
      reply.raw.end()

    } catch (error) {
      app.log.error(error)
      const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor'
      
      reply.raw.write(`event: error\n`)
      reply.raw.write(`data: ${JSON.stringify({ message: errorMessage })}\n\n`)
      reply.raw.end()
    }
  })

  // Endpoint tradicional para importação (sem SSE)
  app.post('/import/:type', {
    preHandler: [app.authenticate, app.requireAdvisor]
  }, async (request, reply) => {
    try {
      const { type } = request.params as { type: string }
      const validType = importTypeSchema.parse(type)

      const data = await (request as any).file()
      if (!data) {
        return reply.code(400).send({ error: 'Nenhum arquivo enviado' })
      }

      const buffer = await data.toBuffer()

      let result
      switch (validType) {
        case 'clients':
          result = await csvImportService.importClients(buffer)
          break
        case 'goals':
          result = await csvImportService.importGoals(buffer)
          break
        default:
          return reply.code(400).send({ error: 'Tipo de importação não suportado' })
      }

      reply.send({
        success: true,
        data: result
      })

    } catch (error) {
      app.log.error(error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Tipo de importação inválido',
          details: (error as any).errors
        })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Obter templates CSV
  app.get('/import/templates/:type', {
    preHandler: [app.authenticate, app.requireAuth]
  }, async (request, reply) => {
    try {
      const { type } = request.params as { type: string }
      const validType = importTypeSchema.parse(type)

      let template: string
      let filename: string

      switch (validType) {
        case 'clients':
          template = csvImportService.generateClientTemplate()
          filename = 'template_clientes.csv'
          break
        case 'goals':
          template = csvImportService.generateGoalTemplate()
          filename = 'template_metas.csv'
          break
        default:
          return reply.code(400).send({ error: 'Tipo de template não suportado' })
      }

      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(template)

    } catch (error) {
      app.log.error(error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Tipo de template inválido',
          details: (error as any).errors
        })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Listar importações recentes (histórico)
  app.get('/import/history', {
    preHandler: [app.authenticate, app.requireAuth]
  }, async (request, reply) => {
    try {
      // Por enquanto, retornar dados mockados
      // Em uma implementação real, isso viria de uma tabela de histórico
      const history = [
        {
          id: '1',
          type: 'clients',
          filename: 'clientes_janeiro.csv',
          status: 'completed',
          total: 150,
          imported: 145,
          errors: 5,
          createdAt: new Date('2024-01-09T10:30:00Z'),
          duration: 12500
        },
        {
          id: '2',
          type: 'goals',
          filename: 'metas_q1.csv',
          status: 'completed',
          total: 75,
          imported: 75,
          errors: 0,
          createdAt: new Date('2024-01-08T14:15:00Z'),
          duration: 8200
        }
      ]

      reply.send({
        success: true,
        data: history
      })

    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // Validar arquivo CSV antes da importação
  app.post('/import/:type/validate', {
    preHandler: [app.authenticate, app.requireAuth]
  }, async (request, reply) => {
    try {
      const { type } = request.params as { type: string }
      const validType = importTypeSchema.parse(type)

      const data = await (request as any).file()
      if (!data) {
        return reply.code(400).send({ error: 'Nenhum arquivo enviado' })
      }

      const buffer = await data.toBuffer()
      const csvContent = buffer.toString()
      const lines = csvContent.split('\n').filter((line: string) => line.trim())

      if (lines.length < 2) {
        return reply.code(400).send({ 
          error: 'Arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados' 
        })
      }

      const headers = lines[0].split(',').map((h: string) => h.trim())
      const dataLines = lines.slice(1)

      // Validar headers baseado no tipo
      let expectedHeaders: string[]
      switch (validType) {
        case 'clients':
          expectedHeaders = ['name', 'email', 'password', 'age', 'role', 'status', 'perfilFamilia']
          break
        case 'goals':
          expectedHeaders = ['clientEmail', 'type', 'amount', 'targetAt']
          break
        default:
          return reply.code(400).send({ error: 'Tipo não suportado' })
      }

      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h))
      const extraHeaders = headers.filter((h: string) => !expectedHeaders.includes(h))

      reply.send({
        success: true,
        data: {
          filename: data.filename,
          totalLines: dataLines.length,
          headers,
          expectedHeaders,
          missingHeaders,
          extraHeaders,
          valid: missingHeaders.length === 0,
          preview: dataLines.slice(0, 5).map((line: string, index: number) => ({
            row: index + 2,
            data: line.split(',').map((cell: string) => cell.trim())
          }))
        }
      })

    } catch (error) {
      app.log.error(error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}
