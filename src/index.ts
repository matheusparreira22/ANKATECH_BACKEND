import Fastify from 'fastify'
// import swagger from '@fastify/swagger'
// import swaggerUi from '@fastify/swagger-ui'
import jwt from '@fastify/jwt'
import cors from '@fastify/cors'
import { prismaPlugin } from './libs/prisma'
import { authPlugin } from './libs/auth'

// Import routes
import authRoutes from './routes/auth'
import clientRoutes from './routes/clients'
import projectionRoutes from './routes/projections'
import suggestionRoutes from './routes/suggestions'
import importRoutes from './routes/import'
import insuranceRoutes from './routes/insurance'
// import goalRoutes from './routes/goals'
// import walletRoutes from './routes/wallet'
// import eventRoutes from './routes/events'

const app = Fastify({ logger: true })

// Register Swagger documentation
app.register(async function (fastify) {
  const swagger = await import('@fastify/swagger')
  const swaggerUi = await import('@fastify/swagger-ui')

  await fastify.register(swagger.default, {
    swagger: {
      info: {
        title: 'ANKATECH Backend API',
        description: 'API para sistema de planejamento financeiro',
        version: '0.5.0'
      },
      host: 'localhost:3000',
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'JWT token. Formato: Bearer <token>'
        }
      }
    }
  })

  await fastify.register(swaggerUi.default, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header
  })
})

app.register(jwt, { secret: process.env.JWT_SECRET || 'changeme' })
app.register(cors, { origin: '*' })
// Rate limiting (temporariamente desabilitado por problemas de compatibilidade)
// TODO: Implementar rate limiting com versão compatível do Fastify

app.register(prismaPlugin)
app.register(authPlugin)

// Register routes
app.register(authRoutes, { prefix: '/api/auth' })
app.register(clientRoutes, { prefix: '/api' })
app.register(projectionRoutes, { prefix: '/api' })
app.register(suggestionRoutes, { prefix: '/api' })
app.register(importRoutes, { prefix: '/api' })
app.register(insuranceRoutes, { prefix: '/api' })
// app.register(goalRoutes, { prefix: '/api' })
// app.register(walletRoutes, { prefix: '/api' }) // Temporariamente desabilitado
// app.register(eventRoutes, { prefix: '/api' }) // Temporariamente desabilitado

// Health check endpoint
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

const start = async () => {
  try {
    const port = Number(process.env.PORT || 3000)
    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`Server running on http://localhost:${port}`)
    app.log.info(`API documentation available at http://localhost:${port}/docs`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()