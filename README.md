# ANKATECH Backend

🚀 **API Backend para Planejamento Financeiro e Gestão Patrimonial**

Sistema completo com autenticação JWT, autorização baseada em roles, CRUD de clientes, validação robusta e testes automatizados.

## ✨ Status do Projeto

- ✅ **Dia 1**: Configuração inicial e arquitetura
- ✅ **Dia 2**: Autenticação, CRUD de clientes, testes
- ✅ **Dia 3**: Motor de projeção patrimonial e sistema de sugestões (79.32% cobertura)
- ⏳ **Dia 4**: SSE para importação de CSV (próximo)

## 🛠️ Pré-requisitos

- **Node.js 20** ou superior
- **npm** ou **yarn**
- **Docker** e **Docker Compose** (para PostgreSQL)
- **Git**

## 🚀 Instalação e Configuração

### 1. Clone o repositório
```bash
git clone <repository-url>
cd ANKATECH_BACKEND
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o banco de dados
```bash
# Subir PostgreSQL com Docker
docker-compose up -d

# Executar migrações
npm run prisma:migrate
```

### 4. Inicie o servidor
```bash
# Desenvolvimento (com hot reload)
npm run dev

# O servidor estará rodando em http://localhost:3000
```

### 5. Verificar funcionamento
```bash
# Health check
curl http://localhost:3000/health

# Executar testes
npm test
```


## 📡 API Endpoints

### 🔐 **Autenticação** (`/api/auth`) ✅ **IMPLEMENTADO**
```bash
POST /api/auth/register    # Registrar usuário
POST /api/auth/login       # Login e obter JWT token
GET  /api/auth/me         # Perfil do usuário logado
```

### 👥 **Clientes** (`/api/clients`) ✅ **IMPLEMENTADO**
```bash
GET    /api/clients        # Listar clientes (paginado)
GET    /api/clients/:id    # Buscar cliente por ID
PUT    /api/clients/:id    # Atualizar cliente (advisor only)
DELETE /api/clients/:id    # Deletar cliente (advisor only)
```

### 🎯 **Metas** (`/api/goals`) ⏳ **PREPARADO**
```bash
GET    /api/goals          # Listar metas
POST   /api/goals          # Criar meta
GET    /api/goals/:id      # Buscar meta por ID
PUT    /api/goals/:id      # Atualizar meta
DELETE /api/goals/:id      # Deletar meta
```

### 💼 **Carteiras** (`/api/wallets`) ⏳ **PREPARADO**
```bash
POST   /api/wallets                # Criar/atualizar carteira
GET    /api/wallets/client/:id     # Buscar carteira por cliente
PUT    /api/wallets/:id            # Atualizar carteira
DELETE /api/wallets/:id            # Deletar carteira
```

### 📊 **Eventos** (`/api/events`) ⏳ **PREPARADO**
```bash
GET    /api/events         # Listar eventos
POST   /api/events         # Criar evento
GET    /api/events/:id     # Buscar evento por ID
PUT    /api/events/:id     # Atualizar evento
DELETE /api/events/:id     # Deletar evento
```

### 🔮 **Projeções** (`/api/projections`) ✅ **IMPLEMENTADO**
```bash
GET    /api/projections/client/:id              # Projeção completa do cliente
GET    /api/projections/client/:id/annual       # Projeção anual simplificada
POST   /api/projections/simulate                # Simulação com parâmetros customizados
POST   /api/projections/client/:id/save         # Salvar simulação
GET    /api/projections/client/:id/simulations  # Listar simulações salvas
GET    /api/projections/simulations/:id         # Obter simulação específica
DELETE /api/projections/simulations/:id         # Deletar simulação
```

### 💡 **Sugestões** (`/api/suggestions`) ✅ **IMPLEMENTADO**
```bash
GET    /api/suggestions/client/:id                    # Análise completa e sugestões
GET    /api/suggestions/client/:id/summary            # Resumo das sugestões
GET    /api/suggestions/client/:id/alignment          # Análise de alinhamento
POST   /api/suggestions/client/:id/simulate           # Simular impacto de sugestão
GET    /api/suggestions/client/:id/category/:category # Sugestões por categoria
GET    /api/suggestions/stats                         # Estatísticas gerais
```

### 🔧 **Utilitários** ✅ **IMPLEMENTADO**
```bash
GET /health               # Health check do sistema
```

## 🏗️ Estrutura do Projeto

```
ANKATECH_BACKEND/
├── docker-compose.yml          # PostgreSQL containerizado
├── package.json               # Dependências e scripts
├── tsconfig.json              # Configuração TypeScript
├── jest.config.mjs            # Configuração de testes
├── .eslintrc.json             # Linting rules
├── prisma/
│   ├── schema.prisma          # Modelos de dados
│   └── migrations/            # Migrações do banco
├── src/
│   ├── index.ts              # Servidor principal
│   ├── libs/
│   │   ├── prisma.ts         # Plugin Prisma
│   │   ├── auth.ts           # Middleware JWT ✅
│   │   └── validation.ts     # Validação Zod ✅
│   ├── routes/
│   │   ├── auth.ts           # Autenticação ✅
│   │   ├── clients.ts        # CRUD clientes ✅
│   │   ├── goals.ts          # CRUD metas ⏳
│   │   ├── wallet.ts         # CRUD carteiras ⏳
│   │   └── events.ts         # CRUD eventos ⏳
│   ├── schemas/
│   │   └── index.ts          # Schemas Zod ✅
│   └── services/             # Lógica de negócio (futuro)
└── tests/
    ├── auth.test.ts          # Testes autenticação ✅
    ├── clients.test.ts       # Testes clientes ✅
    └── setup.ts              # Setup de testes ✅
