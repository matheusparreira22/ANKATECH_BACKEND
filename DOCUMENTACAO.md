# ANKATECH_BACKEND - Documentação do Projeto

## Visão Geral
Este projeto é uma API backend desenvolvida em Node.js com TypeScript, utilizando o framework Fastify. O objetivo é fornecer uma base robusta para autenticação, gerenciamento de clientes, metas financeiras, carteiras, eventos, simulações e perfis de seguro.

## Principais Tecnologias Utilizadas
- **Node.js** + **TypeScript**
- **Fastify** (framework web)
- **Prisma ORM** (acesso ao banco de dados PostgreSQL)
- **JWT** (autenticação)
- **Swagger** (documentação automática de rotas)
- **CORS** (controle de acesso)

## Estrutura de Pastas
- `src/`
  - `index.ts`: Arquivo principal de inicialização do servidor Fastify.
  - `libs/prisma.ts`: Plugin para integração do Prisma com o Fastify.
  - `routes/`: Rotas da aplicação (ex: autenticação, clientes).
  - `services/`: Serviços de negócio (a serem implementados).
- `prisma/`
  - `schema.prisma`: Definição dos modelos de dados e relações.
  - `migrations/`: Migrações do banco de dados.

## Modelos de Dados (Prisma)
- **Client**: Usuário principal do sistema, com informações pessoais, autenticação, status, perfil familiar, metas, carteira, eventos, simulações e perfil de seguro.
- **Goal**: Metas financeiras associadas a um cliente.
- **Wallet**: Carteira financeira do cliente, com valor total e alocação.
- **Event**: Eventos financeiros do cliente (ex: receitas, despesas).
- **Simulation**: Simulações financeiras realizadas pelo cliente.
- **InsuranceProfile**: Perfil de seguro do cliente, com tipo e detalhes.

## Funcionalidades Implementadas
- Inicialização do servidor Fastify com plugins:
  - Swagger para documentação de rotas
  - JWT para autenticação
  - CORS para controle de acesso
  - Integração com Prisma via plugin
- Estruturação dos modelos de dados no Prisma para suportar as entidades principais do domínio financeiro.

## Scripts Úteis
- `npm run dev`: Inicia o servidor em modo desenvolvimento.
- `npm run build`: Compila o projeto TypeScript.
- `npm start`: Executa o servidor a partir do código compilado.
- `npm run prisma:migrate`: Executa as migrações do banco de dados.

## Observações
- O projeto está preparado para expansão, com rotas e serviços a serem implementados conforme as necessidades do domínio.
- O uso de Prisma facilita a manutenção e evolução do banco de dados.

---

Para dúvidas ou contribuições, consulte o README.md ou entre em contato com o responsável pelo projeto.
