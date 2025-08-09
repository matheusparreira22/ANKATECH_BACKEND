import { PrismaClient } from '@prisma/client'
import csv from 'csv-parser'
import { Readable } from 'stream'
import { z } from 'zod'
import { hashPassword } from '../libs/auth'

export interface ImportProgress {
  total: number
  processed: number
  success: number
  errors: number
  currentRow?: number
  status: 'processing' | 'completed' | 'error'
  message?: string
  errorDetails?: Array<{
    row: number
    error: string
    data?: any
  }>
}

export interface ImportResult {
  success: boolean
  total: number
  imported: number
  errors: Array<{
    row: number
    error: string
    data?: any
  }>
  duration: number
}

// Schema para validação de clientes via CSV
const clientCsvSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  role: z.enum(['advisor', 'viewer']).optional().default('viewer'),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  perfilFamilia: z.string().optional()
})

// Schema para validação de metas via CSV
const goalCsvSchema = z.object({
  clientEmail: z.string().email('Email do cliente inválido'),
  type: z.string().min(1, 'Tipo da meta é obrigatório'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  targetAt: z.string().refine((date) => !isNaN(Date.parse(date)), 'Data inválida')
})

// Schema para validação de eventos via CSV
const eventCsvSchema = z.object({
  clientEmail: z.string().email('Email do cliente inválido'),
  type: z.string().min(1, 'Tipo do evento é obrigatório'),
  value: z.coerce.number('Valor deve ser um número'),
  frequency: z.enum(['once', 'monthly', 'yearly']).optional().default('once'),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Data inválida').optional()
})

export class CsvImportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Importa clientes de um arquivo CSV
   */
  async importClients(
    csvBuffer: Buffer,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const startTime = Date.now()
    const errors: Array<{ row: number; error: string; data?: any }> = []
    let processed = 0
    let success = 0
    let total = 0

    // Primeiro, contar o total de linhas
    const lines = csvBuffer.toString().split('\n').filter(line => line.trim())
    total = Math.max(0, lines.length - 1) // Subtrair header

    const progress: ImportProgress = {
      total,
      processed: 0,
      success: 0,
      errors: 0,
      status: 'processing',
      errorDetails: []
    }

    try {
      const stream = Readable.from(csvBuffer)
      const results: any[] = []

      // Parse CSV
      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject)
      })

      // Processar cada linha
      for (let i = 0; i < results.length; i++) {
        const row = results[i]
        const rowNumber = i + 2 // +2 porque começamos do 0 e temos header

        try {
          // Validar dados
          const validatedData = clientCsvSchema.parse(row)

          // Verificar se email já existe
          const existingClient = await this.prisma.client.findUnique({
            where: { email: validatedData.email }
          })

          if (existingClient) {
            errors.push({
              row: rowNumber,
              error: `Email ${validatedData.email} já existe`,
              data: row
            })
          } else {
            // Hash da senha se fornecida, senão usar padrão
            const password = validatedData.password || 'temp123'
            const hashedPassword = await hashPassword(password)

            // Criar cliente
            await this.prisma.client.create({
              data: {
                ...validatedData,
                password: hashedPassword
              }
            })

            success++
          }
        } catch (error) {
          const errorMessage = error instanceof z.ZodError
            ? (error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
            : error instanceof Error ? error.message : 'Erro desconhecido'

          errors.push({
            row: rowNumber,
            error: errorMessage,
            data: row
          })
        }

        processed++
        progress.processed = processed
        progress.success = success
        progress.errors = errors.length
        progress.currentRow = rowNumber
        progress.errorDetails = errors

        // Callback de progresso
        if (onProgress) {
          onProgress({ ...progress })
        }

        // Pequena pausa para não sobrecarregar o banco
        if (processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      progress.status = 'completed'
      if (onProgress) {
        onProgress({ ...progress })
      }

      return {
        success: true,
        total: results.length,
        imported: success,
        errors,
        duration: Date.now() - startTime
      }

    } catch (error) {
      progress.status = 'error'
      progress.message = error instanceof Error ? error.message : 'Erro desconhecido'
      
      if (onProgress) {
        onProgress({ ...progress })
      }

      return {
        success: false,
        total,
        imported: success,
        errors: [...errors, {
          row: 0,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }],
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Importa metas de um arquivo CSV
   */
  async importGoals(
    csvBuffer: Buffer,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const startTime = Date.now()
    const errors: Array<{ row: number; error: string; data?: any }> = []
    let processed = 0
    let success = 0

    const lines = csvBuffer.toString().split('\n').filter(line => line.trim())
    const total = Math.max(0, lines.length - 1)

    const progress: ImportProgress = {
      total,
      processed: 0,
      success: 0,
      errors: 0,
      status: 'processing',
      errorDetails: []
    }

    try {
      const stream = Readable.from(csvBuffer)
      const results: any[] = []

      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject)
      })

      for (let i = 0; i < results.length; i++) {
        const row = results[i]
        const rowNumber = i + 2

        try {
          const validatedData = goalCsvSchema.parse(row)

          // Buscar cliente pelo email
          const client = await this.prisma.client.findUnique({
            where: { email: validatedData.clientEmail }
          })

          if (!client) {
            errors.push({
              row: rowNumber,
              error: `Cliente com email ${validatedData.clientEmail} não encontrado`,
              data: row
            })
          } else {
            await this.prisma.goal.create({
              data: {
                clientId: client.id,
                type: validatedData.type,
                amount: validatedData.amount,
                targetAt: new Date(validatedData.targetAt)
              }
            })

            success++
          }
        } catch (error) {
          const errorMessage = error instanceof z.ZodError
            ? (error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
            : error instanceof Error ? error.message : 'Erro desconhecido'

          errors.push({
            row: rowNumber,
            error: errorMessage,
            data: row
          })
        }

        processed++
        progress.processed = processed
        progress.success = success
        progress.errors = errors.length
        progress.currentRow = rowNumber
        progress.errorDetails = errors

        if (onProgress) {
          onProgress({ ...progress })
        }

        if (processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      progress.status = 'completed'
      if (onProgress) {
        onProgress({ ...progress })
      }

      return {
        success: true,
        total: results.length,
        imported: success,
        errors,
        duration: Date.now() - startTime
      }

    } catch (error) {
      progress.status = 'error'
      progress.message = error instanceof Error ? error.message : 'Erro desconhecido'
      
      if (onProgress) {
        onProgress({ ...progress })
      }

      return {
        success: false,
        total,
        imported: success,
        errors: [...errors, {
          row: 0,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }],
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Gera template CSV para clientes
   */
  generateClientTemplate(): string {
    const headers = ['name', 'email', 'password', 'age', 'role', 'status', 'perfilFamilia']
    const example = [
      'João Silva',
      'joao@exemplo.com',
      'senha123',
      '35',
      'viewer',
      'active',
      'Casado com 2 filhos'
    ]

    return [headers.join(','), example.join(',')].join('\n')
  }

  /**
   * Gera template CSV para metas
   */
  generateGoalTemplate(): string {
    const headers = ['clientEmail', 'type', 'amount', 'targetAt']
    const example = [
      'joao@exemplo.com',
      'Aposentadoria',
      '1000000',
      '2040-12-31'
    ]

    return [headers.join(','), example.join(',')].join('\n')
  }
}