```

## 🚀 Scripts Disponíveis

```bash
npm run dev                   # Servidor desenvolvimento (hot reload)
npm run build                # Compilar para produção
npm start                    # Executar servidor compilado
npm test                     # Executar testes (19 testes, 80.11% cobertura)
npm test -- --coverage      # Testes com relatório de cobertura
npm run lint                 # Verificar código com ESLint
npm run prisma:migrate       # Executar migrações do banco
```

## 🛡️ Sistema de Autorização

### **Roles Implementados:**
- **`advisor`**: Acesso completo (leitura e escrita)
- **`viewer`**: Acesso somente leitura

### **Exemplo de Uso:**
```bash
# 1. Registrar advisor
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@test.com","password":"123456","role":"advisor"}'

# 2. Login e obter token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"123456"}'

# 3. Usar token nas requisições
curl -X GET http://localhost:3000/api/clients \
  -H "Authorization: Bearer <seu-jwt-token>"
```

## 🧪 Testes e Qualidade

- **34 testes unitários** implementados
- **79.32% de cobertura** (próximo ao objetivo de 80%)
- **Jest + Supertest** para testes de API
- **Testes de projeções e sugestões** incluídos
- **Limpeza automática** do banco entre testes
- **TypeScript strict mode** habilitado

## 🔧 Tecnologias Utilizadas

- **Node.js 20** + **TypeScript**
- **Fastify 4** (framework web)
- **Prisma ORM** + **PostgreSQL 15**
- **JWT** (autenticação)
- **Zod v4** (validação)
- **bcrypt** (hash de senhas)
- **Jest** (testes)
- **Docker Compose** (banco)

## 📊 Métricas de Desenvolvimento

- ✅ **Cobertura de Testes**: 79.32%
- ✅ **Testes Passando**: 34/34 (100%)
- ✅ **Endpoints Funcionais**: 21 endpoints
- ✅ **TypeScript**: Strict mode
- ✅ **ESLint**: Configurado
- ✅ **Segurança**: JWT + bcrypt + validação

## 📄 Licença

Este projeto é privado e confidencial.
