import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import jwt from '@fastify/jwt'
import cors from '@fastify/cors'
import { prismaPlugin } from './libs/prisma'

const app = Fastify({ logger: true })

app.register(swagger, { /* config */ })
app.register(jwt, { secret: process.env.JWT_SECRET || 'changeme' })
app.register(cors, { origin: '*' })
app.register(prismaPlugin)

const start = async () => {
  try {
    const port = Number(process.env.PORT || 3000)
    await app.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()