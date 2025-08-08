# ANKATECH Backend

Backend application for ANKATECH project.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your database connection in `.env`

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```


## Endpoints Planejados

### Autenticação
- `POST /auth/login` — Login do usuário e geração de token JWT
- `POST /auth/register` — Cadastro de novo usuário (advisor/viewer)

### Clients
- `GET /clients` — Listar todos os clientes
- `GET /clients/:id` — Buscar cliente por ID
- `POST /clients` — Criar novo cliente
- `PUT /clients/:id` — Atualizar dados do cliente
- `DELETE /clients/:id` — Remover cliente

### Goals
- `GET /clients/:clientId/goals` — Listar metas do cliente
- `POST /clients/:clientId/goals` — Criar meta para cliente
- `PUT /goals/:id` — Atualizar meta
- `DELETE /goals/:id` — Remover meta

### Wallet
- `GET /clients/:clientId/wallet` — Consultar carteira do cliente
- `POST /clients/:clientId/wallet` — Criar/atualizar carteira

### Events
- `GET /clients/:clientId/events` — Listar eventos do cliente
- `POST /clients/:clientId/events` — Registrar novo evento
- `PUT /events/:id` — Atualizar evento
- `DELETE /events/:id` — Remover evento

### Simulations
- `GET /clients/:clientId/simulations` — Listar simulações do cliente
- `POST /clients/:clientId/simulations` — Criar nova simulação

### InsuranceProfile
- `GET /clients/:clientId/insurance-profile` — Consultar perfil de seguro
- `POST /clients/:clientId/insurance-profile` — Criar/atualizar perfil de seguro

### Utilitários
- `GET /docs` — Documentação Swagger

---

## Project Structure

```
backend/
├─ docker-compose.yml
├─ package.json
├─ tsconfig.json
├─ .eslintrc.json
├─ .gitignore
├─ .env.example
├─ README.md
├─ prisma/
│  └─ schema.prisma
└─ src/
   ├─ index.ts
   ├─ libs/
   │  └─ prisma.ts
   ├─ routes/
   │  ├─ auth.ts        # (será criado no Dia 2)
   │  └─ clients.ts     # (será criado no Dia 2)
   └─ services/         # (será usado a partir do Dia 3)
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## Technologies Used

- Node.js
- TypeScript
- Fastify
- Prisma
- PostgreSQL

## License

This project is private and confidential.
