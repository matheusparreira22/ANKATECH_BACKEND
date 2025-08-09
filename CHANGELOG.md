# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.2.0] - 2024-01-09

### ✨ Adicionado
- **Sistema de Autenticação JWT completo**
  - Registro de usuários com validação
  - Login com geração de token JWT
  - Middleware de autenticação para rotas protegidas
  - Endpoint de perfil do usuário (`/api/auth/me`)

- **Sistema de Autorização baseado em Roles**
  - Role `advisor`: acesso completo (leitura e escrita)
  - Role `viewer`: acesso somente leitura
  - Middleware de autorização por endpoint

- **CRUD completo de Clientes**
  - Listagem com paginação (`GET /api/clients`)
  - Busca por ID com dados relacionados (`GET /api/clients/:id`)
  - Atualização (apenas advisors) (`PUT /api/clients/:id`)
  - Exclusão (apenas advisors) (`DELETE /api/clients/:id`)

- **Validação robusta com Zod v4**
  - Schemas de validação para todos os endpoints
  - Middleware de validação customizado
  - Tratamento de erros de validação consistente

- **Segurança implementada**
  - Hash de senhas com bcrypt (salt rounds: 10)
  - Tokens JWT com payload customizado
  - Validação de entrada em todos os endpoints

- **Testes automatizados**
  - 19 testes unitários com Jest e Supertest
  - Cobertura de 80.11% (acima do objetivo de 80%)
  - Testes de autenticação e CRUD de clientes
  - Testes de autorização (advisor vs viewer)
  - Limpeza automática do banco entre testes

- **Infraestrutura melhorada**
  - Servidor Fastify configurado na porta 3000
  - Health check endpoint (`/health`)
  - Logs estruturados do Fastify
  - CORS configurado para desenvolvimento

### 🔧 Alterado
- Atualizado `package.json` com novas dependências
- Configurado `tsconfig.json` para incluir testes
- Melhorado `docker-compose.yml` para desenvolvimento

### 📚 Documentação
- Atualizado `README.md` com instruções completas
- Atualizado `DOCUMENTACAO.md` com detalhes técnicos
- Adicionado `CHANGELOG.md` para rastrear mudanças

### 🧪 Testes
- Configurado Jest com suporte a ESM e TypeScript
- Implementados testes para autenticação
- Implementados testes para CRUD de clientes
- Configurada cobertura de código

## [0.1.0] - 2024-01-08

### ✨ Adicionado
- **Configuração inicial do projeto**
  - Estrutura base com TypeScript e Fastify
  - Configuração do Prisma ORM
  - Modelos de dados definidos no schema
  - Docker Compose para PostgreSQL
  - ESLint e Prettier configurados

- **Modelos de dados Prisma**
  - Client (usuários/clientes)
  - Goal (metas financeiras)
  - Wallet (carteiras de investimento)
  - Event (eventos financeiros)
  - Simulation (simulações)
  - InsuranceProfile (perfis de seguro)

- **Infraestrutura base**
  - Servidor Fastify básico
  - Plugin Prisma para integração
  - Configuração de CORS
  - Scripts de desenvolvimento

### 📚 Documentação
- README.md inicial
- DOCUMENTACAO.md com visão geral
- Plano de ação de 5 dias definido

---

## Legenda

- ✨ **Adicionado**: para novas funcionalidades
- 🔧 **Alterado**: para mudanças em funcionalidades existentes
- 🐛 **Corrigido**: para correções de bugs
- 🗑️ **Removido**: para funcionalidades removidas
- 🔒 **Segurança**: para correções de vulnerabilidades
- 📚 **Documentação**: para mudanças na documentação
- 🧪 **Testes**: para adições ou mudanças em testes
