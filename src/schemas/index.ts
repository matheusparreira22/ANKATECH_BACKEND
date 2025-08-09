import { z } from 'zod'

// Client schemas
export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  age: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  perfilFamilia: z.string().optional(),
  role: z.enum(['advisor', 'viewer']).default('viewer')
})

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  age: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  perfilFamilia: z.string().optional(),
  role: z.enum(['advisor', 'viewer']).optional()
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
})

// Goal schemas
export const createGoalSchema = z.object({
  clientId: z.string().cuid('Invalid client ID'),
  type: z.string().min(1, 'Goal type is required'),
  amount: z.number().positive('Amount must be positive'),
  targetAt: z.string().datetime('Invalid target date')
})

export const updateGoalSchema = z.object({
  type: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  targetAt: z.string().datetime().optional()
})

// Wallet schemas
export const createWalletSchema = z.object({
  clientId: z.string().cuid('Invalid client ID'),
  totalValue: z.number().positive('Total value must be positive'),
  allocation: z.record(z.string(), z.number().min(0).max(100))
    .refine(
      (allocation) => {
        const total = Object.values(allocation).reduce((sum, val) => sum + val, 0)
        return Math.abs(total - 100) < 0.01 // Allow for small floating point errors
      },
      'Allocation percentages must sum to 100%'
    )
})

export const updateWalletSchema = z.object({
  totalValue: z.number().positive().optional(),
  allocation: z.record(z.string(), z.number().min(0).max(100))
    .refine(
      (allocation) => {
        const total = Object.values(allocation).reduce((sum, val) => sum + val, 0)
        return Math.abs(total - 100) < 0.01
      },
      'Allocation percentages must sum to 100%'
    ).optional()
})

// Event schemas
export const createEventSchema = z.object({
  clientId: z.string().cuid('Invalid client ID'),
  type: z.string().min(1, 'Event type is required'),
  value: z.number('Value must be a number'),
  frequency: z.enum(['once', 'monthly', 'yearly']).optional(),
  date: z.string().datetime().optional()
})

export const updateEventSchema = z.object({
  type: z.string().min(1).optional(),
  value: z.number().optional(),
  frequency: z.enum(['once', 'monthly', 'yearly']).optional(),
  date: z.string().datetime().optional()
})

// Common schemas
export const idParamSchema = z.object({
  id: z.string().cuid('Invalid ID format')
})

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10)
})

// Type exports
export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>
export type CreateWalletInput = z.infer<typeof createWalletSchema>
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>
export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type IdParam = z.infer<typeof idParamSchema>
export type PaginationQuery = z.infer<typeof paginationSchema>
